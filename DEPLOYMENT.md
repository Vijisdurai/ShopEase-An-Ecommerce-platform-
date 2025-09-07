# Production Deployment Guide

## Prerequisites
- Python 3.8+
- PostgreSQL (recommended for production)
- Nginx (as reverse proxy)
- Domain name with SSL certificate (Let's Encrypt)
- Server with at least 2GB RAM (4GB recommended)

## 1. Server Setup

### Install Dependencies
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install system dependencies
sudo apt install -y python3-pip python3-venv nginx postgresql postgresql-contrib

# Install certbot for SSL
sudo apt install -y certbot python3-certbot-nginx
```

### Configure PostgreSQL
```bash
# Connect to PostgreSQL
sudo -u postgres psql

# Create database and user
CREATE DATABASE ecommerce;
CREATE USER ecomuser WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ecommerce TO ecomuser;
\q
```

## 2. Application Setup

### Clone Repository
```bash
# Clone your repository
cd /opt
sudo git clone https://github.com/yourusername/e-commerace.git
sudo chown -R $USER:$USER e-commerace/
cd e-commerace
```

### Create Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
```

### Configure Environment Variables
Create a `.env` file in the project root:
```env
# App Settings
ENVIRONMENT=production
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://ecomuser:your_secure_password@localhost/ecommerce

# Frontend URL (for CORS)
FRONTEND_URL=https://yourdomain.com

# JWT Settings
ACCESS_TOKEN_EXPIRE_MINUTES=1440  # 24 hours
```

## 3. Nginx Configuration

### Create Nginx Config
Create `/etc/nginx/sites-available/ecommerce`:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Static files
    location /static/ {
        alias /opt/e-commerace/frontend/;
        expires 30d;
        access_log off;
        add_header Cache-Control "public, no-transform";
    }

    # API and app
    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # Disable access to .git directory
    location ~ /\.git/ {
        deny all;
        return 403;
    }
}
```

### Enable the Site
```bash
sudo ln -s /etc/nginx/sites-available/ecommerce /etc/nginx/sites-enabled
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

## 4. SSL Certificate

### Get Let's Encrypt Certificate
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Auto-renewal (optional)
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## 5. Systemd Service

### Create Gunicorn Service
Create `/etc/systemd/system/ecommerce.service`:
```ini
[Unit]
Description=Gunicorn instance to serve E-commerce API
After=network.target

[Service]
User=your_username
Group=www-data
WorkingDirectory=/opt/e-commerace
Environment="PATH=/opt/e-commerace/venv/bin"
EnvironmentFile=/opt/e-commerace/.env
ExecStart=/opt/e-commerace/venv/bin/gunicorn --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000 backend.main:app --timeout 120
Restart=always

[Install]
WantedBy=multi-user.target
```

### Start and Enable Service
```bash
sudo systemctl daemon-reload
sudo systemctl start ecommerce
sudo systemctl enable ecommerce
```

## 6. Database Migrations

### Run Migrations
```bash
cd /opt/e-commerace
source venv/bin/activate
alembic upgrade head
```

## 7. Firewall Configuration

### Configure UFW
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

## 8. Monitoring (Optional)

### Install Monitoring Tools
```bash
# Install monitoring tools
sudo apt install -y htop nmon

# Install logrotate
sudo cp /opt/e-commerace/deployment/logrotate.conf /etc/logrotate.d/ecommerce
```

## 9. Backup

### Database Backup Script
Create a backup script at `/opt/e-commerace/scripts/backup.sh`:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/e-commerace/backups"
DB_NAME="ecommerce"
DB_USER="ecomuser"

mkdir -p $BACKUP_DIR
pg_dump -U $DB_USER -d $DB_NAME > $BACKUP_DIR/backup_$DATE.sql

# Keep last 7 days backups
find $BACKUP_DIR -name "backup_*.sql" -type f -mtime +7 -delete
```

### Make it executable
```bash
chmod +x /opt/e-commerace/scripts/backup.sh
```

### Add to Crontab
```bash
# Edit crontab
crontab -e

# Add this line for daily backups at 2 AM
0 2 * * * /opt/e-commerace/scripts/backup.sh
```

## 10. Post-Deployment

### Verify Installation
1. Visit https://yourdomain.com
2. Check API docs at https://yourdomain.com/docs
3. Test user registration and login
4. Verify static files are being served correctly

### Monitoring Logs
```bash
# Application logs
journalctl -u ecommerce -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### Common Issues
1. **502 Bad Gateway**: Check if Gunicorn is running (`systemctl status ecommerce`)
2. **Static files not loading**: Verify Nginx has read permissions on the frontend directory
3. **Database connection issues**: Check database credentials in `.env`
4. **CORS errors**: Verify `FRONTEND_URL` in `.env` matches your domain

### Performance Tuning
- Adjust Gunicorn workers: `(2 x $num_cores) + 1`
- Enable database connection pooling
- Configure PostgreSQL for production
- Implement caching with Redis

## Security Hardening

### Update Regularly
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Python packages
source venv/bin/activate
pip install --upgrade pip
pip install --upgrade -r requirements.txt
```

### Security Headers
Ensure all security headers are properly set in Nginx configuration.

### Rate Limiting
Consider adding rate limiting to prevent abuse:
```nginx
# In Nginx server block
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    # ... rest of your config
}
```

## Scaling

### Horizontal Scaling
1. Set up a load balancer (e.g., AWS ALB, Nginx)
2. Configure multiple application servers
3. Use a managed database service
4. Implement Redis for caching and session management

### Database Replication
For high availability, set up:
- Primary-Replica replication
- Read replicas for read-heavy workloads
- Regular backups with point-in-time recovery

## Maintenance

### Update Application
```bash
cd /opt/e-commerace
git pull
source venv/bin/activate
pip install -r requirements.txt
systemctl restart ecommerce
```

### Database Migrations
After updating the code, run any new migrations:
```bash
alembic upgrade head
```

## Support
For support, please contact your system administrator or open an issue on the project's GitHub repository.
