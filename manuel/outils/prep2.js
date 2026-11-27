// Backlog : faux export (fictif)
const st = ["Done", "Done", "Done", "In Progress", "To Do", "Blocked"];
const epics = ["Congés", "Bulletins de paie", "Données personnelles", "Connexion"];
const qui = ["Élise Dubois", "Karim Benali", "Thomas Petit", ""];
const L = ["Issue key;Summary;Issue Type;Status;Assignee;Sprint;Story Points;Epic Link;Due Date"];
let k = 1;
for (let s = 1; s <= 8; s++) {
  for (let i = 0; i < 6; i++) {
    const status = s <= 5 ? "Done" : s === 6 ? ["Done", "In Progress", "In Progress", "To Do", "Blocked", "Done"][i] : "To Do";
    const pts = [1, 2, 3, 5, 8, 3][(i + s) % 6];
    const due = s === 6 && i === 4 ? "2026-11-10" : "";
    L.push(`PRH-${k};${["Afficher", "Valider", "Exporter", "Notifier", "Modifier", "Consulter"][i]} ${["le solde de congés", "un bulletin", "les absences", "le manager", "l'adresse", "l'historique"][(i + s) % 6]};${i === 4 ? "Bug" : "Story"};${status};${qui[(i + s) % 4]};${s <= 6 ? "PRH Sprint " + s : ""};${pts};${epics[(i + s) % 4]};${due}`);
    k++;
  }
}
await clic('[data-act=module][data-id=backlog]');
await clic(btn("Importer un export CSV"), 500);
saisir("#blTxt", L.join("\n"));
await clic("#blSuite", 600);
let etapes = [];
for (let i = 0; i < 4; i++) {
  const b = [...document.querySelectorAll("#modal button")].find(x => /Importer|Suivant|Valider/.test(x.textContent) && !/Annuler/.test(x.textContent));
  if (!b) break; etapes.push(b.textContent.trim()); b.click(); await w(600);
  if ($("#modalBack").hidden) break;
}
return { etapes, main: $("main").innerText.slice(0, 300) };
