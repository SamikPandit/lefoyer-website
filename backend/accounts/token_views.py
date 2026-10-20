"""
`POST /api/token/` — login. §2b #28.

Three defects fixed, two of them user-visible as a mysterious logout:

1. **A wrong password escaped as a 401.** `api.js`'s interceptor treats *any*
   401 as an expired session: it tries a token refresh, fails, clears
   `authToken`/`refreshToken`/`user`/`cart` and dispatches `lefoyer:auth-expired`.
   So mistyping a password on the sign-in page logged the user out of the
   session they were not in, and wiped their cart. A failed login is a
   credential problem, not a session problem, so it now returns
   **400 `{code:'invalid_credentials'}`** (api.js already passes a 401 from
   `token/` through untouched; between them the cascade is closed from both
   ends).

2. **`User.objects.get(email=…)` 500s on a duplicate address.** Nothing stopped
   two accounts sharing an email until migration 0003, and the lookup raised
   `MultipleObjectsReturned` → 500. It is now `.filter(...).first()`, and the
   lookup is case-insensitive, so `Sam@x.com` signs in as `sam@x.com`.

3. **No `user` in the response.** `AuthContext.login()` wants the profile
   inline; without it, it has to fire a second `GET /api/auth/me/` before it can
   render anything personalised. The serializer below adds it, using the same
   `User.public_payload()` that `me/` serialises, so the two can never drift.

Note on ordering: credentials are validated **first**, and only then is email
verification checked. Reversing that would tell an attacker whether an address
is registered and unverified without knowing the password.
"""
from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
import logging

logger = logging.getLogger(__name__)
User = get_user_model()

INVALID_CREDENTIALS_DETAIL = (
    'We could not sign you in with that email and password. '
    'Please check them and try again.'
)


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds the `user` object to the `{access, refresh}` pair (§2b #28)."""

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = self.user.public_payload()
        return data


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Token view that:
    1. Allows login by email (translates email → username for JWT)
    2. Returns the user object alongside the token pair
    3. Refuses an unverified account with a machine-readable 403
    4. Returns 400, not 401, for bad credentials
    """

    serializer_class = CustomTokenObtainPairSerializer

    def post(self, request, *args, **kwargs):
        # The frontend sends { username: <email>, password }.
        username_or_email = request.data.get('username', '') or ''
        if not isinstance(username_or_email, str):
            username_or_email = str(username_or_email)

        actual_username = username_or_email
        user_lookup = None
        if '@' in username_or_email:
            # `.filter().first()`, never `.get()`: see note 2 in the module
            # docstring. Case-insensitive so the address the user typed need not
            # match the case they registered with.
            user_lookup = User.objects.filter(email__iexact=username_or_email).first()
            if user_lookup is not None:
                actual_username = user_lookup.username

        data = request.data.copy()
        data['username'] = actual_username

        serializer = self.get_serializer(data=data)

        try:
            serializer.is_valid(raise_exception=True)
        except AuthenticationFailed as exc:
            # SimpleJWT raises AuthenticationFailed (401) for a bad password, an
            # unknown user and an inactive account alike. All three are the same
            # thing to the person at the keyboard, and none of them is an
            # expired session.
            #
            # Its own wording ("No active account found with the given
            # credentials") is not passed through: to someone who simply
            # mistyped their password it reads as "your account is gone", and it
            # distinguishes an unknown address from a wrong password no better
            # than ours while sounding like it might.
            logger.info('Failed login for %r: %s', username_or_email, getattr(exc, 'detail', exc))
            return Response(
                {'code': 'invalid_credentials', 'detail': INVALID_CREDENTIALS_DETAIL},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except TokenError as exc:
            raise InvalidToken(exc.args[0])

        # Credentials are good. `serializer.user` is authoritative — prefer it
        # over the email lookup, which may have missed (login by username).
        user = getattr(serializer, 'user', None) or user_lookup

        if user is not None and not user.is_email_verified:
            return Response(
                {
                    'detail': 'Please verify your email address before logging in. '
                              'Check your inbox for a verification link.',
                    'code': 'email_not_verified',
                    'email': user.email,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(serializer.validated_data, status=status.HTTP_200_OK)
