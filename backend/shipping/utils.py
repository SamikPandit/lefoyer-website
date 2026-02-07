"""
Utility functions for Blue Dart API integration
"""
import time
from datetime import datetime, date
import base64
from django.core.files.base import ContentFile


def to_bluedart_date(dt):
    """
    Convert Python datetime/date to Blue Dart's Microsoft JSON date format.
    
    Args:
        dt: datetime or date object
        
    Returns:
        str: Date in format "/Date(timestamp_ms)/"
        
    Example:
        >>> to_bluedart_date(datetime(2026, 2, 10))
        '/Date(1770681600000)/'
    """
    if isinstance(dt, date) and not isinstance(dt, datetime):
        dt = datetime.combine(dt, datetime.min.time())
    
    timestamp_ms = int(time.mktime(dt.timetuple())) * 1000
    return f"/Date({timestamp_ms})/"


def from_bluedart_date(date_str):
    """
    Convert Blue Dart's Microsoft JSON date format to Python datetime.
    
    Args:
        date_str: String in format "/Date(timestamp_ms)/"
        
    Returns:
        datetime: Python datetime object
    """
    if not date_str or not isinstance(date_str, str):
        return None
    
    try:
        # Extract timestamp from "/Date(1770681600000)/"
        timestamp_ms = int(date_str.strip('/Date()'))
        return datetime.fromtimestamp(timestamp_ms / 1000)
    except (ValueError, AttributeError):
        return None


def parse_bluedart_display_date(date_str):
    """
    Parse Blue Dart's display date format (DD-MON-YY) to Python date.
    
    Args:
        date_str: String like "12-FEB-26"
        
    Returns:
        date: Python date object
    """
    if not date_str:
        return None
    
    try:
        return datetime.strptime(date_str, '%d-%b-%y').date()
    except ValueError:
        try:
            # Also try full year format
            return datetime.strptime(date_str, '%d-%b-%Y').date()
        except ValueError:
            return None


def calculate_volumetric_weight(length_cm, width_cm, height_cm):
    """
    Calculate volumetric weight for Blue Dart shipments.
    Blue Dart divisor = 5000
    
    Args:
        length_cm: Length in centimeters
        width_cm: Width in centimeters
        height_cm: Height in centimeters
        
    Returns:
        float: Volumetric weight in kg
    """
    return (length_cm * width_cm * height_cm) / 5000


def get_billable_weight(actual_kg, length_cm, width_cm, height_cm):
    """
    Get the billable weight (higher of actual vs volumetric).
    
    Args:
        actual_kg: Actual weight in kg
        length_cm: Length in cm
        width_cm: Width in cm
        height_cm: Height in cm
        
    Returns:
        float: Billable weight in kg
    """
    volumetric = calculate_volumetric_weight(length_cm, width_cm, height_cm)
    return max(float(actual_kg), volumetric)


def decode_label_pdf(base64_content):
    """
    Decode Base64-encoded PDF label from Blue Dart API response.
    
    Args:
        base64_content: Base64 string or bytes
        
    Returns:
        ContentFile: Django ContentFile ready to save to FileField
    """
    if isinstance(base64_content, str):
        base64_content = base64_content.encode('utf-8')
    
    pdf_bytes = base64.b64decode(base64_content)
    return ContentFile(pdf_bytes)


def truncate_address(address, max_length):
    """
    Truncate address to fit Blue Dart's field length limits.
    
    Args:
        address: Full address string
        max_length: Maximum allowed length
        
    Returns:
        str: Truncated address
    """
    if not address:
        return ""
    
    address = str(address).strip()
    if len(address) <= max_length:
        return address
    
    # Truncate and add ellipsis
    return address[:max_length - 3] + "..."


def split_address(full_address, line1_max=30, line2_max=30, line3_max=25):
    """
    Split a full address into multiple lines per Blue Dart requirements.
    
    Args:
        full_address: Complete address string
        line1_max: Max chars for address line 1
        line2_max: Max chars for address line 2
        line3_max: Max chars for address line 3
        
    Returns:
        tuple: (line1, line2, line3)
    """
    if not full_address:
        return ("", "", "")
    
    # Split by common delimiters
    parts = full_address.replace(',', ' ').split()
    
    line1 = ""
    line2 = ""
    line3 = ""
    
    for part in parts:
        if len(line1) + len(part) + 1 <= line1_max:
            line1 += (" " + part if line1 else part)
        elif len(line2) + len(part) + 1 <= line2_max:
            line2 += (" " + part if line2 else part)
        elif len(line3) + len(part) + 1 <= line3_max:
            line3 += (" " + part if line3 else part)
        else:
            break  # Can't fit anymore
    
    return (line1.strip(), line2.strip(), line3.strip())
