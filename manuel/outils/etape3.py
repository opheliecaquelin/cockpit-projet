# Étape 3 : contenu vivant du projet (CR, décisions, actions, livrables, RACI, retex, flash, changement, préparation du copil)
import json, sys
F = sys.argv[1]
d = json.load(open(F, encoding='utf-8')); p = d['projet']; pl = p['planning']
n = 0
def uid():
    global n; n += 1
    return f"sigc{n:04d}"

I = {x['role']: x['id'] for x in p['interlocuteurs']}  # rôle → id interlocuteur
reu = lambda typ, motif="": next(r for r in pl['reunions'] if r['type'] == typ and (not motif or r.get('motif') == motif))
jal = lambda nom: next(j for j in pl['jalons'] if j['nom'] == nom)
jal("Fin de cadrage")['atteint'] = True

def cr(r, presents, excuses, points, diffuse=""):
    pres = {I[x]: "present" for x in presents}; pres.update({I[x]: "excuse" for x in excuses})
    r['cr'] = {"presence": pres, "autres": "", "points": [{"id": uid(), "titre": t, "notes": nt} for t, nt in points], "creeLe": r['date'], "diffuseLe": diffuse}

L, C, E = reu("lancement"), reu("cadrage"), reu("entretien", "n°1")
PS1 = next(r for r in pl['reunions'] if r['type'] == 'planning' and r['date'] == '2026-11-16')
AF1 = next(r for r in pl['reunions'] if r['type'] == 'affinage' and r['date'] == '2026-11-18')
TOUS = ["Sponsor", "Chef de projet", "Référent métier", "Product Owner", "Équipe projet", "Architecte", "Utilisateur clé", "Fournisseur / prestataire"]
cr(L, TOUS, [], [
    ("Contexte et enjeux", "Délai moyen actuel de signature d'un contrat : 10 jours (envois papier, relances).\nObjectif : 2 jours, avant la campagne de renouvellement de janvier."),
    ("Objectifs et périmètre", "Contrats de travail, avenants et bons de commande.\nHors périmètre : contrats commerciaux et archivage à valeur probante (2027)."),
    ("Organisation et planning", "4 semaines en hybride : cadrage (1 semaine), 2 sprints d'une semaine, recette, déploiement le 4 décembre.\nPoint quotidien de 15 min pendant les sprints."),
    ("Questions", "La DRH demande que les gestionnaires RH soient formés avant la mise en service."),
], "2026-11-09")
cr(C, ["Chef de projet", "Référent métier", "Product Owner", "Architecte", "Fournisseur / prestataire", "Utilisateur clé"], ["Équipe projet"], [
    ("Parcours de signature cibles", "RH : contrat préparé par la gestionnaire → validation du manager → signature du salarié → signature de la DRH.\nAchats : bon de commande > 5 000 € → signature du responsable achats puis du fournisseur."),
    ("Niveaux de signature", "Le juridique classe chaque modèle de contrat (signature simple ou avancée) pour le 18 novembre."),
    ("Sécurité et RGPD", "L'éditeur confirme un hébergement en France ; attestation attendue sous une semaine."),
    ("Entretiens utilisateurs", "3 entretiens prévus (RH, achats, un manager) pour valider les parcours."),
], "2026-11-10")
cr(E, ["Chef de projet", "Product Owner", "Utilisateur clé"], [], [
    ("Personne interviewée", "Inès Morel, gestionnaire RH : prépare environ 40 contrats et avenants par mois."),
    ("Irritants actuels", "Relances par téléphone, contrats égarés dans les bannettes, scans illisibles."),
    ("Attentes", "Voir en un coup d'œil où en est chaque contrat.\nRelance automatique au bout de 48 h."),
    ("Verbatim", "« Si je pouvais ne plus jamais imprimer un avenant, ce serait déjà une victoire. »"),
], "2026-11-13")
cr(PS1, ["Chef de projet", "Product Owner", "Équipe projet", "Fournisseur / prestataire"], [], [
    ("Objectif du sprint 1", "Parcours de signature RH de bout en bout, sur l'environnement de test de l'éditeur."),
    ("Éléments retenus", "Modèles de contrats importés · circuit de validation manager · notifications par mail · tableau de suivi des signatures."),
    ("Capacité et risques", "Accès à l'environnement de test reçu avec 2 jours de retard : le tableau de suivi pourrait glisser au sprint 2."),
])
# préparation du copil (en cours)
CP = reu("copil")
CP['prep'] = {"meteo": {"global": "nuage", "delais": "nuage", "perimetre": "soleil", "equipe": "soleil"},
              "faits": "Cadrage terminé dans les temps\nParcours RH testé avec 3 contrats réels\nAttestation d'hébergement en France reçue",
              "decisions": "Inclure ou non les contrats d'intérim dans la V1\nGo / No-Go de mise en production du 4 décembre",
              "etapes": "Recette globale du 30 novembre au 2 décembre\nFormation des gestionnaires RH le 2 décembre\nMise en production le 4 décembre",
              "budget": "", "diapos": ["titre", "odj", "meteo", "avancement", "ecarts", "risques", "actions", "releve", "decisions", "etapes"], "statue": False}

dec = [
    {"id": uid(), "titre": "Outil retenu : SignaFlow (offre entreprise)", "date": "2026-11-09", "statut": "validee", "instance": L['id'], "decideur": "Hélène Garnier",
     "description": "Choix fait à l'issue de la consultation d'octobre : meilleure intégration avec l'outil achats et hébergement en France.", "impacts": ["Organisation"], "risques": [], "creeLe": "2026-11-09"},
    {"id": uid(), "titre": "Signature avancée pour les contrats de travail, simple pour les avenants et bons de commande", "date": "2026-11-10", "statut": "validee", "instance": C['id'], "decideur": "Antoine Mercier",
     "description": "Niveau de signature adapté à la valeur probante requise par type de document.", "impacts": ["Périmètre"], "risques": [p['risques'][1]['id']], "creeLe": "2026-11-10"},
    {"id": uid(), "titre": "Relance automatique des signataires au bout de 48 h", "date": "2026-11-16", "statut": "validee", "instance": PS1['id'], "decideur": "Laura Fontaine",
     "description": "Demande issue de l'entretien utilisateur n°1.", "impacts": ["Périmètre"], "risques": [], "creeLe": "2026-11-16"},
    {"id": uid(), "titre": "Inclure les contrats d'intérim dans la V1 ?", "date": "", "statut": "attente", "instance": "", "decideur": "Hélène Garnier",
     "description": "Demande de la DRH. Impact estimé : +3 jours. À trancher au copil du 30 novembre.", "impacts": ["Planning", "Périmètre"], "risques": [], "creeLe": "2026-11-17"},
]
p['decisions'] = dec

def act(texte, resp, ech, fait=False, faitLe="", src=None, cree="2026-11-10"):
    return {"id": uid(), "texte": texte, "responsable": resp, "echeance": ech, "fait": fait, "faitLe": faitLe, "creeLe": cree, "source": src or {"type": "libre"}, "notes": ""}
p['actions'] += [
    act("Envoyer la note de cadrage à la sponsor pour validation", "Camille Lefèvre", "2026-11-13", True, "2026-11-13", {"type": "reunion", "id": C['id']}),
    act("Créer les comptes utilisateurs sur l'environnement de test", "Paul Renard", "2026-11-12", True, "2026-11-13", {"type": "reunion", "id": C['id']}),
    act("Paramétrer la relance automatique à 48 h", "Yanis Haddad", "2026-11-20", src={"type": "decision", "id": dec[2]['id']}, cree="2026-11-16"),
    act("Récupérer 10 bons de commande réels anonymisés pour les tests", "Laura Fontaine", "2026-11-18", cree="2026-11-16"),
    act("Planifier la formation des gestionnaires RH (2 décembre)", "Inès Morel", "2026-11-25", src={"type": "reunion", "id": L['id']}, cree="2026-11-09"),
    act("Chiffrer l'ajout des contrats d'intérim pour le copil", "Camille Lefèvre", "2026-11-26", src={"type": "decision", "id": dec[3]['id']}, cree="2026-11-17"),
]

J = {j['nom']: j['id'] for j in pl['jalons']}
def liv(titre, cat, statut, resp, val, ech, ver="", jal="", notes=""):
    return {"id": uid(), "titre": titre, "cat": cat, "statut": statut, "responsable": resp, "valideur": val, "echeance": ech, "version": ver, "lien": "", "jalonId": J.get(jal, ""), "notes": notes, "fichier": None}
p['livrables'] = [
    liv("Note de cadrage", "doc", "valide", "Camille Lefèvre", "Hélène Garnier", "2026-11-13", "1.0", "Fin de cadrage"),
    liv("Classement des contrats par niveau de signature", "doc", "relecture", "Antoine Mercier", "Directeur juridique", "2026-11-18", "0.9", "Fin de cadrage"),
    liv("Spécifications du connecteur achats", "specs", "redaction", "Yanis Haddad", "Laura Fontaine", "2026-11-24", "0.3", "Fin de réalisation"),
    liv("Plan et cahier de recette", "doc", "afaire", "Laura Fontaine", "Camille Lefèvre", "2026-11-27", "", "Recette validée"),
    liv("PV de recette", "doc", "afaire", "Camille Lefèvre", "Hélène Garnier", "2026-12-02", "", "Recette validée"),
    liv("Guide « Signer un contrat en 3 clics »", "manuel", "afaire", "Inès Morel", "Laura Fontaine", "2026-12-01", "", "Mise en production"),
    liv("Tuto vidéo managers (2 min)", "tuto", "afaire", "Inès Morel", "", "2026-12-01", "", "Mise en production"),
    liv("How-to support : signataire qui ne reçoit pas le mail", "support", "afaire", "Yanis Haddad", "", "2026-12-03", "", "Mise en production"),
]

p['raci'] = {"activites": [], "cells": {}}
for nom, cases in [
    ("Pilotage du projet", {"Sponsor": "A", "Chef de projet": "R", "Référent métier": "C", "Product Owner": "C", "Utilisateur clé": "I"}),
    ("Paramétrage des parcours de signature", {"Chef de projet": "A", "Product Owner": "C", "Équipe projet": "R", "Fournisseur / prestataire": "R"}),
    ("Classement juridique des contrats", {"Référent métier": "R", "Sponsor": "A", "Chef de projet": "I"}),
    ("Connecteur outil achats", {"Chef de projet": "A", "Équipe projet": "R", "Architecte": "C", "Product Owner": "C", "Fournisseur / prestataire": "C"}),
    ("Sécurité et RGPD", {"Architecte": "R", "Chef de projet": "A", "Fournisseur / prestataire": "C", "Référent métier": "C"}),
    ("Recette", {"Product Owner": "A", "Utilisateur clé": "R", "Chef de projet": "R", "Équipe projet": "C"}),
    ("Formation et communication", {"Utilisateur clé": "R", "Chef de projet": "A", "Sponsor": "I", "Product Owner": "C"}),
    ("Mise en production", {"Chef de projet": "A", "Équipe projet": "R", "Fournisseur / prestataire": "R", "Sponsor": "I"}),
]:
    a = {"id": uid(), "nom": nom}; p['raci']['activites'].append(a)
    p['raci']['cells'][a['id']] = {I[r]: v for r, v in cases.items()}

p['retex'] = [
    {"id": uid(), "date": "2026-11-13", "nature": "positif", "categorie": "Organisation & équipe", "sprintId": "", "constat": "Les entretiens utilisateurs pendant le cadrage ont fait émerger la relance à 48 h",
     "cause": "Utilisateurs rencontrés dès la première semaine", "recommandation": "Toujours prévoir au moins un entretien utilisateur dans la semaine de cadrage", "phase": "", "partage": True},
    {"id": uid(), "date": "2026-11-17", "nature": "ameliorer", "categorie": "Fournisseurs", "sprintId": "", "constat": "Accès à l'environnement de test de l'éditeur reçu avec 2 jours de retard",
     "cause": "Demande d'accès faite après la signature du bon de commande", "recommandation": "Demander les accès éditeur dès la décision de choix de l'outil", "phase": "", "partage": True},
]
p['flash'] = {
    "2026-11-09": {"meteo": {"global": "soleil", "delais": "soleil", "perimetre": "soleil", "equipe": "soleil"}, "faits": "Lancement et cadrage réalisés\nOutil SignaFlow confirmé", "attention": "", "besoins": "", "envoyeLe": "2026-11-13"},
    "2026-11-16": {"meteo": {"global": "nuage", "delais": "nuage", "perimetre": "soleil", "equipe": "soleil"}, "faits": "Sprint 1 démarré : parcours RH en cours de paramétrage\nAttestation d'hébergement en France reçue",
                   "attention": "Accès éditeur reçu avec 2 jours de retard : le tableau de suivi peut glisser au sprint 2", "besoins": "Décision attendue sur les contrats d'intérim", "envoyeLe": ""},
}
p['flashRappel'] = True
p['changements'] = [{"id": uid(), "titre": "Ajouter les contrats d'intérim", "demandeur": "Inès Morel", "date": "2026-11-17", "priorite": "moyenne",
    "description": "La DRH souhaite signer aussi les contrats de mission des intérimaires (environ 15 par mois).", "justification": "Même circuit que les contrats de travail ; gain de temps important pour la RH.",
    "impacts": {"delai": "3", "cout": "", "charge": "4", "perimetre": "Ajout : modèle de contrat d'intérim et circuit agence d'intérim"}, "jalons": [J["Mise en production"]],
    "instance": CP['id'], "statut": "arbitrage", "creeLe": "2026-11-17"}]
json.dump(d, open(F, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print("ok")
