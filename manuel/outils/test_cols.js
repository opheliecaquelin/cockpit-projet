await w(1500); window.confirm = () => true;
const out = { erreurs: [] }; window.addEventListener('error', e => out.erreurs.push(e.message));
const oe = console.error; console.error = (...a) => { out.erreurs.push(a.map(String).join(' ').slice(0, 200)); oe(...a); };
const s = $('#projSel'); s.value = [...s.options].find(o => o.textContent.includes('Portail')).value; s.dispatchEvent(new Event('change', { bubbles: true })); await w(900);
await clic('[data-act=module][data-id=cockpit]', 500);
const cols = () => $$('.dash-col').map(c => [...c.querySelectorAll(':scope > .tuile')].map(t => t.dataset.tuile));
const commun = async () => (await (await fetch('/api/fichier?chemin=_commun.json', { cache: 'no-store' })).json()).tuiles;
out.conversion = cols();
await clic('[data-act=tu-perso]', 500);
const dt = new DataTransfer();
const ev = (type, el, x, y) => el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt, clientX: x, clientY: y }));
// 1. glisser la 1re tuile de la colonne 1 tout en bas de la colonne 3
const A = $$('.dash-col')[0].querySelector('.tuile'); const idA = A.dataset.tuile;
ev('dragstart', A, 10, 10); await w(50);
const fin3 = $$('.dash-col')[2].querySelector('.dash-col-fin'); const r = fin3.getBoundingClientRect();
ev('dragover', fin3, r.left + 10, r.top + 5); await w(350);
ev('drop', fin3, r.left + 10, r.top + 5); ev('dragend', A, 0, 0); await w(500);
out.basColonne3 = [idA, cols()[2].slice(-1)[0] === idA];
// 2. tout mettre en une seule colonne
await clic('[data-act=tu-cols][data-id="1"]', 500); out.uneColonne = [cols().length, cols()[0].length];
// 3. repasser à 2 colonnes, puis vider la 2e en y glissant… (la 2e est vide : on y dépose une tuile)
await clic('[data-act=tu-cols][data-id="2"]', 500);
out.deuxColonnes = cols().map(c => c.length);
const B = $$('.dash-col')[0].querySelectorAll('.tuile')[2]; const idB = B.dataset.tuile;
ev('dragstart', B, 10, 10); await w(50);
const vide = $$('.dash-col')[1].querySelector('.dash-col-fin'); const r2 = vide.getBoundingClientRect();
ev('dragover', vide, r2.left + 10, r2.top + 10); await w(350); ev('drop', vide, r2.left + 10, r2.top + 10); ev('dragend', B, 0, 0); await w(500);
out.dansColonneVide = [idB, cols()[1]];
// 4. flèches ˅ et ›
const id0 = cols()[0][0]; await clic(`[data-act=tu-dep][data-id=${id0}][data-dir=b]`, 450); out.descendre = cols()[0].indexOf(id0);
await clic(`[data-act=tu-dep][data-id=${id0}][data-dir=d]`, 450); out.droite = cols()[1].includes(id0);
// 5. enregistrement
await w(400); out.enregistre = await commun();
// 6. ajout et retrait d'une tuile
await clic('[data-act=tu-ajout]', 400); const libre = $('#modal [data-act=tu-plus]'); const idL = libre?.dataset.id; if (libre) await clic(libre, 400);
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(300);
out.ajout = [idL, cols().some(c => c.includes(idL))];
await clic(`[data-act=tu-suppr][data-id=${idL}]`, 400); out.retrait = !cols().some(c => c.includes(idL));
await clic('[data-act=tu-cols][data-id="3"]', 500); await clic('[data-act=tu-perso]', 500);
out.final = cols().map(c => c.length);
return out;
