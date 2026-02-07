# Blue Dart Shipping Integration - Setup Guide

## Prerequisites

Before starting, ensure you have:

1. **Blue Dart API Credentials** - Contact Blue Dart sales/integration team to obtain:
   - Login ID
   - Licence Key
   - Customer Code (prepaid)
   - COD Customer Code (if using COD)
   - Tracking Licence Key

2. **Redis Server** - Required for Celery task queue
   ```bash
   # Install Redis
   sudo apt-get install redis-server
   
   # Start Redis
   sudo systemctl start redis
   sudo systemctl enable redis
   ```

3. **Environment Variables** - Copy and configure:
   ```bash
   cp .env.example .env
   # Edit .env with your Blue Dart credentials
   ```

## Installation Steps

### 1. Install Dependencies

```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure Environment

Edit `.env` file with your Blue Dart credentials and warehouse details:

```bash
BLUEDART_LOGIN_ID=your_actual_login_id
BLUEDART_LICENCE_KEY=your_actual_licence_key
BLUEDART_CUSTOMER_CODE=your_actual_customer_code
BLUEDART_ORIGIN_AREA=your_area_code  # e.g., BOM, DEL, BLR
BLUEDART_ORIGIN_PINCODE=your_warehouse_pincode
BLUEDART_WAREHOUSE_ADDRESS=your_complete_address
BLUEDART_WAREHOUSE_CONTACT=contact_person_name
BLUEDART_WAREHOUSE_PHONE=contact_phone_number
BLUEDART_DEMO_MODE=True  # Use demo endpoints for testing
```

### 3. Run Database Migrations

```bash
python manage.py makemigrations shipping
python manage.py migrate
```

### 4. Start Celery Worker

Open a new terminal and start the Celery worker:

```bash
cd backend
source venv/bin/activate
celery -A lefoyer worker -l info
```

### 5. Start Celery Beat (Scheduler)

Open another terminal for scheduled tasks:

```bash
cd backend
source venv/bin/activate
celery -A lefoyer beat -l info
```

### 6. Start Django Server

```bash
python manage.py runserver
```

## Testing the Integration

### 1. Check Pincode Serviceability

```bash
curl "http://localhost:8000/api/shipping/check-serviceability/?pincode=560001"
```

Expected response:
```json
{
  "serviceable": true,
  "cod_available": false,
  "expected_delivery_date": "2026-02-10",
  "transit_days": 2,
  "area_code": "BLR",
  "error": null
}
```

### 2. Create Test Order

1. Place an order through the frontend
2. Complete payment using PhonePe
3. Check Django admin for automatically created shipment
4. Verify AWB number and label PDF are generated

### 3. Track Shipment

```bash
curl "http://localhost:8000/api/shipping/track/12345678901/"
```

## Production Deployment

### 1. Switch to Production Mode

Update `.env`:
```bash
BLUEDART_DEMO_MODE=False
DEBUG=False
```

### 2. Use Process Manager for Celery

Instead of running Celery manually, use systemd or supervisor:

**Celery Worker Service** (`/etc/systemd/system/celery.service`):
```ini
[Unit]
Description=Celery Worker
After=network.target

[Service]
Type=forking
User=www-data
Group=www-data
WorkingDirectory=/path/to/lefoyer-website/backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/celery -A lefoyer worker -l info --pidfile=/var/run/celery/worker.pid
ExecStop=/bin/kill -s TERM $MAINPID
Restart=always

[Install]
WantedBy=multi-user.target
```

**Celery Beat Service** (`/etc/systemd/system/celerybeat.service`):
```ini
[Unit]
Description=Celery Beat
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/path/to/lefoyer-website/backend
Environment="PATH=/path/to/venv/bin"
ExecStart=/path/to/venv/bin/celery -A lefoyer beat -l info
Restart=always

[Install]
WantedBy=multi-user.target
```

Start services:
```bash
sudo systemctl daemon-reload
sudo systemctl start celery celerybeat
sudo systemctl enable celery celerybeat
```

### 3. Configure Production Redis

Update `.env`:
```bash
REDIS_URL=redis://your-redis-host:6379/0
# Or for Redis with password:
REDIS_URL=redis://:password@your-redis-host:6379/0
```

### 4. Monitor Celery Tasks

```bash
# View worker status
celery -A lefoyer inspect active

# View scheduled tasks
celery -A lefoyer inspect scheduled
```

## Scheduled Tasks

The following Celery Beat tasks run automatically:

1. **Daily Pickup Registration** - 4:00 PM IST daily
   - Registers all booked shipments for pickup
   
2. **Tracking Poll** - Every 2 hours
   - Updates shipment status for all active shipments

## API Endpoints

- `GET /api/shipping/check-serviceability/?pincode=<pincode>` - Check serviceability
- `GET /api/shipping/track/<awb_number>/` - Track shipment
- `GET /api/shipping/label/<awb_number>/` - Download label (authenticated)
- `GET /api/shipping/shipments/` - List user's shipments (authenticated)
- `GET /api/shipping/shipments/<id>/` - Get shipment details (authenticated)

## Troubleshooting

### Shipment Not Generated After Payment

1. Check Celery worker logs
2. Verify Redis is running: `redis-cli ping`
3. Check order payment status in admin
4. Manually trigger: `Order` object should have `payment_status='COMPLETED'`

### Blue Dart API Errors

1. Verify credentials in `.env`
2. Check `BLUEDART_DEMO_MODE` setting
3. Review shipment `last_error` field in admin
4. Contact Blue Dart support if credentials invalid

### Tracking Not Updating

1. Ensure Celery Beat is running
2. Check `poll_active_shipments` task in Celery logs
3. Verify AWB number is correct
4. Check shipment is not in terminal status (delivered/cancelled)

## Support

For Blue Dart API issues:
- Contact: Blue Dart Integration Team
- Documentation: Refer to Blue Dart SOAP API documentation

For technical issues:
- Check Celery logs: `/var/log/celery/`
- Check Django logs
- Review admin panel for shipment errors
