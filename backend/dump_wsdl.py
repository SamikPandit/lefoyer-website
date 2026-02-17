from zeep import Client

wsdl = 'https://netconnect.bluedart.com/Ver1.11/ShippingAPI/WayBill/WayBillGeneration.svc?wsdl'
try:
    client = Client(wsdl)
    client.wsdl.dump()
except Exception as e:
    print(f"Error: {e}")
