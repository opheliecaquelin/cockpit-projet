await w(1500); window.confirm = () => true; window.prompt = () => "4";
const out = { erreurs: [] }; window.addEventListener('error', e => out.erreurs.push(e.message));
const oe = console.error; console.error = (...a) => { out.erreurs.push(a.map(String).join(' ').slice(0, 200)); oe(...a); };
const telechargements = []; const URLo = URL.createObjectURL; URL.createObjectURL = b => { telechargements.push(b); return URLo(b); };
const ouvrir = async nom => { const s = $('#projSel'); s.value = [...s.options].find(o => o.textContent.includes(nom)).value; s.dispatchEvent(new Event('change', { bubbles: true })); await w(900); };
await ouvrir('Portail');
// 1. risque avéré
await clic('[data-act=module][data-id=risques]', 400); await clic('[data-act=vue][data-id=registre]', 400);
const nbAvant = $$('[data-act=open]').length;
await clic($$('[data-act=open]')[0], 500);
out.titreRisque = $('#rTitre')?.value;
$('#rAvere').click(); await w(400);
out.avere = [!!$('#rResolu'), !!$('.avere.on'), !$$('[data-statut]').length];
$('#rClose').click(); await w(300);
await clic('[data-act=vue][data-id=registre]', 400); out.registre = [nbAvant, $$('main [data-act=open]').length];
await clic('[data-act=vue][data-id=problemes]', 400);
out.problemes = [$$('.pb-carte').length, $('#subtabs [data-id=problemes]')?.textContent.trim()];
await clic('[data-act=pb-nouveau]', 500); $('#rTitre').value = 'Panne du serveur de recette'; $('#rTitre').dispatchEvent(new Event('input', { bubbles: true })); $('#rTitre').dispatchEvent(new Event('change', { bubbles: true })); await w(200);
$('#rResolu').click(); await w(300); $('#rClose').click(); await w(300);
out.problemes2 = [$$('.pb-carte').length, $$('.pb-carte.resolu').length];
// 4. objectifs dans le Go / No-Go
await clic('[data-act=module][data-id=planif]', 400); await clic('[data-act=pl-vue][data-id=gonogo]', 500);
out.objectifs = $$('.obj-ligne').length;
const inp = $('.obj-ligne [data-k=actuel]'); inp.value = '70 %'; inp.dispatchEvent(new Event('input', { bubbles: true })); await w(200);
await clic('.obj-ligne [data-act=gn-obj][data-v=encours]', 400);
out.objectifApres = [$('.obj-ligne')?.className, $('.obj-ligne [data-k=actuel]')?.value];
// 3. avancement réel
await clic('[data-act=pl-vue][data-id=hfrise]', 500); await clic('[data-act=pl-avreel]', 500);
out.tuileReel = $$('.hf-tiles > div').map(d => d.textContent.replace(/\s+/g, ' ').trim()).find(t => t.includes('Avancement réel'));
await clic('[data-act=pl-vue][data-id=jalons]', 500);
out.saisiesPhase = $$('[data-phreel]').length;
// 2. tendances
await clic('[data-act=module][data-id=cockpit]', 500); await clic('[data-act=ck-vue][data-id=tendances]', 500);
out.tendances = [$$('.td-carte').length, $('.cp-proj')?.textContent];
// 8. temps passé
await clic('[data-act=module][data-id=identite]', 400); await clic('[data-act=pp-vue][data-id=charge]', 500);
await clic('[data-act=pp-chvue][data-id=reel]', 500);
const c = $('.ch-in'); c.value = '6'; c.dispatchEvent(new Event('change', { bubbles: true })); await w(400);
out.chargeReel = [$('[data-act=pp-chvue].on')?.textContent, $('.ch-in')?.value, $$('.ch-g').slice(0, 2).map(x => x.textContent)];
await clic('[data-act=pp-chvue][data-id=prevu]', 400); out.chargePrevu = $('.ch-in')?.value;
// 9. export des tâches
await clic('[data-act=module][data-id=decisions]', 400); await clic('[data-act=dc-vue][data-id=actions]', 400);
await clic('[data-act=dc-taches]', 400); await clic('#modal [data-fmt=outlook]', 400); await clic('[data-act=dc-taches]', 400); await clic('#modal [data-fmt=ics]', 400);
out.exports = await Promise.all(telechargements.map(async b => (await b.text()).slice(0, 160)));
// 6. rapport
telechargements.length = 0;
await clic('[data-act=module][data-id=cockpit]', 400); await clic('[data-act=ck-vue][data-id=synthese]', 400);
await clic('[data-act=tu-rapport]', 400); out.rapportCases = $$('#modal [data-rp]:checked').length; await clic('#rpOk', 1500);
const r = telechargements[0] ? await telechargements[0].text() : ''; out.rapport = [r.length, (r.match(/class="rp-h"/g) || []).length, r.includes('Portail RH en ligne')];
return out;
