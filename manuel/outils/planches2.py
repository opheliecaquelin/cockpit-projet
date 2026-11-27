# Planches-contact des images du manuel, rendues par le navigateur de test (pas de bibliothèque d'images)
import json, os, sys, urllib.request
IMG = '/Users/ophelie.caquelin/Cockpit_Projet/manuel/images/'
noms = sorted(f for f in os.listdir(IMG) if f.endswith('.png'))
def post(path, data):
    r = urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:9400" + path, data=json.dumps(data).encode(), method="POST"), timeout=120)
    return json.loads(r.read())
post('/aller', {"url": "http://127.0.0.1:8766/manuel/doc-technique.html", "attente": 800})
post('/viewport', {"w": 1800, "h": 1400})
PAR = 12
for k in range(0, len(noms), PAR):
    lot = noms[k:k + PAR]
    html = "<div style='display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:10px;background:#fff;font:13px sans-serif'>" + "".join(
        f"<div><div style='height:300px;display:flex;align-items:flex-start;justify-content:center;border:1px solid #ccc;overflow:hidden'><img src='/manuel/images/{n}?t={k}' style='max-width:100%;max-height:300px'></div><b>{n}</b></div>" for n in lot) + "</div>"
    post('/eval', {"expr": f"document.body.innerHTML = {json.dumps(html)}; document.body.style.margin = 0; await new Promise(r => setTimeout(r, 1500)); return 1"})
    out = post('/shot', {"nom": f"_planche{k // PAR + 1}"})
    print(out)
