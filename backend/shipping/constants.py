# shipping/constants.py
"""
Blue Dart API constants and configuration mappings
"""

# Product Codes
PRODUCT_CODE_DOMESTIC_PRIORITY = 'D'  # Next-business-day air delivery
PRODUCT_CODE_APEX = 'A'  # Commercial shipments ≥10 kg
PRODUCT_CODE_SURFACELINE = 'E'  # Economy ground, 4-7 days

# Sub-Product Codes
SUB_PRODUCT_PREPAID = 'P'
SUB_PRODUCT_COD = 'C'

# Pack Types
PACK_TYPE_DOCUMENTS = 'D'
PACK_TYPE_NON_DOCUMENTS = 'N'

# Product Type
PRODUCT_TYPE_FORWARD = 0  # Normal forward shipment
PRODUCT_TYPE_REVERSE = 1  # Reverse pickup/return

# Blue Dart Status to Internal Status Mapping
BLUEDART_STATUS_MAP = {
    'Shipment Booked': 'booked',
    'Pickup Scheduled': 'pickup_scheduled',
    'Picked Up': 'picked_up',
    'Pickup Done': 'picked_up',
    'In Transit': 'in_transit',
    'Arrived at Hub': 'in_transit',
    'Departed from Hub': 'in_transit',
    'Out for Delivery': 'out_for_delivery',
    'Delivered': 'delivered',
    'Undelivered': 'undelivered',
    'Delivery Failed': 'undelivered',
    'RTO Initiated': 'rto_initiated',
    'Returned to Origin': 'rto_delivered',
    'RTO Delivered': 'rto_delivered',
    'Cancelled': 'cancelled',
}

# WSDL Endpoints
WSDL_ENDPOINTS = {
    'demo': {
        'finder': 'http://netconnect.bluedart.com/Demo/ShippingAPI/Finder/ServiceFinderQuery.svc?wsdl',
        'waybill': 'https://netconnect.bluedart.com/API-QA/Ver1.10/Demo/ShippingAPI/WayBill/WayBillGeneration.svc?wsdl',
        'pickup': 'http://netconnect.bluedart.com/Demo/ShippingAPI/Pickup/PickupRegistrationService.svc?wsdl',
    },
    'production': {
        'finder': 'https://netconnect.bluedart.com/Ver1.11/ShippingAPI/Finder/ServiceFinderQuery.svc?wsdl',
        'waybill': 'https://netconnect.bluedart.com/Ver1.11/ShippingAPI/WayBill/WayBillGeneration.svc?wsdl',
        'pickup': 'https://netconnect.bluedart.com/Ver1.11/ShippingAPI/Pickup/PickupRegistrationService.svc?wsdl',
    }
}

# Tracking API endpoint (HTTP GET, not SOAP)
TRACKING_API_BASE = 'https://api.bluedart.com/servlet/RoutingServlet'


# ---------------------------------------------------------------------------
# Public tracking portal (WP-06)
# ---------------------------------------------------------------------------
# `Shipment.tracking_url` used to be built as `/api/shipping/track/<awb>/`, a
# relative path into our own JSON API. The order pages hand that value straight
# to the router / `window.open`, so a shopper clicking "Track" was sent to a JSON
# document (or to a 404 route). The customer-facing destination is Blue Dart's
# own tracking page, as an absolute external URL.
#
# The query-string shape below is Blue Dart's public "track dart result" form.
# It is reachable without credentials and takes the AWB as `trackNo`. Override it
# with the `BLUEDART_TRACKING_PORTAL_URL` environment setting if Blue Dart moves
# the page (the template must contain a single `{awb}` placeholder).
TRACKING_PORTAL_URL_TEMPLATE = (
    'https://www.bluedart.com/web/guest/trackdartresult?trackFor=0&trackNo={awb}'
)

# ---------------------------------------------------------------------------
# Serviceability cache (WP-06 / §2b #38)
# ---------------------------------------------------------------------------
# Serviceability for a pincode changes at courier-network pace, not at shopper
# pace, so 24h is safe. The cache exists so a debounced pincode field, an
# autochecking PDP widget and the checkout address step cannot between them
# spend the request throttle (or hammer Blue Dart) for one shopper typing one
# pincode. `settings.CACHES['default']` is an explicit per-process LocMemCache;
# duplication across gunicorn workers is acceptable for this data.
SERVICEABILITY_CACHE_TTL_SECONDS = 24 * 60 * 60

# The `v1` segment is a schema stamp: bump it when the cached body shape changes
# so a deploy cannot serve yesterday's shape to today's frontend.
SERVICEABILITY_CACHE_KEY_TEMPLATE = 'shipping:serviceability:v1:{pincode}'

# Indian PIN codes are exactly six digits and never begin with 0. Shared with the
# frontend's `PINCODE_RE` in `components/common/PincodeCheck.jsx`.
PINCODE_REGEX = r'^[1-9][0-9]{5}$'

# The one sentence a 400 on this endpoint ever says.
PINCODE_INVALID_MESSAGE = 'Enter a valid 6-digit pincode.'

# Said with 200 + serviceable:false. Not an error: the request succeeded and the
# answer is "no". Keyed by the client as `message`.
PINCODE_NOT_SERVICEABLE_MESSAGE = (
    'We do not deliver to this pincode yet.'
)

# Said with 200 + serviceable:true.
PINCODE_SERVICEABLE_MESSAGE = 'Delivery is available to this pincode.'

# Said with 503. The storefront renders this as "you can still order", never as
# "we do not deliver here" — losing an order because a courier API was down is
# the worst outcome available to this endpoint.
SERVICEABILITY_UNAVAILABLE_MESSAGE = (
    'Delivery check is temporarily unavailable. You can still place your order.'
)
