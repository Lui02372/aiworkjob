"""Bound the requested autonomous coding run to 2026-10-29 in Korea."""
from datetime import datetime,timedelta,timezone
now=datetime.now(timezone.utc)+timedelta(hours=9)
raise SystemExit(0 if now.date().isoformat()=='2026-10-29' else 1)
