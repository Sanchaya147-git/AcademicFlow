PY = backend/.venv/bin/python
RUFF = backend/.venv/bin/ruff

.PHONY: backend frontend migrate seed test lint format sample check
backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
frontend:
	cd frontend && npm run dev
migrate:
	cd backend && .venv/bin/alembic upgrade head
seed:
	cd backend && .venv/bin/python -m app.seed --index
sample:
	$(PY) scripts/make_samples.py
test:
	cd backend && .venv/bin/python -m pytest -q
lint:
	$(RUFF) check backend/app backend/tests
	cd frontend && npm run lint && npm run typecheck
format:
	$(RUFF) format backend/app backend/tests scripts
	cd frontend && npm run format
check: test lint
