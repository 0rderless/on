#!/usr/bin/env python3
"""Write the full precache list (every game file) into overcharge/sw.js so the app works offline after one visit."""
import os, re, json, hashlib
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'overcharge')
files, h = [], hashlib.sha1()
for d, dirs, fs in os.walk(root):
    dirs[:] = sorted(x for x in dirs if x not in ('test', 'tools'))
    for f in sorted(fs):
        rel = os.path.relpath(os.path.join(d, f), root).replace(os.sep, '/')
        if rel in ('sw.js', 'README.md') or rel.startswith('_') or f.startswith('.'): continue
        files.append('./' + rel)
        with open(os.path.join(d, f), 'rb') as fh: h.update(fh.read())
sw_path = os.path.join(root, 'sw.js')
sw = open(sw_path).read()
version = 'oc-' + h.hexdigest()[:10]
sw = re.sub(r"const VERSION = '[^']*';", f"const VERSION = '{version}';", sw)
sw = re.sub(r"const CORE = \[[^\]]*\];", 'const CORE = ' + json.dumps(['./'] + files) + ';', sw, flags=re.S)
open(sw_path, 'w').write(sw)
print(f'{len(files)} files precached, version {version}')
