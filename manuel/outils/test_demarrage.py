# Test du démarrage : mode dossier de Chrome normal, puis bloqué (simulé) → bascule sur le petit serveur
import json, time, urllib.request, sys
sys.path.insert(0, __import__('os').path.dirname(__file__))
from c import PRE
def post(path, data):
    r = urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:9400" + path, data=json.dumps(data).encode(), method="POST"), timeout=120); return json.loads(r.read())
def ev(js): return post('/eval', {"expr": PRE + js})
U = "http://127.0.0.1:8798/"
# 1. préparation : un dossier « copie_reelle » dans l'espace privé du navigateur, mémorisé comme dossier de Chrome
post('/aller', {"url": U, "attente": 1500})
print('prep', ev("""localStorage.removeItem('cockpit-stockage');
const root = await navigator.storage.getDirectory(); try { await root.removeEntry('copie_reelle', { recursive: true }); } catch (e) {}
const d = await root.getDirectoryHandle('copie_reelle', { create: true });
for (const n of ['DEMO - Portail RH en ligne.json', '_commun.json']) { const b = await (await fetch('/api/fichier?chemin=' + encodeURIComponent(n))).blob(); const w = await (await d.getFileHandle(n, { create: true })).createWritable(); await w.write(b); await w.close(); }
await new Promise((res, rej) => { const rq = indexedDB.open('radar-risques', 1); rq.onupgradeneeded = () => rq.result.createObjectStore('kv'); rq.onsuccess = () => { const t = rq.result.transaction('kv', 'readwrite'); t.objectStore('kv').put(d, 'dir'); t.oncomplete = res; t.onerror = rej; }; });
return 'ok';"""))
# 2. démarrage normal en mode dossier de Chrome
post('/aller', {"url": U, "attente": 2500})
print('normal', ev("return [document.querySelector('#projSel')?.selectedOptions[0]?.textContent, localStorage.getItem('cockpit-stockage'), document.querySelector('#main')?.textContent.trim().slice(0, 40)]"))
# 3. Chrome bloqué à la vérification de l'autorisation : bascule attendue au bout de 6 s
post('/preload', {"source": "FileSystemHandle.prototype.queryPermission = function () { return new Promise(() => {}); };"})
post('/aller', {"url": U, "attente": 1500})
print('pendant', ev("return document.querySelector('#main')?.textContent.trim().slice(0, 90)"))
time.sleep(7)
print('apres', ev("return [document.querySelector('#projSel')?.selectedOptions[0]?.textContent, localStorage.getItem('cockpit-stockage'), document.querySelector('.toast, #toast')?.textContent?.slice(0, 140)]"))
