# 🚀 Authentication & Authorization Backend

A production-style authentication system built using **Node.js, Express, MongoDB, JWT, and Redis**, with secure session handling and role-based access control.

Deployed on Render and integrated with **Brevo API** for email services.

---

## 🌐 Live Demo

👉 Frontend (Live Demo):
[Open App](https://anjan1920.github.io/auth-system-frontend/pages/index.html)

👉 Backend API:
[View API](https://auth-system-backend-fdwu.onrender.com)

---

## 🔑 Test Credentials

Use these to directly explore the system without registering:

### 👤 Guest User

- Email: `guest201@example.com`
- Password: `guest2026`

### 🛠 Admin User

- Email: `admin@example.com`
- Password: `admin2026`

  👉 Note: First request may take ~30–60 seconds (Render cold start)

---


## 🧠 Overview

This project implements a complete authentication lifecycle:

- User registration & email verification
- Secure login with JWT (Access + Refresh Tokens)
- Redis-based session validation
- Logout with token invalidation
- Password reset flow via email
- Role-based authorization (Admin/User)
- Rate limiting to prevent brute-force attacks

---

## 🛠️ Tech Stack

### Backend

- Node.js
- Express.js
- MongoDB + Mongoose

### Authentication & Security

- JWT (Access Token + Refresh Token)
- Refresh Token Rotation
- bcrypt (password hashing)
- HTTP-only cookies

### Caching & Protection

- Redis (session management + rate limiting)

### Email Service

- Brevo (Production API)

### Deployment

- Render

---

## 🔐 Authentication Flow

### Login

```
User login
→ Validate credentials
→ Generate Access Token + Refresh Token
→ Generate JTI (unique token ID)
→ Store session in Redis (TTL = access token expiry)
→ Send tokens via HTTP-only cookies
```

---

### Access Protected Routes

```
Request
→ Verify JWT
→ Extract JTI
→ Check Redis:

   Exists → Allow access
   Not found → Reject request
```

---

### Logout

```
User logout
→ Delete session from Redis (using JTI)
→ Clear cookies
```

👉 Fixes JWT stateless logout issue (real-world problem)

---

## ⚡ Redis Usage

### 1. Session Validation Layer

- Key → `JTI`
- Value → `{ userId, email }`
- TTL → ~15 minutes

👉 Redis acts as a **server-side control layer over JWT**

---

### 2. Rate Limiting (Login Security)

```
User hits login API
→ Key = email/IP
→ Value = attempt count
→ TTL = 2 minutes

Each request:
→ INCR counter

If attempts > 5:
→ Block request
→ Return "Too many attempts"
```

👉 Prevents brute-force login attacks

---

## 🔐 Authorization

- Role-Based Access Control (RBAC)
- Roles:

  - Admin
  - User
- Middleware:

  - `auth.middleware.js`
  - `role.middleware.js`

---

## 📁 Folder Structure

```
.
├── app.js                     # Express app setup
├── index.js                   # Server entry point

├── config/
│   └── redis_connect.js       # Redis connection setup

├── db/
│   └── index.js               # MongoDB connection

├── controllers/
│   ├── auth.controller.js         # Auth logic (login, register, etc.)
│   ├── admin.controller.js        # Admin-related logic
│   ├── user.controller.js         # User operations (profile, etc.)
│   └── healthcheck.controller.js  # Server health check

├── middlewares/
│   ├── auth.middleware.js         # JWT verification + Redis check
│   ├── role.middleware.js         # Role-based access control
│   ├── rateLimiter.middleware.js  # Login rate limiting (Redis)
│   └── validator.middleware.js    # Request validation

├── models/
│   └── user.model.js              # User schema

├── routes/
│   ├── auth.routes.js             # Auth endpoints
│   └── admin.routes.js            # Admin endpoints

├── utils/
│   ├── redis_utils.js             # Redis helper functions
│   ├── mail.js                    # Email service (Brevo/Nodemailer)
│   ├── api-error.js               # Custom error handler
│   ├── api-response.js            # Standard API responses
│   └── async-handler.js           # Try-catch wrapper

├── validators/
│   └── index.js                   # Validation schemas

├── .env                          # Environment variables
├── .gitignore
├── package.json
└── README.md
```

---

## 🌐 API Endpoints

### Authentication

| Method | Endpoint                           | Description      |
| ------ | ---------------------------------- | ---------------- |
| POST   | /api/v1/auth/register              | Register user    |
| POST   | /api/v1/auth/login                 | Login            |
| POST   | /api/v1/auth/logout                | Logout           |
| POST   | /api/v1/auth/refresh-token         | Refresh tokens   |
| POST   | /api/v1/auth/forgot-password       | Send reset email |
| POST   | /api/v1/auth/reset-password/:token | Reset password   |
| GET    | /api/v1/auth/verify-email/:token   | Verify email     |
| POST   | /api/v1/auth/resend-verification   | Resend email     |

---

### Admin

| Method | Endpoint                  | Description  |
| ------ | ------------------------- | ------------ |
| POST   | /api/v1/admin/login       | Admin login  |
| GET    | /api/v1/admin/healthcheck | Health check |
| GET    | /api/v1/admin/getAllUsers | Get users    |

---

## 🚀 Deployment Notes

- Backend hosted on Render
- Redis used via Render internal service
- Environment variables configured in Render dashboard

---

## 🎯 Why This Project Matters

This is not just a basic login system.

It demonstrates:

- Production-level authentication design
- Secure session handling
- Token lifecycle management
- Real-world security practices
- Admin + user separation

👉 Exactly what companies expect from backend engineers

---

## 🔮 Future Improvements

- OAuth (Google/Github login)
- 2FA authentication
- Advanced RBAC (permissions system)
- API monitoring dashboard

---

## 👨‍💻 Author

**Anjan**
📲[LinkedIn](https://www.linkedin.com/in/anjan-das-22b278236/)
