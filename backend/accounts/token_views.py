"""
Custom JWT token views that enforce email verification before issuing tokens.
Supports login by email (looks up username from email).
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model

User = get_user_model()


class CustomTokenObtainPairView(TokenObtainPairView):
    """
    Custom token view that:
    1. Allows login by email (translates email → username for JWT)
    2. Checks email verification status before issuing tokens
    """

    def post(self, request, *args, **kwargs):
        # The frontend sends { username: email, password }
        # We need to look up the actual username from the email
        username_or_email = request.data.get('username', '')

        # If it looks like an email, look up the user's actual username
        actual_username = username_or_email
        user_lookup = None
        if '@' in username_or_email:
            try:
                user_lookup = User.objects.get(email=username_or_email)
                actual_username = user_lookup.username
            except User.DoesNotExist:
                # Let the parent handle invalid credentials
                pass

        # Replace username in request data with the actual username
        mutable_data = request.data.copy()
        mutable_data['username'] = actual_username
        request._full_data = mutable_data

        serializer = self.get_serializer(data=mutable_data)

        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            raise InvalidToken(e.args[0])

        # After validation, check email verification
        # Use the user we already looked up, or look up by username
        if user_lookup is None:
            try:
                user_lookup = User.objects.get(username=actual_username)
            except User.DoesNotExist:
                pass

        if user_lookup and not user_lookup.is_email_verified:
            return Response(
                {
                    'detail': 'Please verify your email address before logging in. Check your inbox for a verification link.',
                    'code': 'email_not_verified',
                    'email': user_lookup.email,
                },
                status=status.HTTP_403_FORBIDDEN
            )

        return Response(serializer.validated_data, status=status.HTTP_200_OK)
