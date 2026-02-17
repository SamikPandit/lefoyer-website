from zeep import Client
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Constants
WSDL_URL = 'https://netconnect.bluedart.com/Ver1.11/ShippingAPI/Finder/ServiceFinderQuery.svc?wsdl'
LOGIN_ID = 'DY3060117'
LICENCE_KEY = 'i7uhmfmmvjjijpg3ojsoops6h7qjivji'
PINCODE = '380001'

def get_area_code():
    print(f"Querying Blue Dart Finder API for Pincode: {PINCODE}")
    
    try:
        client = Client(WSDL_URL)
        
        profile = {
            'Api_type': 'S',
            'LicenceKey': LICENCE_KEY,
            'LoginID': LOGIN_ID,
            'Version': '1.3',
            'Area': 'AHD',  # Using AHD temporarily, hoping Finder is lenient
            'Customercode': 'AHD000032' 
        }
        
        response = client.service.GetServicesforPincode(
            pinCode=PINCODE,
            profile=profile
        )
        
        print("\n--- Response ---")
        print(response)
        
        if hasattr(response, 'AreaCode'):
            print(f"\n✅ CORRECT AREA CODE FOUND: {response.AreaCode}")
        else:
            print("\n❌ Area Code not found in response.")
            
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == '__main__':
    get_area_code()
