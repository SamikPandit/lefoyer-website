"""Dev-only operator tool: drive an order through confirm_order().

**This exercises OUR state machine, not PhonePe's.** It does not call the
gateway, it does not verify a signature and it proves nothing whatsoever about
the PhonePe integration - the SDK is not even installable in this environment
(spec C-4). What it does prove, and what it was written for, is that *our*
side effects fire exactly once: stock decrements once, the cart clears once, one
confirmation email is queued, and a second run changes nothing.

The real gateway path can only be verified on staging - see spec §5.2.
"""

from django.core.management.base import BaseCommand, CommandError

from orders.models import Order
from orders.services import confirm_order


class Command(BaseCommand):
    help = (
        'Mark an order paid by calling orders.services.confirm_order directly. '
        'DEV ONLY. This exercises OUR state machine, NOT PhonePe: no gateway '
        'call is made and nothing here verifies the payment integration.'
    )

    def add_arguments(self, parser):
        parser.add_argument('order_id', type=int, help='Order primary key (not the LF number)')
        parser.add_argument(
            '--reference',
            default='FAKE-SUCCESS',
            help='Provider payment reference to record on the order.',
        )

    def handle(self, *args, **options):
        order_id = options['order_id']
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            raise CommandError(f'No order with id {order_id}.')

        self.stdout.write(
            f'Before: {order.order_number} payment_status={order.payment_status} '
            f'paid={order.paid} stock_decremented={order.stock_decremented} '
            f'cart_cleared_at={order.cart_cleared_at} '
            f'email_sent_at={order.confirmation_email_sent_at}'
        )

        outcome = confirm_order(
            order_id,
            provider_payment_id=options['reference'],
            source='fake_payment_success',
        )

        order.refresh_from_db()
        self.stdout.write(
            f'After:  {order.order_number} payment_status={order.payment_status} '
            f'paid={order.paid} stock_decremented={order.stock_decremented} '
            f'cart_cleared_at={order.cart_cleared_at} '
            f'email_sent_at={order.confirmation_email_sent_at}'
        )
        self.stdout.write(f'Outcome: {outcome}')
        if not outcome['changed']:
            self.stdout.write(self.style.WARNING(
                'No change - the order was already terminal. That is the correct '
                'behaviour for a replay.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS('confirm_order applied.'))
        self.stdout.write(self.style.WARNING(
            'Reminder: this proved our state machine only. The PhonePe V2 status '
            'call and callback signature remain unverified until staging.'
        ))
