"""Date/lease gate must stop duplicate and out-of-day automation before dispatch."""
import importlib.util,json,tempfile
from datetime import datetime,timezone
from pathlib import Path
module_path=Path(__file__).resolve().parents[1]/'tools/maintenance_due.py'
spec=importlib.util.spec_from_file_location('maintenance_due',module_path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
at=datetime(2026,10,29,3,0,tzinfo=timezone.utc).timestamp()
with tempfile.TemporaryDirectory(prefix='aiworkjob-maintenance-') as temp:
 root=Path(temp);(root/'AGENTS.md').write_text('test contract',encoding='utf-8')
 assert module.due(root,at)
 assert not module.due(root,datetime(2026,10,29,15,0,tzinfo=timezone.utc).timestamp())
 assert not module.due(root,datetime(2026,10,28,14,59,tzinfo=timezone.utc).timestamp())
 (root/'locks').mkdir();lock=root/'locks/aiworkjob-edit.json'
 lock.write_text(json.dumps({'owner':'any-owner','expiresAt':at+600}),encoding='utf-8');assert not module.due(root,at)
 lock.write_text(json.dumps({'owner':'any-owner','expiresAt':at-1}),encoding='utf-8');assert module.due(root,at)
 lock.write_text('damaged',encoding='utf-8');assert not module.due(root,at)
print('Maintenance gate: date boundary, active/expired/corrupt lease verified')
