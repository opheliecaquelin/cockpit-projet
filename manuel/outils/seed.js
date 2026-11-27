// Données de démonstration (fictives) pour les captures du manuel
(() => {
  let n = 0; const id = () => "demo" + (++n).toString(36).padStart(4, "0");
  const J = (d) => { const x = new Date("2026-11-18T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
  const pers = [
    ["Claire Martin", "Directrice RH", "RH"], ["Julien Moreau", "Chef de projet", "DSI"], ["Sophie Laurent", "Product Owner", "RH"],
    ["Karim Benali", "Scrum Master", "DSI"], ["Élise Dubois", "Développeuse", "DSI"], ["Thomas Petit", "Architecte", "DSI"],
    ["Nadia Roux", "Référente paie", "RH"], ["Marc Girard", "DSI", "DSI"],
  ].map(([nom, fonction, entite]) => ({ id: id(), nom, fonction, entite, email: nom.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(" ", ".") + "@exemple.fr", tel: "", capacite: "" }));
  const P = Object.fromEntries(pers.map(p => [p.nom.split(" ")[0], p.id]));
  const inter = (nom, role, copil) => ({ id: id(), personneId: P[nom], role, copil });
  const ref = (k) => window.CATALOGUE[k];
  const risque = (k, pp, g, statut, extra = {}) => { const r = ref(k); return { id: id(), refId: r.id, cat: r.cat, titre: r.titre, description: r.description, impact: r.impact, p: pp, g, critForce: null, statut, responsable: "", revue: "", notes: "", actions: [], initial: { p: r.p, g: r.g, c: r.p * r.g }, creeLe: J(-60), historique: [{ date: J(-60), p: r.p, g: r.g }, { date: J(-10), p: pp, g }], ...extra }; };

  const prh = {
    id: id(), nom: "Portail RH en ligne", code: "PRH", emoji: "🌐", couleur: "#5a9fc9", creeLe: J(-72),
    description: "Un portail où chaque salarié consulte ses bulletins de paie, pose ses congés et met à jour ses informations personnelles.",
    enjeu: "Supprimer les demandes papier et libérer 2 jours par semaine à l'équipe RH.",
    objectifs: "Dématérialiser 100 % des demandes de congés\nMettre en ligne les bulletins de paie", perimetreIn: "Congés, bulletins, données personnelles", perimetreOut: "Recrutement, formation",
    notes: "Espace de travail de l'équipe : https://www.exemple.fr/portail-rh/wiki",
    dateDebut: J(-72), dateFin: J(130), finFerme: false,
    budget: { montant: "180", unite: "keur", lignes: [], points: [] }, options: { budget: true, charge: true },
    interlocuteurs: [inter("Claire", "Sponsor", true), inter("Julien", "Chef de projet", true), inter("Sophie", "Product Owner", true), inter("Karim", "Scrum Master", false), inter("Élise", "Équipe projet", false), inter("Thomas", "Architecte", false), inter("Nadia", "Référent métier", true)],
    liens: [], risques: [], planning: null, actions: [], decisions: [], livrables: [], retex: [],
    backlog: { outil: "clickup", url: "https://app.clickup.com/exemple/portail-rh", imports: [], mapping: null },
  };
  const R = prh.risques;
  R.push(risque(10, 3, 3, "traitement", { responsable: "Thomas Petit", notes: "Point d'attention remonté au copil d'octobre." }));
  R.push(risque(25, 2, 3, "traitement", { responsable: "Julien Moreau" }));
  R.push(risque(40, 2, 2, "surveille", { responsable: "Sophie Laurent" }));
  R.push(risque(55, 3, 2, "identifie"));
  R.push(risque(70, 1, 2, "surveille", { responsable: "Karim Benali" }));
  R.push(risque(5, 1, 1, "leve"));
  R[0].actions.push({ id: id(), texte: "Organiser un atelier d'architecture avec l'éditeur de paie", responsable: "Thomas Petit", echeance: J(-3), fait: false, creeLe: J(-20) });
  R[0].actions.push({ id: id(), texte: "Tester l'interface de paie sur l'environnement de recette", responsable: "Élise Dubois", echeance: J(9), fait: false, creeLe: J(-20) });
  R[1].actions.push({ id: id(), texte: "Faire valider le planning de recette par la RH", responsable: "Julien Moreau", echeance: J(4), fait: false, creeLe: J(-15) });
  R[1].actions.push({ id: id(), texte: "Identifier un renfort pour la recette", responsable: "Claire Martin", echeance: J(-12), fait: true, faitLe: J(-14), creeLe: J(-30) });

  prh.decisions.push(
    { id: id(), titre: "Connexion au portail avec le compte Windows (SSO)", date: J(-40), statut: "validee", instance: "", decideur: "Marc Girard", description: "Évite un mot de passe de plus. Voir la note d'architecture.", impacts: ["Planning"], risques: [], creeLe: J(-40) },
    { id: id(), titre: "Reporter le module « notes de frais » en version 2", date: J(-25), statut: "validee", instance: "", decideur: "Claire Martin", description: "Pour tenir la date de mise en production.", impacts: ["Périmètre"], risques: [], creeLe: J(-25) },
    { id: id(), titre: "Ouvrir le portail aux managers dès la V1", date: J(-5), statut: "attente", instance: "", decideur: "Claire Martin", description: "", impacts: ["Périmètre", "Planning"], risques: [], creeLe: J(-5) },
    { id: id(), titre: "Application mobile dédiée", date: J(-30), statut: "refusee", instance: "", decideur: "Marc Girard", description: "Le portail sera adapté aux téléphones : pas d'application à installer.", impacts: ["Budget"], risques: [], creeLe: J(-30) },
  );
  const act = (texte, responsable, echeance, fait = false) => ({ id: id(), texte, responsable, echeance, fait, faitLe: fait ? J(-2) : "", creeLe: J(-20), source: { type: "libre" }, notes: "" });
  prh.actions.push(
    act("Rédiger la FAQ salariés", "Sophie Laurent", J(12)),
    act("Envoyer le planning de formation aux managers", "Julien Moreau", J(-2)),
    act("Commander les licences de l'outil de signature", "Marc Girard", J(0)),
    act("Mettre à jour la charte graphique du portail", "Élise Dubois", J(-6), true),
  );
  prh.actions[0].source = { type: "decision", id: prh.decisions[1].id };

  prh.livrables.push(
    { id: id(), titre: "Note de cadrage", cat: "doc", statut: "valide", responsable: "Julien Moreau", valideur: "Claire Martin", echeance: J(-50), version: "1.2", lien: "https://www.exemple.fr/portail-rh/cadrage", jalonId: "", notes: "", fichier: null },
    { id: id(), titre: "Spécifications fonctionnelles", cat: "specs", statut: "relecture", responsable: "Sophie Laurent", valideur: "Nadia Roux", echeance: J(6), version: "0.9", lien: "", jalonId: "", notes: "", fichier: null },
    { id: id(), titre: "Manuel utilisateur salarié", cat: "manuel", statut: "redaction", responsable: "Sophie Laurent", valideur: "Claire Martin", echeance: J(60), version: "0.3", lien: "", jalonId: "", notes: "", fichier: null },
    { id: id(), titre: "Contrat éditeur de paie", cat: "contrat", statut: "diffuse", responsable: "Marc Girard", valideur: "", echeance: J(-65), version: "", lien: "", jalonId: "", notes: "", fichier: null },
    { id: id(), titre: "Tutoriel « Poser un congé »", cat: "tuto", statut: "afaire", responsable: "Élise Dubois", valideur: "Sophie Laurent", echeance: J(-1), version: "", lien: "", jalonId: "", notes: "", fichier: null },
  );
  prh.retex.push(
    { id: id(), date: J(-15), nature: "positif", categorie: CATS(0), sprintId: "", constat: "Les démos de fin de sprint ont beaucoup rassuré la RH", cause: "Les utilisateurs voient le produit tôt", recommandation: "Inviter un utilisateur clé à chaque démo", phase: "", partage: true },
    { id: id(), date: J(-15), nature: "ameliorer", categorie: CATS(1), sprintId: "", constat: "Les environnements de test n'étaient pas prêts au sprint 1", cause: "Demande faite trop tard à l'infrastructure", recommandation: "Commander les environnements dès le cadrage", phase: "", partage: true },
    { id: id(), date: J(-1), nature: "positif", categorie: CATS(2), sprintId: "", constat: "Daily courts et efficaces (10 min)", cause: "", recommandation: "", phase: "", partage: true },
  );
  function CATS(i) { return ["Organisation & équipe", "Technique", "Communication", "Planning"][i]; }
  prh.budget.lignes.push(
    { id: id(), categorie: "interne", poste: "Équipe projet DSI", prevu: "90", engage: "90", consomme: "38", raf: "56" },
    { id: id(), categorie: "externe", poste: "Intégrateur (développement)", prevu: "60", engage: "60", consomme: "22", raf: "38" },
    { id: id(), categorie: "licences", poste: "Licences éditeur de paie", prevu: "20", engage: "24", consomme: "24", raf: "0" },
    { id: id(), categorie: "materiel", poste: "Hébergement", prevu: "10", engage: "6", consomme: "2", raf: "6" },
  );
  prh.budget.points.push({ id: id(), date: J(-60), prevu: 180, engage: 120, consomme: 10, atterrissage: 180, commentaire: "" }, { id: id(), date: J(-30), prevu: 180, engage: 170, consomme: 48, atterrissage: 182, commentaire: "" }, { id: id(), date: J(-1), prevu: 180, engage: 180, consomme: 86, atterrissage: 186, commentaire: "Licences plus chères que prévu" });

  const mig = {
    id: id(), nom: "Migration de la messagerie", code: "MSG", emoji: "📦", couleur: "#d4925f", creeLe: J(-30),
    description: "Passage de toute l'entreprise à la nouvelle messagerie.", enjeu: "Fin du support de l'ancien serveur en juin.",
    dateDebut: J(-30), dateFin: J(150), budget: { montant: "60", unite: "keur" }, options: { budget: false, charge: false },
    interlocuteurs: [inter("Marc", "Sponsor", true), inter("Julien", "Chef de projet", true), inter("Thomas", "Architecte", false)],
    risques: [risque(12, 2, 2, "surveille"), risque(33, 3, 3, "identifie")], planning: null, actions: [], decisions: [],
  };
  const app = {
    id: id(), nom: "Application de réservation de salles", code: "RES", emoji: "📱", couleur: "#5f9e76", creeLe: J(-200),
    description: "Réserver une salle de réunion depuis son téléphone.", enjeu: "Fluidifier l'usage des salles.",
    dateDebut: J(-200), dateFin: J(20), budget: { montant: "35", unite: "keur" }, options: { budget: false, charge: false },
    interlocuteurs: [inter("Claire", "Sponsor", true), inter("Sophie", "Product Owner", true)],
    risques: [risque(18, 1, 2, "surveille")], planning: null, actions: [], decisions: [],
  };
  const S = { projets: [prh, mig, app], actif: prh.id, annuaire: pers, calendrier: { alsace: false, pentecoteTravaillee: false, fermetures: [{ id: id(), debut: "2026-12-24", fin: "2027-01-01", libelle: "Fermeture de fin d'année" }] } };
  localStorage.setItem("radar-risques-v1", JSON.stringify(S));
  return "seed ok";
})();
