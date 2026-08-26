# AcademicFlow

AcademicFlow is an AI-powered execution intelligence layer that converts heterogeneous faculty and staff progress reports into structured academic events, semantically links them to the college's master academic execution plan, updates actual progress with confidence scoring, and builds institutional memory from historical execution data.

> **Turn fragmented faculty reports into trusted, schedule-linked academic progress — automatically, while keeping humans in control of uncertain decisions.**

---

## Architecture

```text
                    FACULTY / STAFF
                          |
             +------------+------------+
             |            |            |
          Free Text     Excel        Voice
             |            |            |
             +------------+------------+
                          |
                    INGESTION LAYER
                          |
                    n8n WORKFLOW
                          |
                +---------+---------+
                |                   |
          Input Parsing        File Storage
                |                   |
                +---------+---------+
                          |
                    LLM EXTRACTION
                          |
                  Structured Events
                          |
                 NORMALIZATION LAYER
                          |
                  Candidate Retrieval
                          |
               PostgreSQL + pgvector
                          |
                  Semantic Matching
                          |
              Domain-Aware Rule Engine
                          |
                 CONFIDENCE SCORING
                          |
             +------------+------------+
             |            |            |
          HIGH          MEDIUM         LOW
          >=90%        50–89%         <50%
             |            |            |
          AUTO-LINK     REVIEW       UNMATCHED
             |            |            |
             +------------+------------+
                          |
                SCHEDULE SYNCHRONIZATION
                          |
                  AUDIT TRAIL
                          |
               HISTORICAL DATASET
                          |
                 INSTITUTIONAL MEMORY
```

---

## Tech Stack

| Layer             | Technology                              |
| ----------------- | --------------------------------------- |
| Frontend          | Next.js, TypeScript, Tailwind, shadcn/ui |
| Backend           | Python, FastAPI, Pydantic, SQLAlchemy   |
| Workflow          | n8n                                     |
| Database          | PostgreSQL + pgvector                   |
| Object Storage    | Amazon S3 (later phases)                |
| Local Infrastructure | Docker Compose                       |

---

## Local Setup

1. Clone the repository.

2. Copy the example environment file and fill in your values:

   ```bash
   cp .env.example .env
   ```

3. Start PostgreSQL and n8n:

   ```bash
   docker compose up -d
   ```

4. Install and run the backend.

5. Install and run the frontend.

---

## Environment Variables

See [`.env.example`](./.env.example) for a full list. Key variables:

| Variable         | Purpose                              |
| ---------------- | ------------------------------------ |
| `DATABASE_URL`   | PostgreSQL connection string         |
| `OPENAI_API_KEY` | OpenAI API key for LLM/embedding use |
| `N8N_BASE_URL`   | Base URL for n8n webhooks/API        |
| `AWS_*`          | AWS credentials and S3 bucket        |

Never commit real credentials to source control.

---

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs at [http://localhost:3000](http://localhost:3000).

---

## Running the Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The backend API docs are at [http://localhost:8000/docs](http://localhost:8000/docs).

Verify health:

```bash
curl http://localhost:8000/health
```

---

## Running PostgreSQL

PostgreSQL is started via Docker Compose:

```bash
docker compose up -d postgres
```

Connection details use the values from `.env` or the Docker Compose defaults:

- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: `postgres`
- Database: `academicflow`

The `pgvector` extension will be enabled in a later migration.

---

## Running n8n

n8n is started via Docker Compose:

```bash
docker compose up -d n8n
```

Access n8n at [http://localhost:5678](http://localhost:5678).

Default credentials are set in `.env` or via Docker Compose defaults:

- Username: `admin`
- Password: `admin`

Change these before any real use.

---

## Project Structure

```text
academicflow/
├── frontend/          # Next.js application
├── backend/           # FastAPI application
├── n8n/workflows/     # Exported n8n workflows
├── database/          # Migrations and seed data
├── scripts/           # Helper scripts
├── docker/            # Additional Docker files
├── docs/              # Documentation
├── .env.example       # Environment variable template
├── docker-compose.yml # Local infrastructure
└── README.md          # This file
```
