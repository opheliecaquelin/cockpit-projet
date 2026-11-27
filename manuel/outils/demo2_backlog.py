# Backlog fictif du projet SIGN : deux photos (13 nov. fin du sprint 0, 19 nov. sprint 1 en cours)
import json, sys, copy
F = sys.argv[1]
d = json.load(open(F, encoding='utf-8')); p = d['projet']
CAT = {"To Do": "afaire", "In Progress": "encours", "Blocked": "bloque", "Done": "fait"}
S0, S1, S2 = "SIGN Sprint 0", "SIGN Sprint 1", "SIGN Sprint 2"
Y, PR, MB, LF, IM = "Yanis Haddad", "Paul Renard", "Mathieu Blanc", "Laura Fontaine", "Inès Morel"
# clé, titre, type, epic, points, responsable, prio, échéance, (sprint, statut) au 13/11, (sprint, statut) au 19/11
L = [
  ("Ouvrir l'environnement de test éditeur", "Task", "Socle & sécurité", 2, PR, "High", "", (S0, "Done"), (S0, "Done")),
  ("Connexion par le compte de l'entreprise (SSO)", "Story", "Socle & sécurité", 8, Y, "High", "", (S0, "Done"), (S0, "Done")),
  ("Créer les profils : gestionnaire, manager, signataire", "Story", "Socle & sécurité", 3, PR, "Medium", "", (S0, "Done"), (S0, "Done")),
  ("Importer la charte graphique dans les mails", "Task", "Suivi & notifications", 1, PR, "Low", "", (S0, "Done"), (S0, "Done")),
  ("Attestation d'hébergement en France", "Task", "Socle & sécurité", 1, MB, "High", "", (S0, "Done"), (S0, "Done")),
  ("Importer les modèles de contrats de travail", "Story", "Parcours RH", 3, IM, "High", "", (S0, "Done"), (S0, "Done")),
  ("Journal d'audit des signatures", "Story", "Socle & sécurité", 5, MB, "Medium", "", (S0, "In Progress"), (S0, "Done")),
  ("Circuit RH : gestionnaire → manager → salarié → DRH", "Story", "Parcours RH", 8, Y, "High", "", (S1, "To Do"), (S1, "Done")),
  ("Signature avancée pour les contrats de travail", "Story", "Parcours RH", 5, PR, "High", "", (S1, "To Do"), (S1, "Done")),
  ("Signature simple pour les avenants", "Story", "Parcours RH", 2, PR, "Medium", "", (S1, "To Do"), (S1, "Done")),
  ("Notifications par mail aux signataires", "Story", "Suivi & notifications", 3, Y, "High", "", (S1, "To Do"), (S1, "Done")),
  ("Relance automatique au bout de 48 h", "Story", "Suivi & notifications", 3, Y, "High", "2026-11-20", None, (S1, "In Progress")),
  ("Tableau de suivi des signatures en cours", "Story", "Suivi & notifications", 5, Y, "Medium", "2026-11-20", (S1, "To Do"), (S1, "In Progress")),
  ("Pré-remplir le contrat depuis la fiche salarié", "Story", "Parcours RH", 5, PR, "Medium", "2026-11-20", (S1, "To Do"), (S1, "Blocked")),
  ("Tester le parcours RH avec 3 contrats réels", "Task", "Parcours RH", 2, IM, "High", "2026-11-19", (S1, "To Do"), (S1, "Done")),
  ("Importer les modèles de bons de commande", "Story", "Bons de commande", 2, LF, "High", "", (S2, "To Do"), (S2, "To Do")),
  ("Circuit achats : responsable achats → fournisseur", "Story", "Bons de commande", 5, Y, "High", "", (S2, "To Do"), (S2, "To Do")),
  ("Seuil : signature obligatoire au-delà de 5 000 €", "Story", "Bons de commande", 2, Y, "Medium", "", (S2, "To Do"), (S2, "To Do")),
  ("Connecteur : envoyer le bon de commande à signer", "Story", "Connecteur achats", 8, Y, "High", "2026-11-27", (S2, "To Do"), (S2, "To Do")),
  ("Connecteur : retour du bon signé dans l'outil achats", "Story", "Connecteur achats", 5, Y, "High", "2026-11-27", (S2, "To Do"), (S2, "To Do")),
  ("Gérer les bons de commande personnalisés", "Bug", "Connecteur achats", 3, PR, "High", "2026-11-18", (S2, "To Do"), (S2, "To Do")),
  ("Signature depuis un smartphone", "Story", "Parcours RH", 3, PR, "Low", "", (S2, "To Do"), (S2, "To Do")),
  ("Mise à jour du registre RGPD", "Task", "Socle & sécurité", 1, MB, "Medium", "2026-11-27", (S2, "To Do"), (S2, "To Do")),
  ("Délégation de signature en cas d'absence", "Story", "Parcours RH", 2, "", "Low", "", ("", "To Do"), ("", "To Do")),
  ("Export mensuel des contrats signés", "Story", "Suivi & notifications", 2, "", "Low", "", ("", "To Do"), ("", "To Do")),
  ("Rappel au manager avant l'échéance du contrat", "Story", "Suivi & notifications", 2, "", "Low", "", ("", "To Do"), ("", "To Do")),
  ("Préparer le jeu de données de recette", "Task", "Recette & déploiement", 2, LF, "High", "2026-11-27", ("", "To Do"), ("", "To Do")),
  ("Recette globale des parcours RH et achats", "Task", "Recette & déploiement", 5, LF, "High", "2026-12-02", ("", "To Do"), ("", "To Do")),
  ("Former les gestionnaires RH", "Task", "Recette & déploiement", 2, IM, "High", "2026-12-02", ("", "To Do"), ("", "To Do")),
  ("Ouvrir l'environnement de production", "Task", "Recette & déploiement", 2, PR, "High", "2026-12-03", ("", "To Do"), ("", "To Do")),
  ("Basculer les contrats en cours sur l'outil", "Task", "Recette & déploiement", 2, IM, "Medium", "2026-12-04", ("", "To Do"), ("", "To Do")),
  ("Libellé tronqué dans le mail de relance", "Bug", "Suivi & notifications", 1, Y, "Low", "", None, ("", "To Do")),
  ("Signer les contrats d'intérim", "Story", "Parcours RH", 3, "", "Medium", "", ("", "To Do"), None),  # retiré : passe en demande de changement
]
def photo(idx):
    items = []
    for i, x in enumerate(L):
        etat = x[7 + idx]
        if etat is None: continue
        sprint, st = etat
        items.append({"k": f"SIGN-{i + 1}", "t": x[0], "type": x[1], "st": st, "cat": CAT[st], "prio": x[5], "qui": x[4], "pts": x[3], "sprint": sprint, "epic": x[2], "cree": "", "resolu": "", "ech": x[6]})
    tot = {"nb": len(items), "pts": sum(i["pts"] for i in items)}
    for c in ("afaire", "encours", "bloque", "fait"):
        sel = [i for i in items if i["cat"] == c]; tot[c] = {"nb": len(sel), "pts": sum(i["pts"] for i in sel)}
    return items, tot
i1, t1 = photo(0); i2, t2 = photo(1)
p['backlog'] = {
    "outil": "jira", "url": "https://www.exemple.fr/jira/projects/SIGN",
    "imports": [
        {"id": "sigbl0000001", "date": "2026-11-13", "source": "SIGN-export-2026-11-13.csv", "totaux": t1, "items": i1},
        {"id": "sigbl0000002", "date": "2026-11-19", "source": "SIGN-export-2026-11-19.csv", "totaux": t2, "items": i2},
    ],
    "mapping": {"champs": {"k": "Issue key", "t": "Summary", "type": "Issue Type", "st": "Status", "prio": "Priority", "qui": "Assignee", "pts": "Story Points", "sprint": "Sprint", "epic": "Epic Link", "cree": "", "resolu": "", "ech": "Due Date"},
                "statuts": {"Blocked": "bloque", "Done": "fait", "In Progress": "encours", "To Do": "afaire"}, "dateFmt": "mj"},
}
json.dump(d, open(F, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print("13/11 :", t1); print("19/11 :", t2)
