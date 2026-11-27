// Préparer le copil n°3
await clic("[data-act=module][data-id=instances]");
await clic("[data-act=in-vue][data-id=copil]", 500);
const meteo = { delais: 1, budget: 1, perimetre: 0, risques: 1, equipe: 0 };
const axes = [...new Set($$("[data-act=in-meteo]").map(b => b.dataset.axe))];
for (const [i, axe] of axes.entries()) {
  const bs = $$(`[data-act=in-meteo][data-axe="${axe}"]`); const b = bs[[1, 1, 0, 1, 0][i] ?? 0]; if (b) { b.click(); await w(200); }
}
const fx = $("[data-prep=faits]"); if (fx) saisir(fx, "Sprint 5 livré : bulletins de paie consultables en ligne\nFAQ salariés en cours de rédaction\nRecrutement d'un renfort pour la recette");
const dc = $("[data-prep=decisions]"); if (dc) saisir(dc, "Ouvrir le portail aux managers dès la V1\nValider le décalage de 2 semaines de l'interface paie");
const et = $("[data-prep=etapes]"); if (et) saisir(et, "Recette utilisateurs en janvier\nFormation des managers");
const bu = $("[data-prep=budget]"); if (bu) saisir(bu, "Atterrissage à 186 k€ (+6 k€) à cause des licences.");
await w(300);
// RACI : activités proposées + quelques cases
await clic("[data-act=module][data-id=identite]");
await clic("[data-act=pp-vue][data-id=raci]", 400);
const prop = $("[data-act=pp-proposer]"); if (prop) { prop.click(); await w(400); const ok = [...document.querySelectorAll("#modal button")].find(b => /Ajouter|Valider|OK/.test(b.textContent)); if (ok) { ok.click(); await w(400); } }
const lignes = [...new Set($$("[data-act=pp-cell]").map(b => b.dataset.a))].slice(0, 6);
const motif = [[2, 1, 3, 0, 4, 0, 4], [4, 2, 1, 3, 1, 3, 0], [4, 2, 3, 1, 1, 1, 3], [2, 3, 1, 0, 3, 4, 1], [3, 2, 1, 4, 4, 1, 3], [2, 1, 3, 4, 0, 0, 3]];
for (const [li, a] of lignes.entries()) {
  const cs = $$(`[data-act=pp-cell][data-a="${a}"]`);
  for (const [ci, c] of cs.entries()) { const n = motif[li]?.[ci] || 0; for (let k = 0; k < n; k++) { $$(`[data-act=pp-cell][data-a="${a}"]`)[ci].click(); await w(40); } }
}
// Charge : quelques valeurs
await clic("[data-act=pp-vue][data-id=charge]", 400);
const ins = $$("[data-ch]");
const vals = [4, 4, 3, 3, 2, 12, 14, 12, 10, 8, 10, 10, 8, 6, 4, 16, 16, 15, 14, 12, 18, 19, 18, 16, 14, 6, 6, 4, 2, 2];
for (const [i, el] of ins.slice(0, 30).entries()) { el.value = vals[i % vals.length]; el.dispatchEvent(new Event("change", { bubbles: true })); el.dispatchEvent(new Event("input", { bubbles: true })); await w(30); }
return { axes, lignes: lignes.length, ch: ins.length };
