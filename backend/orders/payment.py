import uuid
import hashlib
import base64
import json
from django.conf import settings
from phonepe.sdk.pg.env import Env
from phonepe.sdk.pg.payments.v2.standard_checkout_client import StandardCheckoutClient
from phonepe.sdk.pg.payments.v2.models.request.standard_checkout_pay_request import StandardCheckoutPayRequest

class PhonePeGateway:
    def __init__(self):
        self.client_id = settings.PHONEPE_MERCHANT_ID
        self.client_secret = settings.PHONEPE_SALT_KEY
        self.client_version = settings.PHONEPE_SALT_INDEX
        
        # Robust Environment Mapping
        env_str = str(settings.PHONEPE_ENV).upper()
        if env_str in ['PRODUCTION', 'PROD']:
            self.env = Env.PRODUCTION
        else:
            self.env = Env.SANDBOX
            
        self.client = StandardCheckoutClient(
            client_id=self.client_id,
            client_secret=self.client_secret,
            client_version=self.client_version,
            env=self.env
        )

    def initiate_payment(self, order_id, amount, user_id, redirect_url=None, callback_url=None):
        """
        Initiates a payment request with PhonePe
        """
        merchant_transaction_id = str(uuid.uuid4())
        
        # PhonePe expects amount in paise (100 paise = 1 INR)
        amount_in_paise = int(amount * 100)
        
        if not redirect_url:
            # Default redirect URL if not provided
            from django.conf import settings
            redirect_url = f"{settings.SITE_URL}/order-confirmation"

        request = StandardCheckoutPayRequest.build_request(
            merchant_order_id=merchant_transaction_id,
            amount=amount_in_paise,
            redirect_url=redirect_url
        )
        
        try:
            response = self.client.pay(request)
            return {
                "success": True,
                "redirect_url": response.redirect_url,
                "merchant_transaction_id": merchant_transaction_id
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

    def verify_callback(self, response_payload, x_verify):
        """
        Verifies the callback checksum manually
        """
        calculated_checksum = hashlib.sha256((response_payload + self.client_secret).encode('utf-8')).hexdigest() + "###" + str(self.client_version)
        return calculated_checksum == x_verify
