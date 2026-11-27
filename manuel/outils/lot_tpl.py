import json
D = '/private/tmp/claude-501/-Users-ophelie-caquelin-Cockpit-Projet/02d1006b-fc0c-4a3a-b347-bcd2df1b8d71/scratchpad/manuel/'
PRH = "await w(600); const s = $('#projSel'); if (s.selectedOptions[0]?.textContent.indexOf('Portail') < 0) { s.value = [...s.options].find(o => o.textContent.includes('Portail')).value; s.dispatchEvent(new Event('change', { bubbles: true })); await w(600); }"
L = [
  {"nom": "40-templates", "vp": [1280, 760], "js": PRH + " if (!$('#modalBack').hidden) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(300); } await clic('[data-act=module][data-id=livrables]', 500); await clic('[data-act=lv-vue][data-id=templates]', 500); window.scrollTo(0,0); const c = $$('.tpl-carte')[1]; const R = marquer([[$('[data-act=lv-vue][data-id=templates]'), 1, 'tl'], [$('main .chips'), 2, 'l'], [c.querySelector('[data-act=tpl-apercu].btn'), 3, 'tl'], [c.querySelector('[data-act=tpl-word]'), 4, 'tl'], [c.querySelector('[data-act=tpl-livrable]'), 5, 'tr'], [$('.tpl-carte .pill.ok'), 6, 'tr']]);"},
  {"nom": "41-template-apercu", "sel": "#modal", "marge": 24, "vp": [1280, 900], "js": "await clic('button[data-act=tpl-apercu][data-id=cadrage]', 600); const R = marquer([[$('#modal .tpl-apercu table'), 1, 'l'], [$('#modal .consigne'), 2, 'l']]);"},
]
json.dump(L, open(D + 'lot_tpl.json', 'w', encoding='utf-8'), ensure_ascii=False)
