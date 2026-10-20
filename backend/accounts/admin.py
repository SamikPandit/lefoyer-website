"""User admin.

Two operational needs this had to meet:

* **A support agent must be able to resend a verification email.** Until now the
  only way to rescue a customer whose link never arrived was to hand-edit
  `email_verification_token` in this form — which the form happily allowed, and
  which produced a token nobody could give the customer, with no sent-at stamp.
* **`email_verification_token` must be read-only.** It is a credential. An
  editable text box for it invites exactly the hand-editing above, and an
  accidental paste into the wrong row silently breaks a live verification link
  (the column is unique, so it can also raise an opaque IntegrityError on save).

`email_verified_at` is shown read-only beside `is_email_verified` so ops can see
at a glance which accounts actually clicked a link and which were grandfathered
to verified wholesale by migration 0002 (those have the flag and a NULL
timestamp).
"""
from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User
from .tasks import send_verification_email_task


class UserAdmin(BaseUserAdmin):
    list_display = (
        'email', 'first_name', 'last_name', 'is_email_verified',
        'email_verified_at', 'marketing_consent', 'is_staff', 'date_joined',
    )
    list_filter = (
        'is_email_verified', 'marketing_consent', 'is_staff', 'is_superuser',
        'is_active',
    )
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    actions = ('resend_verification_email',)

    readonly_fields = (
        'email_verification_token',
        'email_verification_sent_at',
        'email_verified_at',
        'terms_accepted_at',
        'marketing_consent_at',
        'last_login',
        'date_joined',
    )

    fieldsets = BaseUserAdmin.fieldsets + (
        ('Email verification', {
            'fields': (
                'is_email_verified',
                'email_verified_at',
                'email_verification_sent_at',
                'email_verification_token',
            ),
            'description': (
                'A verified account with an empty "verified at" was granted the '
                'flag by migration accounts.0002, not by clicking a link. The '
                'token is read-only: use the "Resend verification email" action '
                'to issue a new one.'
            ),
        }),
        ('Contact and consent', {
            'fields': (
                'phone_number',
                'terms_accepted_at',
                'marketing_consent',
                'marketing_consent_at',
            ),
        }),
    )

    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ('Additional Info', {
            'fields': ('email', 'first_name', 'last_name', 'phone_number'),
        }),
    )

    @admin.action(description='Resend verification email')
    def resend_verification_email(self, request, queryset):
        """Issue a fresh token for each unverified user and mail it.

        Uses the same single issuer (`User.issue_verification_token`) and the
        same task as the public endpoints, so an admin-triggered email can never
        carry a token that disagrees with the row.
        """
        sent = failed = skipped = 0
        for user in queryset:
            if user.is_email_verified:
                skipped += 1
                continue
            if not user.email:
                failed += 1
                continue
            token = user.issue_verification_token()
            try:
                send_verification_email_task.delay(user.id, token)
                sent += 1
            except Exception as exc:
                try:
                    from .email_service import send_verification_email

                    send_verification_email(user, token)
                    sent += 1
                except Exception:
                    failed += 1
                    self.message_user(
                        request,
                        f'Could not send a verification email to {user.email}: {exc}',
                        level=messages.ERROR,
                    )

        if sent:
            self.message_user(
                request,
                f'Verification email sent to {sent} user(s).',
                level=messages.SUCCESS,
            )
        if skipped:
            self.message_user(
                request,
                f'{skipped} user(s) skipped — already verified.',
                level=messages.INFO,
            )
        if failed:
            self.message_user(
                request,
                f'{failed} user(s) could not be emailed (no address, or the mail '
                'backend rejected it). See the server log.',
                level=messages.WARNING,
            )


admin.site.register(User, UserAdmin)
