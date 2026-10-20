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


# ---------------------------------------------------------------------------
# Strict boolean coercion (WP-06 / LF-11)
# ---------------------------------------------------------------------------
# `BlueDartClient` builds its zeep clients with `Settings(strict=False)`, which
# makes zeep tolerant of a WSDL whose element types do not match the payload it
# actually receives. The practical consequence for serviceability is severe: if
# Blue Dart's Finder WSDL types `DomesticPriorityOutbound` / `eTailCODAirOutbound`
# as `xsd:string` (or the element arrives untyped and zeep falls back to text),
# then zeep hands us the *string* `'false'` — and in Python
#
#     bool('false') is True
#
# so a lenient `if response.DomesticPriorityOutbound:` would report **every**
# pincode in India as serviceable and the storefront would promise delivery
# everywhere. The WSDL is fetched over the network at runtime and is not
# reachable from the build environment, so which case production hits cannot be
# determined from this repository: the only safe move is to never trust the
# truthiness of these values and push every one of them through the coercion
# below before it reaches JSON.
#
# Unrecognised input returns `default` (False for a delivery promise) and logs a
# warning, because "we could not understand the courier" must never render as
# "yes, we deliver".

import logging as _logging
from decimal import Decimal

_bool_logger = _logging.getLogger(__name__)

#: Textual spellings Blue Dart / zeep / XML booleans are known to use for true.
STRICT_BOOL_TRUE_TOKENS = frozenset({'true', 't', 'yes', 'y', '1'})

#: Textual spellings treated as false. The empty string is here deliberately:
#: an absent XML value means "not offered", not "unknown but probably yes".
STRICT_BOOL_FALSE_TOKENS = frozenset({
    'false', 'f', 'no', 'n', '0', '', 'none', 'null', 'nil', 'na', 'n/a', '-',
})


def to_strict_bool(value, default=False, field_name=None):
    """
    Coerce a `str | bool | int | None` into a real Python ``bool``.

    Never relies on truthiness. `'false'`, `'False'`, `'FALSE '`, `'no'`, `'0'`
    and `''` are all ``False``; `'true'`, `'yes'`, `'1'` are ``True``.

    Args:
        value: Whatever the SOAP layer produced.
        default: Returned for ``None`` and for anything unrecognised.
        field_name: Included in the warning log line, for diagnosing a real WSDL.

    Returns:
        bool: Always a real ``bool`` — never a string, never ``None``.
    """
    # bool is a subclass of int, so it has to be tested first.
    if isinstance(value, bool):
        return value

    if value is None:
        return bool(default)

    if isinstance(value, (int, float, Decimal)):
        return value != 0

    if isinstance(value, bytes):
        try:
            value = value.decode('utf-8', 'replace')
        except Exception:  # pragma: no cover - defensive
            return bool(default)

    if isinstance(value, str):
        token = value.strip().lower()
        if token in STRICT_BOOL_TRUE_TOKENS:
            return True
        if token in STRICT_BOOL_FALSE_TOKENS:
            return False
        _bool_logger.warning(
            "Unrecognised boolean %r for %s from Blue Dart; defaulting to %s",
            value, field_name or 'field', bool(default)
        )
        return bool(default)

    # zeep can hand back an xsd value object or an AnyObject. Its `_value_1`
    # payload is the text node; try that once, then give up loudly.
    inner = getattr(value, '_value_1', None)
    if inner is not None and not isinstance(inner, type(value)):
        return to_strict_bool(inner, default=default, field_name=field_name)

    _bool_logger.warning(
        "Unsupported boolean type %s (%r) for %s from Blue Dart; defaulting to %s",
        type(value).__name__, value, field_name or 'field', bool(default)
    )
    return bool(default)
