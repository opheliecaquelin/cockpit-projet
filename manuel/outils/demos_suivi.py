# Données de démonstration pour les nouveautés de suivi (tendances, problèmes, objectifs, avancement réel, temps passé)
import json, sys, datetime
D = sys.argv[1].rstrip('/') + '/'
J = lambda s: datetime.date.fromisoformat(s)
def lundis(debut, fin):
    d = J(debut); L = []
    while d <= J(fin): L.append(d.isoformat()); d += datetime.timedelta(days=7)
    return L
def act(i, texte, resp, ech, fait=False):
    return {"id": f"pbact{i}", "texte": texte, "responsable": resp, "echeance": ech, "fait": fait, "creeLe": ech}

# ── Portail RH (Agile, 7 sept. → 28 mars)
f = D + 'DEMO - Portail RH en ligne.json'; d = json.load(open(f, encoding='utf-8')); p = d['projet']
S = lundis('2026-09-07', '2026-11-09')  # semaines passées (la semaine en cours est photographiée par l'appli)
serie = {
    "meteo":      [4, 4, 4, 3, 3, 3, 2, 3, 3, 2],
    "backlog":    [0, 4, 9, 15, 21, 28, 36, 44, 52, 60],
    "risques":    [3, 4, 4, 5, 5, 6, 6, 5, 5, 5],
    "critiques":  [1, 1, 2, 2, 3, 3, 3, 3, 3, 3],
    "problemes":  [0, 0, 0, 0, 0, 1, 1, 0, 0, 1],
    "retard":     [0, 0, 1, 1, 2, 1, 2, 3, 2, 3],
    "glissement": [0, 0, 0, 0, 5, 10, 10, 24, 24, 24],
    "budget":     [4, 8, 12, 16, 21, 26, 31, 36, 41, 44],
}
deb, fin = J('2026-09-07'), J('2027-03-28')
p['tendances'] = {k: {**{n: v[i] for n, v in serie.items()}, "temps": round((J(k) - deb).days / (fin - deb).days * 100), "reel": serie["backlog"][i]} for i, k in enumerate(S)}
p['planning']['avReel'] = True
p['risques'] = [r for r in p['risques'] if not r.get('id', '').startswith('pbdemo')]
p['risques'] += [
    {"id": "pbdemo1", "refId": None, "cat": "fournis", "titre": "Licences de l'éditeur de paie livrées en retard", "description": "Les licences de production n'ont pas été livrées à la date prévue.", "impact": "Impossible de préparer l'environnement de pré-production : la recette risque de glisser.",
     "p": 3, "g": 3, "critForce": None, "statut": "survenu", "avereLe": "2026-11-10", "imprevu": True, "responsable": "Thomas Petit", "revue": "", "notes": "",
     "actions": [act(1, "Relancer le commercial de l'éditeur et demander une date ferme", "Julien Moreau", "2026-11-13", True), act(2, "Utiliser les licences de test pour la pré-production en attendant", "Thomas Petit", "2026-11-24")],
     "initial": {"p": 3, "g": 3, "c": 9}, "creeLe": "2026-11-10", "historique": [{"date": "2026-11-10", "p": 3, "g": 3}]},
    {"id": "pbdemo2", "refId": None, "cat": "infra", "titre": "Environnement de recette indisponible", "description": "Le serveur de recette est tombé en panne après une mise à jour système.", "impact": "Tests bloqués pendant une semaine.",
     "p": 3, "g": 2, "critForce": None, "statut": "survenu", "avereLe": "2026-10-20", "resoluLe": "2026-10-27", "imprevu": True, "responsable": "Karim Benali", "revue": "", "notes": "",
     "actions": [act(3, "Restaurer le serveur depuis la sauvegarde", "Karim Benali", "2026-10-22", True), act(4, "Mettre en place une supervision du serveur de recette", "Thomas Petit", "2026-10-27", True)],
     "initial": {"p": 3, "g": 2, "c": 6}, "creeLe": "2026-10-20", "historique": [{"date": "2026-10-20", "p": 3, "g": 2}]},
]
g = p.setdefault('gonogo', {}); g.setdefault('objectifs', {})
g['objectifs'] = {"Dématérialiser 100 % des demandes de congés": {"cible": "100 %", "actuel": "Pilote RH : 40 salariés", "statut": "encours", "majLe": "2026-11-16"},
                  "Mettre en ligne les bulletins de paie": {"cible": "Tous les salariés", "actuel": "Interface paie en cours", "statut": "", "majLe": "2026-11-16"}}
reel = {}
for i in p['interlocuteurs']:
    pv = p.get('charge', {}).get(i['id'], {})
    reel[i['id']] = {m: str(max(0, round(float(pv[m]) + (1 if (hash(i['id'] + m) % 3 == 0) else -1 if (hash(i['id'] + m) % 3 == 1) else 0), 1))) for m in ['2026-09', '2026-10'] if m in pv}
    if '2026-11' in pv: reel[i['id']]['2026-11'] = str(round(float(pv['2026-11']) * 0.6, 1))
p['chargeReel'] = reel
json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

# ── Signature électronique (Hybride, 9 nov. → 4 déc.)
f = D + 'SIGN - Signature électronique des contrats.json'; d = json.load(open(f, encoding='utf-8')); p = d['projet']; pl = p['planning']
pl['avReel'] = True
for ph in pl['phases']:
    ph['reel'] = {"Cadrage": 100, "Réalisation (sprints)": 45}.get(ph['nom'], 0); ph['reelLe'] = "2026-11-19"
p['tendances'] = {"2026-11-09": {"meteo": 4, "temps": 15, "reel": 20, "backlog": 17, "risques": 5, "critiques": 3, "problemes": 1, "retard": 0, "glissement": 0}}
p['risques'] = [r for r in p['risques'] if not r.get('id', '').startswith('pbsign')]
p['risques'].append({"id": "pbsign1", "refId": None, "cat": "fournis", "titre": "Accès à l'environnement de test de l'éditeur en retard", "description": "Les comptes de test SignaFlow ont été ouverts avec 2 jours de retard.", "impact": "Démarrage du paramétrage décalé ; le tableau de suivi peut glisser au sprint 2.",
    "p": 3, "g": 2, "critForce": None, "statut": "survenu", "avereLe": "2026-11-12", "resoluLe": "2026-11-16", "imprevu": True, "responsable": "Paul Renard", "revue": "", "notes": "",
    "actions": [act(5, "Escalader auprès du responsable de compte SignaFlow", "Camille Lefèvre", "2026-11-13", True)], "initial": {"p": 3, "g": 2, "c": 6}, "creeLe": "2026-11-12", "historique": [{"date": "2026-11-12", "p": 3, "g": 2}]})
g = p.get('gonogo') or {}; g['objectifs'] = {"Signer 100 % des contrats de travail et avenants en électronique d'ici fin décembre": {"cible": "100 %", "actuel": "Pas encore en production", "statut": "", "majLe": "2026-11-19"},
    "Réduire le délai moyen de signature de 10 à 2 jours": {"cible": "2 jours", "actuel": "1,5 jour sur les 3 contrats de test", "statut": "encours", "majLe": "2026-11-19"}}
if p.get('gonogo'): p['gonogo'] = g
else: p['objectifsDemo'] = g['objectifs']
json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok')
