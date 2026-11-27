import json, os
D = os.path.dirname(os.path.abspath(__file__)) + '/'
AJ = """let prochain = null; const orig = HTMLInputElement.prototype.click;
HTMLInputElement.prototype.click = function () { if (this.type === 'file' && prochain) { const dt = new DataTransfer(); dt.items.add(prochain); this.files = dt.files; this.dispatchEvent(new Event('change')); prochain = null; return; } return orig.call(this); };
const ajout = async (nom, fic, phase, desc) => { await clic('[data-act=mo-ajout]', 400); prochain = new File(['x'], fic); await clic('#moChoisir', 300); $('#moNom').value = nom; $('#moPhase').value = phase; $('#moDesc').value = desc; await clic('#moOk', 900); };
await clic('[data-act=module][data-id=livrables]', 500); await clic('[data-act=lv-vue][data-id=templates]', 500);
if (!$$('.tpl-maison').length) { await ajout('Note de cadrage (modèle groupe)', 'Note de cadrage groupe.docx', 'cadrage', 'Le modèle officiel à utiliser pour tout nouveau projet.'); await ajout('Budget prévisionnel', 'Budget previsionnel.xlsx', 'maison', 'Tableur de chiffrage : interne, externe, licences.'); await ajout('Support de copil', 'Trame copil.pptx', 'pilotage', 'La charte graphique de l\\'entreprise pour les copils.'); }
window.scrollTo(0, 0);"""
L = [
  {"nom": "42-mes-templates", "vp": [1280, 720], "js": AJ + " const c = $('.tpl-maison'); const R = marquer([[$('[data-act=tpl-phase][data-id=maison]'), 1, 'tl'], [$('[data-act=mo-ajout]'), 2, 'tr'], [c.querySelector('[data-act=mo-edit]'), 3, 'tl'], [c.querySelector('[data-act=mo-ouvrir].btn'), 4, 'tl'], [c.querySelector('[data-act=mo-livrable]'), 5, 'tr']]);"},
  {"nom": "43-ajout-template", "sel": "#modal", "marge": 24, "vp": [1280, 900], "js": "await clic('.tpl-maison [data-act=mo-edit]', 500); const R = marquer([[$('#moChoisir'), 1, 'tr'], [$('#moNom'), 2, 'l'], [$('#moPhase'), 3, 'l'], [$('#moCat'), 4, 'r']]);"},
]
json.dump(L, open(D + 'lot_mo.json', 'w', encoding='utf-8'), ensure_ascii=False)
