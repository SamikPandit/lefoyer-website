"""No signal receivers. Shipment generation is driven explicitly, from
``orders.services.confirm_order``.

This module is kept (rather than deleted) because ``ShippingConfig.ready()``
imports it; removing the file would break app startup, and ``apps.py`` belongs
to another work package.

-----------------------------------------------------------------------------
WHY THE RECEIVER HAD TO GO  (spec C-31)
-----------------------------------------------------------------------------

It was::

    @receiver(post_save, sender=Order)
    def create_shipment_after_payment(sender, instance, created, **kwargs):
        if instance.payment_status == 'COMPLETED' and not hasattr(instance, 'shipment'):
            generate_shipment_for_order.delay(instance.id)

Four distinct faults, all of them structural rather than cosmetic:

1. **It fired inside the creating transaction.** For a COD order,
   `OrderViewSet.create` saved the order inside ``transaction.atomic()``, so
   ``.delay()`` dispatched the Celery task **before the commit**. A worker that
   picked it up promptly looked up an order id that did not exist yet.
2. **A rolled-back order still dispatched a shipment.** The task was already on
   the broker; rolling the transaction back did not recall it.
3. **No `update_fields` check.** *Any* save of a COMPLETED order re-ran it -
   including every unrelated edit in the admin.
4. **No `dispatch_uid`.** A double import of this module registered the
   receiver twice, so one save dispatched two tasks.

The replacement is one line in `confirm_order`::

    transaction.on_commit(lambda: generate_shipment_for_order.delay(order.id))

which fires once, only on the real COMPLETED transition, and only after the
order is actually committed. `generate_shipment_for_order` is additionally
idempotent via ``get_or_create``, so even a duplicated dispatch cannot create a
second shipment.
"""
