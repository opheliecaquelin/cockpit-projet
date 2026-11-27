# Captures du manuel qui montrent les sous-onglets de Planification (09, 10, 11, 12, 38)
import json, os, sys
D = os.path.dirname(os.path.abspath(__file__)) + '/'
ns = {}
src = open(D + 'lot2.py', encoding='utf-8').read().replace('json.dump(L, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)', '')
exec(src, ns)
L = [x for x in ns['L'] if x['nom'] in ('09-planif-frise', '10-planif-aujourdhui', '11-frise-copil', '12-jalons')]
L[0]['js'] = ns['PROJ'] + " document.querySelectorAll('.maj-bandeau').forEach(e => e.remove()); " + L[0]['js']
exec(open(D + 'lot_b3e.py', encoding='utf-8').read().replace("json.dump(L, open(D + 'lot_b3e.json', 'w', encoding='utf-8'), ensure_ascii=False)", ''), ns)
L += [x for x in ns['L'] if x['nom'] == '38-gonogo']
json.dump(L, open(D + 'lot_planif.json', 'w', encoding='utf-8'), ensure_ascii=False)
print([x['nom'] for x in L])
