# 🚀 Deployment Guide

Complete guide for deploying the University Schedule System to production.

## 📋 Pre-Deployment Checklist

### Security
- [ ] Change default admin password
- [ ] Set strong JWT_SECRET (min 32 characters)
- [ ] Use environment variables for all secrets
- [ ] Enable HTTPS
- [ ] Configure CORS for production domain
- [ ] Set NODE_ENV=production
- [ ] Review and adjust rate limits
- [ ] Enable database SSL
- [ ] Set up firewall rules

### Database
- [ ] Backup strategy in place
- [ ] Database connection pooling configured
- [ ] Indexes created
- [ ] Monitoring enabled

### Application
- [ ] All tests passing
- [ ] Error logging configured
- [ ] Performance monitoring setup
- [ ] Health check endpoint working
- [ ] Documentation up to date

---

## 🌐 Deployment Options

### Option 1: Heroku (Easiest)

#### Backend Deployment

1. **Install Heroku CLI**
```bash
curl https://cli-assets.heroku.com/install.sh | sh
```

2. **Login to Heroku**
```bash
heroku login
```

3. **Create Heroku App**
```bash
cd schedule-backend
heroku create your-schedule-api
```

4. **Add PostgreSQL**
```bash
heroku addons:create heroku-postgresql:hobby-dev
```

5. **Set Environment Variables**
```bash
heroku config:set JWT_SECRET=$(openssl rand -base64 32)
heroku config:set NODE_ENV=production
heroku config:set CORS_ORIGIN=https://your-frontend-domain.com
```

6. **Deploy**
```bash
git init
git add .
git commit -m "Initial commit"
git push heroku main
```

7. **Initialize Database**
```bash
heroku run npm run init-db
heroku run npm run seed
```

8. **Open App**
```bash
heroku open /health
```

#### Frontend Deployment (Vercel)

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Deploy**
```bash
cd university-schedule
vercel
```

3. **Set Environment Variable**
```bash
vercel env add REACT_APP_API_URL
# Enter: https://your-schedule-api.herokuapp.com/api
```

4. **Deploy to Production**
```bash
vercel --prod
```

---

### Option 2: DigitalOcean

#### Backend (App Platform)

1. **Create Account** at digitalocean.com

2. **Create App**
- Click "Create" → "Apps"
- Connect GitHub repository
- Select schedule-backend

3. **Configure**
- Build Command: `npm install`
- Run Command: `npm start`
- HTTP Port: 3001

4. **Add Database**
- Add PostgreSQL database component
- Note connection string

5. **Environment Variables**
```
DB_HOST=<from database connection>
DB_PORT=25060
DB_NAME=<database name>
DB_USER=<database user>
DB_PASSWORD=<from database connection>
JWT_SECRET=<generate secure key>
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.com
```

6. **Deploy**
- Click "Create Resources"
- Wait for deployment

7. **Initialize Database**
- Use console to run:
```bash
npm run init-db
npm run seed
```

#### Frontend (Netlify)

1. **Build Frontend**
```bash
cd university-schedule
npm run build
```

2. **Deploy to Netlify**
- Drag `build` folder to netlify.com
- OR use Netlify CLI:
```bash
npm i -g netlify-cli
netlify deploy --prod
```

3. **Environment Variables**
- Site Settings → Build & Deploy → Environment
- Add: `REACT_APP_API_URL=https://your-backend-url/api`

---

### Option 3: AWS

#### Backend (Elastic Beanstalk)

1. **Install AWS CLI & EB CLI**
```bash
pip install awsebcli
```

2. **Initialize EB**
```bash
cd schedule-backend
eb init
```

3. **Create Environment**
```bash
eb create production
```

4. **Add RDS Database**
- AWS Console → RDS
- Create PostgreSQL database
- Note connection details

5. **Set Environment Variables**
```bash
eb setenv \
  DB_HOST=<rds-endpoint> \
  DB_PORT=5432 \
  DB_NAME=university_schedule \
  DB_USER=<db-user> \
  DB_PASSWORD=<db-password> \
  JWT_SECRET=<secure-key> \
  NODE_ENV=production \
  CORS_ORIGIN=https://your-frontend.com
```

6. **Deploy**
```bash
eb deploy
```

#### Frontend (S3 + CloudFront)

1. **Build**
```bash
cd university-schedule
npm run build
```

2. **Create S3 Bucket**
```bash
aws s3 mb s3://your-schedule-app
```

3. **Upload**
```bash
aws s3 sync build/ s3://your-schedule-app
```

4. **Configure Static Website Hosting**
- S3 Console → Properties → Static Website Hosting
- Enable and set index.html

5. **Create CloudFront Distribution**
- Origin: S3 bucket
- Viewer Protocol Policy: Redirect HTTP to HTTPS

---

### Option 4: VPS (Ubuntu Server)

#### Backend Setup

1. **SSH into Server**
```bash
ssh root@your-server-ip
```

2. **Install Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

3. **Install PostgreSQL**
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

4. **Create Database**
```bash
sudo -u postgres psql
CREATE DATABASE university_schedule;
CREATE USER scheduleuser WITH PASSWORD 'securepassword';
GRANT ALL PRIVILEGES ON DATABASE university_schedule TO scheduleuser;
\q
```

5. **Clone Repository**
```bash
git clone https://github.com/your-repo/schedule-backend.git
cd schedule-backend
npm install
```

6. **Create .env File**
```bash
nano .env
```

7. **Install PM2**
```bash
sudo npm install -g pm2
```

8. **Start Application**
```bash
npm run init-db
npm run seed
pm2 start src/server.js --name schedule-api
pm2 save
pm2 startup
```

9. **Install Nginx**
```bash
sudo apt install nginx
```

10. **Configure Nginx**
```bash
sudo nano /etc/nginx/sites-available/schedule-api
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/schedule-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

11. **Install SSL Certificate**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

#### Frontend Deployment

Same VPS or separate server - serve with Nginx:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/schedule-app/build;
    index index.html;

    location / {
        try_files $uri /index.html;
    }
}
```

---

## 🔒 Production Configuration

### Backend .env (Production)

```env
# Server
PORT=3001
NODE_ENV=production

# Database (use production credentials)
DB_HOST=your-production-db-host
DB_PORT=5432
DB_NAME=university_schedule
DB_USER=your-db-user
DB_PASSWORD=strong-secure-password

# JWT (generate secure key)
JWT_SECRET=your-very-long-and-secure-random-string-minimum-32-characters
JWT_EXPIRES_IN=24h

# CORS (your actual frontend URL)
CORS_ORIGIN=https://schedule.youruniversity.edu

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### Frontend .env (Production)

```env
REACT_APP_API_URL=https://api.schedule.youruniversity.edu/api
```

---

## 📊 Monitoring & Logging

### Application Monitoring

**Option 1: PM2 Plus**
```bash
pm2 plus
```

**Option 2: New Relic**
```bash
npm install newrelic
```

**Option 3: Sentry**
```bash
npm install @sentry/node
```

### Database Monitoring

- Enable PostgreSQL logging
- Set up query performance monitoring
- Configure backup alerts
- Monitor connection pool usage

### Log Management

**Papertrail / Loggly / CloudWatch**
```bash
# Install winston for structured logging
npm install winston
```

---

## 🔐 SSL/TLS Certificate

### Free Option: Let's Encrypt

```bash
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

### Auto-renewal
```bash
sudo certbot renew --dry-run
```

---

## 💾 Backup Strategy

### Database Backups

**Automated Daily Backup**
```bash
# Create backup script
nano /usr/local/bin/backup-db.sh
```

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump university_schedule > /backups/schedule_$DATE.sql
# Upload to S3 or other storage
aws s3 cp /backups/schedule_$DATE.sql s3://your-backup-bucket/
```

```bash
chmod +x /usr/local/bin/backup-db.sh
crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-db.sh
```

---

## 🔍 Health Checks

### Backend Health Endpoint

Already implemented at `/health`

Test:
```bash
curl https://api.yourdomain.com/health
```

### Uptime Monitoring

Use services like:
- UptimeRobot (free)
- Pingdom
- StatusCake
- AWS CloudWatch

---

## 🚨 Troubleshooting Production Issues

### Backend Not Starting

1. Check logs:
```bash
pm2 logs schedule-api
# or
heroku logs --tail
```

2. Verify environment variables
3. Check database connection
4. Verify port not in use

### Database Connection Issues

1. Check credentials
2. Verify firewall rules
3. Test connection:
```bash
psql -h host -U user -d database
```

### CORS Errors

1. Verify CORS_ORIGIN matches frontend URL
2. Check protocol (http vs https)
3. Ensure no trailing slashes

### 502 Bad Gateway

1. Backend not running
2. Port mismatch in Nginx config
3. Check backend logs

---

## 📈 Performance Optimization

### Database

- Create indexes on frequently queried columns
- Use connection pooling
- Enable query caching
- Regular VACUUM and ANALYZE

### Application

- Enable gzip compression
- Use CDN for static assets
- Implement caching headers
- Minimize API calls

### Monitoring

- Set up APM (Application Performance Monitoring)
- Track slow queries
- Monitor memory usage
- Track error rates

---

## 🎯 Post-Deployment

- [ ] Test all endpoints
- [ ] Verify login works
- [ ] Create first real admin user
- [ ] Add university groups
- [ ] Test schedule creation
- [ ] Verify filters work
- [ ] Test on mobile devices
- [ ] Load testing
- [ ] Security audit
- [ ] Set up monitoring alerts
- [ ] Document admin procedures
- [ ] Train administrators

---

**Your production deployment is ready!** 🎉

For issues, check logs and monitoring dashboards.
