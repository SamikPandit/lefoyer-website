"""Account serializers.

Registration (§2b #29) and password reset (§2b #32).

WHAT CHANGED AND WHY
--------------------
* **The verification token is generated in exactly one place.** This file used
  to generate token A, save it, and enqueue the task; `email_service` then
  generated token B, overwrote the row and mailed B (C-25). It now calls
  `User.issue_verification_token()` — the single issuer — and passes that token
  to the task, which passes it to a sender that cannot mutate the user.
* **The enqueue is wrapped, with an inline-send fallback, and its outcome is
  reported.** `POST /api/auth/register/` returns `verification_email_sent`, so
  WP-12's "check your inbox" screen can say "we could not send the email —
  resend, or contact support" instead of cheerfully telling the user to go and
  look in an inbox that will stay empty. Before, a broker outage or an SMTP
  failure still produced a 201 with a success message.
* **Passwords are validated.** `password` was a bare `CharField`, so `"a"` was
  an acceptable password: `create_user` hashes whatever it is handed and
  `AUTH_PASSWORD_VALIDATORS` is only consulted by code that calls
  `validate_password`, which nothing did.
* **Terms acceptance is required and timestamped**, and marketing consent is a
  separate, independently-timestamped opt-in — signing up is not consent to be
  marketed to.
* **`PasswordResetSerializer` no longer confirms whether an address is
  registered.** "User with this email does not exist." turned the endpoint into
  an account-enumeration oracle: anyone could test an address list against it.
  It now always validates and the view always answers with the same neutral
  200 (§2b #32).
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import serializers
import logging

from .email_service import site_url
from .tasks import send_password_reset_email_task, send_verification_email_task

logger = logging.getLogger(__name__)
User = get_user_model()

#: `username` mirrors `email` (the project authenticates by email but kept
#: Django's username column), and `username` is 150 characters. An address
#: longer than that would be silently truncated on MySQL or rejected on
#: PostgreSQL *after* the user had submitted the form, so it is rejected up
#: front with an explanation.
USERNAME_MAX_LENGTH = 150


class UserSerializer(serializers.ModelSerializer):
    """`POST /api/auth/register/` — §2b #29."""

    password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)
    terms_accepted = serializers.BooleanField(write_only=True, required=True)
    marketing_consent = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = User
        fields = (
            'id', 'email', 'first_name', 'last_name', 'phone_number',
            'password', 'terms_accepted', 'marketing_consent',
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        #: Set by `create()`. The view reads it to answer honestly about whether
        #: the verification email actually went out.
        self.verification_email_sent = False

    # ------------------------------------------------------------- validation
    def validate_email(self, value):
        value = (value or '').strip()
        if len(value) > USERNAME_MAX_LENGTH:
            raise serializers.ValidationError(
                f'Please use an email address of at most {USERNAME_MAX_LENGTH} '
                'characters.'
            )
        # `__iexact`: the column is unique but case-sensitive on PostgreSQL, so
        # without this "Sam@x.com" and "sam@x.com" would both register and then
        # race each other at login.
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value.lower()

    def validate_terms_accepted(self, value):
        if value is not True:
            raise serializers.ValidationError(
                'Please accept the terms and conditions to create an account.'
            )
        return value

    def validate(self, attrs):
        password = attrs.get('password')
        if password:
            # A throwaway instance, unsaved, so UserAttributeSimilarityValidator
            # can compare the password against the name and email being
            # submitted ("sam@x.com" / "samsamsam" is rejected).
            probe = User(
                username=attrs.get('email', ''),
                email=attrs.get('email', ''),
                first_name=attrs.get('first_name', ''),
                last_name=attrs.get('last_name', ''),
            )
            try:
                validate_password(password, probe)
            except DjangoValidationError as exc:
                raise serializers.ValidationError({'password': list(exc.messages)})
        return attrs

    # ----------------------------------------------------------------- create
    def create(self, validated_data):
        terms_accepted = validated_data.pop('terms_accepted', False)
        marketing_consent = validated_data.pop('marketing_consent', False)
        email = validated_data['email']

        with transaction.atomic():
            user = User.objects.create_user(
                username=email,  # username mirrors the email, which is the login
                password=validated_data['password'],
                email=email,
                first_name=validated_data.get('first_name', ''),
                last_name=validated_data.get('last_name', ''),
                phone_number=validated_data.get('phone_number', ''),
            )
            user.record_consent(
                terms_accepted=terms_accepted, marketing_consent=marketing_consent
            )
            # The one and only place a verification token is minted.
            token = user.issue_verification_token(save=False)
            user.save(update_fields=[
                'terms_accepted_at', 'marketing_consent', 'marketing_consent_at',
                'email_verification_token', 'email_verification_sent_at',
            ])
            # `on_commit` so no email can ever advertise a token that a rolled
            # back transaction never persisted. Outside an atomic request (the
            # default: ATOMIC_REQUESTS is off) the callback runs the instant this
            # block exits, which is still before the view builds its response —
            # so `verification_email_sent` is known and truthful.
            transaction.on_commit(lambda: self._dispatch_verification_email(user, token))

        return user

    def _dispatch_verification_email(self, user, token):
        """Queue the verification email; fall back to sending it inline.

        Three outcomes, all of them reported rather than hidden:
          * queued (or, with CELERY_TASK_ALWAYS_EAGER, sent) → True
          * broker unreachable, inline SMTP send succeeded → True
          * both failed → False, and the API says so in the response.
        """
        try:
            send_verification_email_task.delay(user.id, token)
            self.verification_email_sent = True
            return
        except Exception as exc:
            logger.error(
                'Could not queue the verification email for %s (%s). '
                'Falling back to an inline send.', user.email, exc,
            )

        try:
            from .email_service import send_verification_email

            send_verification_email(user, token)
            self.verification_email_sent = True
        except Exception as exc:
            logger.error(
                'Inline verification email to %s also failed: %s', user.email, exc
            )
            self.verification_email_sent = False


class MeSerializer(serializers.ModelSerializer):
    """`GET /api/auth/me/` — §2b #27.

    An explicit field list: never `__all__` on the user model, which would
    expose `password`, `email_verification_token` and the permission graph.
    """

    class Meta:
        model = User
        fields = (
            'id', 'email', 'first_name', 'last_name', 'phone_number',
            'is_email_verified', 'date_joined',
        )
        read_only_fields = fields


class PasswordResetSerializer(serializers.Serializer):
    """`POST /api/auth/password-reset/` — §2b #32.

    Deliberately *does not* check whether the address exists. The view answers
    with one neutral 200 either way.
    """

    email = serializers.EmailField(required=True)

    def validate_email(self, value):
        return (value or '').strip().lower()

    def save(self):
        email = self.validated_data['email']
        # `.first()` not `.get()`: a duplicate address (which migration 0003 is
        # about to make impossible, but which may exist on the production box
        # this runs against) must not raise MultipleObjectsReturned here.
        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            # Unknown address: do nothing, say nothing. The caller returns the
            # same body it would for a hit.
            logger.info('Password reset requested for an unregistered address.')
            return False

        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        # No `/#/`: App.jsx is a BrowserRouter now and the route is
        # `/reset-password/:uid/:token`. A fragment would never reach the router.
        reset_link = site_url(f'reset-password/{uid}/{token}')

        try:
            send_password_reset_email_task.delay(user.id, reset_link)
            return True
        except Exception as exc:
            logger.error(
                'Could not queue the password reset email for %s (%s). '
                'Falling back to an inline send.', user.email, exc,
            )

        try:
            from .email_service import send_password_reset_email

            send_password_reset_email(user, reset_link)
            return True
        except Exception as exc:
            # Never surfaced to the caller: whether the mail went out is not
            # something an unauthenticated requester may learn, because that
            # would reintroduce the enumeration oracle this endpoint just lost.
            logger.error('Inline password reset email to %s failed: %s', user.email, exc)
            return False


class SetNewPasswordSerializer(serializers.Serializer):
    """`POST /api/auth/password-reset/confirm/<uidb64>/<token>/`.

    The old view accepted `new_password` raw and called `set_password` on it, so
    a reset link could be used to set the password to `a` — a hole wide enough
    to walk around the registration validators through.
    """

    new_password = serializers.CharField(write_only=True, min_length=8, trim_whitespace=False)

    def __init__(self, *args, user=None, **kwargs):
        self.user = user
        super().__init__(*args, **kwargs)

    def validate_new_password(self, value):
        try:
            validate_password(value, self.user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value
