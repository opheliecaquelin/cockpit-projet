# Étapes des deux projets démo (mode timeline)
import json, sys
DOSSIER = sys.argv[1].rstrip('/') + '/'

f = DOSSIER + 'DEMO - Portail RH en ligne.json'
d = json.load(open(f, encoding='utf-8')); p = d['projet']
p['etapes'] = {"mode": "timeline", "actives": ["besoins", "cadrage", "contrat", "conception", "realisation", "recette", "deploiement", "cloture"],
    "dates": {"besoins": {"debut": "2026-09-07", "fin": "2026-09-18"}, "cadrage": {"debut": "2026-09-21", "fin": "2026-10-02"},
              "contrat": {"debut": "2026-09-28", "fin": "2026-10-16"}, "conception": {"debut": "2026-10-05", "fin": "2026-10-30"},
              "realisation": {"debut": "2026-10-19", "fin": "2027-01-29"}, "recette": {"debut": "2027-02-01", "fin": "2027-02-19"},
              "deploiement": {"debut": "2027-02-22", "fin": "2027-03-26"}, "cloture": {"debut": "2027-03-29", "fin": "2027-04-09"}},
    "courante": "realisation", "terminees": {"besoins": "2026-09-18", "cadrage": "2026-10-02", "contrat": "2026-10-16", "conception": "2026-11-02"}}
json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

f = DOSSIER + 'SIGN - Signature électronique des contrats.json'
d = json.load(open(f, encoding='utf-8')); p = d['projet']
p['etapes'] = {"mode": "timeline", "actives": ["besoins", "cadrage", "contrat", "realisation", "recette", "deploiement", "cloture"],
    "dates": {"besoins": {"debut": "2026-10-26", "fin": "2026-11-06"}, "cadrage": {"debut": "2026-11-09", "fin": "2026-11-13"}, "contrat": {"debut": "2026-11-09", "fin": "2026-11-13"}},
    "courante": "realisation", "terminees": {"besoins": "2026-11-06", "cadrage": "2026-11-13", "contrat": "2026-11-13"}}
noms = {l['titre'] for l in p['livrables']}
ajout = [
    ("Expression de besoin", "specs", "valide", "Laura Fontaine", "Hélène Garnier", "2026-11-06", "1.0"),
    ("Grille d'analyse des offres", "doc", "valide", "Camille Lefèvre", "Hélène Garnier", "2026-11-06", "1.0"),
    ("Accord de confidentialité SignaFlow", "nda", "valide", "Antoine Mercier", "Hélène Garnier", "2026-11-06", "1.0"),
    ("Contrat SignaFlow (licences et mise en œuvre)", "contrat", "valide", "Antoine Mercier", "Hélène Garnier", "2026-11-13", "1.0"),
]
for i, (t, c, s, r, v, e, ver) in enumerate(ajout):
    if t not in noms:
        p['livrables'].insert(i, {"id": f"sigliv{i:03d}", "titre": t, "cat": c, "statut": s, "responsable": r, "valideur": v, "echeance": e, "version": ver, "lien": "", "jalonId": "", "notes": "", "fichier": None})
json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('ok')
