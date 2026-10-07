#!/bin/bash
set -e
echo "Starting PostgreSQL..."
/usr/lib/postgresql/18/bin/pg_ctl -D /tmp/academicflow-pgdata -o '-p 5439 -h 127.0.0.1 -k /tmp -c extension_control_path=/tmp/academicflow-pgdev' -l /tmp/academicflow-pgdata/logfile start || true

echo "Starting FastAPI Backend..."
cd /mnt/d/vibe/AcademicFlow/backend
PYTHONPATH=. .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
