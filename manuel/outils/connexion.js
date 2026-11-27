const db = await new Promise(r => { const q = indexedDB.open("radar-risques", 1); q.onsuccess = () => r(q.result); });
const st = db.objectStoreNames[0];
const dir = await new Promise(r => { const tx = db.transaction(st, "readonly"); const g = tx.objectStore(st).get("dir"); g.onsuccess = () => r(g.result); });
window.__dir = dir;
await new Promise(r => { const tx = db.transaction(st, "readwrite"); tx.objectStore(st).delete("dir"); tx.oncomplete = r; });
db.close();
return "ok";
