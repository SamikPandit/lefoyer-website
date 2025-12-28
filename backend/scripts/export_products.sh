#!/bin/bash
# Export Product Data
cd "$(dirname "$0")/.."
source venv/bin/activate
python manage.py dumpdata products.Category products.SubCategory products.Product --indent 2 > latest_products.json
echo "Product data exported to backend/latest_products.json"
