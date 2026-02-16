# Audio Transcript Application

A full-stack audio transcription application with authentication, multi-tenancy support, and AI-powered transcription capabilities.

## 🎯 Features

### Core Features
- **Authentication**: JWT-based authentication with Admin and User roles
- **Multi-tenancy**: Support for multiple organizations/clients
- **Audio Recording**: Record device and microphone audio
- **Transcription**: Manual transcript management (AI integration ready)
- **Session Management**: Create, view, update, and delete recording sessions
- **Admin Panel**: User approval workflow and administration

### Technical Features
- **RBAC**: Role-based access control (Admin/User)
- **Tenant Isolation**: Data isolation between tenants
- **File Storage**: Server-side audio file storage
- **RESTful API**: Well-structured FastAPI backend
- **Modern Frontend**: Next.js 14 with TypeScript and TailwindCSS
- **Professional Architecture**: SOLID principles and clean code

## 🏗️ Architecture

### Backend (FastAPI)
```
backend/
├── app/
│   ├── api/           # API endpoints (v1)
│   ├── core/          # Config, security, dependencies
│   ├── models/        # SQLAlchemy models
│   ├── schemas/       # Pydantic schemas
│   ├── repositories/  # Data access layer
│   ├── services/      # Business logic layer
│   ├── middleware/    # Custom middleware
│   └── database/      # Database session management
├── alembic/           # Database migrations
├── storage/           # Audio file storage
└── tests/             # Test suite
```

### Frontend (Next.js)
```
frontend/
├── src/
│   ├── app/           # Next.js app router
│   ├── components/    # React components
│   ├── lib/           # API clients and hooks
│   ├── types/         # TypeScript types
│   └── middleware.ts  # Auth middleware
```

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- MySQL 8.0+
- npm or yarn

### Backend Setup

1. **Navigate to backend directory**
```bash
cd backend
```

2. **Create virtual environment**
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment**
```bash
# Copy example env file
copy .env.example .env

# Edit .env and update:
# - DATABASE_URL
# - SECRET_KEY
# - FIRST_ADMIN_EMAIL
# - FIRST_ADMIN_PASSWORD
```

5. **Create MySQL database**
```sql
CREATE DATABASE audio_transcript CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

6. **Initialize database**
```bash
# Run database initialization script
python init_db.py
```

7. **Run the server**
```bash
# Development
python app/main.py

# Or with uvicorn
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- API: http://localhost:8000
- Swagger Docs: http://localhost:8000/api/docs
- ReDoc: http://localhost:8000/api/redoc

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Configure environment**
```bash
# Copy example env file
copy .env.local.example .env.local

# Edit .env.local and update:
# NEXT_PUBLIC_API_URL=http://localhost:8000
```

4. **Run development server**
```bash
npm run dev
# or
yarn dev
```

The application will be available at http://localhost:3000

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/v1/auth/signup` - Register new user (requires admin approval)
- `POST /api/v1/auth/login` - Login and get JWT token
- `GET /api/v1/auth/me` - Get current user info
- `POST /api/v1/auth/logout` - Logout

### Admin Endpoints (Admin only)
- `GET /api/v1/admin/pending-users` - Get users pending approval
- `POST /api/v1/admin/users/{user_id}/approve` - Approve/reject user
- `DELETE /api/v1/admin/users/{user_id}` - Delete user

### Session Endpoints
- `POST /api/v1/sessions` - Start new recording session
- `POST /api/v1/sessions/{id}/end` - End session and upload audio
- `GET /api/v1/sessions` - List sessions (paginated)
- `GET /api/v1/sessions/{id}` - Get session details
- `PUT /api/v1/sessions/{id}` - Update session
- `DELETE /api/v1/sessions/{id}` - Delete session

### Transcript Endpoints
- `POST /api/v1/transcripts` - Create transcript
- `GET /api/v1/transcripts/session/{session_id}` - Get transcript by session
- `GET /api/v1/transcripts/{id}` - Get transcript by ID
- `PUT /api/v1/transcripts/{id}` - Update transcript
- `DELETE /api/v1/transcripts/{id}` - Delete transcript

## 🔐 Default Admin Credentials

After running `init_db.py`, use these credentials:
- **Email**: admin@example.com (or value from .env)
- **Password**: changeme (or value from .env)

⚠️ **Important**: Change the admin password immediately after first login!

## 🛠️ Technology Stack

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM
- **Alembic** - Database migrations
- **MySQL** - Database
- **JWT** - Authentication
- **Pydantic** - Data validation
- **PyMySQL** - MySQL driver

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **Axios** - API client
- **Zustand** - State management
- **TanStack Query** - Server state management

## 📖 Design Principles

This application follows professional software engineering practices:

1. **SOLID Principles**
   - Single Responsibility: Each class/module has one job
   - Open/Closed: Extensible without modification
   - Liskov Substitution: Interfaces are interchangeable
   - Interface Segregation: Specific, focused interfaces
   - Dependency Inversion: Depend on abstractions

2. **Clean Architecture**
   - Repository pattern for data access
   - Service layer for business logic
   - DTOs with Pydantic schemas
   - Dependency injection

3. **Security Best Practices**
   - JWT authentication
   - Password hashing with bcrypt
   - RBAC authorization
   - Tenant isolation
   - CORS configuration

## 🔄 Future Enhancements

### Planned Features (OpenAI Integration)
- Real-time transcription with OpenAI Whisper
- Speaker diarization
- WebSocket support for live transcription
- Transcript editing with AI suggestions
- Multi-language support

### Infrastructure
- Docker containerization
- CI/CD pipeline
- Automated testing
- Cloud storage (S3) integration
- Redis caching
- Logging and monitoring

## 📝 License

This project is proprietary software developed for Oxibit.

## 👥 Support

For support or questions, please contact the development team.

---

**Built with ❤️ using FastAPI, Next.js, and professional software engineering practices**
