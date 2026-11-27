import json
D = '/private/tmp/claude-501/-Users-ophelie-caquelin-Cockpit-Projet/02d1006b-fc0c-4a3a-b347-bcd2df1b8d71/scratchpad/manuel/'
OUVRIR = "await w(1200); { const s2 = $('#projSel'); s2.value = [...s2.options].find(o => o.textContent.includes('Portail')).value; s2.dispatchEvent(new Event('change', { bubbles: true })); await w(700); }"
L = [
  {"nom": "06-identite", "vp": [1280, 1000], "js": OUVRIR + " await clic('[data-act=module][data-id=identite]', 600); window.scrollTo(0,0); const R = marquer([[$('#subtabs'), 1, 'l', 2], [$('.fiche-mode'), 2, 'tl'], [$('.idl-tete'), 3, 'l', 2], [$('.idl-perim'), 4, 'l', 4]]);"},
  {"nom": "06b-identite-saisie", "vp": [1280, 760], "js": "await clic('[data-act=fiche-mode][data-id=saisie]', 600); window.scrollTo(0,0); const R = marquer([[$('.fiche-mode'), 1, 'tl'], [trouver('main button::Terminé'), 2, 'tl']]);"},
]
json.dump(L, open(D + 'lot_lect2.json', 'w', encoding='utf-8'), ensure_ascii=False)
