// Reconstitue le dossier de démo « Cockpit Projet » dans l'espace privé du navigateur de test (OPFS)
await w(800);
const lire = async chemin => { const r = await fetch('/' + chemin.split('/').map(encodeURIComponent).join('/'), { cache: 'no-store' }); if (!r.ok) throw new Error('introuvable : ' + chemin); return r; };
// projets « Migration » et « Réservation » tirés du script de démo d'origine (sans toucher au cache de l'appli)
const src = await (await lire('manuel/outils/seed.js')).text();
eval(src.replace('localStorage.setItem("radar-risques-v1", JSON.stringify(S));', 'window.__seed = S;'));
const seed = window.__seed;
const root = await navigator.storage.getDirectory();
try { await root.removeEntry('Cockpit Projet', { recursive: true }); } catch (e) {}
const dir = await root.getDirectoryHandle('Cockpit Projet', { create: true });
const ecrire = async (d, nom, contenu) => { const f = await (await d.getFileHandle(nom, { create: true })).createWritable(); await f.write(contenu); await f.close(); };
const fichiers = ['DEMO - Portail RH en ligne.json', 'SIGN - Signature électronique des contrats.json'];
for (const n of fichiers) await ecrire(dir, n, await (await lire(n)).blob());
for (const p of seed.projets.filter(x => ['MSG', 'RES'].includes(x.code))) {
  const ids = new Set(p.interlocuteurs.map(i => i.personneId));
  await ecrire(dir, `${p.code} - ${p.nom}.json`, JSON.stringify({ app: 'cockpit-projet', type: 'projet', version: 3, projet: p, personnes: seed.annuaire.filter(x => ids.has(x.id)) }, null, 1));
}
const commun = await (await lire('_commun.json')).json();
const demo = JSON.parse(await (await lire(fichiers[0])).text());
Object.assign(commun, { actif: demo.projet.id, theme: 'inter', modeles: [] });
await ecrire(dir, '_commun.json', JSON.stringify(commun, null, 1));
const caps = await (await (await dir.getDirectoryHandle('documents', { create: true })).getDirectoryHandle('captures', { create: true }));
const liste = await (await lire('documents/captures/')).text();
const noms = [...liste.matchAll(/href="([^"]+\.(?:webp|png))"/g)].map(m => decodeURIComponent(m[1]));
for (const n of noms) await ecrire(caps, n, await (await lire('documents/captures/' + n)).blob());
// branche l'appli sur ce dossier
window.confirm = () => true; window.showDirectoryPicker = async () => dir;
if (btn('Choisir un dossier')) await clic(btn('Choisir un dossier'), 1800);
const L = []; for await (const n of dir.keys()) L.push(n);
return { fichiers: L, captures: noms.length, projets: $$('#projSel option').map(o => o.textContent) };
