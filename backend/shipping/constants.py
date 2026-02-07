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
        'finder': 'https://netconnect.bluedart.com/Ver1.10/ShippingAPI/Finder/ServiceFinderQuery.svc?wsdl',
        'waybill': 'https://netconnect.bluedart.com/Ver1.10/ShippingAPI/WayBill/WayBillGeneration.svc?wsdl',
        'pickup': 'https://netconnect.bluedart.com/Ver1.10/ShippingAPI/Pickup/PickupRegistrationService.svc?wsdl',
    }
}

# Tracking API endpoint (HTTP GET, not SOAP)
TRACKING_API_BASE = 'https://api.bluedart.com/servlet/RoutingServlet'
