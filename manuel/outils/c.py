#!/usr/bin/env python3
# Usage : c.py eval "<js>" | c.py evalf fichier.js | c.py aller URL | c.py shot nom [selecteur] [marge] | c.py vp L H
import json, sys, urllib.request

def post(path, data):
    r = urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:9400" + path, data=json.dumps(data).encode(), method="POST"), timeout=120)
    return json.loads(r.read())

PRE = """const w = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const clic = async (s, ms = 350) => { let e = typeof s === 'string' ? $(s) : s; if (!e && typeof s === 'string' && s.includes('data-act=module') && $('[data-act=et-toutes]')) { $('[data-act=et-toutes]').click(); await w(400); e = $(s); } if (!e) throw new Error('introuvable: ' + s); e.click(); await w(ms); };
const btn = (txt, root = document) => [...root.querySelectorAll('button, [data-act]')].find(b => b.textContent.includes(txt));
const saisir = (s, v) => { const e = typeof s === 'string' ? $(s) : s; e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); };
"""
if __name__ == "__main__":
    a = sys.argv[1:]
    if a[0] == "eval": out = post("/eval", {"expr": PRE + a[1]})
    elif a[0] == "evalf": out = post("/eval", {"expr": PRE + open(a[1], encoding="utf-8").read()})
    elif a[0] == "aller": out = post("/aller", {"url": a[1], "attente": 2000})
    elif a[0] == "vp": out = post("/viewport", {"w": int(a[1]), "h": int(a[2])})
    elif a[0] == "shot":
        q = {"nom": a[1]}
        if len(a) > 2 and a[2]: q["selecteur"] = a[2]
        if len(a) > 3: q["marge"] = int(a[3])
        out = post("/shot", q)
    print(json.dumps(out, ensure_ascii=False)[:3000])
