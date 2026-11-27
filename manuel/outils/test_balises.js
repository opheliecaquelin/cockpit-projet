await w(1500); window.confirm = () => true;
const out = { erreurs: [] }; window.addEventListener('error', e => out.erreurs.push(e.message));
const oe = console.error; console.error = (...a) => { out.erreurs.push(a.map(String).join(' ').slice(0, 200)); oe(...a); };
const s = $('#projSel'); s.value = [...s.options].find(o => o.textContent.includes('Portail')).value; s.dispatchEvent(new Event('change', { bubbles: true })); await w(900);
let prochain = null; const orig = HTMLInputElement.prototype.click;
HTMLInputElement.prototype.click = function () { if (this.type === 'file' && prochain) { const dt = new DataTransfer(); dt.items.add(prochain); this.files = dt.files; this.dispatchEvent(new Event('change')); prochain = null; return; } return orig.call(this); };
const telech = []; const U0 = URL.createObjectURL; URL.createObjectURL = b => { telech.push(b); return U0(b); };
if (!$('[data-act=module][data-id=livrables]')) await clic('[data-act=et-toutes]', 300);
await clic('[data-act=module][data-id=livrables]', 400); await clic('[data-act=lv-vue][data-id=templates]', 500);
out.boutonI = !!$('[data-act=mo-balises]');
await clic('[data-act=mo-balises]', 400); out.aide = [$$('#modal .bal-tab tbody tr').length, $$('#modal .bal-tab tbody tr').slice(0, 3).map(r => r.textContent.replace(/\s+/g, ' ').trim())];
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(300);
const NOMS = ['Modele cadrage.docx', 'Budget previsionnel.xlsx', 'Trame copil.pptx', 'Mail lancement.txt'];
for (const n of NOMS) {
  const b = await (await fetch('/api/fichier?chemin=' + encodeURIComponent(n))).blob();
  await clic('[data-act=mo-ajout]', 400); prochain = new File([b], n); await clic('#moChoisir', 300); await clic('#moOk', 1200);
}
out.cartes = $$('.tpl-maison').map(c => c.textContent.replace(/\s+/g, ' ').trim().slice(0, 110));
// versions remplies : téléchargées, puis renvoyées au serveur de test pour vérification
for (const n of NOMS) {
  const carte = $$('.tpl-maison').find(c => c.textContent.includes(n)); telech.length = 0;
  await clic(carte.querySelector('[data-act=mo-rempli]'), 1500);
  const r = telech[0]; if (!r) { out[n] = 'pas de téléchargement'; continue; }
  const rep = await fetch('/api/fichier?chemin=' + encodeURIComponent('documents/rempli - ' + n), { method: 'PUT', headers: { 'X-Cockpit': '1' }, body: r });
  out[n] = [r.size, rep.status];
}
// livrable à partir du modèle Word : copie remplie jointe
const cw = $$('.tpl-maison').find(c => c.textContent.includes('Modele cadrage')); await clic(cw.querySelector('[data-act=mo-livrable]'), 1500);
out.livrable = $('#modal')?.textContent.match(/📎 [^\n]+?\.docx/)?.[0];
return out;
