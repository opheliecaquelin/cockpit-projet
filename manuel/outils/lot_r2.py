import json
D = '/private/tmp/claude-501/-Users-ophelie-caquelin-Cockpit-Projet/02d1006b-fc0c-4a3a-b347-bcd2df1b8d71/scratchpad/manuel/'
GO = "await w(1200); const errs = []; window.addEventListener('error', e => errs.push(e.message)); await clic('button[data-act=portefeuille]', 500); await clic('[data-act=pf-vue][data-id=rapport]', 700); window.scrollTo(0,0);"
L = [
  {"nom": "39-rapport", "vp": [1280, 900], "js": GO + " const R = [errs, marquer([[$('[data-act=pf-vue][data-id=rapport]'), 1, 'tl'], [$('.rp2-chiffres'), 2, 'l', 2], [$('.rp2-table'), 3, 'l', 2], [$('.rp2-bas'), 4, 'l', 2]])];"},
]
json.dump(L, open(D + 'lot_r2.json', 'w', encoding='utf-8'), ensure_ascii=False)
