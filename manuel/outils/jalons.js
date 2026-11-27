await clic('[data-act=close-modal]', 300);
const ajout = async (nom, date, atteint, risque) => {
  await clic('[data-act=pl-new-jalon]', 500);
  saisir('#jaNom', nom); saisir('#jaDate', date);
  if (atteint) $('#jaAtteint').checked = true;
  if (risque != null) { const c = $$('#modal [data-jr]')[risque]; if (c) c.checked = true; }
  await clic('#jaOk', 500);
};
await ajout('Fin du cadrage', '2026-10-02', true);
await ajout('Recette utilisateurs', '2027-01-11', false, 1);
await ajout('Ouverture pilote', '2027-02-22', false);
// glissement : la recette passe du 11 au 25 janvier
await clic('[data-act=pl-vue][data-id=jalons]', 400);
const el = $$('main [data-act]').find(e => e.textContent.includes('Recette utilisateurs') && e.textContent.length < 200);
const info = el ? el.dataset.act : 'introuvable';
if (el) { await clic(el, 500); if ($('#jaDate')) { saisir('#jaDate', '2027-01-25'); await clic('#jaOk', 500); } }
const R = { info, jalons: $('main').innerText.slice(0, 600) };
