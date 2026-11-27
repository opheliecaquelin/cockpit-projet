import json
D = '/private/tmp/claude-501/-Users-ophelie-caquelin-Cockpit-Projet/02d1006b-fc0c-4a3a-b347-bcd2df1b8d71/scratchpad/manuel/'
PRH = "await w(1200); const s = $('#projSel'); if (s.selectedOptions[0]?.textContent.indexOf('Portail') < 0) { s.value = [...s.options].find(o => o.textContent.includes('Portail')).value; s.dispatchEvent(new Event('change', { bubbles: true })); await w(600); }"
L = [
  {"nom": "36-changements", "vp": [1280, 860], "js": PRH + " await clic('[data-act=module][data-id=decisions]', 500); await clic('[data-act=dc-vue][data-id=changements]', 500); await clic('[data-act=chg-filtre][data-id=toutes]', 400); window.scrollTo(0,0); const R = marquer([['[data-act=chg-nouveau]', 1, 'tl'], [$('.hf-tiles'), 2, 'l', 2], [$('[data-act=chg-arbitrer]'), 3, 'tl']]);"},
  {"nom": "37-arbitrage", "sel": "#modal", "marge": 24, "vp": [1280, 1000], "js": "await clic($('[data-act=chg-arbitrer]'), 600); const R = marquer([[$('#modal .seg4'), 1, 'l'], [$('#arJal')?.closest('label'), 2, 'l'], [$('#arBud')?.closest('label'), 3, 'l']]);"},
  {"nom": "38-gonogo", "vp": [1280, 1050], "js": "document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(300); await clic('[data-act=module][data-id=planif]', 500); await clic('[data-act=pl-vue][data-id=gonogo]', 600); window.scrollTo(0,0); const R = marquer([['#gnJalon', 1, 'tl'], [$('.gng-reco'), 2, 'tl'], [$('.gng-ano'), 3, 'tr'], [$('.gng-seg'), 4, 'l'], [$('.gng-crit .pill.danger'), 5, 'r']]);"},
  {"nom": "39-rapport", "vp": [1280, 1000], "js": "await clic('button[data-act=portefeuille]', 500); await clic('[data-act=pf-vue][data-id=rapport]', 700); window.scrollTo(0,0); const R = marquer([[$('[data-act=pf-vue][data-id=rapport]'), 1, 'tl'], [$('.rp .hf-tiles'), 2, 'l', 2], [$('.rp-table'), 3, 'l', 2]]);"},
]
json.dump(L, open(D + 'lot_b3e.json', 'w', encoding='utf-8'), ensure_ascii=False)
