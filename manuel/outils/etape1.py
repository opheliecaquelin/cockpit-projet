# Étape 1 : fiche du projet + équipe + risques (sans planning : l'appli le génère ensuite)
import json, sys
SORTIE = sys.argv[1]
n = 0
def uid():
    global n; n += 1
    return f"sig{n:04d}"

P = [  # nom, fonction, entité, rôle, copil
    ("Hélène Garnier", "Directrice administrative et financière", "Finance", "Sponsor", True),
    ("Camille Lefèvre", "Cheffe de projet", "DSI", "Chef de projet", True),
    ("Antoine Mercier", "Juriste", "Juridique", "Référent métier", True),
    ("Laura Fontaine", "Responsable achats", "Achats", "Product Owner", True),
    ("Yanis Haddad", "Développeur intégration", "DSI", "Équipe projet", False),
    ("Mathieu Blanc", "Responsable sécurité SI", "DSI", "Architecte", False),
    ("Inès Morel", "Gestionnaire RH", "RH", "Utilisateur clé", False),
    ("Paul Renard", "Consultant éditeur", "SignaFlow (éditeur)", "Fournisseur / prestataire", False),
]
personnes, inter = [], []
for nom, fonc, ent, role, copil in P:
    pid = uid()
    personnes.append({"id": pid, "nom": nom, "fonction": fonc, "entite": ent, "email": nom.lower().replace(" ", ".").replace("é", "e").replace("è", "e").replace("ç", "c") + "@exemple.fr", "tel": "", "capacite": ""})
    inter.append({"id": uid(), "personneId": pid, "role": role, "copil": copil})

def risque(cat, titre, desc, impact, p, g, statut, resp, actions, notes="", creeLe="2026-11-10"):
    return {"id": uid(), "refId": "", "cat": cat, "titre": titre, "description": desc, "impact": impact, "p": p, "g": g, "critForce": None,
            "statut": statut, "responsable": resp, "revue": "", "notes": notes,
            "actions": [{"id": uid(), "texte": t, "responsable": r, "echeance": e, "fait": f, "creeLe": creeLe} for t, r, e, f in actions],
            "initial": {"p": p, "g": g, "c": p * g}, "creeLe": creeLe, "historique": [{"date": creeLe, "p": p, "g": g}]}

risques = [
    risque("planning", "Planning très court : aucune marge", "Quatre semaines de bout en bout, sans semaine tampon.", "Le moindre retard décale la mise en service prévue avant la campagne de renouvellement des contrats de janvier.", 3, 3, "traitement", "Camille Lefèvre",
           [("Valider avec la sponsor un périmètre minimal (MVP) en cas de retard", "Camille Lefèvre", "2026-11-20", False), ("Point quotidien de 15 min pendant la réalisation", "Camille Lefèvre", "2026-11-16", True)]),
    risque("externe", "Valeur probante de la signature", "Le niveau de signature (simple / avancée) doit être adapté à chaque type de contrat.", "Contrats contestables en cas de litige.", 2, 3, "traitement", "Antoine Mercier",
           [("Classer les modèles de contrats par niveau de signature requis", "Antoine Mercier", "2026-11-18", True), ("Faire valider le classement par le directeur juridique", "Antoine Mercier", "2026-11-24", False)]),
    risque("donnees", "Données personnelles hébergées chez l'éditeur", "Les contrats contiennent des données personnelles des salariés et fournisseurs.", "Non-conformité RGPD si l'hébergement est hors UE.", 2, 3, "traitement", "Mathieu Blanc",
           [("Obtenir l'attestation d'hébergement en France de l'éditeur", "Paul Renard", "2026-11-17", True), ("Mettre à jour le registre des traitements RGPD", "Mathieu Blanc", "2026-11-27", False)]),
    risque("archi", "Connecteur avec l'outil achats", "Le connecteur standard de l'éditeur ne gère pas nos bons de commande personnalisés.", "Ressaisie manuelle pour les achats, gain attendu réduit.", 2, 2, "identifie", "Yanis Haddad",
           [("Tester le connecteur sur 10 bons de commande réels", "Yanis Haddad", "2026-11-23", False)]),
    risque("adoption", "Adoption par les managers", "Habitués aux signatures papier, certains managers pourraient contourner l'outil.", "Double circuit papier / électronique.", 2, 2, "identifie", "Laura Fontaine",
           [("Préparer un tuto vidéo de 2 minutes", "Inès Morel", "2026-12-01", False)]),
]

projet = {
    "id": "sig-demo2", "nom": "Signature électronique des contrats", "code": "SIGN", "emoji": "✍️", "couleur": "#7b5ea7",
    "creeLe": "2026-11-02",
    "description": "🧪 PROJET DE DÉMONSTRATION (données fictives). Mettre en place la signature électronique pour les contrats de travail, les avenants et les bons de commande, avec un outil du marché.",
    "enjeu": "Passer de 10 jours à 2 jours en moyenne pour faire signer un contrat, avant la campagne de renouvellement de janvier.",
    "objectifs": "Signer 100 % des contrats de travail et avenants en électronique d'ici fin décembre\nRéduire le délai moyen de signature de 10 à 2 jours\nZéro impression papier pour les bons de commande de plus de 5 000 €",
    "perimetreIn": "Contrats de travail et avenants (RH)\nBons de commande (Achats)\nConnexion avec l'outil achats",
    "perimetreOut": "Contrats commerciaux clients\nArchivage à valeur probante (projet 2027)",
    "notes": "Projet court en mode hybride : cadrage, réalisation en sprints d'une semaine, recette et déploiement.",
    "dateDebut": "2026-11-09", "dateFin": "2026-12-04", "finFerme": True,
    "budget": {"montant": "", "unite": "keur"}, "options": {"budget": False, "charge": False},
    "interlocuteurs": inter, "liens": [{"id": uid(), "libelle": "Espace Teams du projet", "url": "https://www.exemple.fr/teams/signature-electronique"}],
    "risques": risques, "planning": None, "actions": [], "decisions": [], "livrables": [], "retex": [],
}
json.dump({"app": "cockpit-projet", "type": "projet", "version": 3, "projet": projet, "personnes": personnes}, open(SORTIE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ok", SORTIE)
