const cles = $$("[data-ch]").map(e => [e.dataset.ch, e.dataset.m]);
const pers = [...new Set(cles.map(c => c[0]))];
const mois = [...new Set(cles.map(c => c[1]))];
const plan = [[4, 3, 3, 2, 2, 2, 2], [12, 14, 12, 10, 12, 12, 10], [10, 10, 8, 8, 10, 12, 8], [8, 8, 8, 6, 8, 8, 6], [16, 18, 17, 14, 17, 16, 12], [6, 6, 8, 4, 4, 2, 2], [2, 2, 4, 3, 8, 10, 4]];
for (const [pi, p] of pers.entries()) for (const [mi, m] of mois.entries()) {
  const e = $(`[data-ch="${p}"][data-m="${m}"]`); if (!e) continue;
  e.value = plan[pi]?.[mi] ?? ""; e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); await w(60);
}
// deuxième projet : planning hybride ; Julien aussi chargé ailleurs
return { pers: pers.length, mois: mois.length, total: $("main").innerText.match(/Total projet[\s\S]{0,40}/)?.[0] };
