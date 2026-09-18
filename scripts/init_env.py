"""Generate LOCAL credentials without embedding secrets in source control."""
import argparse
import os
from pathlib import Path
import secrets

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--sqlite', action='store_true', help='Portable fallback; not pgvector validation')
args = parser.parse_args()
path = root / '.env'
if path.exists():
    raise SystemExit('.env already exists; refusing to overwrite credentials')
password = secrets.token_urlsafe(24)
database = f'sqlite:///{root / "data/academicflow.db"}' if args.sqlite else f'postgresql://academicflow:{password}@localhost:5432/academicflow'
values = {'DATABASE_URL': database, 'DATABASE_USER': 'academicflow', 'DATABASE_PASSWORD': password,
          'JWT_SECRET': secrets.token_hex(32), 'SEED_ADMIN_PASSWORD': secrets.token_urlsafe(20),
          'N8N_ENCRYPTION_KEY': secrets.token_hex(32), 'AI_PROVIDER': 'demo'}
text = (root / '.env.example').read_text()
for key, value in values.items():
    lines = text.splitlines()
    text = '\n'.join(f'{key}={value}' if line.startswith(key + '=') else line for line in lines) + '\n'
path.write_text(text)
os.chmod(path, 0o600)
print('Created .env with random local secrets. Read SEED_ADMIN_EMAIL/PASSWORD there to sign in.')
print('AI_PROVIDER=demo is explicit offline demonstration mode. Switch to openai and set a key for real AI.')
