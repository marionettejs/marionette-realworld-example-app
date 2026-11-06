#!/usr/bin/env python3
"""Materialize a released snapshot in a NEW directory. Never invokes a model."""
import argparse, hashlib, io, json, shutil, subprocess, tarfile
from pathlib import Path
ROOT = Path(__file__).resolve().parent
BASE = '043fd2a3d8200c803fd005eeca5a8d9169304fff'
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('attempt', choices=['A1','A2','A3','A4','B1'])
p.add_argument('output', type=Path)
a = p.parse_args()
manifest = json.loads((ROOT/'manifest.json').read_text())
for rel, expected in manifest.items():
 if hashlib.sha256((ROOT/rel).read_bytes()).hexdigest() != expected:
  raise SystemExit('Published evidence hash mismatch: '+rel)
data = subprocess.check_output(['git','-C',str(ROOT.parents[1]),'archive',BASE])
a.output.mkdir()  # Exclusive; never overwrite a workspace.
with tarfile.open(fileobj=io.BytesIO(data)) as t:
 t.extractall(a.output, filter='data')
(a.output/'.gitmodules').unlink(missing_ok=True)
shutil.copytree(ROOT/'snapshots'/a.attempt,a.output,dirs_exist_ok=True)
if a.attempt in ['A1','A2','A3']:
 shutil.copyfile(ROOT/'acceptance/filter.spec.ts',a.output/'tests/operator-filter.spec.ts')
 if a.attempt != 'A1':
  shutil.copyfile(ROOT/'acceptance/filter-change.spec.ts',a.output/'tests/operator-filter-change.spec.ts')
else:
 (a.output/'test').mkdir(exist_ok=True)
 shutil.copyfile(ROOT/'acceptance/lifecycle.test.mjs',a.output/'test/acceptance.test.mjs')
print('Snapshot prepared. Install dependencies with npm ci --ignore-scripts in that directory.')
print('A2 replay is diagnostic only: original protected-input rejection remains final.')
