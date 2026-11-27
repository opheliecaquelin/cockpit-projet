await w(1500); window.confirm = () => true;
const out = { erreurs: [] }; window.addEventListener('error', e => out.erreurs.push(e.message));
const oe = console.error; console.error = (...a) => { out.erreurs.push(a.map(String).join(' ').slice(0, 200)); oe(...a); };
const ouvrir = async nom => { const s = $('#projSel'); s.value = [...s.options].find(o => o.textContent.includes(nom)).value; s.dispatchEvent(new Event('change', { bubbles: true })); await w(800); };
const pas = () => $$('.et-pas').map(b => b.className.replace('et-pas', '').trim() + ' : ' + b.textContent.replace(/\s+/g, ' ').trim());
const onglets = () => $$('#tabs > *').map(t => t.textContent.trim().replace(/\s*\d+$/, ''));
await ouvrir('Signature');
out.bandeau = pas(); out.temps = !!$('.et-temps .et-auj'); out.ongletsRealisation = onglets();
// clic sur Cadrage : panneau + onglets du cadrage
await clic('.et-pas[data-id=cadrage]', 500);
out.panneauCadrage = [$('.et-panneau .et-titre')?.textContent, $$('.et-panneau .et-crit').map(c => c.textContent.trim()), $$('.et-panneau [data-act=et-page]').length];
out.ongletsCadrage = onglets();
await clic('.et-panneau [data-act=et-page][data-s=raci]', 600);
out.apresLienRaci = [$('#tabs .tab.active')?.textContent.trim(), $('#subtabs .subtab.active')?.textContent.trim(), !!$('.et-panneau')];
await clic('[data-act=et-toutes]', 400); out.toutes = onglets().length;
await clic('[data-act=et-toutes]', 400);
// étape en cours : panneau + passer à la suivante (avec confirmation)
await clic('.et-pas[data-id=realisation]', 400);
out.panneauReal = $$('.et-panneau .et-crit').map(c => c.textContent.trim());
await clic('[data-act=et-suivante]', 600); out.apresSuivante = pas().slice(3, 5);
await clic('.et-pas[data-id=realisation]', 400); await clic('.et-pas[data-id=realisation]', 400);
if ($('[data-act=et-courante]')) await clic('[data-act=et-courante]', 500); out.retour = pas().slice(3, 5);
// fiche d'identité : réglage
await clic('[data-act=module][data-id=identite]', 500); await clic('[data-act=fiche-mode][data-id=saisie]', 600);
out.fiche = [$$('.et-mode').map(b => b.className), $$('.et-ligne:not(.et-entete)').length];
await clic('.et-mode[data-id=libre]', 500); out.libre = [$$('.et-pas').length, onglets().length];
await clic('.et-mode[data-id=timeline]', 500); out.timeline = $$('.et-pas').length;
// portefeuille
await clic('button[data-act=portefeuille]', 700);
out.cartes = $$('.pf-card .pf-etapes').length; out.carteTexte = $$('.pf-card').map(c => c.querySelector('.pf-etapes')?.parentElement.textContent.replace(/\s+/g, ' ').trim());
await clic('[data-act=pf-vue][data-id=frise]', 600); out.frise = $$('svg.hfrise text.s').map(t => t.textContent).slice(0, 4);
// projet DEMO
await ouvrir('Portail'); out.bandeauPRH = pas();
return out;
