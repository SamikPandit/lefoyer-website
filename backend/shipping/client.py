"""
Blue Dart SOAP API Client

This module provides a client for interacting with Blue Dart's shipping APIs.
Handles all SOAP communication, request/response parsing, and error handling.
"""
import logging
import base64
import requests
import xmltodict
from datetime import datetime, date
from decimal import Decimal

from zeep import Client, Settings
from zeep.cache import SqliteCache
from zeep.transports import Transport
from zeep.exceptions import Fault as ZeepFault

from django.conf import settings

from .constants import (
    WSDL_ENDPOINTS,
    TRACKING_API_BASE,
    BLUEDART_STATUS_MAP,
    PRODUCT_CODE_DOMESTIC_PRIORITY,
    SUB_PRODUCT_PREPAID,
    PACK_TYPE_NON_DOCUMENTS,
)
from .utils import (
    to_bluedart_date,
    from_bluedart_date,
    parse_bluedart_display_date,
    get_billable_weight,
    truncate_address,
    split_address,
)

logger = logging.getLogger(__name__)


class BlueDartAPIError(Exception):
    """Custom exception for Blue Dart API errors"""
    pass


class BlueDartClient:
    """
    Client for Blue Dart SOAP and REST APIs.
    
    Handles:
    - Serviceability checks
    - Transit time calculation
    - Waybill (AWB) generation
    - Shipment tracking
    - Pickup registration
    - Waybill cancellation
    """
    
    def __init__(self):
        """Initialize Blue Dart client with credentials from settings"""
        self.login_id = settings.BLUEDART_LOGIN_ID
        self.licence_key = settings.BLUEDART_LICENCE_KEY
        self.tracking_licence_key = settings.BLUEDART_TRACKING_LICENCE_KEY
        self.customer_code = settings.BLUEDART_CUSTOMER_CODE
        self.cod_customer_code = getattr(settings, 'BLUEDART_COD_CUSTOMER_CODE', '')
        self.origin_area = settings.BLUEDART_ORIGIN_AREA
        self.demo_mode = settings.BLUEDART_DEMO_MODE
        
        # Get WSDL endpoints based on mode
        env = 'demo' if self.demo_mode else 'production'
        self.wsdl_endpoints = WSDL_ENDPOINTS[env]
        
        # Configure zeep transport with caching
        transport = Transport(
            cache=SqliteCache(),
            timeout=30,
            operation_timeout=30
        )
        zeep_settings = Settings(
            strict=False,
            xml_huge_tree=True
        )
        
        # Initialize SOAP clients (lazy loaded)
        self._finder_client = None
        self._waybill_client = None
        self._pickup_client = None
        self.transport = transport
        self.zeep_settings = zeep_settings
    
    @property
    def finder_client(self):
        """Lazy-load Finder SOAP client"""
        if self._finder_client is None:
            self._finder_client = Client(
                self.wsdl_endpoints['finder'],
                transport=self.transport,
                settings=self.zeep_settings
            )
        return self._finder_client
    
    @property
    def waybill_client(self):
        """Lazy-load Waybill SOAP client"""
        if self._waybill_client is None:
            self._waybill_client = Client(
                self.wsdl_endpoints['waybill'],
                transport=self.transport,
                settings=self.zeep_settings
            )
        return self._waybill_client
    
    @property
    def pickup_client(self):
        """Lazy-load Pickup SOAP client"""
        if self._pickup_client is None:
            self._pickup_client = Client(
                self.wsdl_endpoints['pickup'],
                transport=self.transport,
                settings=self.zeep_settings
            )
        return self._pickup_client
    
    def _get_profile(self, customer_code=None):
        """
        Build the Profile object required for all SOAP calls.
        
        Args:
            customer_code: Optional override for customer code (for COD shipments)
            
        Returns:
            dict: Profile dictionary
        """
        return {
            'Api_type': 'S',
            'LicenceKey': self.licence_key,
            'LoginID': self.login_id,
            'Version': '1.3',
            'Customercode': customer_code or self.customer_code,
            'Area': self.origin_area,
        }
    
    def _create_dimensions(self, dims_dict, client):
        """
        Create the Angle of Dimension object structure required by data contract.
        
        Args:
            dims_dict: Dictionary with length_cm, width_cm, height_cm
            client: The Zeep client instance to get types from
            
        Returns:
            The ArrayOfDimension object
        """
        try:
            # Get types from the client
            # Note: The namespace prefix (ns2) might vary, but get_type handles it usually
            # or we iterate to find it.
            
            # Based on WSDL dump: 
            # ns2:ArrayOfDimension
            # ns2:Dimension(Breadth: xsd:double, Count: xsd:int, Height: xsd:double, Length: xsd:double)
            
            # Find the namespace for data types (usually ends in WayBillGeneration)
            ns = None
            for key, val in client.namespaces.items():
                if 'WayBillGeneration' in val:
                    ns = key
                    break
            
            type_prefix = f"{ns}:" if ns else ""
            
            DimensionType = client.get_type(f'{type_prefix}Dimension')
            ArrayOfDimensionType = client.get_type(f'{type_prefix}ArrayOfDimension')
            
            dim = DimensionType(
                Length=float(dims_dict['length_cm']),
                Breadth=float(dims_dict['width_cm']),
                Height=float(dims_dict['height_cm']),
                Count=1
            )
            
            return ArrayOfDimensionType(Dimension=[dim])
            
        except Exception as e:
            logger.error(f"Error creating dimension object: {e}")
            # Fallback to dictionary list if type creation fails (though likely to fail at SOAP level)
            return {
                'Dimension': [{
                    'Length': float(dims_dict['length_cm']),
                    'Breadth': float(dims_dict['width_cm']),
                    'Height': float(dims_dict['height_cm']),
                    'Count': 1
                }]
            }

    def check_serviceability(self, pincode):
        """
        Check if Blue Dart services this pincode.
        
        Args:
            pincode: 6-digit destination pincode
            
        Returns:
            dict: {
                'serviceable': bool,
                'cod_available': bool,
                'area_code': str or None,
                'error': str or None
            }
        """
        logger.info(f"Checking serviceability for pincode: {pincode}")
        
        try:
            response = self.finder_client.service.GetServicesforPincode(
                pinCode=str(pincode),
                profile=self._get_profile()
            )
            
            # Check for errors
            if hasattr(response, 'IsError') and response.IsError:
                error_msg = getattr(response, 'ErrorMessage', 'Unknown error')
                logger.warning(f"Pincode {pincode} not serviceable: {error_msg}")
                return {
                    'serviceable': False,
                    'cod_available': False,
                    'area_code': None,
                    'error': error_msg
                }
            
            # Check for Domestic Priority service (our default)
            serviceable = getattr(response, 'DomesticPriorityOutbound', False)
            
            # Check COD availability
            cod_available = getattr(response, 'eTailCODAirOutbound', False)
            
            logger.info(f"Pincode {pincode}: serviceable={serviceable}, COD={cod_available}")
            
            return {
                'serviceable': serviceable,
                'cod_available': cod_available,
                'area_code': None,  # Area code comes from transit time API
                'error': None
            }
            
        except ZeepFault as e:
            logger.error(f"SOAP fault checking serviceability for {pincode}: {e}")
            raise BlueDartAPIError(f"Blue Dart API error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error checking serviceability for {pincode}: {e}")
            raise BlueDartAPIError(f"Unexpected error: {str(e)}")
    
    def get_transit_time(self, dest_pincode, product_code='D', sub_product_code='P', 
                        pickup_date=None, pickup_time='1600'):
        """
        Get estimated delivery date and transit time.
        
        Args:
            dest_pincode: Destination 6-digit pincode
            product_code: Blue Dart product code (default 'D' - Domestic Priority)
            sub_product_code: 'P' for Prepaid, 'C' for COD
            pickup_date: Date of pickup (default today)
            pickup_time: Pickup time in HHMM format (default 4 PM)
            
        Returns:
            dict: {
                'expected_delivery_date': date object,
                'transit_days': int,
                'area_code': str (destination area code),
                'service_center': str,
                'error': str or None
            }
        """
        if pickup_date is None:
            pickup_date = date.today()
        
        origin_pincode = settings.BLUEDART_ORIGIN_PINCODE
        
        logger.info(f"Getting transit time: {origin_pincode} -> {dest_pincode}")
        
        try:
            response = self.finder_client.service.GetDomesticTransitTimeForPinCodeandProduct(
                pPinCodeFrom=origin_pincode,
                pPinCodeTo=str(dest_pincode),
                pProductCode=product_code,
                pSubProductCode=sub_product_code,
                pPudate=pickup_date,  # Python date object
                pPickupTime=pickup_time,
                profile=self._get_profile()
            )
            
            # Check for errors
            if hasattr(response, 'IsError') and response.IsError:
                error_msg = getattr(response, 'ErrorMessage', 'Unknown error')
                logger.warning(f"Transit time error for {dest_pincode}: {error_msg}")
                return {
                    'expected_delivery_date': None,
                    'transit_days': None,
                    'area_code': None,
                    'service_center': None,
                    'error': error_msg
                }
            
            # Parse expected delivery date (format: "DD-MON-YY")
            delivery_date_str = getattr(response, 'ExpectedDateDelivery', None)
            delivery_date = parse_bluedart_display_date(delivery_date_str)
            
            area_code = getattr(response, 'Area', None)
            service_center = getattr(response, 'ServiceCenter', None)
            additional_days = getattr(response, 'AdditionalDays', 0)
            
            # Calculate transit days
            if delivery_date and pickup_date:
                transit_days = (delivery_date - pickup_date).days
            else:
                transit_days = additional_days
            
            logger.info(f"Transit time for {dest_pincode}: {transit_days} days, delivery by {delivery_date}")
            
            return {
                'expected_delivery_date': delivery_date,
                'transit_days': transit_days,
                'area_code': area_code,
                'service_center': service_center,
                'error': None
            }
            
        except ZeepFault as e:
            logger.error(f"SOAP fault getting transit time for {dest_pincode}: {e}")
            raise BlueDartAPIError(f"Blue Dart API error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error getting transit time for {dest_pincode}: {e}")
            raise BlueDartAPIError(f"Unexpected error: {str(e)}")
    
    def generate_waybill(self, order, weight_kg=None, dimensions=None, product_code='D', sub_product_code='P'):
        """
        Generate AWB (Airway Bill) number and shipping label for an order.
        
        This is the most critical API call - it creates the shipment in Blue Dart's system.
        
        Args:
            order: Order model instance
            weight_kg: Weight in kg (uses default if not provided)
            dimensions: Dict with length_cm, width_cm, height_cm (uses defaults if not provided)
            product_code: 'D' (Domestic Priority), 'A' (Apex), 'E' (Surfaceline)
            sub_product_code: 'P' (Prepaid), 'C' (COD)
            
        Returns:
            dict: {
                'awb_number': str,
                'label_pdf_bytes': bytes,
                'destination_area': str,
                'destination_location': str,
                'pickup_token': str or None,
                'error': str or None
            }
        """
        logger.info(f"Generating waybill for order #{order.id}")
        
        # Get or use default dimensions
        if dimensions is None:
            dimensions = {
                'length_cm': settings.BLUEDART_DEFAULT_LENGTH_CM,
                'width_cm': settings.BLUEDART_DEFAULT_WIDTH_CM,
                'height_cm': settings.BLUEDART_DEFAULT_HEIGHT_CM,
            }
        
        # Get or use default weight
        if weight_kg is None:
            weight_kg = settings.BLUEDART_DEFAULT_WEIGHT_KG
        
        # Calculate billable weight
        billable_weight = get_billable_weight(
            weight_kg,
            dimensions['length_cm'],
            dimensions['width_cm'],
            dimensions['height_cm']
        )
        
        # Determine customer code (COD vs prepaid)
        customer_code = self.customer_code
        if sub_product_code == 'C' and self.cod_customer_code:
            customer_code = self.cod_customer_code
        
        # Split address into multiple lines
        address_line1, address_line2, address_line3 = split_address(
            order.address,
            line1_max=30,
            line2_max=30,
            line3_max=25
        )
        
        # Build the request
        request = {
            'Consignee': {
                'ConsigneeAddress1': address_line1 or truncate_address(order.address, 30),
                'ConsigneeAddress2': address_line2,
                'ConsigneeAddress3': address_line3,
                'ConsigneeAddressType': 'R',  # R=Residential, O=Office
                'ConsigneeMobile': order.phone.replace('+91', '').replace('-', '').replace(' ', '')[:10],
                'ConsigneeName': truncate_address(f"{order.first_name} {order.last_name}", 30),
                'ConsigneePincode': order.pincode,
                'ConsigneeEmailID': order.email[:50] if order.email else '',
                'ConsigneeTelephone': '',
                'ConsigneeGSTNumber': '',
            },
            'Returnadds': {
                'ReturnAddress1': truncate_address(settings.BLUEDART_RETURN_ADDRESS, 30),
                'ReturnContact': truncate_address(settings.BLUEDART_RETURN_CONTACT, 20),
                'ReturnMobile': settings.BLUEDART_RETURN_PHONE.replace('+91', '').replace('-', '').replace(' ', '')[:10],
                'ReturnPincode': settings.BLUEDART_RETURN_PINCODE,
            },
            'Services': {
                'ActualWeight': str(billable_weight),
                'CollectableAmount': float(order.total) if sub_product_code == 'C' else 0,
                'CreditReferenceNo': f"LEFOYER-{order.id}-{int(datetime.now().timestamp())}",  # Unique reference
                'DeclaredValue': float(order.total),
                'InvoiceNo': f"INV-{order.id}",
                'ItemCount': order.items.count(),
                'PieceCount': str(order.items.count()),
                'PieceCount': str(order.items.count()),
                'ProductCode': product_code,
                'SubProductCode': sub_product_code,
                'ProductType': 'Dutiables',  # 'Dutiables' for non-documents, 'Docs' for documents
                'PackType': PACK_TYPE_NON_DOCUMENTS,
                'PDFOutputNotRequired': False,  # We want the PDF label
                'RegisterPickup': False,  # Manual pickup registration via scheduled task
                'PickupDate': datetime.now(),
                'PickupTime': '1600',
                # Dimensions fixed to use correct WSDL type structure
                'Dimensions': self._create_dimensions(dimensions, self.waybill_client),
                'OTPBasedDelivery': 'Default',  # 'Default' = No OTP check usually
                'SpecialInstruction': 'Handle with care - fragile beauty products',
            },
            'Shipper': {
                'CustomerAddress1': truncate_address(settings.BLUEDART_WAREHOUSE_ADDRESS, 30),
                'CustomerCode': customer_code,
                'CustomerName': truncate_address(settings.BLUEDART_WAREHOUSE_NAME, 30),
                'CustomerPincode': settings.BLUEDART_ORIGIN_PINCODE,
                'CustomerMobile': settings.BLUEDART_WAREHOUSE_PHONE.replace('+91', '').replace('-', '').replace(' ', '')[:10],
                'OriginArea': self.origin_area,
                'Sender': truncate_address(settings.BLUEDART_WAREHOUSE_NAME, 30),
                'IsToPayCustomer': False,
                'VendorCode': '',
            }
        }
        
        try:
            response = self.waybill_client.service.GenerateWayBill(
                Request=request,
                Profile=self._get_profile(customer_code)
            )
            
            # Check for errors
            if hasattr(response, 'IsError') and response.IsError:
                # Check multiple error fields
                error_msg = (
                    getattr(response, 'ErrorMessage', None)
                    or getattr(response, 'StatusMessage', None)
                    or getattr(response, 'Status', None)
                )
                
                # Check for status list/array
                if not error_msg:
                    status_array = getattr(response, 'Status', None)
                    if status_array and hasattr(status_array, 'WayBillGenerationStatus'):
                        statuses = status_array.WayBillGenerationStatus
                        if isinstance(statuses, list):
                            error_msg = "; ".join([s.StatusInformation for s in statuses if s.StatusInformation])
                        else:
                             error_msg = getattr(statuses, 'StatusInformation', None)

                if not error_msg:
                    error_msg = 'Unknown error'

                # Also check for error list
                error_list = getattr(response, 'ErrorMessageList', None)
                if error_list:
                    logger.error(f"Error list: {error_list}")
                
                logger.error(f"Waybill generation failed for order #{order.id}: {error_msg}")
                return {
                    'awb_number': None,
                    'label_pdf_bytes': None,
                    'destination_area': None,
                    'destination_location': None,
                    'pickup_token': None,
                    'error': error_msg
                }
            
            # Extract response data
            awb_number = getattr(response, 'AWBNo', None)
            label_pdf_b64 = getattr(response, 'AWBPrintContent', None)
            destination_area = getattr(response, 'DestinationArea', None)
            destination_location = getattr(response, 'DestinationLocation', None)
            pickup_token = getattr(response, 'TokenNumber', None)
            
            # Decode PDF
            label_pdf_bytes = None
            if label_pdf_b64:
                try:
                    label_pdf_bytes = base64.b64decode(label_pdf_b64)
                except Exception as e:
                    logger.error(f"Failed to decode label PDF: {e}")
            
            logger.info(f"Waybill generated successfully: AWB {awb_number} for order #{order.id}")
            
            return {
                'awb_number': awb_number,
                'label_pdf_bytes': label_pdf_bytes,
                'destination_area': destination_area,
                'destination_location': destination_location,
                'pickup_token': pickup_token,
                'error': None
            }
            
        except ZeepFault as e:
            logger.error(f"SOAP fault generating waybill for order #{order.id}: {e}")
            raise BlueDartAPIError(f"Blue Dart API error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error generating waybill for order #{order.id}: {e}")
            raise BlueDartAPIError(f"Unexpected error: {str(e)}")
    
    def track_shipment(self, awb_number):
        """
        Track a shipment and get all scan events.
        
        Uses HTTP GET (not SOAP) on Blue Dart's tracking API.
        
        Args:
            awb_number: 11-digit AWB number
            
        Returns:
            dict: {
                'current_status': str,
                'scan_events': list of dicts,
                'error': str or None
            }
            
        Each scan event dict contains:
            {
                'scan_date': datetime,
                'scan_code': str,
                'scan_description': str,
                'scanned_location': str,
                'instructions': str
            }
        """
        logger.info(f"Tracking shipment: {awb_number}")
        
        params = {
            'handler': 'tnt',
            'action': 'custawbquery',
            'loginid': self.login_id,
            'awb': 'awb',
            'numbers': awb_number,
            'format': 'xml',
            'lickey': self.tracking_licence_key,
            'verno': '1.3',
            'scan': '1',  # Full scan history
        }
        
        try:
            response = requests.get(TRACKING_API_BASE, params=params, timeout=30)
            response.raise_for_status()
            
            # Parse XML response
            data = xmltodict.parse(response.text)
            
            # Navigate through response structure
            shipment_data = data.get('ShipmentData', {})
            shipment = shipment_data.get('Shipment', {})
            
            # Check for error
            if isinstance(shipment, dict) and shipment.get('Status') == 'Error':
                error_msg = shipment.get('ErrorMessage', 'Unknown tracking error')
                logger.warning(f"Tracking error for {awb_number}: {error_msg}")
                return {
                    'current_status': None,
                    'scan_events': [],
                    'error': error_msg
                }
            
            # Extract scan details
            scans = shipment.get('Scans', {}).get('ScanDetail', [])
            
            # Handle single scan (not a list)
            if isinstance(scans, dict):
                scans = [scans]
            
            scan_events = []
            current_status = None
            
            for scan in scans:
                scan_date_str = scan.get('ScanDate', '')
                scan_time_str = scan.get('ScanTime', '')
                scan_description = scan.get('Scan', '') or scan.get('ScanDescription', '')
                scan_code = scan.get('ScanCode', '')
                scanned_location = scan.get('ScannedLocation', '')
                instructions = scan.get('Instructions', '')
                
                # Parse datetime
                try:
                    scan_datetime = datetime.strptime(
                        f"{scan_date_str} {scan_time_str}",
                        '%Y-%m-%d %H:%M:%S'
                    )
                except ValueError:
                    scan_datetime = None
                
                scan_events.append({
                    'scan_date': scan_datetime,
                    'scan_code': scan_code,
                    'scan_description': scan_description,
                    'scanned_location': scanned_location,
                    'instructions': instructions
                })
                
                # Map Blue Dart status to our internal status
                if scan_description and not current_status:
                    for bd_status, internal_status in BLUEDART_STATUS_MAP.items():
                        if bd_status.lower() in scan_description.lower():
                            current_status = internal_status
                            break
            
            # Sort events by date (newest first)
            scan_events.sort(key=lambda x: x['scan_date'] or datetime.min, reverse=True)
            
            logger.info(f"Tracking for {awb_number}: {len(scan_events)} events, status={current_status}")
            
            return {
                'current_status': current_status,
                'scan_events': scan_events,
                'error': None
            }
            
        except requests.RequestException as e:
            logger.error(f"HTTP error tracking {awb_number}: {e}")
            raise BlueDartAPIError(f"Tracking API error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error tracking {awb_number}: {e}")
            raise BlueDartAPIError(f"Unexpected error: {str(e)}")
    
    def register_pickup(self, shipments, pickup_date=None, pickup_time='16:00', close_time='18:00'):
        """
        Register a pickup request for multiple shipments.
        
        Args:
            shipments: List of Shipment model instances
            pickup_date: Date for pickup (default today)
            pickup_time: Time in HH:MM format (default 4 PM)
            close_time: Office close time in HH:MM (default 6 PM)
            
        Returns:
            dict: {
                'pickup_token': str,
                'error': str or None
            }
        """
        if pickup_date is None:
            pickup_date = datetime.now()
        
        if not shipments:
            logger.warning("No shipments provided for pickup registration")
            return {'pickup_token': None, 'error': 'No shipments provided'}
        
        # Calculate totals
        total_pieces = sum(shipment.order.items.count() for shipment in shipments)
        total_weight = sum(float(shipment.weight_kg) for shipment in shipments)
        
        # Volumetric weight calculation (simplified - use highest)
        total_volumetric = total_weight  # TODO: Calculate actual volumetric if needed
        
        logger.info(f"Registering pickup for {len(shipments)} shipments, {total_pieces} pieces, {total_weight}kg")
        
        pickup_request = {
            'AreaCode': self.origin_area,
            'CustomerCode': self.customer_code,
            'CustomerName': settings.BLUEDART_WAREHOUSE_NAME,
            'CustomerAddress1': truncate_address(settings.BLUEDART_WAREHOUSE_ADDRESS, 30),
            'CustomerPincode': settings.BLUEDART_ORIGIN_PINCODE,
            'ContactPersonName': settings.BLUEDART_WAREHOUSE_CONTACT,
            'CustomerTelephoneNumber': settings.BLUEDART_WAREHOUSE_PHONE.replace('+91', '').replace('-', '').replace(' ', '')[:10],
            'MobileTelNo': settings.BLUEDART_WAREHOUSE_PHONE.replace('+91', '').replace('-', '').replace(' ', '')[:10],
            'ShipmentPickupDate': pickup_date,
            'ShipmentPickupTime': pickup_time.replace(':', ''),  # Convert HH:MM to HHMM
            'OfficeCloseTime': close_time.replace(':', ''),
            'NumberofPieces': total_pieces,
            'WeightofShipment': total_weight,
            'VolumeWeight': total_volumetric,
            'ProductCode': PRODUCT_CODE_DOMESTIC_PRIORITY,
            'DoxNDox': '2',  # 1=Documents, 2=Non-Documents
            'IsReversePickup': False,
            'Remarks': f"Le Foyer daily pickup - {len(shipments)} shipments",
        }
        
        try:
            response = self.pickup_client.service.RegisterPickup(
                PickupRequest=pickup_request,
                Profile=self._get_profile()
            )
            
            # Check for errors
            if hasattr(response, 'IsError') and response.IsError:
                error_msg = getattr(response, 'ErrorMessage', 'Unknown error')
                logger.error(f"Pickup registration failed: {error_msg}")
                return {
                    'pickup_token': None,
                    'error': error_msg
                }
            
            pickup_token = getattr(response, 'TokenNumber', None)
            
            logger.info(f"Pickup registered successfully: Token {pickup_token}")
            
            return {
                'pickup_token': pickup_token,
                'error': None
            }
            
        except ZeepFault as e:
            logger.error(f"SOAP fault registering pickup: {e}")
            raise BlueDartAPIError(f"Blue Dart API error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error registering pickup: {e}")
            raise BlueDartAPIError(f"Unexpected error: {str(e)}")
    
    def cancel_waybill(self, awb_number):
        """
        Cancel a waybill before it's manifested/picked up.
        
        IMPORTANT: This only works before the shipmentis in-scanned by Blue Dart.
        
        Args:
            awb_number: 11-digit AWB number
            
        Returns:
            dict: {
                'success': bool,
                'error': str or None
            }
        """
        logger.info(f"Cancelling waybill: {awb_number}")
        
        try:
            response = self.waybill_client.service.CancelWaybill(
                AWBNo=awb_number,
                Profile=self._get_profile()
            )
            
            # Check for errors
            if hasattr(response, 'IsError') and response.IsError:
                error_msg = getattr(response, 'ErrorMessage', 'Unknown error')
                logger.warning(f"Waybill cancellation failed for {awb_number}: {error_msg}")
                return {
                    'success': False,
                    'error': error_msg
                }
            
            logger.info(f"Waybill {awb_number} cancelled successfully")
            
            return {
                'success': True,
                'error': None
            }
            
        except ZeepFault as e:
            logger.error(f"SOAP fault cancelling waybill {awb_number}: {e}")
            raise BlueDartAPIError(f"Blue Dart API error: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error cancelling waybill {awb_number}: {e}")
            raise BlueDartAPIError(f"Unexpected error: {str(e)}")

