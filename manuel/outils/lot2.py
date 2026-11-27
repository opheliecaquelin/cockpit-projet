import json, sys

def M(mod, sub=None, act=None):
    s = f"if (!$('#modalBack').hidden) {{ document.dispatchEvent(new KeyboardEvent('keydown', {{ key: 'Escape', bubbles: true }})); await w(300); }} await clic('[data-act=module][data-id={mod}]', 500);"
    if sub: s += f" await clic('[data-act={act}][data-id={sub}]', 500);"
    return s + " window.scrollTo(0,0); await w(250);"

PROJ = "if ($('#projSel').selectedOptions[0]?.textContent.indexOf('Portail') < 0 || !$('[data-act=module]')) { await clic('button[data-act=portefeuille]', 400); await clic('[data-act=pf-vue][data-id=cartes]', 300); await clic(trouver('[data-act=ouvrir-projet]::Portail RH'), 600); }"
MOD = "$('[data-act=module]').parentElement"
SUB = "$('#subtabs')"
IMG = "const colle = async (cible, fichier) => { const r = await fetch('/manuel/images/' + fichier); const f = new File([await r.blob()], 'image.png', { type: 'image/png' }); const dt = new DataTransfer(); dt.items.add(f); cible.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); await w(1500); };"

FLASH = """ if (!$('[data-act=fl-meteo].on')) {
  for (const [axe, i] of [['global', 1], ['delais', 1], ['budget', 1], ['perimetre', 0], ['equipe', 0]]) { const b = $$('[data-act=fl-meteo][data-axe=' + axe + ']')[i]; if (b) { b.click(); await w(250); } }
  const f = $('[data-fl=faits]'); if (f) { saisir(f, 'Sprint 6 démarré : notifications aux managers' + String.fromCharCode(10) + 'FAQ salariés relue par la RH'); await w(300); }
  const a = $('[data-fl=attention]'); if (a) { saisir(a, 'Interface paie : 2 semaines de retard'); await w(300); }
  window.scrollTo(0, 0); }
const R = marquer([[$('.meteo-row')?.parentElement, 1, 'l'], [$('[data-fl=faits]'), 2, 'l']]);"""

L = [
  # ── Démarrer
  {"nom": "01-portefeuille", "vp": [1280, 800], "js": "await clic('button[data-act=portefeuille]', 500); await clic('[data-act=pf-vue][data-id=cartes]', 300); window.scrollTo(0,0); const R = marquer([['button[data-act=portefeuille]', 1, 'tl'], ['#projSel', 2, 'tl'], ['[data-act=aujourdhui]', 3, 'tl'], ['[data-act=reglages]', 4, 'tl'], [$('#subtabs'), 5, 'l', 2], ['.btn::Nouveau projet', 6, 'tl'], [trouver('[data-act=ouvrir-projet]::Portail RH'), 7, 'tl']]);"},
  {"nom": "02-portefeuille-frise", "vp": [1280, 800], "js": "if (!$('#modalBack').hidden) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await w(300); } await clic('button[data-act=portefeuille]', 500); await clic('[data-act=pf-vue][data-id=frise]', 700); window.scrollTo(0,0); const R = marquer([[$('[data-act=pf-vue][data-id=frise]'), 1, 'tl'], [$('[data-act=pl-pfperiode]')?.parentElement, 2, 'l'], [$('.hfrise .hf-click'), 3, 'l'], [$('.hfrise .hf-today-bg'), 4, 'tr']]);"},
  {"nom": "03-assistant", "sel": "#modal", "marge": 30, "js": "await clic('[data-act=pf-vue][data-id=cartes]', 300); await clic(trouver('.btn::Nouveau projet'), 500); saisir('#modal [data-w=nom]', 'Mon nouveau projet'); const R = marquer([[trouver('#modal *::1. L'), 1, 'l'], [$('#modal [data-w=nom]').closest('.field'), 2, 'l'], [trouver('#modal button::Suivant'), 3, 'tl']]);"},
  # ── Vue d'ensemble
  {"nom": "04-cockpit", "vp": [1280, 1000], "js": "if (!$('#modalBack').hidden) { $('[data-act=close-modal]').click(); await w(300); } " + PROJ + M("cockpit", "synthese", "ck-vue") + f" const R = marquer([[{MOD}, 1, 'l', 2], [{SUB}, 2, 'l', 2], ['button::Modifier la fiche', 3, 'tl']]);"},
  {"nom": "05-flash", "vp": [1280, 1000], "js": M("cockpit", "flash", "ck-vue") + FLASH},
  # ── Identité
  {"nom": "06-identite", "vp": [1280, 900], "js": M("identite", "fiche", "pp-vue") + f" const R = marquer([[{SUB}, 1, 'l', 2]]);"},
  {"nom": "07-raci", "vp": [1280, 800], "js": M("identite", "raci", "pp-vue") + " const R = marquer([[$$('.raci-cell').find(c => c.textContent === 'A'), 1, 'tl', 3]]);"},
  {"nom": "08-charge", "vp": [1280, 800], "js": M("identite", "charge", "pp-vue") + " const R = marquer([[$('[data-ch]').closest('td'), 1, 'tl', 3], ['[data-act=pp-voir-global]', 2, 'tl']]);"},
  # ── Planification
  {"nom": "09-planif-frise", "vp": [1280, 800], "js": M("planif", "frise", "pl-vue") + f" window.scrollTo(0,0); await w(200); const R = marquer([[{SUB}, 1, 'l', 2], ['[data-act=pl-new-jalon]', 2, 'tl'], ['[data-act=pl-new-reunion]', 3, 'tl'], ['[data-act=pl-recalc]', 4, 'tl'], [$('main .chips'), 5, 'l']]);"},
  {"nom": "10-planif-aujourdhui", "vp": [1280, 700], "js": "const t = $$('main span').find(e => /Aujourd'hui ·/.test(e.textContent)); t.scrollIntoView({block: 'center'}); await w(250); const lk = $$('main .lock').filter(l => { const b = l.getBoundingClientRect(); return b.top > 380 && b.top < 600; })[0]; const R = marquer([[t, 1, 'l'], [lk, 2, 'l', 6]]);"},
  {"nom": "11-frise-copil", "vp": [1280, 900], "js": M("planif", "hfrise", "pl-vue") + " const R = marquer([[trouver('main button::Dates initiales'), 1, 'tl'], ['main [data-act=capture]', 2, 'tl']]);"},
  {"nom": "12-jalons", "vp": [1280, 700], "js": M("planif", "jalons", "pl-vue") + " const R = marquer([[trouver('main *::+24 j'), 1, 'r']]);"},
  {"nom": "13-choix-methode", "vp": [1280, 800], "js": "const s = $('#projSel'); s.value = [...s.options].find(o => o.textContent.includes('réservation')).value; s.dispatchEvent(new Event('change', { bubbles: true })); await w(600); " + M("planif") + " await clic('[data-act=pl-methode][data-id=hybride]', 400); const R = marquer([[$('.meth-grid'), 1, 'l', 4], ['#plDureeChoix', 2, 'tl'], ['[data-act=pl-generer]', 3, 'tl']]);"},
  # ── Risques
  {"nom": "14-risques-catalogue", "vp": [1280, 800], "js": "{ const s2 = $('#projSel'); s2.value = [...s2.options].find(o => o.textContent.includes('Portail')).value; s2.dispatchEvent(new Event('change', { bubbles: true })); await w(700); } " + PROJ + M("risques", "catalogue", "vue") + " const R = marquer([[$('main .chips, main [data-act=cat]')?.closest('.chips') || $('[data-act=cat]'), 1, 'l'], [$('[data-act=add]'), 2, 'tl'], [$('[data-act=perso]'), 3, 'tl']]);"},
  {"nom": "15-risques-tableau", "vp": [1280, 1250], "js": M("risques", "dashboard", "vue") + " const R = marquer([[$('main .kpis'), 1, 'l'], [trouver('main h3::Matrice des risques')?.closest('.panel'), 2, 'tl'], [trouver('main h3::Top risques')?.closest('.panel'), 3, 'tr'], [trouver('main h3::Par catégorie')?.closest('.panel'), 4, 'tl']]);"},
  {"nom": "16-risques-registre", "vp": [1280, 800], "js": M("risques", "registre", "vue") + " const R = marquer([[$$('main .chips')[0], 1, 'l'], [$('#triSel'), 2, 'tl'], [$('main .reg-card'), 3, 'l'], [$('main [data-act=perso]'), 4, 'tr']]);"},
  {"nom": "17-risques-matrice", "vp": [1280, 900], "js": M("risques", "matrice", "vue") + " const R = marquer([[$('main .matrix'), 1, 'l'], [$('main .mchip'), 2, 'tr'], [trouver('main h3::Légende')?.closest('.panel'), 3, 'tl']]);"},
  {"nom": "18-risque-fiche", "sel": "#modal", "marge": 30, "vp": [1280, 1300], "js": M("risques", "registre", "vue") + " await clic($('main .reg-card[data-act=open], main .reg-card [data-act=open], main [data-act=open]'), 700); const R = marquer([[$('#modal [data-p]')?.parentElement?.parentElement, 1, 'l'], [$('#modal .avere'), 2, 'l'], [$('#modal .statuts'), 3, 'l'], [$('#rResp')?.closest('.two'), 4, 'l'], [$('#modal .act-edit')?.parentElement || $('#modal .act-edit'), 5, 'l']]);"},
  {"nom": "19-risques-copil", "vp": [1280, 900], "js": M("risques", "copil", "vue") + " const R = marquer([[$('main .copil .cp-head'), 1, 'l'], [$('main .copil .cp-grid'), 2, 'l'], [$('main [data-act=capture]'), 3, 'tr']]);"},
  # ── Instances
  {"nom": "21-preparer-copil", "vp": [1280, 1100], "js": M("instances", "copil", "in-vue") + " const R = marquer([[$('.meteo-row')?.parentElement, 1, 'l'], [$('[data-prep=faits]'), 2, 'l'], [$('[data-prep=decisions]'), 3, 'l']]);"},
  {"nom": "22-diapos", "vp": [1280, 900], "js": M("instances", "diapos", "in-vue") + " const R = marquer([[$('#inCopilSel'), 1, 'tl'], [$('main [data-act=in-vue][data-id=copil]'), 2, 'tl'], [$('main [data-act=in-capture]'), 3, 'tr'], [$('main .slide.courante'), 4, 'l']]);"},
  {"nom": "23-taches", "vp": [1280, 800], "js": M("planif", "taches", "pl-vue") + " const R = marquer([[$('main .panel'), 1, 'l'], [$('main .taches-grid > .panel'), 2, 'l'], [$('main .taches-grid > .panel button'), 3, 'tr']]);"},
  # ── Réunions & CR
  {"nom": "24-reunions-liste", "vp": [1280, 860], "js": M("instances", "reunions", "in-vue") + " if ($('[data-act=cr-retour]')) { await clic('[data-act=cr-retour]', 400); } const R = marquer([['[data-act=cr-nouveau]', 1, 'tl'], [trouver('main h3::À venir'), 2, 'l'], [trouver('main h3::Passées'), 3, 'l'], [$('main [data-act=in-prep]'), 4, 'tl'], [$('main [data-act=in-ics]'), 5, 'tr'], [$('main [data-act=in-export]'), 6, 'tl']]);"},
  {"nom": "25-cr-editeur", "vp": [1280, 1150], "js": "const carte = $$('[data-act=cr-ouvrir]').find(e => e.textContent.includes('Copil n°2')); await clic(carte, 700); window.scrollTo(0,0); const R = marquer([[$('.cr-date'), 1, 'tl'], [$('.cr-pres'), 2, 'l'], [$('textarea[data-crp]'), 3, 'l'], [$('.cap-zone'), 4, 'l'], [$('.liens-champ'), 5, 'r'], ['[data-act=cr-diffuse]', 6, 'tl'], ['[data-act=cr-imprimer]', 7, 'tl']]);"},
  # ── Décisions & actions
  {"nom": "26-actions", "vp": [1280, 900], "js": M("decisions", "actions", "dc-vue") + " const R = marquer([[$('main .toolbar')?.nextElementSibling, 1, 'l'], [$$('main .chips')[0], 2, 'l'], [$('main .act-section'), 3, 'l'], [$('main .act-section .check'), 4, 'tl'], [$('main [data-act=dc-taches]'), 5, 'tr']]);"},
  {"nom": "27-decisions", "vp": [1280, 800], "js": M("decisions", "decisions", "dc-vue") + " const R = marquer([['[data-act=dc-new-dec]', 1, 'tl']]);"},
  {"nom": "28-decision-fiche", "sel": "#modal", "marge": 30, "vp": [1280, 1100], "js": IMG + " await clic($$('[data-act=dc-edit-dec]').find(e => e.textContent.includes('SSO')), 600); const ta = $('#deDesc'); saisir(ta, 'Évite un mot de passe de plus. Note d’architecture : https://www.exemple.fr/portail-rh/architecture-sso'); if (!$('#modal .cap-vig')) await colle(ta, '11-frise-copil.png'); const R = marquer([[$('#modal [data-st]').parentElement, 1, 'l'], [ta, 2, 'l'], [$('#modal .liens-champ'), 3, 'r'], [$('#modal .cap-zone'), 4, 'l']]);"},
  # ── Livrables, backlog, budget, retex
  {"nom": "29-livrables", "vp": [1280, 800], "js": "if (!$('#modalBack').hidden) { $('#deOk')?.click(); await w(400); } " + M("livrables", "liste", "lv-vue") + " const R = marquer([[$('main [data-act=dl-nouveau]'), 1, 'tr'], [$('main .hf-tiles'), 2, 'l'], [$('main .chips'), 3, 'l'], [$('main .doc-row'), 4, 'l'], [$('main .doc-row .pill'), 5, 'tr']]);"},
  {"nom": "30-backlog", "vp": [1280, 1100], "js": M("backlog") + " const R = marquer([['[data-act=bl-import]', 1, 'tl'], ['main [data-act=capture]', 2, 'tl']]);"},
  {"nom": "31-budget", "vp": [1280, 1500], "js": M("budget") + " const R = marquer([[$('main .hf-tiles'), 1, 'l'], [trouver('main h3::Postes budgétaires')?.closest('.panel'), 2, 'l'], [trouver('main h3::Évolution')?.closest('.panel'), 3, 'tr'], [$('main [data-act=bu-point]'), 4, 'tr']]);"},
  {"nom": "32-retex", "vp": [1280, 900], "js": M("retex") + " const R = marquer([['#rxFiltreSprint', 1, 'tl'], [$('.rx-col.positif .rx-ajout'), 2, 'l'], [$('.rx-col.ameliorer .rx-ajout'), 3, 'r'], ['[data-act=rx-imprimer]', 4, 'tl']]);"},
  # ── Transverse
  {"nom": "33-aujourdhui", "sel": "#modal", "marge": 30, "vp": [1280, 1000], "js": "await clic('[data-act=aujourdhui]', 600); const R = marquer([[$('#modal .aj-head'), 1, 'l'], [$('#modal .aj-item .check'), 2, 'l'], [$('#modal .aj-item.clic'), 3, 'r']]);"},
  {"nom": "34-reglages", "vp": [1280, 1750], "js": "if (!$('#modalBack').hidden) { $('[data-act=close-modal]').click(); await w(300); } await clic('[data-act=reglages]', 600); window.scrollTo(0,0); const R = marquer([[trouver('main h3::Apparence')?.closest('.panel'), 1, 'tl'], [trouver('main h3::Mes données')?.closest('.panel'), 2, 'tl'], [trouver('main h3::Annuaire')?.closest('.panel'), 3, 'tl'], [trouver('main h3::Mes projets')?.closest('.panel'), 4, 'tl'], [trouver('main h3::Documentation')?.closest('.panel'), 5, 'tl'], [trouver('main h3::Jours fériés')?.closest('.panel'), 6, 'tl']]);"},
  {"nom": "35-bandeau-maj", "vp": [1280, 400], "js": PROJ + M("cockpit", "synthese", "ck-vue") + " const b = document.createElement('div'); b.className = 'maj-bandeau'; b.innerHTML = '<span>✨ Une nouvelle version de Cockpit Projet est disponible.</span><button class=\"btn small\">🔄 Recharger</button>'; b.style.setProperty('display', 'flex', 'important'); document.body.appendChild(b); await w(200); const R = marquer([[b, 1, 'tl']]);"},
]
json.dump(L, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
