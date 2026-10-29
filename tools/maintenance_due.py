"""Bound hourly runs to today and skip while any aiworkjob editor owns the lease."""
import json
import os
import time
from datetime import datetime,timedelta,timezone
from pathlib import Path

def due(common_root,at=None):
    instant=time.time() if at is None else at
    today=datetime.fromtimestamp(instant,timezone(timedelta(hours=9))).date().isoformat()
    if today!='2026-10-29':return False
    root=Path(common_root)
    if not (root/'AGENTS.md').is_file():return False
    lease=root/'locks/aiworkjob-edit.json'
    if lease.exists():
        try:
            value=json.loads(lease.read_text(encoding='utf-8'))
            if not isinstance(value.get('expiresAt'),(int,float)) or value['expiresAt']>instant:return False
        except (ValueError,OSError):return False
    return True

if __name__=='__main__':
    candidate=Path(__file__).resolve().parents[3]
    root=Path(os.environ['AUA_COMMON_ROOT']) if os.environ.get('AUA_COMMON_ROOT') else candidate if candidate.name=='commonn' else Path.cwd()/'commonn'
    raise SystemExit(0 if due(root) else 1)
