"""Account views — §2b #27, #29, #30, #31, #32.

LF-31's Definition of Done is "new users can sign up, receive the verification
email and successfully verify their accounts". Four things in this file stood in
the way, and all four are fixed here:

* `RegisterView` returned 201 whatever happened to the email. It now reports
  `verification_email_sent` (§2b #29) so the UI can tell the truth.
* `VerifyEmailView` nulled the token on success, which made the friendly
  "already verified" branch below it unreachable. A second click — or a mail
  scanner that prefetched the state-mutating GET before the human ever opened
  the message — therefore rendered "Verification Failed" for a perfectly good
  account (C-26). The token is no longer cleared, the window is actually
  enforced against `email_verification_sent_at`, and the response carries a
  machine-readable `code` so the page branches on data rather than on
  string-matching English.
* `ResendVerificationView` leaked account state three ways (unknown → one
  message, unverified → another, already verified → a third) and had no rate
  limit at all, so it was an open relay for mailbombing any address. One
  neutral body, one per-email throttle.
* `LoginView` is **deleted**. It returned a hardcoded 404 with a comment
  explaining that the real implementation lives in `token_views.py`; it was
  wired into `urls.py` as `/api/auth/login/`, so anything that found it saw an
  unexplained 404.
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from django.utils.http import urlsafe_base64_decode
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
import logging

from .serializers import (
    MeSerializer,
    PasswordResetSerializer,
    SetNewPasswordSerializer,
    UserSerializer,
)
from .tasks import send_verification_email_task, send_welcome_email_task
from .throttles import (
    EmailOnlyFloodThrottle,
    PasswordResetThrottle,
    RegisterThrottle,
    ResendVerificationThrottle,
    ThrottledWithRetryAfter,
)

logger = logging.getLogger(__name__)
User = get_user_model()

#: The single neutral answer `resend-verification/` gives for an unknown
#: address, a known-but-unverified address and an already-verified address.
#: Three different messages (what the old view returned) is an account
#: enumeration oracle with a friendly face.
NEUTRAL_RESEND_DETAIL = (
    'If an account with this email exists and still needs verifying, '
    'a new verification link is on its way. Please check your inbox, '
    'including the spam folder.'
)


class RetryAfterThrottleMixin:
    """Render 429s as `{detail, retry_after}` instead of prose-only."""

    def throttled(self, request, wait):
        raise ThrottledWithRetryAfter(wait=wait)


class RegisterView(RetryAfterThrottleMixin, generics.CreateAPIView):
    """`POST /api/auth/register/` — §2b #29."""

    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer
    throttle_classes = [RegisterThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        sent = bool(serializer.verification_email_sent)
        if sent:
            detail = (
                'Account created. We have emailed you a verification link — '
                'please click it to activate your account.'
            )
        else:
            # Honest, and actionable. The account exists; the email did not go
            # out. Telling the user to "check your inbox" here would send them
            # to watch an empty mailbox and then blame themselves.
            detail = (
                'Account created, but we could not send the verification email '
                'just now. Please use "Resend verification email", or contact '
                'support if it keeps failing.'
            )

        return Response(
            {
                'id': user.id,
                'email': user.email,
                'verification_email_sent': sent,
                'detail': detail,
            },
            status=status.HTTP_201_CREATED,
        )


class MeView(generics.RetrieveAPIView):
    """`GET /api/auth/me/` — §2b #27.

    `AuthContext` calls this on mount whenever a token exists, so a cached
    `user` in localStorage (notably a stale `is_email_verified`) cannot drive
    the UI.
    """

    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = MeSerializer

    def get_object(self):
        return self.request.user


class LogoutView(APIView):
    """Client-side token discard. Retained because the route is published."""

    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, format=None):
        return Response(status=status.HTTP_200_OK)


class PasswordResetRequestView(RetryAfterThrottleMixin, generics.GenericAPIView):
    """`POST /api/auth/password-reset/` — §2b #32.

    **Always** 200 with the same body. Whether the address is registered, and
    whether the mail actually went out, are both facts an unauthenticated caller
    may not learn.
    """

    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetSerializer
    throttle_classes = [PasswordResetThrottle, EmailOnlyFloodThrottle]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {
                'detail': 'If an account exists for that email address, '
                          'we have sent it a password reset link.'
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(generics.GenericAPIView):
    """`POST /api/auth/password-reset/confirm/<uidb64>/<token>/`."""

    permission_classes = (permissions.AllowAny,)
    serializer_class = SetNewPasswordSerializer

    def post(self, request, uidb64, token, *args, **kwargs):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is None or not default_token_generator.check_token(user, token):
            return Response(
                {
                    'detail': 'This password reset link is invalid or has expired. '
                              'Please request a new one.',
                    'code': 'invalid_reset_link',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SetNewPasswordSerializer(data=request.data, user=user)
        serializer.is_valid(raise_exception=True)

        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        # `default_token_generator` keys off the password hash, so changing the
        # password invalidates this link automatically — it cannot be replayed.
        return Response(
            {
                'detail': 'Your password has been reset. You can now sign in.',
                'code': 'password_reset',
            },
            status=status.HTTP_200_OK,
        )


class VerifyEmailView(APIView):
    """`GET /api/auth/verify-email/<token>/` — §2b #30.

    Returns a machine-readable `code`:
      * 200 `verified`         — just verified by this click
      * 200 `already_verified` — a second click, or a mail-scanner prefetch
      * 400 `invalid_token`    — no such token
      * 400 `token_expired`    — the token is past its window

    `already_verified` is a **200**, not an error: the account is in exactly the
    state the user wanted. The old code could never reach this branch, because
    it nulled the token the first time through.
    """

    permission_classes = (permissions.AllowAny,)

    def get(self, request, token, *args, **kwargs):
        user = User.objects.filter(email_verification_token=token).first()
        if user is None:
            return Response(
                {
                    'detail': 'This verification link is not valid. It may have '
                              'already been replaced by a newer one — request a '
                              'fresh link below.',
                    'code': 'invalid_token',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if user.is_email_verified:
            # Checked *before* expiry: an expired link on an already-verified
            # account is still good news, and telling that user their link
            # expired would send them round a loop for nothing.
            return Response(
                {
                    'detail': 'This email address is already verified. You can sign in.',
                    'code': 'already_verified',
                },
                status=status.HTTP_200_OK,
            )

        if user.is_verification_token_expired():
            expires_at = user.verification_token_expires_at
            return Response(
                {
                    'detail': 'This verification link has expired. '
                              'Enter your email address below and we will send you a new one.',
                    'code': 'token_expired',
                    'expired_at': expires_at.isoformat() if expires_at else None,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.mark_email_verified()

        # Best effort. A welcome email that fails must not turn a successful
        # verification into an error page.
        try:
            send_welcome_email_task.delay(user.id)
        except Exception as exc:
            logger.error('Could not dispatch the welcome email for %s: %s', user.email, exc)

        return Response(
            {
                'detail': 'Email verified. Welcome to Le foyeR. — you can now sign in.',
                'code': 'verified',
            },
            status=status.HTTP_200_OK,
        )


class ResendVerificationView(RetryAfterThrottleMixin, APIView):
    """`POST /api/auth/resend-verification/` — §2b #31.

    Throttled at `3/hour` **keyed on the submitted email** (plus a 60s cooldown
    that matches the UI's Resend button), and answering with one identical
    neutral body for unknown / unverified / already-verified addresses.
    """

    permission_classes = (permissions.AllowAny,)
    throttle_classes = [ResendVerificationThrottle, EmailOnlyFloodThrottle]

    def post(self, request, *args, **kwargs):
        email = request.data.get('email') if hasattr(request.data, 'get') else None
        email = (email or '').strip().lower() if isinstance(email, str) else ''
        if not email:
            return Response(
                {'detail': 'Please provide an email address.', 'code': 'email_required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        neutral = Response({'detail': NEUTRAL_RESEND_DETAIL}, status=status.HTTP_200_OK)

        user = User.objects.filter(email__iexact=email).first()
        if user is None or user.is_email_verified:
            # Same body, same status, same timing characteristics as a hit.
            return neutral

        token = user.issue_verification_token()
        try:
            send_verification_email_task.delay(user.id, token)
        except Exception as exc:
            logger.error(
                'Could not queue the resent verification email for %s (%s). '
                'Falling back to an inline send.', user.email, exc,
            )
            try:
                from .email_service import send_verification_email

                send_verification_email(user, token)
            except Exception as inner:
                # Still the neutral body: a caller must not be able to probe our
                # mail health, or the account's existence, from the response.
                logger.error(
                    'Inline resend of the verification email to %s failed: %s',
                    user.email, inner,
                )

        return neutral
