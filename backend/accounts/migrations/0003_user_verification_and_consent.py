"""accounts 0003 — verification audit columns, consent columns, unique email.

READ BEFORE RUNNING THIS AGAINST PRODUCTION
-------------------------------------------
This migration makes `User.email` **unique**. Nothing has ever stopped two
accounts sharing an address, and `token_views.py` used to do
`User.objects.get(email=…)`, which means a duplicate was already serving 500s at
login. The production database may well hold duplicates.

So the first operation is a `RunPython` that *reads only* and **aborts the whole
migration with an actionable message naming the duplicates** if it finds any.
Because it runs first, and because the migration is atomic, an abort leaves the
schema exactly as it was — the failure mode is "nothing happened, here is the
list to clean up", not "half the columns exist and the deploy is wedged".

Operator procedure when it aborts:
  1. Decide which account in each group is the real one (most recent login,
     most orders — `Order.user_id` is the thing that actually matters).
  2. Re-point the loser's rows or delete the loser, then blank/alter the
     duplicate address.
  3. Re-run `migrate`.
Dry-run this on a production **dump** first; §5.2 lists that as mandatory.

`email_verified_at` is deliberately left NULL for the users that migration
`0002` granted `is_email_verified=True` en masse. That is the only thing that
keeps "this mailbox clicked a link" distinguishable from "this account predates
verification" going forward, and overwriting it with `now()` would manufacture
evidence of a verification that never happened. The second `RunPython` below
therefore writes nothing — it only reports how many such users exist, which
§5.2 names as a production fact we cannot see from here.
"""
from django.db import migrations, models
from django.db.models import Count


class DuplicateEmailsFound(Exception):
    """Raised to abort the migration before any schema change is applied."""


def _format_group(rows):
    return ', '.join(
        f'id={row["id"]} username={row["username"]!r} last_login={row["last_login"]}'
        for row in rows
    )


def abort_on_duplicate_emails(apps, schema_editor):
    """Refuse to continue if `email` cannot become unique."""
    User = apps.get_model('accounts', 'User')

    problems = []

    # 1. Exact duplicates — these are what the unique index will reject.
    duplicate_emails = list(
        User.objects.values('email')
        .annotate(n=Count('id'))
        .filter(n__gt=1)
        .order_by('-n', 'email')
        .values_list('email', 'n')
    )
    for email, count in duplicate_emails:
        rows = list(
            User.objects.filter(email=email)
            .order_by('id')
            .values('id', 'username', 'last_login')
        )
        label = repr(email) if email else "'' (no email address at all)"
        problems.append(f'  {label} is used by {count} accounts: {_format_group(rows)}')

    if problems:
        raise DuplicateEmailsFound(
            '\n'
            'accounts.0003 cannot make User.email unique: this database holds '
            'duplicate email addresses.\n'
            'NOTHING HAS BEEN CHANGED — this check runs before every schema '
            'operation in the migration, and the migration is atomic.\n\n'
            'Duplicates found:\n'
            + '\n'.join(problems)
            + '\n\n'
            'To fix: for each group above, decide which account is the real one '
            '(check Order.user_id and last_login), move or delete the others, '
            'make the remaining addresses distinct, then re-run migrate.\n'
            'An account with no email address at all cannot sign in and is '
            'usually a legacy admin row; give it a real address or remove it.\n'
        )

    # 2. Case-insensitive collisions. The unique index is case-SENSITIVE on
    #    PostgreSQL, so these do not block the migration — but the application
    #    now looks accounts up with `email__iexact`, so they are a live login
    #    ambiguity. Warn loudly; do not abort, because aborting on something the
    #    database will happily accept would block the deploy for no schema
    #    reason.
    seen = {}
    collisions = {}
    for pk, email in User.objects.exclude(email='').values_list('id', 'email'):
        key = email.lower()
        if key in seen:
            collisions.setdefault(key, [seen[key]]).append((pk, email))
        else:
            seen[key] = (pk, email)
    if collisions:
        print(
            '\n[accounts.0003] WARNING: %d email address(es) differ only by case. '
            'The unique index accepts them, but login resolves emails '
            'case-insensitively, so these accounts are ambiguous:'
            % len(collisions)
        )
        for key, rows in collisions.items():
            print(
                '  %s -> %s'
                % (key, ', '.join(f'id={pk} {email!r}' for pk, email in rows))
            )
        print('  Please merge them. This is a warning, not a failure.\n')


def report_grandfathered_verifications(apps, schema_editor):
    """Report, and deliberately do not backfill, `email_verified_at`.

    Writing `now()` here would claim every account grandfathered by 0002 had
    clicked a verification link. It did not. NULL is the honest value and the
    only thing that makes the distinction recoverable later.
    """
    User = apps.get_model('accounts', 'User')
    grandfathered = User.objects.filter(
        is_email_verified=True, email_verified_at__isnull=True
    ).count()
    if grandfathered:
        print(
            '\n[accounts.0003] %d user(s) are flagged is_email_verified=True with '
            'no email_verified_at. Migration 0002 granted them the flag in bulk; '
            'email_verified_at is intentionally left NULL so a genuinely '
            'verified mailbox stays distinguishable from a grandfathered one.\n'
            % grandfathered
        )


def noop_reverse(apps, schema_editor):
    """Both RunPythons above are read-only; reversing them is a no-op."""


class Migration(migrations.Migration):

    atomic = True

    dependencies = [
        ('accounts', '0002_add_email_verification_fields'),
    ]

    operations = [
        # FIRST. Nothing below runs if this raises.
        migrations.RunPython(abort_on_duplicate_emails, noop_reverse),
        migrations.AddField(
            model_name='user',
            name='email_verification_sent_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When the current verification token was issued. The expiry window is measured from here.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='email_verified_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When this address was verified by clicking a link. NULL on a user whose is_email_verified flag was granted wholesale by migration accounts.0002 rather than earned.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='terms_accepted_at',
            field=models.DateTimeField(
                blank=True,
                help_text='When the user accepted the terms at registration. NULL for accounts created before acceptance was recorded.',
                null=True,
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='marketing_consent',
            field=models.BooleanField(
                default=False,
                help_text='Opt-in to marketing email. Separate from terms acceptance: signing up is not consent to be marketed to.',
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='marketing_consent_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(report_grandfathered_verifications, noop_reverse),
        migrations.AlterField(
            model_name='user',
            name='email_verification_token',
            field=models.CharField(blank=True, max_length=128, null=True, unique=True),
        ),
        migrations.AlterField(
            model_name='user',
            name='email',
            field=models.EmailField(
                error_messages={'unique': 'An account with this email address already exists.'},
                max_length=254,
                unique=True,
                verbose_name='email address',
            ),
        ),
    ]
