"""Account routes, mounted at `/api/auth/` by `lefoyer/urls.py`.

`login/` is **gone**. It pointed at a `LoginView` whose entire body was
`return Response(status=404)` with a comment saying the real implementation is
`CustomTokenObtainPairView`, mounted separately at `/api/token/`. Publishing a
route that answers 404 by design is worse than not publishing it: it looks like
a deployment fault. Clients log in at `POST /api/token/` (§2b #28).
"""
from django.urls import path

from .views import (
    LogoutView,
    MeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    RegisterView,
    ResendVerificationView,
    VerifyEmailView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('me/', MeView.as_view(), name='me'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password_reset'),
    path(
        'password-reset/confirm/<uidb64>/<token>/',
        PasswordResetConfirmView.as_view(),
        name='password_reset_confirm',
    ),
    path('verify-email/<str:token>/', VerifyEmailView.as_view(), name='verify_email'),
    path(
        'resend-verification/',
        ResendVerificationView.as_view(),
        name='resend_verification',
    ),
]
