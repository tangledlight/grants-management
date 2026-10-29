"""Offline integrity check for synthetic baseline files and their declared SQL sizes."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
sql = (root / 'supabase/migrations/001_demo.sql').read_text()
for name in ('proposal', 'budget', 'eligibility'):
    path = root / 'supabase/fixtures' / f'{name}.pdf'
    data = path.read_bytes()
    assert data.startswith(b'%PDF-'), f'{name}: missing PDF signature'
    assert b'%%EOF' in data[-1024:], f'{name}: incomplete PDF'
    assert f"when '{name}' then {len(data)}" in sql, f'{name}: size differs from seed metadata'
print('All 3 baseline PDFs match the seed metadata.')
