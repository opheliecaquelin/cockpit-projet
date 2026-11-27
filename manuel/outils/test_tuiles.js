await w(1500); window.confirm = () => true;
const out = { erreurs: [] }; window.addEventListener('error', e => out.erreurs.push(e.message));
const oe = console.error; console.error = (...a) => { out.erreurs.push(a.map(String).join(' ').slice(0, 200)); oe(...a); };
const ouvrir = async nom => { const s = $('#projSel'); s.value = [...s.options].find(o => o.textContent.includes(nom)).value; s.dispatchEvent(new Event('change', { bubbles: true })); await w(900); };
const NOUV = ['etape', 'problemes', 'avreel', 'objectifs', 'temps', 'preparation', 'tendances'];
await ouvrir('Portail');
await clic('[data-act=module][data-id=cockpit]', 400);
await clic('[data-act=tu-perso]', 300); await clic('[data-act=tu-ajout]', 400);
out.catalogue = NOUV.map(id => !!$(`#modal [data-act=tu-plus][data-id=${id}]`));
for (const id of NOUV) { const b = $(`#modal [data-act=tu-plus][data-id=${id}]`); if (b) await clic(b, 250); }
document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(300); await clic('[data-act=tu-perso]', 500);
out.portail = NOUV.map(id => { const el = $(`[data-tuile=${id}]`); return id + ': ' + (el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : 'ABSENTE'); });
// clics
await clic('[data-tuile=problemes] .link', 500); out.lienProblemes = [$('#tabs .tab.active')?.textContent.trim(), $('#subtabs .subtab.active')?.textContent.trim()];
await clic('[data-act=module][data-id=cockpit]', 400);
await clic('[data-tuile=preparation] [data-act=cr-ouvrir]', 600); out.lienPrep = [$('#tabs .tab.active')?.textContent.trim(), $('main h2')?.textContent.trim()];
await clic('[data-act=module][data-id=cockpit]', 400);
await clic('[data-tuile=temps] .link', 500); out.lienTemps = [$('#subtabs .subtab.active')?.textContent.trim(), $('[data-act=pp-chvue].on')?.textContent.trim()];
await ouvrir('Signature'); await clic('[data-act=module][data-id=cockpit]', 400);
out.sign = NOUV.map(id => { const el = $(`[data-tuile=${id}]`); return id + ': ' + (el ? el.textContent.replace(/\s+/g, ' ').trim().slice(0, 90) : 'ABSENTE'); });
await clic('[data-tuile=etape] [data-act=et-voir]', 400); out.lienEtape = !!$('.et-panneau'); await clic('[data-act=et-fermer]', 300);
await ouvrir('Portail'); await clic('[data-act=module][data-id=cockpit]', 500); window.scrollTo(0, 0);
return out;
