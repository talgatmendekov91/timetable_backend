# 🎓 University Schedule Backend API

Production-ready Node.js/Express backend for the University Schedule Management System.

## 🚀 Features

- ✅ RESTful API with Express.js
- ✅ PostgreSQL database
- ✅ JWT authentication
- ✅ Role-based access control (Admin/Teacher/Viewer)
- ✅ Input validation
- ✅ Rate limiting
- ✅ Security headers (Helmet)
- ✅ CORS configuration
- ✅ Request logging
- ✅ Error handling
- ✅ Database migrations
- ✅ Seed data scripts

## 📋 Prerequisites

- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

## 🛠️ Installation

### 1. Install Dependencies

```bash
cd schedule-backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=university_schedule
DB_USER=postgres
DB_PASSWORD=your_database_password

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 3. Initialize Database

```bash
npm run init-db
```

This will:
- Create the database
- Create all tables (users, groups, schedules)
- Create indexes

### 4. Seed Initial Data

```bash
npm run seed
```

This will:
- Create admin user (username: admin, password: admin123)
- Insert all 25 university groups
- Add some sample schedules

### 5. Start the Server

```bash
# Development (with nodemon)
npm run dev

# Production
npm start
```

Server will start on `http://localhost:3001`

## 📚 API Documentation

### Base URL
```
http://localhost:3001/api
```

### Authentication

All protected endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

---

### 🔐 Auth Endpoints

#### POST /api/auth/login
Login and get JWT token

**Request:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

#### GET /api/auth/verify
Verify JWT token (Protected)

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin"
  }
}
```

#### POST /api/auth/logout
Logout (Protected)

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

#### POST /api/auth/register
Register new user (Protected - Admin only)

**Request:**
```json
{
  "username": "newuser",
  "password": "password123",
  "role": "admin"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 2,
    "username": "newuser",
    "role": "admin"
  }
}
```

#### POST /api/auth/change-password
Change password (Protected)

**Request:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

---

### 📅 Schedule Endpoints

#### GET /api/schedules
Get all schedules (Public)

**Response:**
```json
{
  "COMSE-25-Monday-08:00": {
    "id": 1,
    "group": "COMSE-25",
    "day": "Monday",
    "time": "08:00",
    "course": "Data Structures",
    "teacher": "Prof. Johnson",
    "room": "Room 401",
    "created_at": "2025-02-06T10:00:00Z",
    "updated_at": "2025-02-06T10:00:00Z"
  }
}
```

#### POST /api/schedules
Create or update schedule (Protected - Admin only)

**Request:**
```json
{
  "group": "COMSE-25",
  "day": "Monday",
  "time": "08:00",
  "course": "Data Structures",
  "teacher": "Prof. Johnson",
  "room": "Room 401"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "group": "COMSE-25",
    "day": "Monday",
    "time": "08:00",
    "course": "Data Structures",
    "teacher": "Prof. Johnson",
    "room": "Room 401"
  }
}
```

#### DELETE /api/schedules/:group/:day/:time
Delete schedule (Protected - Admin only)

**Example:**
```
DELETE /api/schedules/COMSE-25/Monday/08:00
```

**Response:**
```json
{
  "success": true,
  "message": "Schedule deleted successfully"
}
```

#### GET /api/schedules/day/:day
Get schedules by day (Public)

**Example:**
```
GET /api/schedules/day/Monday
```

#### GET /api/schedules/teacher/:teacher
Get schedules by teacher (Public)

**Example:**
```
GET /api/schedules/teacher/Prof.%20Johnson
```

#### GET /api/schedules/group/:group
Get schedules by group (Public)

**Example:**
```
GET /api/schedules/group/COMSE-25
```

#### GET /api/schedules/teachers
Get all unique teachers (Public)

**Response:**
```json
[
  "Prof. Johnson",
  "Prof. Smith",
  "Prof. Williams"
]
```

---

### 📚 Group Endpoints

#### GET /api/groups
Get all groups (Public)

**Response:**
```json
[
  "COMSE-25",
  "COMCEH-25",
  "MATDAIS-25",
  ...
]
```

#### POST /api/groups
Create new group (Protected - Admin only)

**Request:**
```json
{
  "name": "COMSE-26"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 26,
    "name": "COMSE-26"
  }
}
```

#### DELETE /api/groups/:name
Delete group and all associated schedules (Protected - Admin only)

**Example:**
```
DELETE /api/groups/COMSE-26
```

**Response:**
```json
{
  "success": true,
  "message": "Group and associated schedules deleted successfully"
}
```

---

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Groups Table
```sql
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Schedules Table
```sql
CREATE TABLE schedules (
  id SERIAL PRIMARY KEY,
  group_name VARCHAR(50) NOT NULL,
  day VARCHAR(20) NOT NULL,
  time VARCHAR(10) NOT NULL,
  course VARCHAR(100) NOT NULL,
  teacher VARCHAR(100),
  room VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_name, day, time),
  FOREIGN KEY (group_name) REFERENCES groups(name) ON DELETE CASCADE
);
```

---

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (RBAC)
- Password hashing with bcrypt (10 rounds)
- Token expiration

### Security Middleware
- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Express-validator
- **SQL Injection Prevention**: Parameterized queries

### Best Practices
- Environment variables for secrets
- HTTPS recommended for production
- Regular security updates
- Audit logging

---

## 📁 Project Structure

```
schedule-backend/
├── src/
│   ├── config/
│   │   └── database.js         # Database connection
│   ├── controllers/
│   │   ├── authController.js   # Auth logic
│   │   ├── scheduleController.js
│   │   └── groupController.js
│   ├── models/
│   │   ├── User.js             # User model
│   │   ├── Schedule.js         # Schedule model
│   │   └── Group.js            # Group model
│   ├── routes/
│   │   ├── authRoutes.js       # Auth endpoints
│   │   ├── scheduleRoutes.js   # Schedule endpoints
│   │   └── groupRoutes.js      # Group endpoints
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   └── validation.js       # Input validation
│   └── server.js               # Express app
├── scripts/
│   ├── initDatabase.js         # Database setup
│   └── seedData.js             # Initial data
├── .env.example                # Environment template
├── .gitignore
├── package.json
└── README.md
```

---

## 🧪 Testing

### Health Check
```bash
curl http://localhost:3001/health
```

### Test Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Test Get Schedules
```bash
curl http://localhost:3001/api/schedules
```

### Test Protected Endpoint
```bash
# First get token from login
TOKEN="your_jwt_token_here"

curl http://localhost:3001/api/auth/verify \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🚀 Deployment

### Heroku Deployment

1. **Create Heroku app**
```bash
heroku create your-schedule-api
```

2. **Add PostgreSQL**
```bash
heroku addons:create heroku-postgresql:hobby-dev
```

3. **Set environment variables**
```bash
heroku config:set JWT_SECRET=your-secret-key
heroku config:set NODE_ENV=production
heroku config:set CORS_ORIGIN=https://your-frontend-url.com
```

4. **Deploy**
```bash
git push heroku main
```

5. **Initialize database**
```bash
heroku run npm run init-db
heroku run npm run seed
```

### Other Platforms

- **AWS**: Use RDS for PostgreSQL, EC2/ECS for Node.js
- **DigitalOcean**: App Platform with PostgreSQL database
- **Render**: PostgreSQL + Web Service
- **Railway**: PostgreSQL + Node.js deployment

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| NODE_ENV | Environment | development |
| DB_HOST | Database host | localhost |
| DB_PORT | Database port | 5432 |
| DB_NAME | Database name | university_schedule |
| DB_USER | Database user | postgres |
| DB_PASSWORD | Database password | - |
| JWT_SECRET | JWT signing key | - |
| JWT_EXPIRES_IN | Token expiration | 24h |
| CORS_ORIGIN | Allowed origin | http://localhost:3000 |
| RATE_LIMIT_WINDOW_MS | Rate limit window | 900000 (15 min) |
| RATE_LIMIT_MAX_REQUESTS | Max requests | 100 |

---

## 🐛 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
sudo service postgresql status

# Check credentials in .env
cat .env
```

### Port Already in Use
```bash
# Find process using port 3001
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Permission Denied (PostgreSQL)
```bash
# Update PostgreSQL user password
sudo -u postgres psql
ALTER USER postgres PASSWORD 'your_password';
```

---

## 📝 Changelog

### Version 1.0.0
- Initial release
- Authentication system
- Schedule CRUD operations
- Group management
- Rate limiting
- Input validation

---

## 📄 License

ISC

---

## 👥 Support

For issues or questions:
1. Check this README
2. Review code comments
3. Check error logs

---

**Built with Node.js + Express + PostgreSQL** | **Production-Ready**
