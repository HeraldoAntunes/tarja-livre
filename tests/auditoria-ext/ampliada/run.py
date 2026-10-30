#!/usr/bin/env python3
"""Portable wrapper: Python 3 + Node >=22. No source modifications."""
import argparse, json, os, subprocess, sys
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('--repo',default=os.getenv('TARJA_REPO'))
p.add_argument('--output',default=str(Path(__file__).resolve().parent))
a=p.parse_args()
if not a.repo:
    p.error('use --repo PATH or TARJA_REPO')
env=dict(os.environ,TARJA_REPO=str(Path(a.repo).resolve()),TARJA_OUT=str(Path(a.output).resolve()))
try:
    result=subprocess.run(['node',str(Path(__file__).with_name('runner.mjs'))],cwd=Path(__file__).resolve().parent,env=env)
    sys.exit(result.returncode)
except OSError as e:
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
    report={'status':'blocked','summary':{'total':0,'passed':0,'failed':0,'blocked':1},'error':str(e)}
    for name in ('results.json','resultados.json'):(out/name).write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
    print('Environment blocker:',e,file=sys.stderr);sys.exit(2)
