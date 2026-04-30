# Gitdocify

Gitdocify is an AI-powered code intelligence platform that automatically generates documentation for code repositories using advanced AI analysis. It empowers developers and teams to instantly understand, search, and converse with codebases of any size.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.2-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)

## ✨ Features

- **Automated Repository Ingestion**: Paste a GitHub URL and Gitdocify will clone, chunk, and index the codebase automatically.
- **100% Free, Local-First Architecture**: 
  - **Local Embeddings**: Generates `384-dimensional` vector embeddings entirely locally on your CPU using Transformers.js (`Xenova/all-MiniLM-L6-v2`).
  - **Free Generative AI**: Uses NVIDIA NIM's generous free-tier API (`meta/llama-3.1-8b-instruct`) instead of restrictive, paid AI platforms.
- **Semantic Vector Search**: Powered by `pgvector` (PostgreSQL) for deep semantic searches across your code chunks, with an automatic, mathematically-equivalent SQLite fallback for local development.
- **AI Tutor Interface**: An interactive chat interface that understands your repository's context and can explain complex functions, architectures, and dependencies.
- **Team Collaboration**: Create organizations, manage teams, and securely share repository intelligence across your workspace with role-based access control (RBAC).
- **Background Pipeline Orchestration**: Highly scalable background processing powered by `BullMQ` and `Redis`, complete with exponential backoffs and resilient error handling.

---

## 🏗️ Architecture

Gitdocify is built using a modern, robust full-stack architecture:

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS
- **Backend APIs**: Next.js API Routes
- **Database**: Drizzle ORM supporting both **PostgreSQL** (w/ pgvector) and **SQLite**
- **Authentication**: JWT-based auth with AES-256-GCM BYOK (Bring Your Own Key) encryption for NVIDIA API keys
- **Queue System**: BullMQ + Redis for asynchronous repository processing
- **AI Integration**: Custom `fetch`-based REST client designed for OpenAI-compatible endpoints (configured for NVIDIA NIM).
- **Local Vectors**: `@xenova/transformers` running natively in Node.js.

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- Redis (running locally or via Docker on port `6379`)
- NVIDIA NIM API Key (Free at [build.nvidia.com](https://build.nvidia.com))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/SSRINIBASS/gitdocify.git
   cd gitdocify
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env.local` file in the root directory:
   ```env
   # Database Configuration (Use postgres or sqlite)
   DB_TYPE=sqlite
   DATABASE_URL=file:./dev.db
   
   # Redis Configuration for Job Queues
   REDIS_URL=redis://localhost:6379
   
   # Security Secrets
   JWT_SECRET=your_super_secret_jwt_key_here
   ENCRYPTION_SECRET=your_super_secret_32_char_encryption_key
   ```

4. **Initialize the Database**
   ```bash
   npm run db:push
   ```

5. **Start the Development Environment**
   You will need two terminal windows.
   
   **Terminal 1:** Start the Next.js web application
   ```bash
   npm run dev
   ```

   **Terminal 2:** Start the background worker processes
   ```bash
   npm run worker
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.
7. Go to **Settings** and input your **NVIDIA API Key**.

---

## 🧪 Testing

Gitdocify includes a comprehensive testing suite utilizing `Vitest`.

To run unit and integration tests:
```bash
npm run test
```

To run tests in watch mode during development:
```bash
npm run test:watch
```

---

## 📝 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
