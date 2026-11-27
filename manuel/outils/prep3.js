// Compte rendu du copil n°2 (fictif)
await clic('[data-act=module][data-id=cr]');
const carte = [...document.querySelectorAll("[data-act=cr-ouvrir]")].find(e => e.textContent.includes("Copil n°2"));
await clic(carte, 600);
for (const b of $$("[data-act=cr-pres][data-v=present]").slice(0, 4)) { b.click(); await w(120); }
const ex = $$("[data-act=cr-pres][data-v=excuse]")[4]; if (ex) { ex.click(); await w(150); }
const notes = [
  "Sprints 3 et 4 livrés : la pose de congés fonctionne de bout en bout.\nDémo appréciée par la RH.",
  "Retard de 2 semaines sur l'interface avec l'éditeur de paie.\nAtelier d'architecture prévu, voir https://www.exemple.fr/portail-rh/interface-paie",
  "Budget consommé : 86 k€ sur 180 k€. Atterrissage estimé à 186 k€ (licences plus chères).",
  "Validation demandée : reporter les notes de frais en V2.",
];
const tas = $$("textarea[data-crp]");
for (let i = 0; i < tas.length && i < notes.length; i++) { saisir(tas[i], notes[i]); await w(150); }
// capture d'écran collée dans le premier point
const r = await fetch("/manuel/images/_bl.png"); const f = new File([await r.blob()], "image.png", { type: "image/png" });
const dt = new DataTransfer(); dt.items.add(f);
$$("textarea[data-crp]")[0].dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); await w(1200);
saisir("#crDec", "Reporter le module « notes de frais » en V2"); await clic("[data-act=cr-dec-ajout]", 400);
saisir("#crAct", "Organiser l'atelier interface paie"); saisir("#crActQui", "Thomas Petit"); saisir("#crActDate", "2026-11-20"); await clic("[data-act=cr-act-ajout]", 400);
saisir("#crAct", "Envoyer le compte rendu aux participants"); saisir("#crActQui", "Julien Moreau"); saisir("#crActDate", "2026-11-06"); await clic("[data-act=cr-act-ajout]", 400);
await clic("[data-act=cr-diffuse]", 500);
return { pts: $$("textarea[data-crp]").length, caps: $$(".cap-vig").length, txt: $("main").innerText.slice(0, 200) };
