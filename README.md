# Audio Transcript Application

A professional full-stack audio transcription platform with JWT authentication, multi-tenancy support, and AI-ready transcription capabilities.

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
- [Database Migrations](#-database-migrations)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [Default Credentials](#-default-credentials)
- [Development Workflow](#-development-workflow)

## ✨ Features

### Core Functionality
- **JWT Authentication** - Secure token-based authentication with role-based access control
- **Multi-Tenancy** - Complete tenant isolation for multiple organizations
- **Audio Recording** - Capture and store audio from device and microphone
- **Session Management** - Create, manage, and track recording sessions
- **Transcript Management** - Manual and AI-powered (integration ready) transcription
- **Admin Dashboard** - User approval workflow and system administration
- **Speaker Diarization** - AI-powered speaker identification (OpenAI ready)

### Technical Highlights
- Role-Based Access Control (Admin/User)
- Tenant data isolation
- Server-side audio file storage
- RESTful API architecture
- Type-safe TypeScript frontend
- Clean architecture with SOLID principles

## 🏗️ Architecture

### Backend Structure
```
backend/
├── app/
│   ├── api/v1/          # API endpoints (versioned)
│   ├── core/            # Configuration, security, dependencies
│   ├── models/          # SQLAlchemy ORM models
│   ├── schemas/         # Pydantic validation schemas
│   ├── repositories/    # Data access layer
│   ├── services/        # Business logic layer
│   ├── middleware/      # Custom middleware
│   └── database/        # Database session management
├── alembic/             # Database migrations
│   ├── versions/        # Migration scripts
│   └── env.py          # Alembic configuration
└── storage/             # Audio file storage
```

### Frontend Structure
```
frontend/
├── src/
│   ├── app/             # Next.js App Router pages
│   ├── components/      # Reusable React components
│   ├── lib/
│   │   ├── api/        # API client functions
│   │   ├── contexts/   # React contexts
│   │   └── hooks/      # Custom React hooks
│   └── types/          # TypeScript type definitions
```

## 🛠️ Technology Stack

### Backend
- **FastAPI** 0.109.0 - Modern, fast Python web framework
- **SQLAlchemy** 2.0.36 - SQL toolkit and ORM
- **Alembic** 1.13.1 - Database migration tool
- **MySQL** 8.0+ - Relational database
- **PyJWT** - JSON Web Token implementation
- **Passlib + Bcrypt** - Password hashing
- **Pydantic** 2.10.5 - Data validation
- **PyAnnote.audio** - Speaker diarization
- **OpenAI** - AI transcription integration

### Frontend
- **Next.js** 14.1 - React framework with App Router
- **React** 18.2 - UI library
- **TypeScript** 5.3 - Type safety
- **TailwindCSS** 3.4 - Utility-first CSS
- **TanStack Query** 5.17 - Server state management
- **Zustand** 4.4 - Client state management
- **Axios** 1.6 - HTTP client

## 📦 Prerequisites

Before you begin, ensure you have the following installed:

- **Python** 3.11 or higher
- **Node.js** 18.x or higher
- **npm** or **yarn**
- **MySQL** 8.0 or higher
- **Git**

## 🚀 Installation

### Backend Setup

#### 1. Clone and Navigate
```bash
cd backend
```

#### 2. Create Virtual Environment
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# Linux/Mac
python3 -m venv venv
source venv/bin/activate
```

#### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 4. Configure Environment Variables
Create a `.env` file in the `backend` directory:

```bash
# Application
APP_NAME=Audio Transcript API
APP_VERSION=1.0.0
DEBUG=False
ENVIRONMENT=development

# Server
HOST=0.0.0.0
PORT=8000

# Database
DATABASE_URL=mysql+pymysql://username:password@localhost:3306/audio_transcript

# Security (Generate a secure random key)
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS
ALLOWED_ORIGINS=http://localhost:3000
ALLOWED_METHODS=GET,POST,PUT,DELETE,OPTIONS
ALLOWED_HEADERS=*

# File Storage
STORAGE_PATH=./storage
MAX_FILE_SIZE_MB=100

# First Admin User
FIRST_ADMIN_EMAIL=admin@example.com
FIRST_ADMIN_PASSWORD=SecurePassword123!
FIRST_ADMIN_NAME=System Administrator
```

> **Security Note**: Generate a secure `SECRET_KEY` using:
> ```bash
> python -c "import secrets; print(secrets.token_urlsafe(32))"
> ```

#### 5. Set Up MySQL Database
```sql
CREATE DATABASE audio_transcript CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

#### 6. Run Database Migrations
See [Database Migrations](#-database-migrations) section below for detailed instructions.

#### 7. Initialize Default Data
After running migrations, initialize the database with default tenant and admin user:
```bash
python init_db.py
```

**Important**: Save the admin credentials displayed by the script!

### Frontend Setup

#### 1. Navigate to Frontend
```bash
cd frontend
```

#### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

#### 3. Configure Environment Variables
Create a `.env.local` file in the `frontend` directory:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🗄️ Database Migrations

This project uses **Alembic** for database schema management. All schema changes should be made through migrations.

### Initial Setup

#### 1. Run Initial Migration
```bash
cd backend
alembic upgrade head
```

This creates all database tables based on your SQLAlchemy models.

### Creating New Migrations

When you modify SQLAlchemy models, create a new migration:

#### 1. Auto-generate Migration
```bash
alembic revision --autogenerate -m "Description of changes"
```

This creates a new migration file in `alembic/versions/` with:
- Timestamp
- Revision ID
- Description of changes

#### 2. Review the Migration
Check the generated file in `alembic/versions/` to ensure it captures your changes correctly.

#### 3. Apply the Migration
```bash
alembic upgrade head
```

### Common Migration Commands

```bash
# Show current migration version
alembic current

# Show migration history
alembic history

# Upgrade to latest version
alembic upgrade head

# Upgrade to specific version
alembic upgrade <revision_id>

# Downgrade one version
alembic downgrade -1

# Downgrade to specific version
alembic downgrade <revision_id>

# Show SQL without applying
alembic upgrade head --sql
```

### Migration Best Practices

1. **Always review auto-generated migrations** before applying
2. **Test migrations on development database** first
3. **Never modify applied migrations** - create new ones instead
4. **Backup database** before applying migrations in production
5. **Keep migrations small and focused** on single changes

### Troubleshooting Migrations

If you encounter issues:

```bash
# Check current state
alembic current

# If migrations are out of sync, stamp the database
alembic stamp head

# Re-run migrations
alembic upgrade head
```

## ▶️ Running the Application

### Start Backend Server

```bash
cd backend

# Activate virtual environment
# Windows: venv\Scripts\activate
# Linux/Mac: source venv/bin/activate

# Run with uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or run directly
python app/main.py
```

**Backend URLs:**
- API: http://localhost:8000
- Interactive Docs (Swagger): http://localhost:8000/api/docs
- Alternative Docs (ReDoc): http://localhost:8000/api/redoc

### Start Frontend Server

```bash
cd frontend

# Development mode
npm run dev
# or
yarn dev
```

**Frontend URL:**
- Application: http://localhost:3000

### Production Build

```bash
# Frontend
cd frontend
npm run build
npm start

# Backend
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 📚 API Documentation

### Authentication
- `POST /api/v1/auth/signup` - Register new user (requires admin approval)
- `POST /api/v1/auth/login` - User login, returns JWT token
- `GET /api/v1/auth/me` - Get current user profile
- `POST /api/v1/auth/logout` - User logout

### Admin (Admin Role Required)
- `GET /api/v1/admin/pending-users` - List users pending approval
- `POST /api/v1/admin/users/{user_id}/approve` - Approve/reject user registration
- `DELETE /api/v1/admin/users/{user_id}` - Delete user account

### Sessions
- `POST /api/v1/sessions` - Create new recording session
- `POST /api/v1/sessions/{id}/end` - End session and upload audio file
- `GET /api/v1/sessions` - List sessions (paginated, filtered by tenant)
- `GET /api/v1/sessions/{id}` - Get session details
- `PUT /api/v1/sessions/{id}` - Update session metadata
- `DELETE /api/v1/sessions/{id}` - Delete session and associated files

### Transcripts
- `POST /api/v1/transcripts` - Create transcript for session
- `GET /api/v1/transcripts/session/{session_id}` - Get transcript by session
- `GET /api/v1/transcripts/{id}` - Get transcript by ID
- `PUT /api/v1/transcripts/{id}` - Update transcript content
- `DELETE /api/v1/transcripts/{id}` - Delete transcript

### Speakers
- `GET /api/v1/speakers` - List speakers
- `POST /api/v1/speakers` - Create speaker profile
- `PUT /api/v1/speakers/{id}` - Update speaker details
- `DELETE /api/v1/speakers/{id}` - Delete speaker

Visit http://localhost:8000/api/docs for interactive API documentation.

## 🔐 Default Credentials

After running `init_db.py`, use these credentials for first login:

- **Email**: Value from `FIRST_ADMIN_EMAIL` in `.env` (default: admin@example.com)
- **Password**: Value from `FIRST_ADMIN_PASSWORD` in `.env` (default: changeme)

⚠️ **Critical**: Change the admin password immediately after first login!

## 💻 Development Workflow

### Making Schema Changes

1. **Modify SQLAlchemy models** in `backend/app/models/`
2. **Create migration**: `alembic revision --autogenerate -m "Add new field"`
3. **Review migration** in `backend/alembic/versions/`
4. **Apply migration**: `alembic upgrade head`
5. **Update Pydantic schemas** in `backend/app/schemas/` if needed
6. **Update repositories/services** as required
7. **Test endpoints** via Swagger UI

### Code Quality

The project follows these principles:

- **SOLID Principles** - Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- **Clean Architecture** - Clear separation between layers (API → Service → Repository → Model)
- **Type Safety** - Pydantic for backend validation, TypeScript for frontend
- **Security First** - JWT authentication, password hashing, tenant isolation, CORS configuration

### Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests (when implemented)
cd frontend
npm test
```

## 🐛 Troubleshooting

### Database Connection Issues
- Verify MySQL is running: `mysql -u username -p`
- Check `DATABASE_URL` in `.env` file
- Ensure database exists: `SHOW DATABASES;`

### Migration Errors
- Check current version: `alembic current`
- Review migration history: `alembic history`
- If stuck, stamp database: `alembic stamp head`

### Port Already in Use
```bash
# Find process on port 8000 (backend)
netstat -ano | findstr :8000

# Kill process (Windows, use process ID from above)
taskkill /PID <process_id> /F
```

### Frontend Build Errors
- Clear cache: `rm -rf .next node_modules`
- Reinstall: `npm install`
- Rebuild: `npm run build`

## 📝 License

Proprietary software developed for Oxibit.

## 🤝 Support

For questions or issues, contact the development team.

---

**Developed with FastAPI, Next.js, and professional engineering practices**
