#!/bin/bash
# Import Product Data
# Usage: ./import_products.sh
# Ensure 'latest_products.json' is in the same directory or parent directory

cd "$(dirname "$0")/.."

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

if [ -f "latest_products.json" ]; then
    python manage.py loaddata latest_products.json
    echo "Successfully imported product data from latest_products.json"
else
    echo "Error: latest_products.json not found!"
    exit 1
fi
