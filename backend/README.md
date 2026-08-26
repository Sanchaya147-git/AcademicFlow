# AcademicFlow Backend

FastAPI backend for the AcademicFlow platform.

## Local Setup

1. Create a Python virtual environment:

   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Copy the environment file from the repo root and fill in values:

   ```bash
   cp ../.env.example ../.env
   ```

4. Run the development server:

   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

5. Verify the health endpoint:

   ```bash
   curl http://localhost:8000/health
   ```

## Running Tests

```bash
pytest
```
