"""Dev-only operator tool: drive an order through fail_order() or cancel_order().

**This exercises OUR state machine, not PhonePe's.** No gateway call is made and
nothing here verifies the payment integration; the SDK is not installable in
this environment (spec C-4). What it proves is that a failure restores stock at
most once, releases the coupon, leaves the cart intact, and is a no-op on replay.

The real gateway path can only be verified on staging - see spec §5.2.
"""

from django.core.management.base import BaseCommand, CommandError

from orders.models import Order
from orders.services import cancel_order, fail_order


class Command(BaseCommand):
    help = (
        'Mark an order failed (or cancelled/expired) by calling '
        'orders.services.fail_order / cancel_order directly. DEV ONLY. This '
        'exercises OUR state machine, NOT PhonePe: no gateway call is made.'
    )

    def add_arguments(self, parser):
        parser.add_argument('order_id', type=int, help='Order primary key (not the LF number)')
        parser.add_argument(
            '--as',
            dest='final_state',
            choices=['FAILED', 'CANCELLED', 'EXPIRED'],
            default='FAILED',
            help='Which transition to run. FAILED is retryable; the other two are terminal.',
        )
        parser.add_argument('--reason', default='Simulated payment failure (dev tool).')

    def handle(self, *args, **options):
        order_id = options['order_id']
        final_state = options['final_state']
        try:
            order = Order.objects.get(pk=order_id)
        except Order.DoesNotExist:
            raise CommandError(f'No order with id {order_id}.')

        self.stdout.write(
            f'Before: {order.order_number} payment_status={order.payment_status} '
            f'stock_decremented={order.stock_decremented} '
            f'stock_restored={order.stock_restored} coupon_id={order.coupon_id} '
            f'coupon_code={order.coupon_code!r}'
        )

        if final_state == 'FAILED':
            outcome = fail_order(
                order_id, reason=options['reason'], source='fake_payment_failed'
            )
        else:
            outcome = cancel_order(
                order_id,
                reason=options['reason'],
                final_state=final_state,
                source='fake_payment_failed',
            )

        order.refresh_from_db()
        self.stdout.write(
            f'After:  {order.order_number} payment_status={order.payment_status} '
            f'stock_decremented={order.stock_decremented} '
            f'stock_restored={order.stock_restored} coupon_id={order.coupon_id} '
            f'coupon_code={order.coupon_code!r}'
        )
        self.stdout.write(f'Outcome: {outcome}')
        if not outcome['changed']:
            self.stdout.write(self.style.WARNING(
                'No change - the order was already in that state or terminal. That '
                'is the correct behaviour for a replay.'
            ))
        else:
            self.stdout.write(self.style.SUCCESS(f'{final_state} applied.'))
        self.stdout.write(self.style.WARNING(
            'Reminder: this proved our state machine only. The PhonePe V2 status '
            'call and callback signature remain unverified until staging.'
        ))
