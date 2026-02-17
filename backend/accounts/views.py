from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from .serializers import UserSerializer, PasswordResetSerializer
from django.contrib.auth import get_user_model
from django.utils.http import urlsafe_base64_decode
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_str
from .tasks import send_verification_email_task, send_welcome_email_task

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = UserSerializer

class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request, format=None):
        # This view is now handled by djangorestframework-simplejwt
        # The logic is kept here for reference, but the actual token generation
        # is done by CustomTokenObtainPairView in token_views.py.
        return Response(status=status.HTTP_404_NOT_FOUND)

class LogoutView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, format=None):
        # On the client side, the token should be discarded.
        # The server does not need to do anything.
        return Response(status=status.HTTP_200_OK)

class PasswordResetRequestView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    serializer_class = PasswordResetSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({'detail': 'Password reset email has been sent.'}, status=status.HTTP_200_OK)

class PasswordResetConfirmView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request, uidb64, token, *args, **kwargs):
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is not None and default_token_generator.check_token(user, token):
            new_password = request.data.get('new_password')
            if new_password:
                user.set_password(new_password)
                user.save()
                return Response({'detail': 'Password has been reset successfully.'}, status=status.HTTP_200_OK)
            return Response({'detail': 'New password not provided.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'detail': 'Invalid reset link.'}, status=status.HTTP_400_BAD_REQUEST)


class VerifyEmailView(APIView):
    """Verify user email using the token sent via email."""
    permission_classes = (permissions.AllowAny,)

    def get(self, request, token, *args, **kwargs):
        try:
            user = User.objects.get(email_verification_token=token)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Invalid or expired verification link.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if user.is_email_verified:
            return Response(
                {'detail': 'Email is already verified.'},
                status=status.HTTP_200_OK
            )

        user.is_email_verified = True
        user.email_verification_token = None  # Invalidate the token
        user.save(update_fields=['is_email_verified', 'email_verification_token'])

        # Send welcome email asynchronously
        send_welcome_email_task.delay(user.id)

        return Response(
            {'detail': 'Email verified successfully! You can now log in.'},
            status=status.HTTP_200_OK
        )


class ResendVerificationView(APIView):
    """Resend email verification link."""
    permission_classes = (permissions.AllowAny,)

    def post(self, request, *args, **kwargs):
        email = request.data.get('email')
        if not email:
            return Response(
                {'detail': 'Email is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # Don't reveal whether user exists
            return Response(
                {'detail': 'If an account with this email exists, a verification email has been sent.'},
                status=status.HTTP_200_OK
            )

        if user.is_email_verified:
            return Response(
                {'detail': 'Email is already verified.'},
                status=status.HTTP_200_OK
            )

        from .email_service import generate_verification_token
        token = generate_verification_token()
        user.email_verification_token = token
        user.save(update_fields=['email_verification_token'])
        send_verification_email_task.delay(user.id)

        return Response(
            {'detail': 'Verification email has been sent. Please check your inbox.'},
            status=status.HTTP_200_OK
        )
