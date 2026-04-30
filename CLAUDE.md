# Gitdocify

Gitdocify is an AI-powered code intelligence platform that automatically generates documentation for code repositories using advanced AI analysis.

## Project Overview

Gitdocify enables developers to automatically generate comprehensive documentation for code repositories by analyzing code structure, dependencies, and patterns using AI-powered analysis. The platform supports both individual developers and teams through a complete collaboration system.

## Architecture

### Core Components

1. **Frontend** (Next.js)
   - User dashboard for managing repositories
   - Repository analysis views
   - AI tutor interface for code understanding
   - Team collaboration management interface

2. **Backend Services**
   - Authentication and user management
   - Repository ingestion pipeline
   - Code analysis workers
   - AI-powered documentation generation
   - Database storage (PostgreSQL/SQLite)
   - Team collaboration services

3. **Workers**
   - Ingestion worker (cloning and processing repositories)
   - Indexing worker (code chunking and vector embedding)
   - Documentation worker (AI analysis and generation)
   - Code analysis worker (static analysis)
   - Code analysis worker for team collaboration features

### Database Schema

Supports both PostgreSQL and SQLite with Drizzle ORM:
- Users, organizations, teams, and team memberships
- Repositories with processing status tracking
- Code chunks with vector embeddings for semantic search
- Job queue system for async processing
- Tutor sessions for interactive code exploration

### Key Features

- **Repository Ingestion**: Clone and process GitHub repositories
- **Code Intelligence**: AI-powered code analysis and documentation
- **Semantic Search**: Vector-based code search using embeddings
- **Tutor System**: Interactive AI assistant for code understanding
- **Team Collaboration**: Multi-user workspace with role-based access
- **Monitoring**: Real-time job tracking and system metrics

## Team Collaboration

Gitdocify includes comprehensive team collaboration features:

### Database Schema
- Organizations table for grouping teams
- Teams table for organizing users and repositories
- Team memberships table for user-team associations with role-based access control
- Repositories table with teamId foreign key for team sharing

### API Endpoints
- GET `/api/teams` - List all teams for authenticated user
- POST `/api/teams` - Create new teams
- GET `/api/teams/[id]` - Get specific team details including members

### Team Management
- Users can create organizations and teams
- Team members can be added with role-based access control ('owner', 'admin', 'member')
- Repositories can be shared with teams for collaborative work

### Implementation Status
Team collaboration features are fully implemented with:
- Database schema support for teams, organizations, and team memberships
- API endpoints for team management
- Role-based access control for repositories

## Development Setup

1. Install dependencies: `npm install`
2. Set up environment variables in `.env.local`
3. Run database migrations: `npm run db:push`
4. Start development server: `npm run dev`
5. Start worker processes: `npm run worker`

## Environment Variables

- `DATABASE_URL` - Database connection string
- `DB_TYPE` - Database type (postgres or sqlite)
- `GEMINI_API_KEY` - Google Gemini API key for AI features
- `JWT_SECRET` - Secret for JWT token signing
- `REDIS_URL` - Redis connection for job queues

## Database Migrations

Uses Drizzle Kit for database schema management:
- PostgreSQL schema: `src/db/schema.pg.ts`
- SQLite schema: `src/db/schema.sqlite.ts`
- Migration commands: `npm run db:generate` and `npm run db:push`

## Worker System

BullMQ-based worker system with Redis:
- Ingest workers (repository cloning)
- Index workers (code chunking and embedding)
- Docs workers (AI documentation generation)
- Code analysis workers (static code analysis)

Run workers with: `npm run worker`

## API Endpoints

### Authentication
- POST `/api/auth/register` - User registration
- POST `/api/auth/login` - User login
- POST `/api/settings/api-key` - Manage API keys

### Teams
- GET `/api/teams` - List all teams for authenticated user
- POST `/api/teams` - Create new teams
- GET `/api/teams/[id]` - Get specific team details

### Repositories
- GET `/api/repos` - List user repositories
- POST `/api/repos` - Add new repository
- GET `/api/repos/[id]` - Get repository details
- GET `/api/repos/[id]/structure` - Get repository structure

### AI Intelligence
- GET `/api/intelligence/[id]/search` - Semantic code search
- GET `/api/intelligence/[id]/analysis` - Code analysis results
- POST `/api/tutor/[id]/chat` - AI tutor chat interface

### System
- GET `/api/health` - Health check endpoint
- GET `/api/metrics` - System metrics and monitoring

## Deployment

Deploy using Vercel or any Node.js hosting platform. Ensure environment variables are configured and a PostgreSQL/SQLite database is available.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes and commit with clear messages
4. Push to your fork
5. Create a pull request

## License

MIT License