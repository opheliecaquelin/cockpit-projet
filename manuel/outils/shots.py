#!/usr/bin/env python3
# Usage : shots.py lot.json  → pour chaque entrée : {nom, js, sel?, marge?, vp?}
import json, sys, urllib.request
sys.path.insert(0, __import__("os").path.dirname(__file__))
from c import PRE  # noqa

def post(path, data):
    r = urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:9400" + path, data=json.dumps(data).encode(), method="POST"), timeout=120)
    return json.loads(r.read())

ANNOT = open(__import__("os").path.join(__import__("os").path.dirname(__file__), "annot.js"), encoding="utf-8").read()
for s in json.load(open(sys.argv[1], encoding="utf-8")):
    if s.get("vp"): post("/viewport", {"w": s["vp"][0], "h": s["vp"][1]})
    r = post("/eval", {"expr": PRE + ANNOT.replace('return "annot ok";', "") + "\n" + s.get("js", "") + "\nawait w(250); return typeof R !== 'undefined' ? R : null;"})
    if r.get("erreur"): print(s["nom"], "ERREUR", r["erreur"][:300]); continue
    q = {"nom": s["nom"]}
    if s.get("sel"): q["selecteur"] = s["sel"]; q["marge"] = s.get("marge", 12)
    out = post("/shot", q)
    print(s["nom"], r.get("valeur"), out.get("erreur", "ok"))
    post("/eval", {"expr": "document.querySelectorAll('.ann-box, .ann-num, .maj-bandeau').forEach(e => e.remove()); return 1"})
