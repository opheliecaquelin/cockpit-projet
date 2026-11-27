(() => {
  "use strict";

  // ═══════════════ Constantes
  const KEY = "radar-risques-v1";
  const CATS = window.CATEGORIES;
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
  const REF = Object.fromEntries(window.CATALOGUE.map(r => [r.id, r]));

  const PROBA = { 1: ["Faible", "🙂"], 2: ["Moyenne", "😐"], 3: ["Forte", "😬"] };
  const GRAV  = { 1: ["Mineure", "🩹"], 2: ["Significative", "⚠️"], 3: ["Majeure", "🔥"] };
  const STATUTS = [
    { id: "identifie",  nom: "Identifié",         emoji: "🔍", c: "#7c7fd6" },
    { id: "surveille",  nom: "Sous surveillance", emoji: "👀", c: "#5a9fc9" },
    { id: "traitement", nom: "En traitement",     emoji: "🛠️", c: "#d48a52" },
    { id: "survenu",    nom: "Survenu",           emoji: "💥", c: "#c9605a" },
    { id: "accepte",    nom: "Accepté",           emoji: "🤝", c: "#7b8494" },
    { id: "leve",       nom: "Levé",              emoji: "✅", c: "#5a9e72" },
  ];
  const STATUT = Object.fromEntries(STATUTS.map(s => [s.id, s]));
  const CLOS = new Set(["leve", "accepte", "survenu"]);
  // problème = risque avéré (statut « survenu »), ouvert tant qu'il n'est pas résolu
  const estProbleme = r => r.statut === "survenu";
  const problemesOuverts = p => p.risques.filter(r => estProbleme(r) && !r.resoluLe);

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Étapes du projet (cycle de vie) et navigation « timeline »
  // p.etapes = { mode: "timeline" | "libre", actives: [ids], dates: { id: { debut, fin } }, courante: id, terminees: { id: date } }
  // Les dates non saisies sont proposées à partir des phases du planning.
  // ═══════════════════════════════════════════════════════════════
  const ETP_OK = ["valide", "diffuse"];
  const livOk = (p, test) => (p.livrables || []).some(d => test(d) && ETP_OK.includes(d.statut));
  const livEnCours = (p, test) => (p.livrables || []).some(d => test(d) && d.statut !== "afaire");
  const aRole = (p, re) => p.interlocuteurs.some(i => re.test(i.role || ""));
  const jalonAtteint = (p, re) => { const J = (p.planning?.jalons || []).filter(j => re.test(j.nom)); return J.length ? J.some(j => j.atteint) : null; };
  const PG = (emoji, nom, module, sub = "") => ({ emoji, nom, module, sub });
  const ETAPES = [
    { id: "opportunite", nom: "Opportunité", court: "Opportunité", emoji: "💡", defaut: false, desc: "Idée ou demande initiale, décision d'étudier le sujet",
      pages: [PG("🪪", "Fiche d'identité", "identite", "fiche"), PG("📚", "Catalogue des risques", "risques", "catalogue"), PG("⚖️", "Décisions", "decisions", "decisions")], tpl: [],
      criteres: [["Enjeu renseigné", p => !!(p.enjeu || "").trim()], ["Sponsor identifié", p => aRole(p, /sponsor/i)], ["Décision d'étudier le projet", p => p.decisions.some(d => d.statut === "validee")]] },
    { id: "besoins", nom: "Recueil des besoins", court: "Besoins", emoji: "🗣️", defaut: true, desc: "Entretiens, expression de besoin",
      pages: [PG("🪪", "Fiche et interlocuteurs", "identite", "fiche"), PG("📝", "Réunions (entretiens)", "instances", "reunions"), PG("⚖️", "Décisions", "decisions", "decisions"), PG("🧩", "Templates", "livrables", "templates")], tpl: ["besoin", "entretien"],
      criteres: [["Au moins 3 interlocuteurs identifiés", p => p.interlocuteurs.length >= 3], ["Au moins un entretien utilisateur réalisé", p => p.planning ? (p.planning.reunions || []).some(r => r.type === "entretien" && !r.annulee && (r.cr || r.date < today())) : null], ["Expression de besoin validée", p => livOk(p, d => /besoin/i.test(d.titre))]] },
    { id: "cadrage", nom: "Cadrage", court: "Cadrage", emoji: "🧭", defaut: true, desc: "Note de cadrage, planning, organisation, risques",
      pages: [PG("🪪", "Fiche d'identité", "identite", "fiche"), PG("🧩", "Matrice RACI", "identite", "raci"), PG("🗓️", "Planification", "planif", "frise"), PG("🎯", "Registre des risques", "risques", "registre"), PG("📝", "Réunions (lancement, cadrage)", "instances", "reunions"), PG("💶", "Budget", "budget"), PG("📚", "Livrables", "livrables", "liste")], tpl: ["cadrage", "raci"],
      criteres: [["Objectifs et périmètre renseignés", p => !!(lignes(p.objectifs).length && lignes(p.perimetreIn).length)], ["Planning généré", p => !!p.planning?.methode], ["Matrice RACI remplie", p => !!p.raci?.activites?.some(a => Object.keys(p.raci.cells[a.id] || {}).length)], ["Au moins 3 risques identifiés", p => p.risques.length >= 3], ["Note de cadrage validée", p => livOk(p, d => /cadrage/i.test(d.titre))]] },
    { id: "contrat", nom: "Consultation & contractualisation", court: "Contractualisation", emoji: "🤝", defaut: false, desc: "Appel d'offres, choix du fournisseur ou du produit, négociation, contrat",
      pages: [PG("📚", "Livrables (contrat, NDA)", "livrables", "liste"), PG("⚖️", "Décisions", "decisions", "decisions"), PG("💶", "Budget", "budget"), PG("🎯", "Risques fournisseur", "risques", "registre"), PG("🪪", "Interlocuteurs", "identite", "fiche"), PG("📝", "Réunions (soutenances, négociation)", "instances", "reunions")], tpl: ["offres", "nda"],
      criteres: [["Fournisseur ajouté aux interlocuteurs", p => aRole(p, /fournisseur|prestataire/i)], ["Choix du fournisseur acté (décision validée)", p => p.decisions.some(d => d.statut === "validee" && /fournisseur|prestataire|éditeur|outil|offre|contrat|solution/i.test(d.titre))], ["Accord de confidentialité signé", p => livOk(p, d => d.cat === "nda")], ["Contrat signé", p => livOk(p, d => d.cat === "contrat")]] },
    { id: "conception", nom: "Conception", court: "Conception", emoji: "📐", defaut: false, desc: "Spécifications, maquettes, user stories",
      pages: [PG("📚", "Livrables (spécifications)", "livrables", "liste"), PG("📈", "Backlog", "backlog"), PG("⚖️", "Décisions", "decisions", "decisions"), PG("📝", "Réunions", "instances", "reunions")], tpl: ["specs", "us"],
      criteres: [["Spécifications validées", p => livOk(p, d => d.cat === "specs")], ["Backlog importé", p => !!p.backlog?.imports?.length]] },
    { id: "realisation", nom: "Réalisation", court: "Réalisation", emoji: "🛠️", defaut: true, desc: "Développement ou paramétrage, suivi au quotidien",
      pages: [PG("🗓️", "Frise du planning", "planif", "frise"), PG("🏃", "Sprints", "planif", "sprints"), PG("📈", "Backlog", "backlog"), PG("🏛️", "Réunions & copils", "instances", "reunions"), PG("✅", "Actions", "decisions", "actions"), PG("🔄", "Demandes de changement", "decisions", "changements"), PG("🎯", "Risques", "risques", "registre"), PG("💶", "Budget", "budget"), PG("📰", "Flash report", "cockpit", "flash")], tpl: ["cr", "changement"],
      criteres: [["Fin de réalisation atteinte (jalon)", p => jalonAtteint(p, /réalisation|développement|construction/i)], ["Aucun élément bloqué dans le backlog", p => { const I = p.backlog?.imports?.slice(-1)[0]; return I ? !I.items.some(x => x.cat === "bloque") : null; }], ["Aucune action en retard", p => !p.actions.some(a => !a.fait && a.echeance && a.echeance < today())]] },
    { id: "recette", nom: "Recette", court: "Recette", emoji: "🧪", defaut: true, desc: "Tests par les utilisateurs, PV de recette, Go / No-Go",
      pages: [PG("🚦", "Go / No-Go", "planif", "gonogo"), PG("📚", "Livrables (plan, PV)", "livrables", "liste"), PG("🎯", "Risques", "risques", "registre"), PG("⚖️", "Décisions", "decisions", "decisions"), PG("📈", "Backlog (anomalies)", "backlog")], tpl: ["plan-recette", "pv-recette"],
      criteres: [["Plan de recette rédigé", p => livEnCours(p, d => /recette/i.test(d.titre) && /plan|cahier/i.test(d.titre))], ["PV de recette validé", p => livOk(p, d => /pv.*recette|recette.*pv/i.test(d.titre))], ["Go / No-Go prononcé", p => !!p.gonogo?.verdict]] },
    { id: "deploiement", nom: "Déploiement", court: "Déploiement", emoji: "🚀", defaut: true, desc: "Mise en production, formation, communication",
      pages: [PG("🚦", "Go / No-Go", "planif", "gonogo"), PG("📚", "Livrables (manuel, tutos)", "livrables", "liste"), PG("📝", "Réunions", "instances", "reunions"), PG("✅", "Actions", "decisions", "actions")], tpl: ["mep", "communication", "manuel", "howto"],
      criteres: [["Mise en production réalisée (jalon atteint)", p => jalonAtteint(p, /production|mep|bascule/i)], ["Documentation utilisateur diffusée", p => livOk(p, d => ["manuel", "tuto"].includes(d.cat))], ["Fiches How-to support prêtes", p => livEnCours(p, d => d.cat === "support")]] },
    { id: "accompagnement", nom: "Accompagnement", court: "Accompagnement", emoji: "🛟", defaut: false, desc: "Support renforcé après la mise en production (hypercare)",
      pages: [PG("✅", "Actions", "decisions", "actions"), PG("🎯", "Risques", "risques", "registre"), PG("📚", "Livrables (support)", "livrables", "liste")], tpl: ["howto"],
      criteres: [["Fiches How-to support validées", p => livOk(p, d => d.cat === "support")], ["Aucun risque critique ouvert", p => !p.risques.some(r => !CLOS.has(r.statut) && crit(r) >= 9)]] },
    { id: "cloture", nom: "Clôture", court: "Clôture", emoji: "🏁", defaut: true, desc: "Bilan, retex, transfert, clôture officielle",
      pages: [PG("🎓", "Retex", "retex"), PG("📚", "Livrables (bilan)", "livrables", "liste"), PG("💶", "Budget", "budget"), PG("📝", "Réunions (bilan de clôture)", "instances", "reunions")], tpl: ["cloture"],
      criteres: [["Au moins 3 enseignements de retex", p => (p.retex || []).length >= 3], ["Bilan de clôture validé", p => livOk(p, d => /bilan|clôture/i.test(d.titre))], ["Toutes les actions soldées", p => !p.actions.some(a => !a.fait && !a.auto)]] },
  ];
  const ETAPE = Object.fromEntries(ETAPES.map(e => [e.id, e]));
  const etapesDefaut = mode => ({ mode, actives: ETAPES.filter(e => e.defaut).map(e => e.id), dates: {}, courante: "", terminees: {} });
  function etapesDe(p) {
    if (!p.etapes || typeof p.etapes !== "object") p.etapes = etapesDefaut("libre");
    const E = p.etapes; E.actives = (E.actives || []).filter(id => ETAPE[id]); E.dates = E.dates || {}; E.terminees = E.terminees || {};
    return E;
  }
  const enTimeline = p => !!p && etapesDe(p).mode === "timeline" && etapesActives(p).length > 0;
  const etapesActives = p => ETAPES.filter(e => etapesDe(p).actives.includes(e.id));
  // dates proposées à partir des phases du planning (une étape peut regrouper plusieurs phases)
  const RX_PHASE = { cadrage: /cadrage/i, conception: /spécif|concept/i, realisation: /réalis|dévelop|sprint|construction|paramétr/i, recette: /recette|test/i, deploiement: /déploi|production|bascule/i };
  function datesProposees(p) {
    const P = {}; const ph = p.planning?.phases || [];
    Object.entries(RX_PHASE).forEach(([id, re]) => { const L = ph.filter(x => re.test(x.nom) && x.debut && x.fin); if (L.length) P[id] = { debut: L.map(x => x.debut).sort()[0], fin: L.map(x => x.fin).sort().pop() }; });
    const finDeploi = P.deploiement?.fin || p.dateFin;
    if (finDeploi) { const d = addOuvres(finDeploi, 1); P.cloture = { debut: d, fin: addOuvres(d, 4) }; }
    return P;
  }
  function datesEtape(p, id) {
    const s = etapesDe(p).dates[id] || {}; const pr = datesProposees(p)[id] || {};
    return { debut: s.debut || pr.debut || "", fin: s.fin || pr.fin || "", proposees: !s.debut && !s.fin && !!(pr.debut || pr.fin) };
  }
  // étape en cours : celle choisie (bouton « Passer à l'étape suivante »), sinon celle que les dates désignent
  function etapeCourante(p) {
    const A = etapesActives(p); if (!A.length) return null; const E = etapesDe(p); const t = today();
    if (E.courante && A.some(e => e.id === E.courante)) return ETAPE[E.courante];
    const parDates = A.find(e => { const d = datesEtape(p, e.id); return d.debut && d.fin && d.debut <= t && t <= d.fin; })
      || [...A].reverse().find(e => { const d = datesEtape(p, e.id); return d.debut && d.debut <= t; });
    return parDates || A[0];
  }
  const rangCourant = (p, A) => { const c = etapeCourante(p); const i = A.findIndex(x => x.id === c.id); return i === A.length - 1 && etapesDe(p).terminees[c.id] ? A.length : i; };
  const criteresEtape = (p, e) => e.criteres.map(([lib, f]) => { let ok = null; try { ok = f(p); } catch (_) { ok = null; } return { lib, ok }; }).filter(c => c.ok !== null);
  const retardEtape = (p, e) => { const d = datesEtape(p, e.id); return d.fin && d.fin < today() ? diffJ(d.fin, today()) : 0; };
  const libDates = d => d.debut || d.fin ? `${d.debut ? fmtJM(d.debut) : "?"} → ${d.fin ? fmtJM(d.fin) : "?"}` : "dates à définir";
  const pageDispo = (p, g) => moduleActif(p, g.module) && !(g.sub === "sprints" && !p.planning?.sprints?.length);
  function allerPage(module, sub) {
    allerA("projet", module); const p = proj();
    if (sub) {
      if (module === "identite") ui.vuePP = sub;
      else if (module === "planif") { if (p.planning?.methode) ui.vuePlanif = sub; }
      else if (module === "decisions") ui.vueDec = sub;
      else if (module === "cockpit") ui.vueCk = sub;
      else if (module === "livrables") ui.livVue = sub;
      else if (module === "instances") { ui.vueInst = sub; ui.crSel = null; }
      else if (module === "risques") ui.vue = sub;
      render();
    }
  }
  // étape dont on affiche les pages : celle cliquée dans le bandeau, sinon l'étape en cours
  function etapeVue(p) {
    if (ui.etapeProj !== p.id) { ui.etapeProj = p.id; ui.etapeVue = null; ui.etapePanneau = null; ui.toutesPages = false; }
    return (ui.etapeVue && ETAPE[ui.etapeVue] && etapesDe(p).actives.includes(ui.etapeVue)) ? ETAPE[ui.etapeVue] : etapeCourante(p);
  }
  function modulesEtape(p, e) { return new Set(["cockpit", "identite", ...e.pages.filter(g => pageDispo(p, g)).map(g => g.module)]); }

  function renderEtapes() {
    const nav = $("#etapes"); if (!nav) return;
    const p = proj();
    if (!connecte() || ui.ecran !== "projet" || !enTimeline(p)) { nav.innerHTML = ""; return; }
    const A = etapesActives(p); const cour = etapeCourante(p); const vue = etapeVue(p); const t = today();
    const iCour = rangCourant(p, A);
    const pas = A.map((e, i) => {
      const d = datesEtape(p, e.id); const etat = i < iCour ? "fini" : i === iCour ? "cours" : "avenir";
      const retard = etat === "cours" ? retardEtape(p, e) : 0;
      let info = libDates(d);
      if (etat === "cours" && d.debut && d.fin && d.debut <= t && t <= d.fin) info += ` · J${diffJ(d.debut, t) + 1}/${diffJ(d.debut, d.fin) + 1}`;
      return `<button class="et-pas ${etat} ${vue.id === e.id ? "sel" : ""} ${retard ? "retard" : ""}" data-act="et-voir" data-id="${e.id}" title="${esc(e.nom)} : ${esc(e.desc)}">
        <span class="et-nom">${etat === "fini" ? "✓ " : ""}${e.emoji} ${esc(e.court)}</span><span class="et-dates">${info}${retard ? ` · ⏰ +${retard} j` : ""}</span></button>`;
    }).join(`<span class="et-sep" aria-hidden="true">›</span>`);
    // barre de temps : de la première à la dernière date connue
    const D = A.map(e => datesEtape(p, e.id)); const deb = D.map(x => x.debut).filter(Boolean).sort()[0]; const fin = D.map(x => x.fin).filter(Boolean).sort().pop();
    let temps = "";
    if (deb && fin && fin > deb) {
      const pc = Math.max(0, Math.min(100, diffJ(deb, t) / diffJ(deb, fin) * 100));
      temps = `<div class="et-temps" title="${fmtDate(deb)} → ${fmtDate(fin)} · aujourd'hui ${fmtDate(t)}"><div class="et-temps-fait" style="width:${pc}%"></div>${t >= deb && t <= fin ? `<div class="et-auj" style="left:${pc}%"></div>` : ""}</div>`;
    }
    nav.innerHTML = `<div class="et-rail">${pas}</div>${temps}${ui.etapePanneau && ETAPE[ui.etapePanneau] ? panneauEtape(p, ETAPE[ui.etapePanneau], cour, A) : ""}`;
  }
  function panneauEtape(p, e, cour, A) {
    const d = datesEtape(p, e.id); const C = criteresEtape(p, e); const nOk = C.filter(c => c.ok).length;
    const i = A.findIndex(x => x.id === e.id), iCour = rangCourant(p, A);
    const etat = i < iCour ? `terminée${etapesDe(p).terminees[e.id] ? ` le ${fmtJM(etapesDe(p).terminees[e.id])}` : ""}` : i === iCour ? "en cours" : "à venir";
    const suiv = A[iCour + 1];
    const tpls = e.tpl.map(id => TEMPLATES.find(x => x.id === id)).filter(Boolean);
    return `<div class="et-panneau">
      <div class="row" style="gap:10px"><b class="et-titre">${e.emoji} ${esc(e.nom)}</b><span class="pill ${i < iCour ? "ok" : i === iCour ? "" : "soft"}">${etat}</span><span class="muted">${libDates(d)}${d.proposees ? " (d'après le planning)" : ""}</span>
        <span class="spacer"></span>${C.length ? `<span class="${nOk === C.length ? "txt-ok" : "muted"}" style="font-size:.85rem">${nOk} / ${C.length} critère(s) rempli(s)</span>` : ""}<button class="x-btn" data-act="et-fermer" title="Fermer">✕</button></div>
      <div class="et-cols">
        <div><h4>Pages à remplir</h4>${e.pages.filter(g => pageDispo(p, g)).map(g => `<button class="et-lien" data-act="et-page" data-m="${g.module}" data-s="${g.sub}"><span>${g.emoji}</span>${esc(g.nom)}<span class="spacer"></span>›</button>`).join("")}</div>
        <div><h4>Templates utiles</h4>${tpls.length ? tpls.map(x => `<button class="et-lien" data-act="tpl-apercu" data-id="${x.id}"><span>${x.emoji}</span>${esc(x.nom)}<span class="spacer"></span>👁️</button>`).join("") : `<p class="muted" style="font-size:.85rem;margin:0">Pas de template pour cette étape.</p>`}</div>
        <div><h4>Pour terminer l'étape</h4>${C.length ? C.map(c => `<div class="et-crit ${c.ok ? "ok" : ""}"><span>${c.ok ? "✅" : "⬜"}</span>${esc(c.lib)}</div>`).join("") : `<p class="muted" style="font-size:.85rem;margin:0">Rien à vérifier automatiquement.</p>`}
          <div class="row" style="margin-top:10px;gap:6px">${i === iCour ? (suiv ? `<button class="btn small" data-act="et-suivante">Passer à « ${esc(suiv.court)} » →</button>` : `<button class="btn small" data-act="et-suivante">🏁 Clore le projet</button>`)
            : `<button class="btn ghost small" data-act="et-courante" data-id="${e.id}">${i < iCour ? "↩︎ Revenir à cette étape" : "Faire de cette étape l'étape en cours"}</button>`}</div></div>
      </div></div>`;
  }
  // fiche d'identité en lecture : frise des étapes (cliquable en mode timeline)
  function blocEtapesLecture(p) {
    const A = etapesActives(p); if (!A.length) return "";
    const E = etapesDe(p); const r = rangCourant(p, A); const tl = E.mode === "timeline";
    const pas = A.map((e, i) => {
      const d = datesEtape(p, e.id); const etat = i < r ? "fini" : i === r ? "cours" : "avenir"; const ret = etat === "cours" ? retardEtape(p, e) : 0;
      const sous = etat === "fini" && E.terminees[e.id] ? `terminée le ${fmtJM(E.terminees[e.id])}` : libDates(d);
      return `<${tl ? "button" : "div"} class="et-pas ${etat} ${ret ? "retard" : ""}" ${tl ? `data-act="et-voir" data-id="${e.id}"` : ""} title="${esc(e.desc)}"><span class="et-nom">${etat === "fini" ? "✓ " : ""}${e.emoji} ${esc(e.court)}</span><span class="et-dates">${sous}${ret ? ` · ⏰ +${ret} j` : ""}</span></${tl ? "button" : "div"}>`;
    }).join(`<span class="et-sep" aria-hidden="true">›</span>`);
    return `<section class="panel idl-etapes"><div class="row" style="margin-bottom:10px"><h3 style="margin:0">🧭 Étapes du projet</h3>
        <span class="pill soft">${r >= A.length ? "🏁 projet clos" : `étape ${r + 1} sur ${A.length} : ${esc(A[r].nom)}`}</span><span class="spacer"></span>
        <span class="muted cp-tools" style="font-size:.82rem">${tl ? "Suivi en timeline" : "Navigation libre : le bandeau d'étapes est masqué"} · <span class="link" data-act="fiche-mode" data-id="saisie">modifier</span></span></div>
      <div class="et-rail">${pas}</div></section>`;
  }
  // section de la fiche d'identité (mode saisie)
  function blocEtapesFiche(p) {
    const E = etapesDe(p); const cour = etapesActives(p).length ? etapeCourante(p) : null; const A = etapesActives(p); const iCour = cour ? rangCourant(p, A) : -1;
    const ligne = e => {
      const on = E.actives.includes(e.id); const s = E.dates[e.id] || {}; const pr = datesProposees(p)[e.id] || {}; const i = A.findIndex(x => x.id === e.id);
      const tag = !on ? `<span class="pill soft">facultative</span>` : i < iCour ? `<span class="pill ok">terminée</span>` : i === iCour ? `<span class="pill" style="background:var(--primary);color:#fff">en cours</span>` : `<span class="pill soft">à venir</span>`;
      return `<div class="et-ligne ${on ? "" : "off"}">
        <input type="checkbox" data-act="et-actif" data-id="${e.id}" ${on ? "checked" : ""} aria-label="${esc(e.nom)}">
        <div><b>${e.emoji} ${esc(e.nom)}</b><div class="muted" style="font-size:.78rem">${esc(e.desc)}</div></div>
        <input type="date" class="inp" data-etd="${e.id}" data-k="debut" value="${esc(s.debut || "")}" ${on ? "" : "disabled"} title="Début">
        <input type="date" class="inp" data-etd="${e.id}" data-k="fin" value="${esc(s.fin || "")}" ${on ? "" : "disabled"} title="Fin">
        <div>${tag}${on && !s.debut && !s.fin && (pr.debut || pr.fin) ? `<div class="muted" style="font-size:.72rem;margin-top:3px">planning : ${libDates(pr)}</div>` : ""}</div></div>`;
    };
    return `<section class="panel id-wide">
      <h3>🧭 Navigation et étapes du projet</h3>
      <div class="et-modes">
        <button class="et-mode ${E.mode !== "timeline" ? "on" : ""}" data-act="et-mode" data-id="libre"><b>🗂️ Libre</b><span>Comme avant : toutes les pages, pas de bandeau d'étapes.</span></button>
        <button class="et-mode ${E.mode === "timeline" ? "on" : ""}" data-act="et-mode" data-id="timeline"><b>🧭 Suivi en timeline</b><span>Bandeau des étapes en haut de chaque page ; les onglets montrent les pages de l'étape.</span></button>
      </div>
      <div class="et-ligne et-entete"><span></span><span>Étape</span><span>Début</span><span>Fin</span><span></span></div>
      ${ETAPES.map(ligne).join("")}
      <div class="aide" style="margin-top:8px">Cochez les étapes de votre projet. Sans date saisie, l'appli reprend les dates des phases du planning. <span class="link" data-act="et-dates-plan">↺ Effacer mes dates et reprendre celles du planning</span></div>
    </section>`;
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || !el.dataset.act.startsWith("et-")) return;
    const p = proj(); if (!p) return; const { act, id } = el.dataset; const E = etapesDe(p);
    switch (act) {
      case "et-voir": ui.etapeVue = id; ui.etapePanneau = ui.etapePanneau === id ? null : id; ui.toutesPages = false; break;
      case "et-fermer": ui.etapePanneau = null; ui.etapeVue = null; break;
      case "et-page": ui.etapePanneau = null; allerPage(el.dataset.m, el.dataset.s); return;
      case "et-toutes": ui.toutesPages = !ui.toutesPages; break;
      case "et-suivante": {
        const A = etapesActives(p); const c = etapeCourante(p); const i = A.findIndex(x => x.id === c.id); const manque = criteresEtape(p, c).filter(x => !x.ok);
        if (manque.length && !confirm(`Il reste ${manque.length} critère(s) non rempli(s) pour « ${c.nom} » :\n• ${manque.map(x => x.lib).join("\n• ")}\n\nPasser quand même à l'étape suivante ?`)) return;
        E.terminees[c.id] = today();
        if (A[i + 1]) { E.courante = A[i + 1].id; ui.etapeVue = E.courante; ui.etapePanneau = E.courante; toast(`${A[i + 1].emoji} Étape « ${A[i + 1].nom} » démarrée`); }
        else { E.courante = c.id; ui.etapePanneau = null; toast("🏁 Projet clos : toutes les étapes sont terminées"); }
        save(); break;
      }
      case "et-courante": { const A = etapesActives(p); const i = A.findIndex(x => x.id === id); A.slice(i).forEach(x => delete E.terminees[x.id]); E.courante = id; ui.etapeVue = id; save(); toast(`${ETAPE[id].emoji} « ${ETAPE[id].nom} » est l'étape en cours`); break; }
      case "et-mode": E.mode = id; ui.toutesPages = false; save(); toast(id === "timeline" ? "🧭 Suivi en timeline activé" : "🗂️ Navigation libre : toutes les pages"); break;
      case "et-actif": { const on = el.checked; E.actives = ETAPES.map(x => x.id).filter(x => x === id ? on : E.actives.includes(x)); if (!on && E.courante === id) E.courante = ""; save(); break; }
      case "et-dates-plan": if (!confirm("Effacer les dates saisies et reprendre celles du planning ?")) return; E.dates = {}; save(); toast("📅 Dates reprises du planning"); break;
      default: return;
    }
    render();
  });
  document.addEventListener("change", e => {
    const k = e.target.dataset?.etd; if (!k) return; const p = proj(); if (!p) return;
    const E = etapesDe(p); E.dates[k] = E.dates[k] || {}; E.dates[k][e.target.dataset.k] = e.target.value; save(); render();
  });
  const EMOJIS = ["🚀", "🛰️", "✈️", "🧭", "💡", "🏗️", "📦", "🧪", "🌐", "📱", "🤖", "🛡️", "⚙️", "🎨", "📊", "🌱"];
  const COLORS = ["#7466c4", "#c27a9b", "#d4925f", "#c9ab55", "#5f9e76", "#5a9fc9", "#7c7fd6", "#4fa89a", "#c9665f", "#4b5567"];
  const VUES = [
    { id: "catalogue", nom: "Catalogue & sélection", emoji: "📚", c: "#b9789a" },
    { id: "dashboard", nom: "Tableau de bord", emoji: "🏠", c: "#7466c4" },
    { id: "registre",  nom: "Registre du projet", emoji: "📋", c: "#cf8d5c" },
    { id: "matrice",   nom: "Matrice 3×3", emoji: "🎯", c: "#c9665f" },
    { id: "problemes", nom: "Problèmes", emoji: "⚠️", c: "#c9605a" },
    { id: "actions",   nom: "Plan d'actions", emoji: "✅", c: "#5a9e72" },
    { id: "copil",     nom: "Synthèse COPIL", emoji: "📸", c: "#1f4e79" },
  ];

  // Briques du Cockpit Projet (onglets principaux d'un projet)
  const MODULES = [
    { id: "cockpit",   nom: "Vue d'ensemble", emoji: "🧭" },
    { id: "identite",  nom: "Identité", emoji: "🪪" },
    { id: "planif",    nom: "Planification", emoji: "🗓️" },
    { id: "backlog",   nom: "Analyse du backlog", emoji: "📈" },
    { id: "risques",   nom: "Risques", emoji: "🎯" },
    { id: "instances", nom: "Réunions & copils", emoji: "🏛️" },
    { id: "decisions", nom: "Décisions & actions", emoji: "📒" },
    { id: "livrables", nom: "Livrables & docs", emoji: "📚" },
    { id: "budget", nom: "Budget", emoji: "💶" },
    { id: "retex", nom: "Retex / rétrospective", emoji: "🎓" },
  ];
  const A_VENIR = {
  };
  const ROLES = ["Sponsor", "Directeur de projet", "Chef de projet", "Product Owner", "Scrum Master", "Référent métier", "MOA", "MOE", "Architecte", "Équipe projet", "Fournisseur / prestataire", "Utilisateur clé", "Autre"];
  const UNITES = { eur: "€", keur: "k€", jh: "jours-homme" };

  // ═══════════════ État
  const DEMO_MODE = new URLSearchParams(location.search).get("demo") === "1" || location.hostname.endsWith(".github.io");
  const DEMO_NAV_ACTIONS = new Set([
    "portefeuille", "ouvrir-projet", "module", "kpi", "clear-hl", "vue", "vue-risques",
    "cat", "catReg", "statutF", "chips-scroll", "open", "close-modal", "ck-vue", "pl-vue",
    "in-vue", "in-part", "pp-vue", "pp-chvue", "pp-annu", "pp-annu-ouvrir", "pf-vue",
    "dc-vue", "dl-filtre", "chg-filtre", "pl-filtre", "et-page", "et-toutes", "et-voir",
    "cr-ouvrir", "pl-open", "mo-ouvrir"
  ]);
  const DEMO_FILTER_IDS = new Set(["search", "searchAnnuaire"]);
  const DEMO_CHANGE_IDS = new Set(["projSel", "triSel", "masquerClos", "copilClos", "copilDetails"]);
  const bloquerDemo = e => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (DEMO_MODE) {
    document.addEventListener("click", e => {
      const target = e.target.closest?.("[data-act], button, [role=button], a");
      if (!target) return;
      const action = target.dataset?.act;
      const href = target.closest("a")?.getAttribute("href") || "";
      const lienLecture = href.startsWith("#") || href.startsWith("manuel/");
      if (!DEMO_NAV_ACTIONS.has(action) && !["rClose", "rOk"].includes(target.id) && !target.matches(".nav-fleche") && !lienLecture) bloquerDemo(e);
    }, true);
    document.addEventListener("beforeinput", e => { if (!DEMO_FILTER_IDS.has(e.target.id)) bloquerDemo(e); }, true);
    document.addEventListener("input", e => { if (!DEMO_FILTER_IDS.has(e.target.id)) bloquerDemo(e); }, true);
    document.addEventListener("change", e => { if (!DEMO_CHANGE_IDS.has(e.target.id)) bloquerDemo(e); }, true);
    document.addEventListener("submit", bloquerDemo, true);
    document.addEventListener("dragstart", bloquerDemo, true);
    document.addEventListener("drop", bloquerDemo, true);
  }
  let S = DEMO_MODE ? normaliser({ projets: [], actif: null }) : load();
  const ui = { copilClos: false, copilDetails: false, surligne: null, vue: "dashboard", cat: "all", q: "", statutFiltre: "ouverts", tri: "crit", masquerClos: false, catReg: "all", ecran: "projet", module: "cockpit", qAnnuaire: "" };
  try { if (!DEMO_MODE) {
    ui.vue = localStorage.getItem(KEY + "-vue") || "dashboard";
    ui.module = localStorage.getItem(KEY + "-module") || "cockpit";
    if (!MODULES.some(m => m.id === ui.module)) ui.module = "cockpit";
  }} catch (e) {}
  let modalRedraw = null; // si une fenêtre doit se redessiner après une modification (assistant de création)

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && Array.isArray(s.projets)) return normaliser(s);
    } catch (e) {}
    return normaliser({ projets: [], actif: null });
  }
  // Reprise automatique des anciennes données : ajoute les nouvelles rubriques sans rien perdre
  function normaliser(s) {
    s.annuaire = Array.isArray(s.annuaire) ? s.annuaire : [];
    s.calendrier = s.calendrier && typeof s.calendrier === "object" ? s.calendrier : { alsace: false, pentecoteTravaillee: false, fermetures: [] };
    s.calendrier.fermetures = s.calendrier.fermetures || [];
    s.modeles = Array.isArray(s.modeles) ? s.modeles : [];
    s.projets.forEach(normaliserProjet);
    return s;
  }
  function normaliserProjet(p) {
    const def = {
      code: "", enjeu: "", objectifs: "", perimetreIn: "", perimetreOut: "", notes: "",
      dateDebut: p.creeLe || "", dateFin: "", finFerme: false,
      budget: { montant: "", unite: "keur" }, interlocuteurs: [], liens: [], risques: [], planning: null, actions: [], decisions: [],
    };
    for (const k in def) if (p[k] == null) p[k] = def[k];
    etapesDe(p);
    if (typeof p.budget !== "object") p.budget = { montant: p.budget, unite: "keur" };
    if (!p.options) p.options = { budget: !!(p.budget?.montant || p.budget?.lignes?.length), charge: false };
    return p;
  }
  function save() {
    if (DEMO_MODE) return;
    try { localStorage.setItem(KEY, JSON.stringify(S)); }
    catch (e) { if (!fichier.handle) toast("⚠️ Sauvegarde impossible dans ce navigateur"); }
    planifierEcriture();
  }

  // ═══════════════ Stockage sur le poste (File System Access API : Chrome / Edge)
  // Deux modes :
  //  • « dossier » (recommandé) : un fichier .json par projet + _commun.json (annuaire, jours fériés…) ;
  //    un projet supprimé part dans le sous-dossier « corbeille ».
  //  • « fichier » (ancien mode) : tout dans un seul fichier .json.
  // Le localStorage ne sert que de cache. Le dossier / fichier choisi est mémorisé dans IndexedDB.
  const FS_OK = "showOpenFilePicker" in window && "showSaveFilePicker" in window;
  const DIR_OK = "showDirectoryPicker" in window;
  const FS_TYPES = [{ description: "Données Cockpit Projet", accept: { "application/json": [".json"] } }];
  const COMMUN = "_commun.json";
  // Safari, Firefox… ne savent pas écrire dans un dossier du poste : le petit serveur local (serveur.py) le fait pour eux.
  // Ces deux classes imitent les « poignées » de fichier et de dossier de Chrome : le reste du code ne voit pas la différence.
  const apiServeur = (methode, route, chemin = "", corps) => fetch(`/api/${route}?chemin=${encodeURIComponent(chemin)}`, { method: methode, headers: { "X-Cockpit": "1" }, body: corps, cache: "no-store" });
  const introuvable = () => new DOMException("Introuvable", "NotFoundError");
  class FichierServeur {
    constructor(chemin, nom) { this.kind = "file"; this.chemin = chemin; this.name = nom; this.serveur = true; }
    async getFile() { const r = await apiServeur("GET", "fichier", this.chemin); if (!r.ok) throw introuvable(); const b = await r.blob(); return new File([b], this.name, { type: b.type }); }
    async createWritable() {
      const morceaux = []; const chemin = this.chemin;
      return { write: async d => { morceaux.push(d instanceof Blob ? d : new Blob([d])); }, close: async () => { const r = await apiServeur("PUT", "fichier", chemin, new Blob(morceaux)); if (!r.ok) throw new Error("écriture refusée"); } };
    }
    async queryPermission() { return "granted"; } async requestPermission() { return "granted"; }
  }
  class DossierServeur {
    constructor(chemin = "", nom = "dossier", complet = "") { this.kind = "directory"; this.chemin = chemin; this.name = nom; this.complet = complet; this.serveur = true; }
    sous(n) { return this.chemin ? `${this.chemin}/${n}` : n; }
    async *entries() {
      const r = await apiServeur("GET", "liste", this.chemin); if (!r.ok) throw introuvable();
      for (const x of await r.json()) yield [x.nom, x.type === "directory" ? new DossierServeur(this.sous(x.nom), x.nom) : new FichierServeur(this.sous(x.nom), x.nom)];
    }
    async *keys() { for await (const [n] of this.entries()) yield n; }
    async getFileHandle(n) { return new FichierServeur(this.sous(n), n); }
    async getDirectoryHandle(n, { create } = {}) { if (create) { const r = await apiServeur("POST", "dossier", this.sous(n)); if (!r.ok) throw new Error("dossier refusé"); } return new DossierServeur(this.sous(n), n); }
    async removeEntry(n) { const r = await apiServeur("DELETE", "fichier", this.sous(n)); if (!r.ok) throw introuvable(); }
    async queryPermission() { return "granted"; } async requestPermission() { return "granted"; }
  }
  const CLE_STOCKAGE = "cockpit-stockage";
  const modeServeurVoulu = () => { try { return localStorage.getItem(CLE_STOCKAGE) === "serveur"; } catch (e) { return false; } };
  // Branche l'appli sur le dossier de données du serveur local. Renvoie false si le serveur ne répond pas.
  async function brancherServeur(memoriser) {
    let info; try { const r = await fetch("/api/info", { cache: "no-store" }); if (!r.ok) return false; info = await r.json(); } catch (e) { return false; }
    const dir = new DossierServeur("", info.nom, info.chemin);
    await chargerOuRemplir(dir);
    if (memoriser) { try { localStorage.setItem(CLE_STOCKAGE, "serveur"); await idb("del", null, "dir"); await idb("del"); } catch (e) {} }
    return true;
  }
  const fichier = { handle: null, dir: null, etat: "init", derniere: null }; // init | aucun | attente | ok | ecriture | erreur | nonsupporte
  // L'appli ne fonctionne qu'avec un dossier (ou un fichier) de données sur le poste
  const connecte = () => ["ok", "ecriture", "erreur"].includes(fichier.etat);
  const ecrits = new Map();      // nom de fichier → contenu déjà écrit (on ne réécrit que ce qui change)
  const nomsProjets = new Map(); // id du projet → nom de son fichier dans le dossier
  let ecritureTimer = null, ecritureEnCours = false, ecritureARefaire = false;

  function idb(op, val, cle = "handle") {
    return new Promise((res, rej) => {
      const rq = indexedDB.open("radar-risques", 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore("kv");
      rq.onerror = () => rej(rq.error);
      rq.onsuccess = () => {
        const st = rq.result.transaction("kv", op === "get" ? "readonly" : "readwrite").objectStore("kv");
        const r = op === "get" ? st.get(cle) : op === "del" ? st.delete(cle) : st.put(val, cle);
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      };
    });
  }
  const support = () => fichier.dir || fichier.handle;
  const nomSupport = () => esc(fichier.dir ? fichier.dir.name : fichier.handle ? fichier.handle.name : "");

  function planifierEcriture() {
    if (!support() || fichier.etat === "attente") return;
    clearTimeout(ecritureTimer);
    fichier.etat = "ecriture"; renderProjectBar();
    ecritureTimer = setTimeout(ecrire, 400);
  }
  async function ecrire() {
    if (ecritureEnCours) { ecritureARefaire = true; return; }
    ecritureEnCours = true;
    try { fichier.dir ? await ecrireDossier() : await ecrireFichier(); fichier.etat = "ok"; fichier.derniere = new Date(); }
    catch (e) { console.error(e); fichier.etat = "erreur"; toast(fichier.dir ? "⚠️ Impossible d'écrire dans le dossier de données" : "⚠️ Impossible d'écrire dans le fichier de données"); }
    ecritureEnCours = false; renderProjectBar();
    if (ecritureARefaire) { ecritureARefaire = false; ecrire(); }
  }
  async function ecrireTexte(dir, nom, txt) {
    const h = await dir.getFileHandle(nom, { create: true });
    const w = await h.createWritable(); await w.write(txt); await w.close();
  }

  // ─── Mode « un seul fichier »
  async function ecrireFichier() {
    const w = await fichier.handle.createWritable();
    await w.write(JSON.stringify({ app: "cockpit-projet", version: 2, enregistreLe: new Date().toISOString(), actif: S.actif, annuaire: S.annuaire, calendrier: S.calendrier, theme: S.theme || "inter", tuiles: S.tuiles || null, modeles: S.modeles || [], projets: S.projets }, null, 2));
    await w.close();
  }
  // Lit le fichier. Renvoie true si des données ont été chargées, false s'il est vide.
  async function lireFichier(h) {
    const txt = (await (await h.getFile()).text()).trim();
    if (!txt) return false;
    const data = JSON.parse(txt);
    if (!data || !Array.isArray(data.projets)) throw new Error("format");
    S = normaliser({ projets: data.projets, actif: data.actif, annuaire: data.annuaire, calendrier: data.calendrier, theme: data.theme, tuiles: data.tuiles, modeles: data.modeles });
    if (!proj()) S.actif = S.projets[0]?.id || null;
    if (!DEMO_MODE) try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
    return true;
  }
  async function brancherFichier(h, { ecraser = false } = {}) {
    fichier.handle = h; fichier.dir = null;
    try { await idb("put", h); await idb("del", null, "dir"); } catch (e) {}
    if (ecraser || !(await lireFichier(h))) await ecrireFichier();
    fichier.etat = "ok"; fichier.derniere = new Date();
    render();
  }
  async function creerFichier() {
    try {
      const h = await window.showSaveFilePicker({ suggestedName: "cockpit-projet-donnees.json", types: FS_TYPES });
      await brancherFichier(h, { ecraser: true });
      closeModal(); toast(`📄 Données enregistrées dans « ${h.name} »`);
    } catch (e) { if (e.name !== "AbortError") toast("❌ Création du fichier impossible"); }
  }
  async function ouvrirFichier() {
    try {
      const [h] = await window.showOpenFilePicker({ types: FS_TYPES });
      const txt = (await (await h.getFile()).text()).trim();
      if (txt && JSON.parse(txt)?.type === "projet") { closeModal(); importerDonnees(JSON.parse(txt)); save(); render(); toast("📥 Projet ajouté"); return; }
      if (txt && S.projets.length && !confirm(`Charger « ${h.name} » ? Les projets affichés actuellement seront remplacés par ceux du fichier.`)) return;
      await brancherFichier(h);
      closeModal(); toast(`📂 Fichier « ${h.name} » connecté`);
    } catch (e) {
      if (e.name === "AbortError") return;
      toast(e.message === "format" || e instanceof SyntaxError ? "❌ Ce fichier n'est pas un fichier Cockpit Projet" : "❌ Ouverture du fichier impossible");
    }
  }

  // ─── Mode « dossier » : un fichier par projet
  const nomFichierProjet = p => (`${p.code ? p.code + " - " : ""}${p.nom || "Projet"}`).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80) || "Projet";
  function nomsUniques() {
    const pris = new Set([COMMUN.toLowerCase()]); const m = new Map();
    S.projets.forEach(p => { const b = nomFichierProjet(p); let n = b + ".json", i = 2; while (pris.has(n.toLowerCase())) n = `${b} (${i++}).json`; pris.add(n.toLowerCase()); m.set(p.id, n); });
    return m;
  }
  const personnesDuProjet = p => p.interlocuteurs.map(i => S.annuaire.find(x => x.id === i.personneId)).filter(Boolean);
  const contenuProjet = p => JSON.stringify({ app: "cockpit-projet", type: "projet", version: 3, projet: p, personnes: personnesDuProjet(p) }, null, 2);
  const contenuCommun = () => JSON.stringify({ app: "cockpit-projet", type: "commun", version: 3, actif: S.actif, annuaire: S.annuaire, calendrier: S.calendrier, theme: S.theme || "inter", tuiles: S.tuiles || null, modeles: S.modeles || [] }, null, 2);

  async function ecrireDossier() {
    const dir = fichier.dir; const noms = nomsUniques(); const anciens = new Map(nomsProjets);
    for (const p of S.projets) {
      const nom = noms.get(p.id); const txt = contenuProjet(p);
      if (ecrits.get(nom) !== txt) { await ecrireTexte(dir, nom, txt); ecrits.set(nom, txt); }
      nomsProjets.set(p.id, nom);
    }
    // projet renommé : on retire l'ancien fichier ; projet supprimé : son fichier part dans « corbeille »
    for (const [id, ancien] of anciens) {
      const nouveau = noms.get(id); if (nouveau === ancien) continue;
      if (!nouveau) { await versCorbeille(dir, ancien); nomsProjets.delete(id); }
      else { try { await dir.removeEntry(ancien); } catch (e) {} }
      ecrits.delete(ancien);
    }
    const c = contenuCommun(); if (ecrits.get(COMMUN) !== c) { await ecrireTexte(dir, COMMUN, c); ecrits.set(COMMUN, c); }
  }
  async function versCorbeille(dir, nom) {
    try {
      const txt = await (await (await dir.getFileHandle(nom)).getFile()).text();
      await ecrireTexte(await dir.getDirectoryHandle("corbeille", { create: true }), `${today()} - ${nom}`, txt);
      await dir.removeEntry(nom);
    } catch (e) {}
  }
  async function lireDossier(dir) {
    const projets = [], personnes = []; let commun = null;
    for await (const [nom, h] of dir.entries()) {
      if (h.kind !== "file" || !nom.toLowerCase().endsWith(".json")) continue;
      let txt, data; try { txt = await (await h.getFile()).text(); data = JSON.parse(txt); } catch (e) { continue; }
      if (data?.app !== "cockpit-projet") continue;
      if (data.type === "commun") { commun = data; ecrits.set(nom, txt); }
      else if (data.type === "projet" && data.projet?.id) { projets.push({ p: data.projet, nom }); personnes.push(...(data.personnes || [])); ecrits.set(nom, txt); }
    }
    return { projets, personnes, commun };
  }
  function chargerDepuisDossier(L) {
    const annuaire = [...(L.commun?.annuaire || [])];
    L.personnes.forEach(x => { if (x?.id && !annuaire.some(y => y.id === x.id)) annuaire.push(x); });
    const vus = new Set(); const projets = []; nomsProjets.clear();
    L.projets.sort((a, b) => a.nom.localeCompare(b.nom)).forEach(({ p, nom }) => { if (vus.has(p.id)) return; vus.add(p.id); projets.push(p); nomsProjets.set(p.id, nom); });
    S = normaliser({ projets, actif: L.commun?.actif, annuaire, calendrier: L.commun?.calendrier, theme: L.commun?.theme, tuiles: L.commun?.tuiles, modeles: L.commun?.modeles });
    if (!proj()) S.actif = S.projets[0]?.id || null;
    if (!DEMO_MODE) try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }
  // Charge le dossier ; s'il est vide alors que des projets sont affichés, on les y range (rien n'est perdu)
  async function chargerOuRemplir(dir) {
    ecrits.clear(); nomsProjets.clear();
    const L = await lireDossier(dir);
    if (L.projets.length || L.commun) chargerDepuisDossier(L);
    fichier.dir = dir; fichier.handle = null;
    await ecrireDossier();
    fichier.etat = "ok"; fichier.derniere = new Date();
  }
  async function choisirDossier() {
    try {
      const dir = await window.showDirectoryPicker({ id: "cockpit-projet", mode: "readwrite" });
      const L = await lireDossier(dir); ecrits.clear();
      if ((L.projets.length || L.commun) && S.projets.length && !confirm(`Le dossier « ${dir.name} » contient déjà ${L.projets.length} projet(s).\n\nOK : afficher les projets de ce dossier (ceux affichés actuellement seront remplacés).\nAnnuler : ne rien changer.`)) return;
      await chargerOuRemplir(dir);
      try { await idb("put", dir, "dir"); await idb("del", null, "handle"); localStorage.removeItem(CLE_STOCKAGE); } catch (e) {}
      closeModal(); render();
      toast(`📁 ${S.projets.length} projet(s) dans le dossier « ${dir.name} » : un fichier par projet`);
    } catch (e) {
      console.error(e);
      ui.msgConnexion = e.name === "AbortError"
        ? "Aucun dossier n'a été relié. Si Chrome a affiché « Impossible d'ouvrir ce dossier (fichiers système) », choisis un dossier dans Documents, par exemple Documents › Cockpit Projet."
        : `Le dossier n'a pas pu être utilisé (${e.name} : ${e.message}).`;
      if (e.name !== "AbortError") toast("❌ Impossible d'utiliser ce dossier"); render();
    }
  }

  // ─── Ajouter un projet reçu (fichier projet, ou ancien fichier contenant plusieurs projets)
  function importerProjet(p, personnes) {
    (personnes || []).forEach(x => { if (x?.id && !S.annuaire.some(y => y.id === x.id)) S.annuaire.push(x); });
    const ex = S.projets.find(x => x.id === p.id);
    if (ex) {
      if (confirm(`Le projet « ${p.nom} » existe déjà.\n\nOK : le remplacer par la version du fichier.\nAnnuler : l'ajouter comme copie.`)) S.projets = S.projets.filter(x => x.id !== ex.id);
      else { p = structuredClone(p); p.id = uid(); p.nom += " (copie)"; }
    }
    S.projets.push(normaliserProjet(p)); S.actif = p.id;
  }
  function importerDonnees(data) {
    if (data?.type === "projet" && data.projet) { importerProjet(data.projet, data.personnes); return 1; }
    if (Array.isArray(data?.projets)) { data.projets.forEach(p => importerProjet(p, (data.annuaire || []).filter(x => (p.interlocuteurs || []).some(i => i.personneId === x.id)))); return data.projets.length; }
    throw new Error("format");
  }
  // Choisir un ou des fichiers sur le poste, dans tous les navigateurs
  function choisirFichiers({ accept = "", multiple = false } = {}) {
    return new Promise(res => {
      const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.multiple = multiple;
      i.onchange = () => res([...i.files]); i.click();
    });
  }
  async function ajouterFichiersProjet() {
    if (!FS_OK) { ui.importAjout = true; $("#importFile").click(); return; }
    try {
      const hs = await window.showOpenFilePicker({ types: FS_TYPES, multiple: true });
      let n = 0;
      for (const h of hs) n += importerDonnees(JSON.parse(await (await h.getFile()).text()));
      save(); closeModal(); ui.ecran = "projet"; render();
      toast(`📥 ${n} projet(s) ajouté(s)${fichier.dir ? " et rangé(s) dans ton dossier" : ""}`);
    } catch (e) { if (e.name !== "AbortError") toast(e.message === "format" || e instanceof SyntaxError ? "❌ Ce fichier n'est pas un fichier Cockpit Projet" : "❌ Ajout impossible"); }
  }
  function exporterProjet(p) {
    telecharger(`${nomFichierProjet(p)}.json`, contenuProjet(p), "application/json");
    toast("📤 Fichier du projet téléchargé : tu peux l'envoyer à un collègue");
  }

  // ─── Connexion / reconnexion
  async function reconnecterFichier() {
    try {
      if ((await support().requestPermission({ mode: "readwrite" })) !== "granted") { toast("🔒 Accès refusé"); return; }
      if (fichier.dir) { await chargerOuRemplir(fichier.dir); render(); toast(`✅ Dossier « ${fichier.dir.name} » reconnecté`); }
      else { await brancherFichier(fichier.handle); toast(`✅ Fichier « ${fichier.handle.name} » reconnecté`); }
    } catch (e) { console.error(e); toast("❌ Introuvable : choisis-le à nouveau"); deconnecterFichier(); }
  }
  async function deconnecterFichier() {
    fichier.handle = null; fichier.dir = null; fichier.etat = "aucun"; ecrits.clear(); nomsProjets.clear();
    try { localStorage.removeItem(CLE_STOCKAGE); await idb("del"); await idb("del", null, "dir"); } catch (e) {}
    render();
  }
  // Démarrage : chaque étape a un délai. Si le navigateur ne répond pas (cela arrive avec l'accès direct au dossier de Chrome),
  // l'appli passe par le petit serveur, qui lit le même dossier, au lieu d'afficher « Ouverture de tes données… » indéfiniment.
  let etapeInit = "";
  const DELAI_ETAPE = 6000;
  function avecDelai(promesse, etape) {
    etapeInit = etape; if (fichier.etat === "init") { const m = $("#etapeInit"); if (m) m.textContent = etape; }
    return Promise.race([promesse, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(`« ${etape} » ne répond pas`), { name: "Delai" })), DELAI_ETAPE))]);
  }
  async function initFichier() {
    if (!DIR_OK || modeServeurVoulu()) {
      try { if (await avecDelai(brancherServeur(false), "connexion au petit serveur")) { render(); return; } } catch (e) { console.error(e); }
      if (!FS_OK) { fichier.etat = "nonsupporte"; render(); return; }
    }
    let dir = null;
    try {
      dir = DIR_OK ? await avecDelai(idb("get", null, "dir"), "lecture de la mémoire du navigateur") : null;
      if (dir) {
        if ((await avecDelai(dir.queryPermission({ mode: "readwrite" }), "vérification de l'autorisation")) === "granted") {
          ecrits.clear(); nomsProjets.clear();
          const L = await avecDelai(lireDossier(dir), "lecture du dossier");
          if (L.projets.length || L.commun) chargerDepuisDossier(L);
          fichier.dir = dir; fichier.handle = null; fichier.etat = "ok"; fichier.derniere = new Date();
          ecrireDossier().catch(e => console.error(e)); // rangement éventuel, sans bloquer l'ouverture
        } else { fichier.dir = dir; fichier.etat = "attente"; }
      } else {
        const h = await avecDelai(idb("get"), "lecture de la mémoire du navigateur"); if (!h) { fichier.etat = "aucun"; render(); return; }
        fichier.handle = h;
        if ((await avecDelai(h.queryPermission({ mode: "readwrite" }), "vérification de l'autorisation")) === "granted") { await avecDelai(lireFichier(h), "lecture du fichier"); fichier.etat = "ok"; fichier.derniere = new Date(); }
        else fichier.etat = "attente";
      }
    } catch (e) {
      console.error(e);
      fichier.handle = null; fichier.dir = null; fichier.etat = "aucun";
      // le navigateur ne répond pas : on passe par le petit serveur s'il lit le même dossier
      if (e.name === "Delai") {
        let info = null; try { const r = await fetch("/api/info", { cache: "no-store" }); if (r.ok) info = await r.json(); } catch (_) {}
        if (info && (!dir || dir.name === info.nom)) {
          try { if (await brancherServeur(true)) { render(); toast(`🖥️ Chrome ne répondait pas (${etapeInit}) : tes données sont ouvertes par le petit serveur, dans le même dossier`); return; } } catch (e2) { console.error(e2); }
        }
        ui.msgConnexion = `Le navigateur n'a pas répondu à l'étape « ${etapeInit} ». Tes données ne sont pas perdues : choisis à nouveau ton dossier${info ? ", ou utilise le dossier de l'appli" : ""}.`;
      }
    }
    render();
  }

  function vueConnexion() {
    if (fichier.etat === "init") return `<div class="connexion"><p class="muted">⏳ Ouverture de tes données… <span id="etapeInit" style="font-size:.85rem">${esc(etapeInit)}</span></p></div>`;
    if (fichier.etat === "nonsupporte") return `<div class="connexion"><span class="hero">🧭</span><h1>Cockpit Projet</h1>
      <div class="alert" style="max-width:600px;margin:16px auto">Le petit serveur de Cockpit Projet ne répond pas. Ouvre l'appli en double-cliquant sur <b>« Lancer Cockpit Projet »</b> (Mac) ou <b>« Lancer Cockpit Projet.bat »</b> (Windows), puis recharge cette page.</div></div>`;
    if (fichier.etat === "attente") return `<div class="connexion"><span class="hero">🔒</span><h1>Autoriser l'accès à tes données</h1>
      <p class="muted">${fichier.dir ? "Ton dossier" : "Ton fichier"} de données <b>${nomSupport()}</b> est mémorisé. Le navigateur demande ton accord à chaque nouvelle ouverture de l'appli.</p>
      <button class="btn" style="font-size:1.1rem;padding:12px 24px" data-act="fs-reconnect">🔓 Autoriser l'accès à ${nomSupport()}</button>
      <p class="muted" style="margin-top:16px;font-size:.88rem">ou <span class="link" data-act="fs-dossier">choisir un autre dossier</span></p></div>`;
    const cache = S.projets.length;
    if (/ Claude\//.test(navigator.userAgent) && !/[?&]test\b/.test(location.search)) return `<div class="connexion"><span class="hero">🧭</span><h1>Ouvre Cockpit Projet dans Chrome</h1>
      <p class="muted" style="max-width:620px;margin:0 auto">Tu es dans l'aperçu intégré à l'appli Claude : il ne permet pas de relier un dossier de ton Mac. Pour utiliser Cockpit Projet, double-clique sur <b>« Lancer Cockpit Projet »</b> dans le dossier de l'appli : il l'ouvre dans Chrome.</p></div>`;
    return `<div class="connexion"><span class="hero">📁</span><h1>Où ranger tes projets ?</h1>
      ${ui.msgConnexion ? `<div class="alert" style="max-width:620px;margin:0 auto 16px">${esc(ui.msgConnexion)}</div>` : ""}
      <p class="muted" style="max-width:620px;margin:0 auto 20px">Cockpit Projet enregistre tes données dans des fichiers sur ton poste : <b>un fichier par projet</b> dans le dossier de ton choix, plus <code>${COMMUN}</code> pour l'annuaire et les jours fériés. Conseil : crée un dossier <b>Documents › Cockpit Projet</b>.</p>
      ${DIR_OK ? `<button class="btn" style="font-size:1.1rem;padding:12px 24px" data-act="fs-dossier">📁 Choisir un dossier</button>
        <p class="muted" style="font-size:.88rem;margin-top:12px">Dossier vide : ${cache ? `tes ${cache} projet(s) déjà présents dans ce navigateur y seront rangés` : "tu pourras y créer ton premier projet"}. Dossier Cockpit Projet existant : ses projets s'ouvrent.</p>` : ""}
      <p style="margin-top:14px"><button class="btn ghost" data-act="fs-serveur">🖥️ Utiliser le dossier de l'appli</button></p>
      <p class="muted" style="font-size:.84rem;max-width:560px;margin:4px auto 0">Fonctionne dans tous les navigateurs (Safari, Firefox, Chrome…) : les données sont lues et écrites par le petit serveur lancé avec « Lancer Cockpit Projet ».</p>
      <details class="store-ancien" style="max-width:560px;margin:22px auto 0;text-align:left"><summary>📄 Ancien mode : tout dans un seul fichier</summary>
        <p class="muted">Tous les projets dans un même fichier <code>.json</code> (par exemple ton ancien <code>radar-risques-donnees.json</code>).</p>
        <div class="row"><button class="btn ghost small" data-act="fs-open">Ouvrir un fichier de données</button><button class="btn ghost small" data-act="fs-create">Créer un fichier de données</button></div>
      </details></div>`;
  }

  function ouvrirStockage() {
    const nom = nomSupport(); const quoi = fichier.dir ? "le dossier" : "le fichier";
    const etat = {
      ok: `<div class="store-state ok">${fichier.dir ? "📁" : "📄"} Tes données sont enregistrées dans ${quoi} <b>${nom}</b>${fichier.dir ? ` : un fichier par projet (${S.projets.length}) + <code>${COMMUN}</code>` : ""}${fichier.derniere ? ` · dernier enregistrement à ${fichier.derniere.toLocaleTimeString("fr-FR")}` : ""}.</div>`,
      ecriture: `<div class="store-state ok">⏳ Enregistrement en cours dans ${quoi} <b>${nom}</b>…</div>`,
      attente: `<div class="store-state warn">🔒 ${fichier.dir ? "Le dossier" : "Le fichier"} <b>${nom}</b> est mémorisé, mais le navigateur demande ton accord pour y accéder à nouveau.</div>`,
      erreur: `<div class="store-state warn">⚠️ La dernière écriture dans ${quoi} <b>${nom}</b> a échoué. Choisis-le à nouveau.</div>`,
      aucun: "",
    }[fichier.etat];
    const p = proj();
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">💾 Où sont mes données ?</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        ${etat}
        ${fichier.etat === "attente" ? `<button class="btn" data-act="fs-reconnect">🔓 Autoriser l'accès à ${nom}</button>` : ""}
        ${fichier.dir?.serveur ? `<div class="store-state ok">🖥️ Mode « dossier de l'appli » : le petit serveur local lit et écrit tes données dans <b>${esc(fichier.dir.complet || fichier.dir.name)}</b>. Ce mode fonctionne dans tous les navigateurs ; ouvre la même adresse dans Safari ou Chrome, tu retrouves les mêmes projets.</div>` : ""}
        ${FS_OK ? `
          ${DIR_OK ? `<div class="panel store-choix ${fichier.dir && !fichier.dir.serveur ? "actif" : ""}">
            <h3>📁 Un fichier par projet <span class="pill ok">recommandé</span></h3>
            <p class="muted">Choisis un dossier sur ton poste (conseil : Documents › Cockpit Projet ; sur Mac, Chrome peut refuser un dossier OneDrive synchronisé). Chaque projet y a son fichier, nommé avec son code et son nom, plus <code>${COMMUN}</code> pour l'annuaire et les jours fériés. Un projet supprimé part dans le sous-dossier <code>corbeille</code>.</p>
            ${fichier.dir && nomsProjets.size ? `<div class="store-liste">${[...nomsProjets.values()].sort().map(n => `<div>📄 ${esc(n)}</div>`).join("")}<div class="muted">📄 ${COMMUN}</div></div>` : ""}
            <div class="row">
              <button class="btn" data-act="fs-dossier">${fichier.dir ? "Changer de dossier" : fichier.handle ? "Répartir mes projets dans un dossier" : "Choisir un dossier"}</button>
              <button class="btn ghost" data-act="fs-ajout-projet">📥 Ajouter un projet</button>
              ${fichier.dir?.serveur ? "" : `<button class="btn ghost" data-act="fs-serveur">🖥️ Utiliser le dossier de l'appli</button>`}
            </div>
            ${fichier.handle ? `<p class="muted" style="font-size:.84rem;margin:8px 0 0">Ton fichier actuel <b>${nom}</b> ne sera pas modifié : il servira de sauvegarde.</p>` : ""}
          </div>` : ""}
          <details class="store-ancien" ${fichier.handle ? "open" : ""}><summary>📄 Tout dans un seul fichier (ancien mode)</summary>
            <p class="muted">Tous les projets dans un même fichier <code>.json</code>.</p>
            <div class="row"><button class="btn ghost small" data-act="fs-create">Créer un fichier de données</button><button class="btn ghost small" data-act="fs-open">Ouvrir un fichier de données</button></div>
          </details>`
        : `<div class="panel store-choix actif"><h3>🖥️ Dossier de l'appli</h3><p class="muted">Dans ce navigateur, c'est le petit serveur local qui enregistre tes données, un fichier par projet. Pour ajouter un projet reçu d'un collègue :</p><div class="row"><button class="btn ghost" data-act="fs-ajout-projet">📥 Ajouter un projet</button></div></div>`}
        <div class="panel" style="box-shadow:none;background:#f6f5fb">
          <h3>🧳 Copies et partage</h3>
          <p class="muted">Télécharge une copie de toutes tes données, ou le fichier d'un seul projet pour l'envoyer à un collègue.</p>
          <div class="row">
            <button class="btn small ghost" data-act="export">⬇️ Copie de tous les projets</button>
            ${p ? `<button class="btn small ghost" data-act="fs-export-projet">📤 Fichier du projet « ${esc(tronque(p.nom, 28))} »</button>` : ""}
            <button class="btn small ghost" data-act="import">⬆️ Importer une copie</button>
          </div>
        </div>
      </div>`);
  }
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const today = () => new Date().toISOString().slice(0, 10);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const proj = () => S.projets.find(p => p.id === S.actif) || null;
  const findRisk = id => proj()?.risques.find(r => r.id === id);
  const crit = r => r.critForce || r.p * r.g;
  const niveau = c => c >= 9 ? "critique" : c >= 6 ? "eleve" : c >= 3 ? "modere" : "faible";
  const NIV_NOM = { faible: "Faible", modere: "Modéré", eleve: "Élevé", critique: "Critique" };
  const numero = r => proj().risques.indexOf(r) + 1;
  const fmtDate = d => d ? new Date(d + "T00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "";

  // ═══════════════ Projets
  function creerProjet(data) {
    const p = normaliserProjet({ id: uid(), creeLe: today(), risques: [], etapes: etapesDefaut("timeline"), ...data });
    S.projets.push(p); S.actif = p.id; save();
    return p;
  }
  const personne = id => S.annuaire.find(x => x.id === id);
  // monogramme du projet (thème Sobre, où les emojis sont retirés) : le code, sinon les initiales du nom
  const monoProjet = p => (p.code || (p.nom || "P").split(/[\s'’-]+/).filter(w => w.length > 2 || /^[A-Z0-9]/.test(w)).map(w => w[0]).join("")).toUpperCase().slice(0, 4) || "P";
  const fmtMontant = b => b && b.montant !== "" && b.montant != null ? `${new Intl.NumberFormat("fr-FR").format(+b.montant)} ${UNITES[b.unite] || ""}` : "";
  // Avancement calendaire : part du temps écoulé entre début et fin
  function avancementTemps(p) {
    if (!p.dateDebut || !p.dateFin || p.dateFin <= p.dateDebut) return null;
    const d0 = new Date(p.dateDebut), d1 = new Date(p.dateFin), t = new Date(today());
    const pct = Math.max(0, Math.min(1, (t - d0) / (d1 - d0)));
    return { pct, restants: Math.round((d1 - t) / 864e5), total: Math.round((d1 - d0) / 864e5) };
  }
  const statsRisques = p => {
    const ouverts = p.risques.filter(r => !CLOS.has(r.statut));
    const actions = p.risques.flatMap(r => r.actions.map(a => ({ a, r })));
    return { ouverts, critiques: ouverts.filter(r => crit(r) >= 6), retard: actionsToutes(p).filter(x => !x.a.fait && x.a.echeance && x.a.echeance < today()) };
  };
  const nomRole = (p, role) => p.interlocuteurs.filter(i => i.role === role).map(i => personne(i.personneId)?.nom).filter(Boolean).join(", ");

  function ajouterDepuisRef(refId) {
    const p = proj(); const ref = REF[refId];
    if (!p || !ref) return;
    const r = {
      id: uid(), refId, cat: ref.cat, titre: ref.titre, description: ref.description, impact: ref.impact,
      p: ref.p, g: ref.g, critForce: null, statut: "identifie", responsable: "", revue: "", notes: "",
      actions: [], initial: { p: ref.p, g: ref.g, c: ref.p * ref.g }, creeLe: today(),
      historique: [{ date: today(), p: ref.p, g: ref.g }],
    };
    p.risques.push(r); save();
    toast(`${CAT[ref.cat].emoji} « ${ref.titre} » ajouté au projet`);
    return r;
  }

  function ajouterProbleme() {
    const p = proj(); if (!p) return;
    const r = { id: uid(), refId: null, cat: "orga", titre: "", description: "", impact: "", p: 3, g: 2, critForce: null, statut: "survenu", avereLe: today(), imprevu: true,
      responsable: "", revue: "", notes: "", actions: [], initial: { p: 3, g: 2, c: 6 }, creeLe: today(), historique: [{ date: today(), p: 3, g: 2 }] };
    p.risques.push(r); save(); ouvrirRisque(r.id);
  }
  // Registre des problèmes : les risques avérés, ouverts puis résolus
  function vueProblemes() {
    const p = proj(); const t = today();
    const L = p.risques.filter(estProbleme); const ouverts = L.filter(r => !r.resoluLe).sort((a, b) => crit(b) - crit(a)); const resolus = L.filter(r => r.resoluLe).sort((a, b) => b.resoluLe.localeCompare(a.resoluLe));
    const carte = r => { const A = r.actions; const f = A.filter(x => x.fait).length; const retard = A.filter(x => !x.fait && x.echeance && x.echeance < t).length;
      return `<div class="pb-carte ${r.resoluLe ? "resolu" : ""}" data-act="open" data-id="${r.id}">
        <div class="pb-tete"><span class="pb-ico">${r.resoluLe ? "✅" : "💥"}</span><div style="flex:1;min-width:0"><b>${r.imprevu ? "" : `R${numero(r)} · `}${esc(r.titre || "Problème sans titre")}</b>
          <div class="muted" style="font-size:.8rem">${CAT[r.cat]?.emoji || ""} ${esc(CAT[r.cat]?.nom || "")} · ${r.imprevu ? "imprévu" : "risque avéré"}${r.avereLe ? ` le ${fmtJM(r.avereLe)}` : ""}${r.resoluLe ? ` · résolu le ${fmtJM(r.resoluLe)}` : r.avereLe ? ` · ouvert depuis ${diffJ(r.avereLe, t)} j` : ""}</div></div>
          <span class="pill ${crit(r) >= 6 ? "danger" : "warn"}">Gravité ${r.g}/3</span></div>
        ${r.impact ? `<div class="pb-impact">${esc(r.impact)}</div>` : ""}
        <div class="row" style="gap:10px;font-size:.82rem"><span>🛠️ Plan de résolution : ${A.length ? `${f}/${A.length} action(s)` : "aucune action"}</span>${retard ? `<span class="txt-danger">⏰ ${retard} en retard</span>` : ""}<span class="spacer"></span>${r.responsable ? `<span class="muted">👤 ${esc(r.responsable)}</span>` : ""}</div>
      </div>`; };
    return `
      <div class="toolbar"><h2 style="margin:0">⚠️ Problèmes</h2><span class="muted">risques avérés et problèmes imprévus</span><span class="spacer"></span><button class="btn small" data-act="pb-nouveau">＋ Problème</button></div>
      <div class="hf-tiles">
        <div class="${ouverts.length ? "danger" : ""}"><span>💥 Ouverts</span><b>${ouverts.length}</b><small>${ouverts.filter(r => crit(r) >= 6).length} grave(s)</small></div>
        <div><span>✅ Résolus</span><b>${resolus.length}</b><small>depuis le début du projet</small></div>
        <div><span>⏱️ Durée moyenne</span><b>${resolus.filter(r => r.avereLe).length ? Math.round(resolus.filter(r => r.avereLe).reduce((n, r) => n + diffJ(r.avereLe, r.resoluLe), 0) / resolus.filter(r => r.avereLe).length) + " j" : "—"}</b><small>pour résoudre un problème</small></div>
      </div>
      ${ouverts.length ? `<section class="panel" style="margin-bottom:14px"><h3>💥 À résoudre <span class="pill soft">${ouverts.length}</span></h3><div class="pb-grille">${ouverts.map(carte).join("")}</div></section>`
        : `<div class="empty"><span class="big">🌤️</span>Aucun problème ouvert. Quand un risque se produit, ouvrez-le et cochez « 💥 Risque avéré ». Un problème que personne n'avait prévu ? <span class="link" data-act="pb-nouveau">＋ Problème</span></div>`}
      ${resolus.length ? `<section class="panel"><h3>✅ Résolus <span class="pill soft">${resolus.length}</span></h3><div class="pb-grille">${resolus.map(carte).join("")}</div></section>` : ""}`;
  }
  function ajouterPerso() {
    const p = proj(); if (!p) return;
    const r = {
      id: uid(), refId: null, cat: "orga", titre: "", description: "", impact: "",
      p: 2, g: 2, critForce: null, statut: "identifie", responsable: "", revue: "", notes: "",
      actions: [], initial: { p: 2, g: 2, c: 4 }, creeLe: today(), historique: [{ date: today(), p: 2, g: 2 }],
    };
    p.risques.push(r); save();
    ouvrirRisque(r.id);
  }

  function supprimerRisque(id) {
    const p = proj(); const r = findRisk(id); if (!r) return;
    if (r.actions.length && !confirm(`Supprimer « ${r.titre || "ce risque"} » et ses ${r.actions.length} action(s) ?`)) return false;
    p.risques = p.risques.filter(x => x.id !== id); save();
    toast("🗑️ Risque retiré du projet");
    return true;
  }

  function setPG(r, p, g) {
    if (r.p === p && r.g === g) return;
    r.p = p; r.g = g;
    r.historique = r.historique || [];
    const last = r.historique[r.historique.length - 1];
    if (last && last.date === today()) { last.p = p; last.g = g; } else r.historique.push({ date: today(), p, g });
    save();
  }

  // ═══════════════ Rendu global
  function render() {
    if (ui.module === "cr") { ui.module = "instances"; ui.vueInst = "reunions"; } // ancien onglet mémorisé
    try { syncTheme(); } catch (e) {} // (au tout premier affichage, le module des thèmes n'est pas encore chargé)
    renderProjectBar();
    renderTabs();
    try { renderEtapes(); } catch (e) { console.error(e); }
    const main = $("#main");
    if (!connecte()) { main.innerHTML = vueConnexion(); return; }
    const banniere = DEMO_MODE ? `<div class="demo-banner" role="note"><b>Vitrine en lecture seule</b><span>Explore les deux projets de démonstration. Les changements sont désactivés et rien n'est enregistré.</span></div>` : fichier.etat === "erreur" ? `<div class="store-banner">⚠️ Le dernier enregistrement dans ${fichier.dir ? "ton dossier" : "ton fichier"} <b>${nomSupport()}</b> a échoué. <button class="btn small" data-act="stockage">Voir mes données</button></div>` : fichier.etat === "attente" ? `<div class="store-banner">🔒 ${fichier.dir ? "Ton dossier" : "Ton fichier"} de données <b>${nomSupport()}</b> est prêt, mais le navigateur demande ton accord pour y accéder. <button class="btn small" data-act="fs-reconnect">🔓 Autoriser l'accès</button></div>` : "";
    remplirListePersonnes();
    if (!DEMO_MODE && proj()?.planning) { etendre(proj()); if (syncTaches(proj())) save(); }
    try { if (!DEMO_MODE && proj() && photoSemaine(proj())) save(); } catch (e) { console.error(e); }
    if (ui.ecran === "annuaire") { main.innerHTML = banniere + vueAnnuaire(); return; }
    if (ui.ecran === "reglages") { main.innerHTML = banniere + vueReglages(); return; }
    if (!S.projets.length) { main.innerHTML = banniere + vueBienvenue(); return; }
    if (ui.ecran === "portefeuille" || !proj()) { main.innerHTML = banniere + vuePortefeuille(); return; }
    if (ui.module === "risques") {
      const fn = { dashboard: vueDashboard, catalogue: vueCatalogue, registre: vueRegistre, matrice: vueMatrice, problemes: vueProblemes, actions: vueActions, copil: vueCopil }[ui.vue] || vueDashboard;
      main.innerHTML = banniere + fn();
      if (ui.vue === "catalogue") { renderCatList(); initChips(); }
      return;
    }
    const fn = { cockpit: () => ui.vueCk === "flash" ? vueFlash() : ui.vueCk === "tendances" ? vueTendances(proj()) : vueCockpit(), livrables: vueLivrables, retex: vueRetex, identite: vuePartiesPrenantes, cr: vueModuleCR, planif: vuePlanif, instances: vueInstances, decisions: vueDecisionsModule, budget: vueBudget, parties: vuePartiesPrenantes, backlog: vueBacklog }[moduleActif(proj(), ui.module) ? ui.module : "cockpit"] || vueAVenir;
    main.innerHTML = banniere + fn();
    if (ui.module === "planif" && ui.vuePlanif === "frise" && ui.allerAujourdhui) {
      ui.allerAujourdhui = false;
      requestAnimationFrame(() => $("#friseToday")?.scrollIntoView({ block: "center" }));
    }
  }

  // Liste de noms proposée dans les champs « responsable » / « propriétaire »
  function remplirListePersonnes() {
    const p = proj();
    const ids = p ? p.interlocuteurs.map(i => i.personneId) : [];
    const noms = [...new Set([...ids.map(id => personne(id)?.nom), ...S.annuaire.map(x => x.nom)].filter(Boolean))];
    $("#dlPersonnes").innerHTML = noms.map(n => `<option value="${esc(n)}">`).join("");
  }

  function allerA(ecran, module) {
    document.body.classList.remove("capture");
    if (module === "cr") { module = "instances"; ui.vueInst = "reunions"; ui.crSel = null; } // ancien onglet Réunions & CR
    ui.ecran = ecran; if (module) ui.module = module; ui.surligne = null;
    if (module === "planif") { ui.allerAujourdhui = true; ui.choixOuvert = false; }
    if (module === "identite") { ui.vuePP = "fiche"; ui.ficheMode = "lecture"; }
    if (module === "livrables") ui.livVue = "liste";
    if (module === "cockpit") ui.vueCk = "synthese";
    if (module === "instances" && ui.vueInst === "gonogo") ui.vueInst = "reunions";
    if (!DEMO_MODE) try { localStorage.setItem(KEY + "-module", ui.module); } catch (_) {}
    render(); window.scrollTo(0, 0);
  }

  function renderProjectBar() {
    const bar = $("#projectBar");
    if (DEMO_MODE) {
      const enProjet = ui.ecran === "projet" && proj();
      const opts = (enProjet ? "" : `<option value="" selected>Choisir un projet…</option>`) + S.projets.map(p => `<option value="${p.id}" ${enProjet && p.id === S.actif ? "selected" : ""}>${esc(p.emoji)} ${esc(p.nom)}</option>`).join("");
      bar.innerHTML = `${S.projets.length ? `<button class="btn light ${ui.ecran === "portefeuille" ? "on" : ""}" data-act="portefeuille">🗂️ Projets de démonstration</button><select class="project-select" id="projSel" aria-label="Projet affiché">${opts}</select>` : ""}<a class="btn light icon" href="manuel/" target="_blank" rel="noopener" title="Ouvrir le manuel utilisateur">❓</a>`;
      return;
    }
    if (!connecte()) { bar.innerHTML = ""; return; }
    const enProjet = ui.ecran === "projet" && proj();
    const opts = (enProjet ? "" : `<option value="" selected>Choisir un projet…</option>`) + S.projets.map(p => `<option value="${p.id}" ${enProjet && p.id === S.actif ? "selected" : ""}>${esc(p.emoji)} ${esc(p.nom)}</option>`).join("");
    bar.innerHTML = `
      ${S.projets.length ? `<button class="btn light ${ui.ecran === "portefeuille" ? "on" : ""}" data-act="portefeuille" title="Tous mes projets">🗂️ Portefeuille</button>
        <select class="project-select" id="projSel" aria-label="Projet affiché">${opts}</select>` : ""}
      ${S.projets.length ? (() => { const n = nbAFaire(); return `<button class="btn light ${n ? "aj-on" : ""}" data-act="aujourdhui" title="Ce qui t'attend aujourd'hui, sur tous tes projets">📌 À faire aujourd'hui${n ? `<span class="aj-badge">${n}</span>` : ""}</button>`; })() : ""}
      <a class="btn light icon" href="manuel/" target="_blank" rel="noopener" title="Aide : le manuel utilisateur, pas à pas (s'ouvre dans un nouvel onglet)">❓</a>
      <button class="btn light icon ${ui.ecran === "reglages" || ui.ecran === "annuaire" ? "on" : ""}" data-act="reglages" title="Réglages : mes données, annuaire, jours fériés et fermetures">⚙️</button>
      <button class="btn light" data-act="new-projet">➕ Projet</button>
      `;
  }

  function indicateurStockage() {
    const nom = nomSupport();
    const [ic, txt, cls] = {
      ok: [fichier.dir ? "📁" : "📄", nom + " ✓", ""],
      ecriture: ["⏳", nom, ""],
      attente: ["🔒", "Reconnecter " + nom, "warn"],
      erreur: ["⚠️", "Erreur fichier", "warn"],
      aucun: ["📁", "Choisir un dossier", "warn"],
    }[fichier.etat];
    return `<button class="btn light store-btn ${cls}" data-act="stockage" title="Où sont mes données ?">${ic} <span class="store-txt">${txt}</span></button>`;
  }

  const sousOnglet = (on, act, id, emoji, nom, extra = "") => `<button class="subtab ${on ? "active" : ""}" data-act="${act}" data-id="${id}"><span>${emoji}</span>${nom}${extra}</button>`;
  function renderTabs() {
    const p = proj();
    if (connecte() && ui.ecran === "annuaire") {
      $("#tabs").innerHTML = "";
      $("#subtabs").innerHTML = sousOnglet(ui.annuVue !== "charge", "pp-annu", "liste", "👥", "Liste des personnes") + sousOnglet(ui.annuVue === "charge", "pp-annu", "charge", "📊", "Charge tous projets");
      return;
    }
    if (connecte() && S.projets.length && ui.ecran !== "reglages" && (ui.ecran === "portefeuille" || !p)) {
      $("#tabs").innerHTML = "";
      $("#subtabs").innerHTML = [["cartes", "▦", "Cartes"], ["frise", "▬", "Frise"], ["rapport", "📊", "Rapport"]].map(([id, e, n]) => sousOnglet(ui.pfVue === id || (id === "cartes" && !["frise", "rapport"].includes(ui.pfVue)), "pf-vue", id, e, n)).join("");
      return;
    }
    if (!p || ui.ecran !== "projet" || !connecte()) { $("#tabs").innerHTML = ""; $("#subtabs").innerHTML = ""; return; }
    const st = statsRisques(p);
    const tl = enTimeline(p); const ev = tl ? etapeVue(p) : null; const permis = tl && !ui.toutesPages ? modulesEtape(p, ev) : null;
    if (permis) permis.add(ui.module);
    $("#tabs").innerHTML = (ev ? `<span class="tabs-etape" title="Pages de l'étape « ${esc(ev.nom)} »">${ev.emoji} ${esc(ev.court)}</span>` : "") + MODULES.filter(m => moduleActif(p, m.id) && (!permis || permis.has(m.id))).map(m => `
      <button class="tab ${ui.module === m.id ? "active" : ""}" data-act="module" data-id="${m.id}">
        <span>${m.emoji}</span>${m.nom}${m.id === "risques" && st.ouverts.length ? `<span class="count">${st.ouverts.length}</span>` : ""}${m.bientot ? `<span class="soon">bientôt</span>` : ""}
      </button>`).join("") + (ev ? `<button class="tab tab-toutes" data-act="et-toutes">${ui.toutesPages ? "▴ Pages de l'étape" : "Toutes les pages ▾"}</button>` : "");
    if (ui.module === "retex") {
      $("#subtabs").innerHTML = sousOnglet(ui.retexVue !== "biblio", "rx-vue", "atelier", "🎓", "Ce projet") + sousOnglet(ui.retexVue === "biblio", "rx-vue", "biblio", "📚", "Bibliothèque tous projets");
      return;
    }
    if (ui.module === "cockpit") {
      $("#subtabs").innerHTML = VUES_CK.map(v => `
        <button class="subtab ${ui.vueCk === v.id ? "active" : ""}" data-act="ck-vue" data-id="${v.id}"><span>${v.emoji}</span>${v.nom}</button>`).join("");
      return;
    }
    if (ui.module === "identite") {
      $("#subtabs").innerHTML = VUES_PP.filter(v => !v.opt || opt(p, v.opt)).map(v => `
        <button class="subtab ${ui.vuePP === v.id ? "active" : ""}" data-act="pp-vue" data-id="${v.id}"><span>${v.emoji}</span>${v.nom}</button>`).join("");
      return;
    }
    if (ui.module === "decisions") {
      const nbAtt = p.decisions.filter(d => d.statut === "attente").length + copilsAStatuer(p).length;
      $("#subtabs").innerHTML = VUES_DEC.map(v => `
        <button class="subtab ${ui.vueDec === v.id ? "active" : ""}" data-act="dc-vue" data-id="${v.id}"><span>${v.emoji}</span>${v.nom}${v.id === "decisions" && nbAtt ? `<span class="count">${nbAtt}</span>` : ""}${v.id === "changements" && chgOuverts(p).length ? `<span class="count">${chgOuverts(p).length}</span>` : ""}</button>`).join("");
      return;
    }
    if (ui.module === "livrables") {
      $("#subtabs").innerHTML = VUES_LIV.map(v => sousOnglet(ui.livVue === v.id, "lv-vue", v.id, v.emoji, v.nom, v.id === "templates" ? `<span class="count">${TEMPLATES.length + modelesDe().length}</span>` : "")).join("");
      return;
    }
    if (ui.module === "instances") {
      $("#subtabs").innerHTML = VUES_INST.filter(v => v.id === "reunions" || p.planning?.methode).map(v => `
        <button class="subtab ${ui.vueInst === v.id ? "active" : ""}" data-act="in-vue" data-id="${v.id}"><span>${v.emoji}</span>${v.nom}</button>`).join("");
      return;
    }
    if (ui.module === "planif" && p.planning?.methode && !ui.choixOuvert) {
      $("#subtabs").innerHTML = VUES_PLANIF.filter(v => !v.sprints || p.planning.sprints.length).map(v => `
        <button class="subtab ${ui.vuePlanif === v.id ? "active" : ""}" data-act="pl-vue" data-id="${v.id}"><span>${v.emoji}</span>${v.nom}</button>`).join("");
      return;
    }
    if (ui.module !== "risques") { $("#subtabs").innerHTML = ""; return; }
    const nbActions = p.risques.reduce((n, r) => n + r.actions.filter(a => !a.fait).length, 0);
    const counts = { registre: st.ouverts.length, actions: nbActions, problemes: problemesOuverts(p).length || null };
    $("#subtabs").innerHTML = VUES.map(v => `
      <button class="subtab ${ui.vue === v.id ? "active" : ""}" data-act="vue" data-id="${v.id}">
        <span>${v.emoji}</span>${v.nom}${counts[v.id] != null ? `<span class="count">${counts[v.id]}</span>` : ""}
      </button>`).join("");
  }

  // ═══════════════ Vue : Bienvenue
  function vueBienvenue() {
    return `<div class="welcome">
      <span class="hero">🧭</span>
      <h1>Bienvenue dans ton Cockpit Projet</h1>
      <p class="muted">La fiche d'identité, les risques, et bientôt la planification et les copils de tes projets, au même endroit.</p>
      <div class="steps">
        <div class="step"><div class="n">1️⃣</div><b>Crée un projet</b><p class="muted">Nom, dates, budget, enjeu.</p></div>
        <div class="step"><div class="n">2️⃣</div><b>Ajoute les interlocuteurs</b><p class="muted">Depuis l'annuaire commun à tous tes projets.</p></div>
        <div class="step"><div class="n">3️⃣</div><b>Identifie les risques</b><p class="muted">Avec le catalogue de ${window.CATALOGUE.length} risques et la matrice 3×3.</p></div>
        <div class="step"><div class="n">4️⃣</div><b>Pilote depuis le cockpit</b><p class="muted">Tout ton projet en un coup d'œil.</p></div>
      </div>
      <button class="btn" style="font-size:1.2rem;padding:14px 26px" data-act="new-projet">🚀 Créer mon premier projet</button>
      <p class="muted" style="margin-top:14px">ou <span class="link" data-act="fs-ajout-projet">ajouter un projet (fichier .json)</span> · <span class="link" data-act="import">importer une copie de sauvegarde</span></p>
    </div>`;
  }

  // ═══════════════ Vue : Portefeuille (tous les projets)
  function vuePortefeuille() {
    const carte = p => {
      const st = statsRisques(p); const av = avancementTemps(p); const sponsor = nomRole(p, "Sponsor");
      return `<div class="pf-card" style="--c:${p.couleur}" data-act="ouvrir-projet" data-id="${p.id}" role="button" tabindex="0">
        <div class="row" style="flex-wrap:nowrap">
          <div class="project-emoji pf-emoji" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div>
          <div style="flex:1;min-width:0"><div class="pf-nom">${esc(p.nom)}</div>
            <div class="muted pf-sub">${p.code ? `<span class="code-pill">${esc(p.code)}</span>` : ""}${p.dateDebut ? `${fmtDate(p.dateDebut)} → ${p.dateFin ? fmtDate(p.dateFin) : "fin non fixée"}` : "Dates à préciser"}</div></div>
        </div>
        ${p.enjeu ? `<div class="pf-enjeu">${esc(p.enjeu)}</div>` : ""}
        ${enTimeline(p) ? (() => { const A = etapesActives(p); const e = etapeCourante(p); const r = rangCourant(p, A); const ret = r < A.length ? retardEtape(p, e) : 0; return `<div><div class="row pf-mini"><span>${r >= A.length ? "🏁 Projet clos" : `${e.emoji} Étape : <b>${esc(e.nom)}</b> (${r + 1}/${A.length})`}</span><span class="spacer"></span>${ret ? `<span class="txt-danger">⏰ +${ret} j</span>` : ""}</div>
          <div class="pf-etapes">${A.map((x, k) => `<span class="${k < r ? "fini" : k === r ? "cours" : ""}" title="${esc(x.nom)}"></span>`).join("")}</div></div>`; })() : ""}
        ${av ? `<div><div class="row pf-mini"><span>⏳ Temps écoulé</span><span class="spacer"></span><span>${Math.round(av.pct * 100)} %</span></div><div class="progress time"><div style="width:${av.pct * 100}%"></div></div></div>` : ""}
        <div class="row pf-mini">
          ${sponsor ? `<span>👤 Sponsor : ${esc(sponsor)}</span>` : ""}
          ${opt(p, "budget") && fmtMontant(p.budget) ? `<span>💶 ${fmtMontant(p.budget)}</span>` : ""}
          ${opt(p, "budget") && budgetDe(p).lignes.length ? (() => { const T = totauxBudget(p); return `<span class="${T.ecart > 0.005 ? "txt-danger" : ""}">💸 ${Math.round(T.conso * 100)} % consommé${T.ecart > 0.005 ? ` · dépassement ${fmtB(p, T.ecart)}` : ""}</span>`; })() : ""}
        </div>
        ${p.planning?.methode ? (() => { const spr = sprintEnCours(p.planning); const cop = prochainsPlanning(p).find(x => x.type === "copil"); return `<div class="row pf-mini">
          <span>${METHODES[p.planning.methode].emoji} ${METHODES[p.planning.methode].nom}${spr ? ` · sprint ${spr.num} en cours` : ""}</span>
          ${cop ? `<span>🏛️ Prochain copil : ${fmtJM(cop.d)}</span>` : ""}</div>`; })() : ""}
        <div class="row">
          <span class="pill soft">🎯 ${st.ouverts.length} risque(s) ouvert(s)</span>
          ${st.critiques.length ? `<span class="pill warn">${st.critiques.length} élevé(s) ou critique(s)</span>` : ""}
          ${st.retard.length ? `<span class="pill danger">⏰ ${st.retard.length} action(s) en retard</span>` : ""}
        </div>
      </div>`;
    };
    return `
      <div class="toolbar cp-tools"><h2 style="margin:0">🗂️ Portefeuille de projets</h2><span class="muted">${S.projets.length} projet(s)</span>

        <span class="spacer"></span>
        <button class="btn ghost" data-act="fs-ajout-projet" title="Ouvrir le fichier .json d'un projet envoyé par un collègue">📥 Ajouter un projet</button>
        <button class="btn" data-act="new-projet">🚀 Nouveau projet</button></div>
      ${ui.pfVue === "rapport" ? vueRapportPortefeuille() : ui.pfVue === "frise" ? vueFrisePortefeuille() : `<div class="pf-grid">${S.projets.map(carte).join("")}
        <button class="pf-card pf-new" data-act="new-projet"><span style="font-size:1.6rem">➕</span>Nouveau projet</button>
      </div>`}`;
  }

  // ═══════════════ Vue : Cockpit (vue d'ensemble d'un projet)
  function enteteProjet(p) {
    const av = avancementTemps(p);
    return `<div class="project-header">
      <div class="project-emoji" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div>
      <div style="flex:1;min-width:240px">
        <div class="row" style="gap:8px"><h2 style="margin:0">${esc(p.nom)}</h2>${p.code ? `<span class="code-pill">${esc(p.code)}</span>` : ""}</div>
        <div class="muted">${p.dateDebut ? `📅 ${fmtDate(p.dateDebut)} → ${p.dateFin ? `${fmtDate(p.dateFin)} <span class="pill soft">${p.finFerme ? "date ferme" : "date estimée"}</span>` : "fin non fixée"}` : "📅 Dates à préciser"}
          ${opt(p, "budget") && fmtMontant(p.budget) ? ` · 💶 ${fmtMontant(p.budget)}` : ""}
          ${av ? ` · ⏳ ${av.restants >= 0 ? `J-${av.restants}` : `échéance dépassée de ${-av.restants} j`}` : ""}</div>
      </div>
      <button class="btn ghost small" data-act="fiche-saisie">✏️ Modifier la fiche</button>
    </div>`;
  }

  function vueCockpit() {
    const p = proj(); const st = statsRisques(p); const av = avancementTemps(p);
    const t = today();
    const echeances = [
      ...p.risques.flatMap(r => r.actions.filter(a => !a.fait && a.echeance && a.echeance >= t).map(a => ({ d: a.echeance, ic: "🛠️", txt: a.texte || "Action sans libellé", sous: `R${numero(r)} · ${r.titre}`, id: r.id }))),
      ...p.risques.filter(r => !CLOS.has(r.statut) && r.revue && r.revue >= t).map(r => ({ d: r.revue, ic: "🔁", txt: `Revue du risque R${numero(r)}`, sous: r.titre, id: r.id })),
      ...prochainsPlanning(p),
      ...actionsToutes(p).filter(x => !x.r && !x.a.fait && x.a.echeance && x.a.echeance >= t).map(x => ({ d: x.a.echeance, ic: "✅", txt: x.a.texte, sous: x.lib, action: x.a.id })),
    ].sort((a, b) => a.d.localeCompare(b.d)).slice(0, 7);
    const pl = p.planning; const spr = sprintEnCours(pl);
    const jalonSuivant = pl?.methode ? pl.jalons.filter(j => j.date && !j.atteint && j.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0] : null;
    const cles = ["Sponsor", "Directeur de projet", "Chef de projet", "Product Owner", "Scrum Master"].map(role => ({ role, n: nomRole(p, role) })).filter(x => x.n);
    const tuile = m => `<button class="brick ${m.bientot ? "soon-brick" : ""}" data-act="module" data-id="${m.id}"><span class="brick-ic">${m.emoji}</span><b>${m.nom}</b><span class="muted">${m.bientot ? "Bientôt disponible" : "Ouvrir"}</span></button>`;
    return `
      ${enteteProjet(p)}
      ${grilleTuiles(p, {
        avancement: `<div class="panel">
          <h3>⏳ Avancement calendaire</h3>
          ${av ? `<div class="av-tete"><b>${Math.round(av.pct * 100)} %</b><span>du temps écoulé</span><span class="spacer"></span><span class="av-reste ${av.restants < 0 ? "txt-danger" : ""}" title="${av.restants >= 0 ? `${av.restants} jours restants sur ${av.total}` : `date de fin dépassée de ${-av.restants} jours`}">${av.restants >= 0 ? `J-${av.restants}` : `+${-av.restants} j`}</span></div>
            <div class="progress time big"><div style="width:${av.pct * 100}%"></div></div>
            <div class="av-bornes"><span>${fmtDate(p.dateDebut)}</span><span>${fmtDate(p.dateFin)}</span></div>`
            : `<p class="muted">${p.dateFin ? "Vérifie les dates : la fin doit être après le début." : "Renseigne une date de fin pour suivre l'avancement calendaire."}</p>`}
          ${pl?.methode ? (() => {
            const L = [];
            const ligne = (lib, val, sous, attrs = "") => L.push(`<div class="av-ligne ${attrs ? "clic" : ""}" ${attrs}><span class="av-lib">${lib}</span><span class="av-val"><b>${val}</b>${sous ? `<small>${sous}</small>` : ""}</span></div>`);
            { const AR = avancementReel(p); if (AR) ligne("Avancement réel", `${Math.round(AR.reel * 100)} %`, `prévu ${Math.round(AR.prevu * 100)} % · ${libEcartAv(AR)}`, `data-act="pl-vue" data-id="jalons" data-module="planif"`); }
            if (spr) { const ouvres = d => diffJ(spr.debut, d) - Math.floor(diffJ(spr.debut, d) / 7) * 2 + 1; ligne("Sprint en cours", `Sprint ${spr.num}`, `jour ${ouvres(t)} sur ${ouvres(spr.fin)}`); }
            if (jalonSuivant) { const g = glissement(jalonSuivant); ligne("Prochain jalon", esc(jalonSuivant.nom), `${fmtDate(jalonSuivant.date)}${g ? ` · <span class="${g > 0 ? "txt-danger" : "txt-ok"}">${g > 0 ? "+" : ""}${g} j</span>` : ""}`, `data-act="module" data-id="planif"`); }
            const A = analyseBacklog(p);
            if (A) ligne("Backlog", `${Math.round(A.pct * 100)} % terminé`, A.dateFinEstimee ? `fin estimée le ${fmtDate(A.dateFinEstimee)}` : "", `data-act="module" data-id="backlog"`);
            const j = jalonMEP(p);
            if (j && !j.atteint && (p.gonogo || (j.date >= t && j.date <= addJ(t, 45)))) { const E = evalGoNoGo(p); const V = p.gonogo.verdict ? VERDICTS_GNG[p.gonogo.verdict.v] : null; ligne("Go / No-Go", V ? `${V.emoji} ${V.nom}` : E.reco.lib, V ? `décidé le ${fmtDate(p.gonogo.verdict.date)}` : `${E.ok.length} critères remplis sur ${E.C.length}`, `data-act="pl-vue" data-id="gonogo" data-module="planif"`); }
            return `<div class="av-liste">${L.join("")}</div><span class="link" data-act="module" data-id="planif">Voir la frise →</span>`;
          })()
          : `<p class="muted" style="font-size:.85rem;margin:10px 0 0">🗓️ <span class="link" data-act="module" data-id="planif">Mettre en place la planification</span> (méthode, sprints, jalons, copils).</p>`}
        </div>`,
        risques: `<div class="panel">
          <div class="row" style="margin-bottom:8px"><h3 style="margin:0">🎯 Risques</h3><span class="spacer"></span><span class="link" data-act="module" data-id="risques">Ouvrir le radar →</span></div>
          <div class="mini-kpis">
            <div><b>${st.ouverts.length}</b><span>ouverts</span></div>
            <div class="${st.critiques.length ? "warn" : ""}"><b>${st.critiques.length}</b><span>élevés ou critiques</span></div>
            <div class="${st.retard.length ? "danger" : ""}"><b>${st.retard.length}</b><span>actions en retard</span></div>
          </div>
          ${st.ouverts.length ? miniMatrice(st.ouverts) : `<p class="muted">Aucun risque ouvert. <span class="link" data-act="vue-risques" data-id="catalogue">Ouvrir le catalogue</span></p>`}
        </div>`,
        echeances: `<div class="panel">
          <h3>📅 Prochaines échéances</h3>
          ${echeances.length ? echeances.map(e => `<div class="top-item" ${e.action ? `data-act="dc-edit" data-id="${e.action}"` : e.planif ? `data-act="pl-open" data-k="${e.planif}" data-id="${e.id}"` : `data-act="open" data-id="${e.id}"`}><span class="date-chip">${fmtDate(e.d).replace(/ \d{4}$/, "")}</span><div style="flex:1"><b>${e.ic} ${esc(e.txt)}</b><div class="muted" style="font-size:.82rem">${esc(e.sous)}</div></div></div>`).join("")
            : `<p class="muted">Aucune échéance à venir.</p>`}
        </div>`,
        meteo: `<div class="panel">${panneauMeteo(p)}</div>`,
        decisions: `<div class="panel">
          ${(() => { const A = actionsToutes(p); const ouv = A.filter(x => !x.a.fait); const ret = ouv.filter(x => x.a.echeance && x.a.echeance < t); const att = p.decisions.filter(d => d.statut === "attente").length + copilsAStatuer(p).length;
            const der = p.decisions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
            return `<div class="row" style="margin-bottom:8px"><h3 style="margin:0">📒 Décisions & actions</h3><span class="spacer"></span><span class="link" data-act="module" data-id="decisions">Ouvrir →</span></div>
            <div class="mini-kpis"><div><b>${ouv.length}</b><span>actions ouvertes</span></div><div class="${ret.length ? "danger" : ""}"><b>${ret.length}</b><span>en retard</span></div><div class="${att ? "warn" : ""}"><b>${att}</b><span>décision(s) à statuer</span></div></div>
            ${chgOuverts(p).length ? `<div class="kv clic" data-act="dc-vue" data-id="changements" data-module="decisions"><span>🔄 ${chgOuverts(p).length} demande(s) de changement à traiter</span><span class="link">Voir →</span></div>` : ""}
            ${der.length ? der.map(d => `<div class="kv clic" data-act="dc-edit-dec" data-id="${d.id}"><span>${STATUTS_DEC[d.statut].emoji} ${esc(tronque(d.titre, 44))}</span><span class="muted">${fmtJM(d.date)}</span></div>`).join("") : `<p class="muted" style="margin:0">Aucune décision enregistrée.</p>`}`; })()}
        </div>`,
        interlocuteurs: `<div class="panel">
          <div class="row" style="margin-bottom:8px"><h3 style="margin:0">👥 Interlocuteurs clés</h3><span class="spacer"></span><span class="link" data-act="module" data-id="identite">Gérer →</span></div>
          ${cles.length ? cles.map(c => `<div class="kv"><span class="muted">${c.role}</span><b>${esc(c.n)}</b></div>`).join("") : `<p class="muted">Aucun interlocuteur clé. <span class="link" data-act="module" data-id="identite">En ajouter</span></p>`}
          ${p.interlocuteurs.length ? `<p class="muted" style="font-size:.82rem;margin:8px 0 0">${p.interlocuteurs.length} interlocuteur(s) au total · ${p.interlocuteurs.filter(i => i.copil).length} invité(s) au copil</p>` : ""}
        </div>`
      })}
      <h3 style="margin:26px 0 10px">🧩 Briques du cockpit</h3>
      <div class="bricks">${MODULES.filter(m => m.id !== "cockpit" && moduleActif(p, m.id)).map(tuile).join("")}</div>`;
  }

  function vueAVenir() {
    const m = MODULES.find(x => x.id === ui.module);
    return `${enteteProjet(proj())}<div class="empty" style="text-align:left;max-width:720px;margin:0 auto">
      <span class="big" style="text-align:center">${m.emoji}</span>
      <h3 style="text-align:center">${m.nom} : brique en préparation</h3>
      <p class="muted" style="text-align:center">Voici ce qu'elle contiendra :</p>
      <ul>${(A_VENIR[m.id] || []).map(x => `<li>${x}</li>`).join("")}</ul>
    </div>`;
  }

  // ═══════════════ Vue : Fiche d'identité (saisie directe, enregistrement automatique)
  const champ = (p, k, label, opts = {}) => {
    const v = esc(p[k]);
    const input = opts.area ? `<textarea data-f="${k}" placeholder="${opts.ph || ""}" ${opts.rows ? `rows="${opts.rows}"` : ""}>${v}</textarea>`
      : `<input type="${opts.type || "text"}" data-f="${k}" value="${v}" placeholder="${opts.ph || ""}">`;
    return `<div class="field ${opts.cls || ""}"><label>${label}</label>${input}${opts.aide ? `<div class="aide">${opts.aide}</div>` : ""}</div>`;
  };

  function blocInterlocuteurs(p) {
    const dispo = S.annuaire.filter(x => !p.interlocuteurs.some(i => i.personneId === x.id)).sort((a, b) => a.nom.localeCompare(b.nom));
    const optsRoles = sel => ROLES.map(r => `<option ${r === sel ? "selected" : ""}>${r}</option>`).join("");
    return `
      ${p.interlocuteurs.length ? `<div class="int-table">
        <div class="int-row int-headrow"><span>Nom</span><span>Rôle sur le projet</span><span title="Invité au copil">Copil</span><span></span></div>
        ${p.interlocuteurs.map(i => { const x = personne(i.personneId) || { nom: "(personne supprimée)" }; return `
          <div class="int-row">
            <div><span class="link" style="font-size:.95rem" data-act="edit-personne" data-id="${i.personneId}">${esc(x.nom)}</span><div class="muted" style="font-size:.8rem">${[x.fonction, x.entite].filter(Boolean).map(esc).join(" · ")}</div></div>
            <select data-int-role="${i.id}">${optsRoles(i.role)}</select>
            <label class="copil-check" title="Invité au copil"><input type="checkbox" data-int-copil="${i.id}" ${i.copil ? "checked" : ""}></label>
            <button class="x-btn" data-act="retirer-int" data-id="${i.id}" title="Retirer du projet (reste dans l'annuaire)">✕</button>
          </div>`; }).join("")}
      </div>` : `<p class="muted">Aucun interlocuteur pour l'instant.</p>`}
      <div class="row int-add">
        ${dispo.length ? `<select id="intPers"><option value="">Choisir dans l'annuaire…</option>${dispo.map(x => `<option value="${x.id}">${esc(x.nom)}${x.entite ? " · " + esc(x.entite) : ""}</option>`).join("")}</select>
          <select id="intRole">${optsRoles("Équipe projet")}</select>
          <button class="btn small" data-act="ajout-int">＋ Ajouter</button><span class="muted">ou</span>` : ""}
        <button class="btn small ghost" data-act="nouvelle-personne-int">👤 Nouvelle personne</button>
      </div>`;
  }

  function vueIdentite() {
    const p = proj();
    if (ui.ficheMode !== "saisie") return vueIdentiteLecture(p);
    const dateKo = p.dateDebut && p.dateFin && p.dateFin < p.dateDebut;
    return `
      <div class="toolbar"><h2 style="margin:0">🪪 Fiche d'identité</h2>${basculeFiche()}<span class="muted">Chaque modification est enregistrée automatiquement</span><span class="spacer"></span><button class="btn small" data-act="fiche-mode" data-id="lecture">✓ Terminé</button></div>
      <div class="id-grid">
        <section class="panel">
          <h3>📌 L'essentiel</h3>
          <div class="two">${champ(p, "nom", "Nom du projet *", { ph: "Ex : Refonte du portail client" })}${champ(p, "code", "Code projet", { ph: "Ex : PRJ-2026-014" })}</div>
          <div class="field"><label>Emoji et couleur</label>
            <div class="row"><div class="emoji-pick">${EMOJIS.map(e => `<button data-act="set-emoji" data-id="${e}" class="${e === p.emoji ? "on" : ""}">${e}</button>`).join("")}</div></div>
            <div class="color-pick" style="margin-top:8px">${COLORS.map(c => `<button data-act="set-couleur" data-id="${c}" class="${c === p.couleur ? "on" : ""}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join("")}</div>
          </div>
          ${champ(p, "description", "Description / contexte", { area: true, ph: "De quoi s'agit-il ? Pour qui ?" })}
          ${champ(p, "enjeu", "Enjeu", { area: true, ph: "Pourquoi ce projet existe : gain attendu, risque si on ne le fait pas…" })}
          ${champ(p, "objectifs", "Objectifs mesurables", { area: true, ph: "Un objectif par ligne. Ex : réduire de 30 % le délai de traitement" })}
          <div class="two">${champ(p, "perimetreIn", "Dans le périmètre", { area: true, ph: "Ce qui est inclus" })}${champ(p, "perimetreOut", "Hors périmètre", { area: true, ph: "Ce qui est exclu" })}</div>
        </section>
        <div class="id-side">
          <section class="panel">
            <h3>📅 Calendrier</h3>
            <div class="two">${champ(p, "dateDebut", "Date de début *", { type: "date" })}${champ(p, "dateFin", "Date de fin", { type: "date", aide: "Facultative" })}</div>
            ${dateKo ? `<div class="alert">⚠️ La date de fin est avant la date de début.</div>` : ""}
            <div class="seg2" role="group" aria-label="Nature de la date de fin">
              <button class="${!p.finFerme ? "on" : ""}" data-act="fin-ferme" data-id="0">Date estimée</button>
              <button class="${p.finFerme ? "on" : ""}" data-act="fin-ferme" data-id="1">Date ferme (engagement)</button>
            </div>
          </section>
          <section class="panel">
            <h3>🧩 Modules optionnels</h3>
            <label class="type-row"><input type="checkbox" data-act="set-opt" data-id="budget" ${opt(p, "budget") ? "checked" : ""}><span>💶 Suivre le budget<div class="muted" style="font-size:.78rem">Onglet Budget, diapo budget du copil</div></span></label>
            <label class="type-row"><input type="checkbox" data-act="set-opt" data-id="charge" ${opt(p, "charge") ? "checked" : ""}><span>📊 Suivre la charge des parties prenantes<div class="muted" style="font-size:.78rem">Jours prévus par personne et par mois, alerte de surcharge tous projets</div></span></label>
            <div class="aide">Désactiver un module le masque sans effacer ses données.</div>
          </section>
          ${opt(p, "budget") ? `          <section class="panel">
            <h3>💶 Budget</h3>
            <div class="row" style="flex-wrap:nowrap">
              <input class="inp" type="number" min="0" step="any" data-budget="montant" value="${esc(p.budget.montant)}" placeholder="Montant" style="flex:1">
              <select class="inp" data-budget="unite">${Object.entries(UNITES).map(([k, v]) => `<option value="${k}" ${k === p.budget.unite ? "selected" : ""}>${v}</option>`).join("")}</select>
            </div>
            <div class="aide">Enveloppe accordée au projet. <span class="link" data-act="module" data-id="budget">Suivi détaillé (prévu, engagé, consommé) →</span></div>
          </section>` : ""}
          <section class="panel">
            <h3>📋 Outil de backlog</h3>
            <div class="row" style="flex-wrap:nowrap">
              <select class="inp" data-blf="outil" style="width:auto"><option value="">Outil…</option>${Object.entries(OUTILS_BL).map(([k, v]) => `<option value="${k}" ${backlogDe(p).outil === k ? "selected" : ""}>${v}</option>`).join("")}</select>
              <input class="inp" data-blf="url" value="${esc(backlogDe(p).url)}" placeholder="https://… (tableau ou backlog du projet)" style="flex:1">
              ${backlogDe(p).url ? `<a class="btn ghost icon small" href="${esc(backlogDe(p).url)}" target="_blank" rel="noopener" title="Ouvrir">↗</a>` : ""}
            </div>
            <div class="aide">Le backlog reste dans ${OUTILS_BL[backlogDe(p).outil] || "ton outil"}. <span class="link" data-act="module" data-id="backlog">Analyse du backlog (import CSV) →</span></div>
          </section>
          <section class="panel">
            <h3>🔗 Liens utiles</h3>
            ${p.liens.map(l => `<div class="lien-row"><input class="inp" data-lien="${l.id}" data-k="libelle" value="${esc(l.libelle)}" placeholder="Libellé (Jira, Confluence…)"><input class="inp" data-lien="${l.id}" data-k="url" value="${esc(l.url)}" placeholder="https://…">${l.url ? `<a class="btn ghost icon small" href="${esc(l.url)}" target="_blank" rel="noopener" title="Ouvrir">↗</a>` : ""}<button class="x-btn" data-act="suppr-lien" data-id="${l.id}" title="Supprimer">✕</button></div>`).join("")}
            <button class="btn small ghost" data-act="ajout-lien">＋ Ajouter un lien</button>
          </section>
        </div>
        ${blocEtapesFiche(p)}
        <section class="panel id-wide">
          <h3>👥 Interlocuteurs</h3>
          <p class="muted" style="margin-top:-4px;font-size:.88rem">Les personnes viennent de l'annuaire commun : saisies une fois, réutilisables dans tous tes projets.</p>
          ${blocInterlocuteurs(p)}
        </section>
        <section class="panel id-wide">
          <h3>🗒️ Notes</h3>
          <textarea class="inp" data-f="notes" data-capt="${p.id}" rows="5" placeholder="Contexte, historique, points d'attention… (tu peux y coller une capture d'écran)">${esc(p.notes)}</textarea>
          ${zoneCaptures(p)}
        </section>
      </div>`;
  }

  // ═══════════════ Vue : Annuaire commun
  function vueAnnuaire() { return ui.annuVue === "charge" ? vueChargeGlobale() : vueAnnuaireListe(); }
  function vueAnnuaireListe() {
    const q = ui.qAnnuaire.trim().toLowerCase();
    const liste = S.annuaire.filter(x => !q || [x.nom, x.fonction, x.entite, x.email].join(" ").toLowerCase().includes(q)).sort((a, b) => a.nom.localeCompare(b.nom));
    const projetsDe = id => S.projets.filter(p => p.interlocuteurs.some(i => i.personneId === id));
    return `
      <div class="toolbar"><button class="btn ghost small" data-act="reglages">← Réglages</button><h2 style="margin:0">👥 Annuaire</h2>${segAnnuaire()}<span class="muted">${S.annuaire.length} personne(s), communes à tous tes projets</span><span class="spacer"></span>
        <input class="search" id="searchAnnuaire" type="search" placeholder="🔎 Rechercher" value="${esc(ui.qAnnuaire)}" style="max-width:260px">
        <button class="btn" data-act="nouvelle-personne">👤 Ajouter une personne</button></div>
      ${S.annuaire.length === 0 ? `<div class="empty"><span class="big">👥</span>L'annuaire est vide. Ajoute les personnes avec qui tu travailles : tu les retrouveras dans tous tes projets.</div>`
        : `<div class="panel" style="padding:6px 0"><table class="annu">
          <thead><tr><th>Nom</th><th>Fonction</th><th>Entité</th><th>Contact</th><th>Projets</th><th></th></tr></thead>
          <tbody>${liste.map(x => `<tr>
            <td><span class="link" style="font-size:.95rem" data-act="edit-personne" data-id="${x.id}">${esc(x.nom)}</span></td>
            <td>${esc(x.fonction)}</td><td>${esc(x.entite)}</td>
            <td class="muted">${x.email ? `<a href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : ""}${x.email && x.tel ? "<br>" : ""}${esc(x.tel)}</td>
            <td>${projetsDe(x.id).map(p => `<span class="pill soft" title="${esc(p.nom)}">${esc(p.emoji)} ${esc(p.nom)}</span>`).join(" ")}</td>
            <td style="text-align:right"><button class="x-btn" data-act="suppr-personne" data-id="${x.id}" title="Supprimer de l'annuaire">✕</button></td>
          </tr>`).join("") || `<tr><td colspan="6" class="muted">Aucun résultat.</td></tr>`}</tbody></table></div>`}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Brique 2 : Planification
  // ═══════════════════════════════════════════════════════════════
  const METHODES = {
    agile:   { nom: "Agile", emoji: "🔄", desc: "Des sprints qui s'enchaînent, les cérémonies agiles et un copil tous les N sprints." },
    hybride: { nom: "Hybride", emoji: "🔀", desc: "Cadrage, recette et déploiement en phases ; la réalisation se fait en sprints." },
    v:       { nom: "Cycle en V", emoji: "📐", desc: "Des phases successives, un jalon à la fin de chaque phase et un copil à chaque jalon." },
  };
  const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const TYPES_REU = {
    lancement: { nom: "Réunion de lancement", emoji: "🚀", heure: "10:00", duree: 90, cat: "autre" },
    cadrage:   { nom: "Réunion de cadrage", emoji: "🧭", heure: "14:00", duree: 120, cat: "autre" },
    entretien: { nom: "Entretien utilisateur", emoji: "🎙️", heure: "10:00", duree: 60, cat: "autre" },
    avancement: { nom: "Point d'avancement (métier)", emoji: "🤝", heure: "11:00", duree: 45, cat: "autre" },
    planning:  { nom: "Planification de sprint", emoji: "🧩", heure: "09:30", duree: 120, cat: "agile", agile: true },
    affinage:  { nom: "Affinage du backlog", emoji: "🔍", heure: "10:00", duree: 60, cat: "agile", agile: true },
    revue:     { nom: "Revue de sprint", emoji: "🎬", heure: "14:00", duree: 60, cat: "agile", agile: true },
    retro:     { nom: "Rétrospective", emoji: "🔁", heure: "15:30", duree: 60, cat: "agile", agile: true },
    copil:     { nom: "Copil", emoji: "🏛️", heure: "14:00", duree: 90, cat: "copil" },
    cloture:   { nom: "Bilan de clôture", emoji: "🏁", heure: "14:00", duree: 90, cat: "autre" },
    libre:     { nom: "Réunion", emoji: "📌", heure: "10:00", duree: 60, cat: "autre", manuel: true },
  };
  // [nom de la phase, durée en semaines, jalon de fin de phase, phase en sprints]
  const MODELES_PHASES = {
    v: [["Cadrage", 4, "Fin de cadrage"], ["Spécifications", 6, "Spécifications validées"], ["Conception", 4, "Conception validée"], ["Réalisation", 12, "Fin de réalisation"], ["Tests", 4, "Fin des tests"], ["Recette", 4, "Recette validée (VABF)"], ["Déploiement", 2, "Mise en production"]],
    hybride: [["Cadrage", 4, "Fin de cadrage"], ["Réalisation (sprints)", 20, "Fin de réalisation", true], ["Recette globale", 4, "Recette validée"], ["Déploiement", 2, "Mise en production"]],
    agile: [],
  };
  const VUES_PLANIF = [
    { id: "frise", nom: "Frise", emoji: "📍" },
    { id: "gonogo", nom: "Go / No-Go", emoji: "🚦" },
    { id: "sprints", nom: "Sprints", emoji: "🏃", sprints: true },
    { id: "parametres", nom: "Paramètres", emoji: "⚙️" },
    { id: "reunions", nom: "Réunions", emoji: "🗓️" },
    { id: "jalons", nom: "Jalons & phases", emoji: "🏁" },
    { id: "taches", nom: "Tâches de préparation", emoji: "✅" },
  ];
  Object.assign(ui, { vuePlanif: "frise", choixMethode: "agile", choixDuree: 2, choixOuvert: false, reuPassees: false, allerAujourdhui: true,
    friseFiltres: { structure: true, jalons: true, copil: true, agile: true, autre: true, annulees: false, passe: true, feries: true } });

  // Dates « AAAA-MM-JJ » calculées sans fuseau horaire
  const dJ = s => new Date(s + "T00:00:00Z");
  const sJ = d => d.toISOString().slice(0, 10);
  const addJ = (s, n) => { const d = dJ(s); d.setUTCDate(d.getUTCDate() + n); return sJ(d); };
  const jSem = s => dJ(s).getUTCDay();
  const diffJ = (a, b) => Math.round((dJ(b) - dJ(a)) / 864e5);
  const prochainJour = (s, j) => addJ(s, (j - jSem(s) + 7) % 7);
  // Jours ouvrés : ni week-end, ni jour férié, ni fermeture (voir « Jours fériés et fermetures »)
  const ouvre = s => { let d = s, n = 0; while (nonOuvre(d) && n++ < 120) d = addJ(d, 1); return d; };
  const ouvreAvant = s => { let d = s, n = 0; while (nonOuvre(d) && n++ < 120) d = addJ(d, -1); return d; };
  const addOuvres = (s, n) => { let d = s, k = 0; while (n > 0 && k++ < 400) { d = addJ(d, 1); if (!nonOuvre(d)) n--; } return d; };
  const finSprint = (debut, sem) => ouvreAvant(addJ(debut, sem * 7 - 1));
  const moisSuivant = m => { let [a, mo] = m.split("-").map(Number); mo++; if (mo > 12) { mo = 1; a++; } return `${a}-${String(mo).padStart(2, "0")}`; };
  const nieme = (mois, rang, jour) => {
    if (rang === 5) { const fin = addJ(moisSuivant(mois) + "-01", -1); return addJ(fin, -((jSem(fin) - jour + 7) % 7)); }
    return addJ(prochainJour(mois + "-01", jour), 7 * (rang - 1));
  };
  const fmtCourt = d => d ? new Date(d + "T00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" }) : "";
  const fmtJM = d => d ? new Date(d + "T00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" }) : "";
  const fmtMois = m => new Date(m + "-01T00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const RANGS = { 1: "1er", 2: "2e", 3: "3e", 4: "4e", 5: "dernier" };

  // ─── Modèle
  function typesParDefaut(m) {
    const ag = m !== "v";
    return { lancement: { actif: true }, cadrage: { actif: true }, entretien: { actif: true, nombre: 3 }, avancement: { actif: true, tousLes: 2, jourSemaine: 4 },
      planning: { actif: ag }, affinage: { actif: ag }, revue: { actif: ag }, retro: { actif: ag },
      copil: { actif: true, regle: ag ? "sprints" : "jalons", tousLes: 2, rang: 1, jourSemaine: 2 }, cloture: { actif: true } };
  }
  function initPlanning(p, methode, duree) {
    const ancien = p.planning;
    const debut = p.dateDebut || today();
    const mod = MODELES_PHASES[methode];
    const tot = mod.reduce((n, x) => n + x[1] * 7, 0);
    const dispo = p.dateFin && p.dateFin > debut ? diffJ(debut, p.dateFin) + 1 : null;
    const phases = mod.map(([nom, sem, , sprints]) => ({ id: uid(), nom, jours: dispo ? Math.max(1, Math.round(dispo * sem * 7 / tot)) : sem * 7, sprints: !!sprints, verrou: false }));
    if (dispo && phases.length) { const autres = phases.slice(0, -1).reduce((n, x) => n + x.jours, 0); phases[phases.length - 1].jours = Math.max(1, dispo - autres); }
    const jalon = (nom, ancre) => ({ id: uid(), nom, ancre, date: "", dateInitiale: "", frise: true, atteint: false, verrou: false, notes: "" });
    const jalons = mod.map(([, , jn], i) => jalon(jn, "phase:" + phases[i].id));
    if (methode === "agile") jalons.push(jalon("Mise en production", "fin"));
    p.planning = { methode, sprint: { duree, jour: 1, avance: 6 }, types: typesParDefaut(methode), phases, sprints: [], jalons,
      reunions: (ancien?.reunions || []).filter(r => !r.auto), base: null };
    genererPlanning(p, p.planning);
  }
  const horizon = (p, pl) => p.dateFin || pl.sprints[pl.sprints.length - 1]?.fin || pl.phases[pl.phases.length - 1]?.fin || addJ(p.dateDebut || today(), 182);

  // ─── Calcul : seules les dates NON verrouillées sont recalculées
  // complète les réglages d'un planning créé avant l'ajout de nouveaux types de réunion
  function typesComplets(pl) {
    const def = { cadrage: { actif: false }, entretien: { actif: false, nombre: 3 }, avancement: { actif: false, tousLes: 2, jourSemaine: 4 } };
    pl.types = pl.types || {};
    for (const [k, v] of Object.entries(def)) { if (!pl.types[k]) pl.types[k] = { ...v }; else pl.types[k] = { ...v, ...pl.types[k] }; }
    return pl.types;
  }
  function genererPlanning(p, pl) {
    typesComplets(pl);
    const t = today(); const debutP = p.dateDebut || t;
    // 1. Phases enchaînées
    let cur = debutP;
    pl.phases.forEach(ph => {
      if (!ph.verrou) { ph.debut = cur; ph.fin = addJ(cur, Math.max(1, ph.jours) - 1); }
      cur = addJ(ph.fin, 1);
    });
    pl.phases.forEach(ph => { if (!ph.finInitiale) { ph.debutInitial = ph.debut; ph.finInitiale = ph.fin; } });
    // 2. Sprints (Agile : tout le projet ; Hybride : la phase de réalisation)
    let zone = null;
    if (pl.methode === "agile") zone = { debut: debutP, fin: p.dateFin || null };
    else if (pl.methode === "hybride") { const r = pl.phases.find(x => x.sprints); if (r) zone = { debut: r.debut, fin: r.fin }; }
    if (zone) {
      const neuf = []; let d = prochainJour(zone.debut, pl.sprint.jour);
      for (let i = 0; i < 300; i++) {
        const s = pl.sprints[i] || { id: uid(), objectif: "", verrou: false, duree: null };
        s.num = i + 1;
        if (!s.verrou) { s.debut = d; s.fin = finSprint(d, s.duree || pl.sprint.duree); }
        if (!s.finInitiale) { s.debutInitial = s.debut; s.finInitiale = s.fin; }
        neuf.push(s);
        d = prochainJour(addJ(s.fin, 1), pl.sprint.jour);
        if (zone.fin) { if (finSprint(d, pl.sprint.duree) > zone.fin) break; } // aucun sprint ne dépasse la fin
        else if (neuf.filter(x => x.fin >= t).length >= pl.sprint.avance && neuf.length >= pl.sprints.length) break;
      }
      pl.sprints.slice(neuf.length).filter(s => s.verrou).forEach(s => { s.num = neuf.length + 1; neuf.push(s); });
      pl.sprints = neuf;
    } else pl.sprints = [];
    // 3. Jalons accrochés à une phase / au début / à la fin du projet
    pl.jalons.forEach(j => {
      if (j.verrou || !j.ancre) return;
      let d = null;
      if (j.ancre === "debut") d = debutP;
      else if (j.ancre === "fin") d = p.dateFin || null;
      else if (j.ancre.startsWith("phase:")) d = pl.phases.find(x => x.id === j.ancre.slice(6))?.fin || null;
      if (d) { j.date = ouvreAvant(d); if (!j.dateInitiale) j.dateInitiale = j.date; }
    });
    // 4. Réunions automatiques
    const voulues = new Map(); const T = pl.types;
    const add = (type, ref, date, motif) => { if (date) voulues.set(type + ":" + ref, { type, date: ouvre(date), motif }); };
    if (T.lancement.actif) add("lancement", "", debutP, "");
    // cadrage : l'après-midi du premier jour, après la réunion de lancement
    // un type activé en cours de projet ne crée pas de réunions dans le passé : il démarre au jour de son activation
    const depart = k => T[k]?.depuis && T[k].depuis > debutP ? T[k].depuis : debutP;
    if (T.cadrage?.actif && depart("cadrage") === debutP) add("cadrage", "", debutP, "");
    // entretiens utilisateurs : un par semaine à partir de la 1re semaine
    if (T.entretien?.actif) for (let i = 0; i < (T.entretien.nombre || 3); i++) add("entretien", "e" + (i + 1), addOuvres(depart("entretien"), 2 + 5 * i), `n°${i + 1}`);
    // points d'avancement avec le métier : toutes les N semaines, le jour choisi, jusqu'à la fin du projet
    if (T.avancement?.actif) {
      const fin = horizon(p, pl); let d = prochainJour(addJ(depart("avancement"), depart("avancement") === debutP ? 7 : 1), T.avancement.jourSemaine ?? 4); let n = 1;
      while (d <= fin && n < 200) { add("avancement", d, d, `n°${n}`); d = addJ(d, 7 * (T.avancement.tousLes || 2)); n++; }
    }
    pl.sprints.forEach(s => {
      const dur = s.duree || pl.sprint.duree;
      if (T.planning.actif) add("planning", s.id, s.debut, `Sprint ${s.num}`);
      if (T.affinage.actif) add("affinage", s.id, addOuvres(s.debut, Math.max(1, Math.floor(dur * 5 / 2))), `Sprint ${s.num}`);
      if (T.revue.actif) add("revue", s.id, s.fin, `Sprint ${s.num}`);
      if (T.retro.actif) add("retro", s.id, s.fin, `Sprint ${s.num}`);
    });
    if (T.copil.actif) {
      const r = T.copil;
      if (r.regle === "sprints") pl.sprints.forEach((s, i) => { if ((i + 1) % r.tousLes === 0) add("copil", s.id, addJ(s.fin, 1), `après le sprint ${s.num}`); });
      else if (r.regle === "jalons") pl.jalons.filter(j => j.date).forEach(j => add("copil", "j" + j.id, j.date, j.nom));
      else {
        const fin = horizon(p, pl);
        for (let m = debutP.slice(0, 7); m <= fin.slice(0, 7); m = moisSuivant(m)) {
          const d = nieme(m, r.rang, r.jourSemaine);
          if (d >= debutP && d <= fin) add("copil", m, d, fmtMois(m));
        }
      }
    }
    if (T.cloture.actif && p.dateFin) add("cloture", "", p.dateFin, "");
    const garde = [];
    pl.reunions.forEach(r => {
      if (!r.auto) { garde.push(r); return; }
      const v = voulues.get(r.cle);
      if (v) { if (!r.verrou) r.date = v.date; r.motif = v.motif; voulues.delete(r.cle); garde.push(r); }
      else if (r.verrou && T[r.type]?.actif) garde.push(r); // une réunion verrouillée reste, même si son sprint a disparu
    });
    voulues.forEach((v, cle) => garde.push({ id: uid(), auto: true, cle, type: v.type, date: v.date, heure: TYPES_REU[v.type].heure, duree: TYPES_REU[v.type].duree, motif: v.motif, titre: "", notes: "", verrou: false, annulee: false }));
    pl.reunions = garde;
    pl.reunions.forEach(r => { if (!r.dateInitiale) r.dateInitiale = r.date; });
    if (!pl.referenceLe) pl.referenceLe = today();
    pl.base = { dateDebut: p.dateDebut, dateFin: p.dateFin };
  }

  // Compare deux plannings : liste des changements de dates (pour l'aperçu avant recalcul)
  function diffPlanning(a, b) {
    const L = []; const idx = arr => new Map(arr.map(x => [x.id, x]));
    const nums = numerosCopil(b);
    const comp = (aa, bb, nomFn, dateA, dateB = dateA) => {
      const A = idx(aa);
      bb.forEach(x => { const o = A.get(x.id); if (!o) L.push({ nom: nomFn(x), ajout: x[dateB] }); else if (o[dateA] !== x[dateA] || (dateB !== dateA && o[dateB] !== x[dateB])) L.push({ nom: nomFn(x), de: o[dateA], a: x[dateA] }); });
      aa.forEach(o => { if (!bb.some(x => x.id === o.id)) L.push({ nom: nomFn(o), suppr: o[dateA] }); });
    };
    comp(a.phases, b.phases, x => `▶ Phase « ${x.nom} »`, "debut", "fin");
    comp(a.sprints, b.sprints, x => `🏃 Sprint ${x.num}`, "debut", "fin");
    comp(a.jalons, b.jalons, x => `◆ Jalon « ${x.nom} »`, "date");
    comp(a.reunions, b.reunions, x => `${(TYPES_REU[x.type] || TYPES_REU.libre).emoji} ${titreReu(x, nums)}`, "date");
    return L;
  }
  const appliquer = (p, msg) => { genererPlanning(p, p.planning); save(); render(); if (msg) toast(msg); };

  // Sans date de fin : on garde toujours 6 sprints d'avance (ajout seulement, rien ne bouge)
  function etendre(p) {
    const pl = p.planning;
    if (!pl?.methode || p.dateFin || pl.methode === "v") return;
    const c = structuredClone(pl); genererPlanning(p, c);
    const L = diffPlanning(pl, c);
    if (L.length && L.every(x => x.ajout)) { p.planning = c; save(); }
  }

  function numerosCopil(pl) {
    const m = new Map();
    pl.reunions.filter(r => r.type === "copil" && !r.annulee).sort((a, b) => a.date.localeCompare(b.date)).forEach((r, i) => m.set(r.id, i + 1));
    return m;
  }
  function titreReu(r, nums) {
    if (r.titre) return r.titre;
    const T = TYPES_REU[r.type] || TYPES_REU.libre;
    if (r.type === "copil") return `Copil${nums?.get(r.id) ? " n°" + nums.get(r.id) : ""}`;
    return T.nom + (r.motif ? " · " + r.motif : "");
  }
  const sprintEnCours = pl => pl?.sprints.find(s => s.debut <= today() && s.fin >= today());
  const glissement = j => j.date && j.dateInitiale ? diffJ(j.dateInitiale, j.date) : 0;
  const ecart = (ini, cur) => ini && cur ? diffJ(ini, cur) : 0;
  const ecartPhase = ph => ecart(ph.finInitiale, ph.fin);
  const ecartReu = r => ecart(r.dateInitiale, r.date);
  const pillEcart = (g, ini) => g ? `<span class="pill ${g > 0 ? "danger" : "ok"}" title="Date initiale : ${fmtDate(ini)}">${g > 0 ? "+" : ""}${g} j</span>` : "";
  const iniTxt = (ini, cur) => ini && cur && ini !== cur ? `<span class="ini">initialement ${fmtJM(ini)}</span>` : "";
  const badgeGlissement = j => { const g = glissement(j); return g ? `<span class="pill ${g > 0 ? "danger" : "ok"}" title="Date de référence : ${fmtDate(j.dateInitiale)}">${g > 0 ? "+" : ""}${g} j</span>` : ""; };
  // Risques ouverts rattachés à un jalon, et criticité maximale
  const risquesJalon = (p, j) => (j.risques || []).map(id => p.risques.find(r => r.id === id)).filter(r => r && !CLOS.has(r.statut));
  const critMenace = (p, j) => Math.max(0, ...risquesJalon(p, j).map(crit));
  const badgeMenace = (p, j) => { const rs = risquesJalon(p, j); if (!rs.length) return ""; const c = critMenace(p, j);
    return `<span class="pill ${c >= 9 ? "danger" : c >= 6 ? "warn" : "soft"}" title="${rs.map(r => `R${p.risques.indexOf(r) + 1} · ${esc(r.titre)}`).join(" / ")}">⚠ ${rs.map(r => "R" + (p.risques.indexOf(r) + 1)).join(", ")}</span>`; };
  const lockBtn = (k, x) => `<button class="lock ${x.verrou ? "on" : ""}" data-act="pl-lock" data-k="${k}" data-id="${x.id}" title="${x.verrou ? "Date verrouillée : clique pour la déverrouiller (elle sera réalignée au prochain « Recalculer »)" : "Date calculée automatiquement : clique pour la verrouiller"}">${x.verrou ? "🔒" : "🔓"}</button>`;
  const estAuto = (k, x) => k === "reunion" ? x.auto : k === "jalon" ? !!x.ancre : true;

  // Prochains événements du planning (pour le cockpit et le portefeuille)
  function prochainsPlanning(p) {
    const pl = p.planning; if (!pl?.methode) return [];
    const t = today(); const nums = numerosCopil(pl);
    return [
      ...pl.reunions.filter(r => !r.annulee && r.date >= t).map(r => ({ d: r.date, ic: (TYPES_REU[r.type] || TYPES_REU.libre).emoji, txt: titreReu(r, nums), sous: r.type === "copil" ? r.motif : (r.heure ? r.heure.replace(":", "h") : ""), type: r.type, planif: "reunion", id: r.id })),
      ...pl.jalons.filter(j => j.date && j.date >= t && !j.atteint).map(j => ({ d: j.date, ic: "◆", txt: j.nom, sous: "Jalon" + (glissement(j) ? ` (${glissement(j) > 0 ? "+" : ""}${glissement(j)} j)` : ""), type: "jalon", planif: "jalon", id: j.id })),
    ].sort((a, b) => a.d.localeCompare(b.d));
  }

  // ─── Vues
  function vuePlanif() {
    const p = proj(); const pl = p.planning;
    if (!pl?.methode || ui.choixOuvert) return vueChoixMethode(p);
    const M = METHODES[pl.methode];
    const changement = pl.base && (pl.base.dateDebut !== p.dateDebut || pl.base.dateFin !== p.dateFin);
    const resume = pl.methode === "v" ? `${pl.phases.length} phases` : `sprints de ${pl.sprint.duree} semaine${pl.sprint.duree > 1 ? "s" : ""}, le ${JOURS[pl.sprint.jour]}`;
    const fn = { frise: vueFrise, hfrise: vueFriseCopil, reunions: vueReunions, jalons: vueJalons, gonogo: vueGoNoGo, sprints: vueSprints, parametres: vueParametresPlanif, taches: vueReglagesTaches }[ui.vuePlanif] || vueFrise;
    return `
      <div class="toolbar cp-tools">
        <h2 style="margin:0">🗓️ Planification</h2>
        <span class="pill soft">${M.emoji} ${M.nom}</span><span class="muted">${resume}</span>
        <span class="spacer"></span>
        <button class="btn ghost small" data-act="pl-new-jalon">◆ Jalon</button>
        <button class="btn ghost small" data-act="pl-new-reunion">＋ Réunion</button>
        <button class="btn small" data-act="pl-recalc" title="Réaligne les dates non verrouillées, avec un aperçu avant de valider">↻ Recalculer</button>
      </div>
      ${changement ? `<div class="hl-banner cp-tools" style="--k:#BA7517"><span>📅 Les dates du projet ont changé depuis le dernier calcul.</span><span class="spacer"></span><button class="btn small" data-act="pl-recalc">↻ Recalculer le planning</button></div>` : ""}
      ${fn(p, pl)}`;
  }

  function vueChoixMethode(p) {
    const existe = p.planning?.methode;
    const m = ui.choixMethode;
    return `
      <div class="toolbar"><h2 style="margin:0">🗓️ ${existe ? "Changer de méthode" : "Mettre en place la planification"}</h2></div>
      ${!p.dateDebut ? `<div class="alert">Renseigne d'abord la date de début dans la <span class="link" data-act="module" data-id="identite">fiche d'identité</span>.</div>` : ""}
      <p class="muted" style="margin-top:0">Choisis la méthode du projet : l'outil propose les phases, les sprints, les jalons et les réunions. <b>Tout reste modifiable ensuite.</b></p>
      <div class="meth-grid">${Object.entries(METHODES).map(([id, x]) => `
        <button class="meth-card ${m === id ? "on" : ""}" data-act="pl-methode" data-id="${id}">
          <span class="meth-ic">${x.emoji}</span><b>${x.nom}</b><span class="muted">${x.desc}</span>
        </button>`).join("")}</div>
      <div class="panel" style="margin-top:16px;max-width:760px">
        <div class="row">
          ${m !== "v" ? `<label class="field" style="margin:0"><span class="lbl">Durée des sprints</span>
            <select class="inp" id="plDureeChoix" style="width:auto">${[1, 2, 3, 4].map(n => `<option value="${n}" ${n === ui.choixDuree ? "selected" : ""}>${n} semaine${n > 1 ? "s" : ""}</option>`).join("")}</select></label>` : ""}
          <div class="muted" style="font-size:.88rem;flex:1;min-width:220px">
            📅 Projet : ${p.dateDebut ? fmtDate(p.dateDebut) : "?"} → ${p.dateFin ? fmtDate(p.dateFin) : "fin non fixée"}<br>
            ${m === "agile" ? (p.dateFin ? "Les sprints couvriront tout le projet, en commençant un lundi." : "Sans date de fin : 6 sprints d'avance, ajoutés automatiquement au fil du temps.")
              : m === "hybride" ? "Phases Cadrage → Réalisation en sprints → Recette globale → Déploiement." : "Phases Cadrage → Spécifications → Conception → Réalisation → Tests → Recette → Déploiement."}
            ${m !== "agile" ? (p.dateFin ? " Les durées sont réparties sur la période du projet." : " Durées types proposées, à ajuster.") : ""}
          </div>
        </div>
        ${existe ? `<div class="alert" style="margin:12px 0 0">⚠️ Changer de méthode recrée les phases, les sprints, les jalons et les réunions automatiques. Tes réunions ajoutées à la main sont conservées.</div>` : ""}
        <div class="row" style="margin-top:14px;justify-content:flex-end">
          ${existe ? `<button class="btn ghost" data-act="pl-annuler-choix">Annuler</button>` : ""}
          <button class="btn" data-act="pl-generer">${existe ? "Recréer le planning" : "Générer le planning"} →</button>
        </div>
      </div>`;
  }

  function vueFrise(p, pl) {
    const f = ui.friseFiltres; const t = today(); const nums = numerosCopil(pl);
    let items = [];
    if (f.structure) {
      pl.phases.forEach(x => items.push({ d: x.debut, o: 0, k: "phase", x, fin: x.fin }));
      pl.sprints.forEach(x => items.push({ d: x.debut, o: 1, k: "sprint", x, fin: x.fin }));
    }
    if (f.jalons) pl.jalons.filter(j => j.frise && j.date).forEach(x => items.push({ d: x.date, o: 2, k: "jalon", x }));
    pl.reunions.forEach(x => {
      const c = (TYPES_REU[x.type] || TYPES_REU.libre).cat;
      if (!f[c] || (x.annulee && !f.annulees)) return;
      items.push({ d: x.date, o: 3, k: "reunion", x });
    });
    if (!f.passe) items = items.filter(i => (i.fin || i.d) >= t);
    if (f.feries && items.length) {
      const ds = items.map(i => i.d).sort(); const J = joursNonOuvres(ds[0], ds[ds.length - 1]);
      J.feries.forEach(x => items.push({ d: x.d, o: 2.5, k: "ferie", x }));
      J.fermetures.forEach(x => items.push({ d: x.debut, o: 0.5, k: "fermeture", x, fin: x.fin }));
    }
    items.push({ d: t, o: 1.5, k: "today" });
    items.sort((a, b) => a.d.localeCompare(b.d) || a.o - b.o);

    let mois = ""; let h = "";
    for (const i of items) {
      const m = i.d.slice(0, 7);
      if (m !== mois) { mois = m; h += `<div class="fr-mois">${fmtMois(m)}</div>`; }
      const passe = (i.fin || i.d) < t ? "passe" : "";
      if (i.k === "today") { h += `<div class="fr-today" id="friseToday"><span>Aujourd'hui · ${fmtCourt(t)}</span></div>`; continue; }
      if (i.k === "ferie") { h += `<div class="fr-row fr-ferie ${passe}"><span class="fr-date">${fmtCourt(i.d)}</span><span class="fr-dot d-vide"></span><div class="fr-body">🎌 ${esc(i.x.nom)} <span class="muted">· férié</span></div><span></span></div>`; continue; }
      if (i.k === "fermeture") { h += `<div class="fr-band fr-ferm ${passe}"><span>🏖️ <b>${esc(i.x.libelle || "Fermeture")}</b></span><span class="muted">${fmtJM(i.x.debut)} → ${fmtJM(i.x.fin)} · fermeture</span></div>`; continue; }
      if (i.k === "phase") { h += `<div class="fr-band fr-phase ${passe}" data-act="pl-open" data-k="phase" data-id="${i.x.id}"><span>▶ <b>${esc(i.x.nom)}</b></span><span class="muted">${fmtJM(i.x.debut)} → ${fmtJM(i.x.fin)}</span>${i.x.finInitiale && (i.x.finInitiale !== i.x.fin || i.x.debutInitial !== i.x.debut) ? `<span class="ini">initialement ${fmtJM(i.x.debutInitial)} → ${fmtJM(i.x.finInitiale)}</span>${pillEcart(ecartPhase(i.x), i.x.finInitiale)}` : ""}<span class="spacer"></span>${lockBtn("phase", i.x)}</div>`; continue; }
      if (i.k === "sprint") {
        const enc = i.x.debut <= t && i.x.fin >= t;
        h += `<div class="fr-band fr-sprint ${passe} ${enc ? "encours" : ""}" data-act="pl-open" data-k="sprint" data-id="${i.x.id}"><span>🏃 <b>Sprint ${i.x.num}</b></span><span class="muted">${fmtJM(i.x.debut)} → ${fmtJM(i.x.fin)}</span>${i.x.finInitiale && (i.x.finInitiale !== i.x.fin || i.x.debutInitial !== i.x.debut) ? `<span class="ini">initialement ${fmtJM(i.x.debutInitial)} → ${fmtJM(i.x.finInitiale)}</span>${pillEcart(ecart(i.x.finInitiale, i.x.fin), i.x.finInitiale)}` : ""}${enc ? `<span class="pill soft">en cours</span>` : ""}${i.x.objectif ? `<span class="fr-obj">🎯 ${esc(i.x.objectif)}</span>` : ""}<span class="spacer"></span>${lockBtn("sprint", i.x)}</div>`;
        continue;
      }
      if (i.k === "jalon") {
        const j = i.x;
        h += `<div class="fr-row ${passe} ${j.atteint ? "fait" : ""}" data-act="pl-open" data-k="jalon" data-id="${j.id}">
          <span class="fr-date">${fmtCourt(j.date)}</span><span class="fr-dot d-jalon ${j.atteint ? "ok" : critMenace(p, j) >= 9 ? "crit" : critMenace(p, j) >= 6 ? "warn" : ""}"></span>
          <div class="fr-body"><b>${j.atteint ? "✔ " : ""}${esc(j.nom)}</b> ${badgeGlissement(j)} ${badgeMenace(p, j)}<div class="muted fr-sub">Jalon${j.dateInitiale && glissement(j) ? ` · initialement le ${fmtJM(j.dateInitiale)}` : ""}</div></div>
          ${estAuto("jalon", j) ? lockBtn("jalon", j) : ""}</div>`;
        continue;
      }
      const r = i.x; const T = TYPES_REU[r.type] || TYPES_REU.libre;
      h += `<div class="fr-row ${passe} ${r.annulee ? "annulee" : ""}" data-act="pl-open" data-k="reunion" data-id="${r.id}">
        <span class="fr-date">${fmtCourt(r.date)}</span><span class="fr-dot ${r.annulee ? "d-vide" : "d-" + T.cat}"></span>
        <div class="fr-body"><b>${T.emoji} ${esc(titreReu(r, nums))}</b>${r.annulee ? ` <span class="pill soft">annulée</span>` : ""}${!r.auto ? ` <span class="pill soft">ajoutée</span>` : ""} ${pillEcart(ecartReu(r), r.dateInitiale)} ${r.annulee ? "" : alerteJour(r.date)}
          <div class="muted fr-sub">${r.heure ? r.heure.replace(":", "h") : ""}${r.type === "copil" && r.motif ? ` · ${esc(r.motif)}` : ""}${ecartReu(r) ? ` · initialement le ${fmtJM(r.dateInitiale)}` : ""}</div></div>
        ${r.auto ? lockBtn("reunion", r) : ""}</div>`;
    }
    const chip = (id, nom) => `<button class="chip ${f[id] ? "on" : ""}" data-act="pl-filtre" data-id="${id}">${nom}</button>`;
    return `
      <div class="row" style="margin-bottom:14px">
        <div class="chips" style="margin:0">${chip("structure", pl.sprints.length ? "Phases & sprints" : "Phases")}${chip("jalons", "◆ Jalons")}${chip("copil", "🏛️ Copils")}${pl.sprints.length ? chip("agile", "🧩 Cérémonies agiles") : ""}${chip("autre", "📌 Autres réunions")}${chip("feries", "🎌 Fériés & fermetures")}${chip("annulees", "Annulées")}${chip("passe", "Passé")}</div>
        <span class="spacer"></span><button class="btn ghost small" data-act="pl-today">⤓ Aujourd'hui</button>
      </div>
      <div class="frise">${h}</div>
      <p class="muted" style="font-size:.82rem;margin-top:10px">🔓 date calculée automatiquement · 🔒 date verrouillée (déplacée à la main, elle ne bouge plus au recalcul) · clique sur un élément pour le modifier</p>`;
  }

  function reglageType(pl, id) {
    const T = pl.types[id] || {}; const sel = (f, opts, val) => `<select class="inp mini-sel" data-pl="param" data-f="${f}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? "selected" : ""}>${l}</option>`).join("")}</select>`;
    if (id === "cadrage") return `<span class="muted" style="display:block;font-size:.8rem">${T.depuis ? "projet déjà commencé : ajoutez-la avec « ＋ Réunion » si besoin" : "le premier jour du projet, après la réunion de lancement"}</span>`;
    if (id === "entretien") return `<span class="muted type-regle">${sel("entretienNombre", [1, 2, 3, 4, 5, 6, 8, 10].map(n => [n, n]), T.nombre || 3)} entretien(s), un par semaine dès le début · questions types dans l'ordre du jour</span>`;
    if (id === "avancement") return `<span class="muted type-regle">toutes les ${sel("avancementTousLes", [1, 2, 3, 4].map(n => [n, n]), T.tousLes || 2)} semaine(s), le ${sel("avancementJour", [1, 2, 3, 4, 5].map(j => [j, JOURS[j]]), T.jourSemaine ?? 4)}</span>`;
    return "";
  }
  function vueReunions(p, pl) {
    typesComplets(pl);
    const t = today(); const nums = numerosCopil(pl);
    const types = Object.entries(TYPES_REU).filter(([id, T]) => !T.manuel && (!T.agile || pl.sprints.length));
    const regle = pl.types.copil;
    const regleTxt = regle.regle === "sprints" ? `tous les ${regle.tousLes} sprint(s), le lendemain de la revue` : regle.regle === "jalons" ? "à chaque jalon" : `le ${RANGS[regle.rang]} ${JOURS[regle.jourSemaine]} du mois`;
    const liste = pl.reunions.filter(r => ui.reuPassees || r.date >= t).sort((a, b) => a.date.localeCompare(b.date) || (a.heure || "").localeCompare(b.heure || ""));
    return `
      <div class="two-col">
        <section class="panel">
          <h3>Types de réunions générées</h3>
          <p class="muted" style="margin-top:0;font-size:.85rem">Décoche un type pour retirer toutes ses réunions automatiques (les réunions 🔒 et celles ajoutées à la main sont gardées).</p>
          ${types.map(([id, T]) => { const n = pl.reunions.filter(r => r.type === id && r.auto && !r.annulee).length; return `
            <label class="type-row"><input type="checkbox" data-pl="type" data-id="${id}" ${pl.types[id].actif ? "checked" : ""}>
              <span>${T.emoji} ${T.nom}${id === "copil" ? `<span class="muted" style="display:block;font-size:.8rem">${regleTxt} · <span class="link" data-act="pl-vue" data-id="parametres">changer</span></span>` : ""}${reglageType(pl, id)}</span>
              <span class="spacer"></span><span class="pill soft">${n}</span></label>`; }).join("")}
        </section>
        <section class="panel">
          <div class="row" style="margin-bottom:8px"><h3 style="margin:0">${ui.reuPassees ? "Toutes les réunions" : "Réunions à venir"}</h3><span class="spacer"></span>
            <label class="row" style="font-size:.85rem;cursor:pointer"><input type="checkbox" data-act="pl-passees" ${ui.reuPassees ? "checked" : ""}> Afficher les passées</label>
            <button class="btn small" data-act="pl-new-reunion">＋ Réunion</button></div>
          ${liste.length ? `<div class="pl-list">${liste.map(r => { const T = TYPES_REU[r.type] || TYPES_REU.libre; return `
            <div class="pl-item ${r.annulee ? "annulee" : ""} ${r.date < t ? "passe" : ""}">
              <span class="date-chip">${fmtCourt(r.date)}</span>
              <div style="flex:1;min-width:0" class="clic" data-act="pl-open" data-k="reunion" data-id="${r.id}"><b>${T.emoji} ${esc(titreReu(r, nums))}</b><div class="muted" style="font-size:.8rem">${r.heure ? r.heure.replace(":", "h") : ""}${r.duree ? ` · ${r.duree} min` : ""}${r.auto ? "" : " · ajoutée à la main"}${r.annulee ? " · annulée" : ""}${ecartReu(r) ? ` · initialement le ${fmtJM(r.dateInitiale)}` : ""}</div></div>
              ${pillEcart(ecartReu(r), r.dateInitiale)}
              ${r.auto ? lockBtn("reunion", r) : ""}
              <button class="btn ghost small" data-act="pl-annuler-reu" data-id="${r.id}">${r.annulee ? "Rétablir" : "Annuler"}</button>
            </div>`; }).join("")}</div>` : `<p class="muted">Aucune réunion.</p>`}
        </section>
      </div>`;
  }

  function vueJalons(p, pl) {
    const optionsAncre = j => j.ancre?.startsWith("phase:") ? `fin de « ${esc(pl.phases.find(x => x.id === j.ancre.slice(6))?.nom || "?")} »` : j.ancre === "fin" ? "fin du projet" : j.ancre === "debut" ? "début du projet" : "date libre";
    return `
      <section class="panel" style="margin-bottom:20px">
        <div class="row" style="margin-bottom:8px"><h3 style="margin:0">◆ Jalons</h3><span class="spacer"></span><button class="btn small" data-act="pl-new-jalon">＋ Jalon</button></div>
        ${pl.jalons.length ? `<div class="pl-table">
          <div class="pl-tr pl-th jal"><span title="Atteint">✔</span><span>Jalon</span><span>Date initiale</span><span>Date revue</span><span>Écart</span><span title="Afficher sur la frise">Frise</span><span></span><span></span></div>
          ${[...pl.jalons].sort((a, b) => (a.date || "9").localeCompare(b.date || "9")).map(j => `
          <div class="pl-tr jal ${j.atteint ? "fait" : ""}">
            <input type="checkbox" data-pl="jalon" data-id="${j.id}" data-f="atteint" ${j.atteint ? "checked" : ""} title="Jalon atteint">
            <div><input class="inp" data-pl="jalon" data-id="${j.id}" data-f="nom" value="${esc(j.nom)}"><div class="muted" style="font-size:.75rem;margin-top:2px">Calé sur : ${optionsAncre(j)} ${badgeMenace(p, j)}</div></div>
            <span class="muted" style="font-size:.85rem">${j.dateInitiale ? fmtDate(j.dateInitiale) : "—"}</span>
            <input class="inp" type="date" data-pl="jalon" data-id="${j.id}" data-f="date" value="${esc(j.date)}">
            <span>${badgeGlissement(j) || (j.date ? `<span class="muted" style="font-size:.8rem">à l'heure</span>` : `<span class="muted" style="font-size:.8rem">à dater</span>`)}</span>
            <input type="checkbox" data-pl="jalon" data-id="${j.id}" data-f="frise" ${j.frise ? "checked" : ""} title="Afficher sur la frise">
            ${estAuto("jalon", j) ? lockBtn("jalon", j) : "<span></span>"}
            <button class="x-btn" data-act="pl-jalon-del" data-id="${j.id}" title="Supprimer">✕</button>
          </div>`).join("")}</div>` : `<p class="muted">Aucun jalon.</p>`}
        <p class="muted" style="font-size:.8rem;margin:8px 0 0">L'écart compare la date revue à la date initiale (référence du ${fmtDate(pl.referenceLe)}). Pour figer une nouvelle référence : onglet Paramètres.</p>
      </section>
      <section class="panel">
        <div class="row" style="margin-bottom:8px"><h3 style="margin:0">▶ Phases</h3>${chipAvReel(pl)}${pl.avReel && avancementReel(p) ? `<span class="muted" style="font-size:.85rem">réel ${Math.round(avancementReel(p).reel * 100)} % · prévu ${Math.round(avancementReel(p).prevu * 100)} % · ${libEcartAv(avancementReel(p))}</span>` : ""}<span class="spacer"></span><button class="btn small ghost" data-act="pl-phase-add">＋ Phase</button></div>
        ${pl.phases.length ? `<div class="pl-table">
          <div class="pl-tr pl-th pha"><span></span><span>Phase</span><span>Début</span><span>Fin</span><span>Écart (fin)</span><span></span><span></span></div>
          ${pl.phases.map((ph, i) => `
          <div class="pl-tr pha">
            <span class="updown"><button data-act="pl-phase-up" data-id="${ph.id}" ${i === 0 ? "disabled" : ""} title="Monter">▲</button><button data-act="pl-phase-down" data-id="${ph.id}" ${i === pl.phases.length - 1 ? "disabled" : ""} title="Descendre">▼</button></span>
            <div><input class="inp" data-pl="phase" data-id="${ph.id}" data-f="nom" value="${esc(ph.nom)}">${pl.avReel ? `<label class="ph-reel">Réalisé <input class="inp" type="number" min="0" max="100" step="5" data-phreel="${ph.id}" value="${+ph.reel || 0}"> % <span class="muted">· prévu ${Math.round(prevuPhase(ph) * 100)} %</span><span class="ph-barre"><i style="width:${Math.min(100, +ph.reel || 0)}%"></i><b style="left:${Math.round(prevuPhase(ph) * 100)}%"></b></span></label>` : ""}${pl.methode === "hybride" ? `<label class="muted" style="font-size:.75rem;display:flex;gap:4px;margin-top:3px"><input type="radio" name="phSprints" data-pl="phase" data-id="${ph.id}" data-f="sprints" ${ph.sprints ? "checked" : ""}> Phase réalisée en sprints</label>` : ""}</div>
            <div><input class="inp" type="date" data-pl="phase" data-id="${ph.id}" data-f="debut" value="${esc(ph.debut)}">${iniTxt(ph.debutInitial, ph.debut)}</div>
            <div><input class="inp" type="date" data-pl="phase" data-id="${ph.id}" data-f="fin" value="${esc(ph.fin)}">${iniTxt(ph.finInitiale, ph.fin)}</div>
            <span>${pillEcart(ecartPhase(ph), ph.finInitiale) || `<span class="muted" style="font-size:.8rem">${Math.round(diffJ(ph.debut, ph.fin) / 7 * 10 + 1.4) / 10} sem.</span>`}</span>
            ${lockBtn("phase", ph)}
            <button class="x-btn" data-act="pl-phase-del" data-id="${ph.id}" title="Supprimer">✕</button>
          </div>`).join("")}</div>` : `<p class="muted">${pl.methode === "agile" ? "En Agile, pas de phases par défaut. Tu peux en ajouter (ex : cadrage, mise en production)." : "Aucune phase."}</p>`}
        <p class="muted" style="font-size:.8rem;margin:8px 0 0">Les phases s'enchaînent : modifier une date verrouille cette phase 🔒 et décale les suivantes non verrouillées.</p>
      </section>`;
  }

  function vueSprints(p, pl) {
    const t = today();
    if (!pl.sprints.length) return `<div class="empty"><span class="big">🏃</span>Aucun sprint dans cette méthode.</div>`;
    return `<section class="panel">
      <div class="pl-table">
        <div class="pl-tr pl-th spr"><span>N°</span><span>Début</span><span>Fin</span><span>Durée</span><span>Objectif du sprint</span><span></span></div>
        ${pl.sprints.map(s => { const enc = s.debut <= t && s.fin >= t; return `
        <div class="pl-tr spr ${s.fin < t ? "passe" : ""} ${enc ? "encours" : ""}">
          <b>S${s.num}${enc ? ` <span class="pill soft">en cours</span>` : ""}</b>
          <div><input class="inp" type="date" data-pl="sprint" data-id="${s.id}" data-f="debut" value="${esc(s.debut)}">${iniTxt(s.debutInitial, s.debut)}</div>
          <div><input class="inp" type="date" data-pl="sprint" data-id="${s.id}" data-f="fin" value="${esc(s.fin)}">${iniTxt(s.finInitiale, s.fin)}${pillEcart(ecart(s.finInitiale, s.fin), s.finInitiale)}</div>
          <select class="inp" data-pl="sprint" data-id="${s.id}" data-f="duree"><option value="">Par défaut (${pl.sprint.duree} sem.)</option>${[1, 2, 3, 4].map(n => `<option value="${n}" ${s.duree === n ? "selected" : ""}>${n} sem.</option>`).join("")}</select>
          <input class="inp" data-pl="sprint" data-id="${s.id}" data-f="objectif" value="${esc(s.objectif)}" placeholder="Objectif…">
          ${lockBtn("sprint", s)}
        </div>`; }).join("")}
      </div>
      <p class="muted" style="font-size:.8rem;margin:8px 0 0">${p.dateFin || pl.methode === "hybride" ? "" : "Sans date de fin, 6 sprints d'avance sont toujours planifiés ; les suivants s'ajoutent automatiquement. "}Changer la date d'un sprint le verrouille 🔒 ; les sprints suivants non verrouillés s'enchaînent derrière.</p>
    </section>`;
  }

  function vueParametresPlanif(p, pl) {
    const M = METHODES[pl.methode]; const c = pl.types.copil; const aSprints = pl.methode !== "v";
    const sel = (f, opts, val) => `<select class="inp" data-pl="param" data-f="${f}" style="width:auto">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(val) ? "selected" : ""}>${l}</option>`).join("")}</select>`;
    return `<div class="two-col">
      <section class="panel">
        <h3>Méthode</h3>
        <div class="row"><span class="pill soft" style="font-size:.95rem">${M.emoji} ${M.nom}</span><span class="spacer"></span><button class="btn ghost small" data-act="pl-changer-methode">Changer de méthode</button></div>
        ${aSprints ? `<h3 style="margin-top:18px">Sprints</h3>
          <div class="param-row"><span>Durée par défaut</span>${sel("duree", [1, 2, 3, 4].map(n => [n, `${n} semaine${n > 1 ? "s" : ""}`]), pl.sprint.duree)}</div>
          <div class="param-row"><span>Jour de début</span>${sel("jour", [1, 2, 3, 4, 5].map(n => [n, JOURS[n]]), pl.sprint.jour)}</div>
          ${!p.dateFin && pl.methode === "agile" ? `<div class="param-row"><span>Sprints planifiés d'avance</span>${sel("avance", [3, 4, 5, 6, 8, 10, 12].map(n => [n, n]), pl.sprint.avance)}</div>` : ""}` : ""}
        <p class="muted" style="font-size:.8rem">Chaque changement s'applique tout de suite aux dates non verrouillées 🔓. Les dates 🔒 ne bougent pas.</p>
      </section>
      <section class="panel">
        <h3>Règle des copils</h3>
        ${[aSprints ? ["sprints", "Tous les N sprints, le lendemain de la revue"] : null, ["mensuel", "Une fois par mois"], ["jalons", "À chaque jalon"]].filter(Boolean).map(([v, l]) => `
          <label class="type-row"><input type="radio" name="regleCopil" data-pl="param" data-f="regle" value="${v}" ${c.regle === v ? "checked" : ""}><span>${l}</span></label>`).join("")}
        ${c.regle === "sprints" ? `<div class="param-row"><span>Fréquence</span>${sel("tousLes", [1, 2, 3, 4, 5, 6].map(n => [n, n === 1 ? "chaque sprint" : `tous les ${n} sprints`]), c.tousLes)}</div>` : ""}
        ${c.regle === "mensuel" ? `<div class="param-row"><span>Jour</span><span class="row" style="gap:6px">le ${sel("rang", Object.entries(RANGS), c.rang)} ${sel("jourSemaine", [1, 2, 3, 4, 5].map(n => [n, JOURS[n]]), c.jourSemaine)} du mois</span></div>` : ""}
        ${!c.actif ? `<div class="alert" style="margin-top:10px">Les copils sont désactivés dans l'onglet Réunions.</div>` : ""}
      </section>
    </div>
    <section class="panel" style="margin-top:20px">
      <h3>◇ Référence (dates initiales)</h3>
      <p style="margin:0 0 6px">Référence actuelle : <b>planning du ${fmtDate(pl.referenceLe)}</b>.</p>
      <p class="muted" style="font-size:.88rem;margin:0 0 12px">Les dates initiales servent à mesurer les écarts (« +14 j ») et sont affichées en pointillés sur la frise copil. Après une replanification validée en copil, fige le planning actuel comme nouvelle référence : les écarts repartent de zéro.</p>
      <button class="btn ghost" data-act="pl-rebase">◇ Figer le planning actuel comme référence</button>
    </section>`;
  }

  // ─── Fenêtres de modification
  function ouvrirReunion(id) {
    const p = proj(); const pl = p.planning; const nums = numerosCopil(pl);
    const r = id ? pl.reunions.find(x => x.id === id) : { id: uid(), auto: false, type: "libre", date: today(), heure: "10:00", duree: 60, titre: "", notes: "", annulee: false, verrou: false };
    const nouveau = !id;
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">${nouveau ? "＋ Nouvelle réunion" : `${(TYPES_REU[r.type] || TYPES_REU.libre).emoji} ${esc(titreReu(r, nums))}`}</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        ${r.auto ? `<div class="muted" style="font-size:.85rem">Réunion générée automatiquement${r.motif ? ` (${esc(r.motif)})` : ""}. ${r.verrou ? "🔒 Date verrouillée." : "🔓 Date calculée : la modifier la verrouillera."}</div>` : ""}
        <div class="field"><label>Titre</label><input type="text" id="reTitre" value="${esc(r.titre)}" placeholder="${esc(r.auto ? titreReu({ ...r, titre: "" }, nums) : "Ex : Atelier fournisseur, démo client…")}"></div>
        ${!r.auto ? `<div class="field"><label>Type</label><select id="reType">${Object.entries(TYPES_REU).map(([k, T]) => `<option value="${k}" ${k === r.type ? "selected" : ""}>${T.emoji} ${k === "libre" ? "Autre réunion" : T.nom}</option>`).join("")}</select></div>` : ""}
        <div class="three">
          <div class="field"><label>Date</label><input type="date" id="reDate" value="${esc(r.date)}"></div>
          <div class="field"><label>Heure</label><input type="text" id="reHeure" value="${esc(r.heure)}" placeholder="14:00"></div>
          <div class="field"><label>Durée (min)</label><input type="text" id="reDuree" value="${esc(r.duree)}"></div>
        </div>
        ${!nouveau && nonOuvre(r.date) ? `<div class="alert">⚠️ Cette réunion tombe un jour non ouvré : ${raisonNonOuvre(r.date)}.</div>` : ""}
        <div class="field"><label>🗒️ Notes</label><textarea id="reNotes" data-capt="${r.id}" placeholder="Points à aborder, lieu, lien visio…">${esc(r.notes)}</textarea>${zoneCaptures(r)}</div>
        ${!nouveau ? (() => { const odj = ordreDuJour(p, r); return `<div class="field"><label>📋 Ordre du jour proposé</label><div class="odj-box">${odjHtml(odj)}</div>${odj.length ? `<button class="btn ghost small" id="reOdj" style="margin-top:6px">↓ Copier dans les notes</button>` : ""}</div>`; })() : ""}
        <div class="field"><label>👥 Participants</label>${p.interlocuteurs.length ? `<div class="risk-pick">${p.interlocuteurs.map(i => `<label><input type="checkbox" data-rp="${i.id}" ${(r.participants || participantsDefaut(p, r)).includes(i.id) ? "checked" : ""}><span>${esc(personne(i.personneId)?.nom || "?")} <span class="muted">· ${esc(i.role)}</span></span></label>`).join("")}</div>` : `<div class="muted" style="font-size:.88rem">Aucun interlocuteur dans la fiche d'identité.</div>`}</div>
      </div>
      <div class="modal-foot">
        <div class="row">${!nouveau ? (r.auto ? `<button class="btn ghost" id="reAnnul">${r.annulee ? "↩︎ Rétablir la réunion" : "Annuler cette réunion"}</button>` : `<button class="btn danger" id="reDel">🗑️ Supprimer</button>`) : ""}
          ${r.auto && r.verrou ? `<button class="btn ghost" id="reUnlock">🔓 Déverrouiller</button>` : ""}
          ${!nouveau ? `<button class="btn ghost" id="reIcs" title="Télécharger pour Outlook">📅 .ics</button>` : ""}
          ${!nouveau && r.type === "copil" ? `<button class="btn ghost" id="rePrep">🏛️ Préparer ce copil</button>` : ""}
          ${!nouveau && !r.annulee ? `<button class="btn ghost" id="reCR">📝 ${r.date > today() ? "Préparer" : "Compte rendu"}</button>` : ""}</div>
        <div class="row"><button class="btn ghost" data-act="close-modal">Fermer</button><button class="btn" id="reOk">Enregistrer</button></div>
      </div>`);
    $("#reOk").onclick = () => {
      const date = $("#reDate").value; if (!date) { toast("✋ Indique une date"); return; }
      if (r.auto && date !== r.date) r.verrou = true;
      Object.assign(r, { titre: $("#reTitre").value.trim(), date, heure: $("#reHeure").value.trim(), duree: +$("#reDuree").value || "", notes: $("#reNotes").value });
      if (!r.auto) r.type = $("#reType").value;
      if (!r.dateInitiale) r.dateInitiale = date;
      if (p.interlocuteurs.length) {
        const coches = $$("#modal [data-rp]").filter(c => c.checked).map(c => c.dataset.rp);
        const def = participantsDefaut(p, r);
        r.participants = coches.length === def.length && coches.every(x => def.includes(x)) ? undefined : coches;
      }
      if (nouveau) pl.reunions.push(r);
      save(); closeModal(); toast(nouveau ? "✅ Réunion ajoutée" : "✅ Réunion enregistrée");
    };
    $("#reAnnul")?.addEventListener("click", () => { r.annulee = !r.annulee; save(); closeModal(); toast(r.annulee ? "Réunion annulée (elle reste visible, barrée)" : "↩︎ Réunion rétablie"); });
    $("#reDel")?.addEventListener("click", () => { if (!confirm("Supprimer cette réunion ?")) return; pl.reunions = pl.reunions.filter(x => x.id !== r.id); save(); closeModal(); toast("🗑️ Réunion supprimée"); });
    $("#reOdj")?.addEventListener("click", () => { const ta = $("#reNotes"); ta.value = (ta.value ? ta.value + "\n\n" : "") + odjTexte(ordreDuJour(p, r)); ta.focus(); });
    $("#reIcs")?.addEventListener("click", () => telechargerIcs(p, [r], `${nomFichier(p)}-${r.type}-${r.date}`));
    $("#reCR")?.addEventListener("click", () => { closeModal(); allerA("projet", "cr"); ui.crSel = r.id; crDe(p, r); save(); render(); window.scrollTo(0, 0); });
    $("#rePrep")?.addEventListener("click", () => { closeModal(); ui.copilSel = r.id; ui.vueInst = "copil"; allerA("projet", "instances"); });
    $("#reUnlock")?.addEventListener("click", () => { r.verrou = false; save(); closeModal(); toast("🔓 Déverrouillée : elle sera réalignée au prochain « Recalculer »"); });
  }

  function ouvrirJalon(id) {
    const p = proj(); const pl = p.planning;
    const j = id ? pl.jalons.find(x => x.id === id) : { id: uid(), nom: "", ancre: null, date: "", dateInitiale: "", frise: true, atteint: false, verrou: false, notes: "" };
    const nouveau = !id; const g = glissement(j);
    openModal(`
      <div class="modal-head" style="--c:#BA7517"><div class="row"><h2 style="margin:0">◆ ${nouveau ? "Nouveau jalon" : esc(j.nom)}</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <div class="field"><label>Nom du jalon *</label><input type="text" id="jaNom" value="${esc(j.nom)}" placeholder="Ex : Go / No go, livraison lot 1…"></div>
        <div class="two">
          <div class="field"><label>Date</label><input type="date" id="jaDate" value="${esc(j.date)}"></div>
          <div class="field"><label>Date de référence</label><div style="padding-top:8px">${j.dateInitiale ? `${fmtDate(j.dateInitiale)} ${g ? `<span class="pill ${g > 0 ? "danger" : "ok"}">${g > 0 ? "+" : ""}${g} j</span>` : ""}` : `<span class="muted">la première date saisie</span>`}</div>
            ${!nouveau && g ? `<button class="btn ghost small" id="jaRebase" style="margin-top:6px">Prendre la date actuelle comme référence</button>` : ""}</div>
        </div>
        <label class="row" style="cursor:pointer"><input type="checkbox" id="jaFrise" ${j.frise ? "checked" : ""}> Afficher sur la frise</label>
        <label class="row" style="cursor:pointer"><input type="checkbox" id="jaAtteint" ${j.atteint ? "checked" : ""}> Jalon atteint</label>
        ${(() => { const rs = p.risques.filter(r => !CLOS.has(r.statut)).sort((a, b) => crit(b) - crit(a)); return `<div class="field"><label>⚠️ Risques qui menacent ce jalon</label>${rs.length ? `<div class="risk-pick">${rs.map(r => `<label><input type="checkbox" data-jr="${r.id}" ${(j.risques || []).includes(r.id) ? "checked" : ""}><span class="crit ${niveau(crit(r))}">${crit(r)}</span><span>R${numero(r)} · ${esc(r.titre) || "Sans titre"}</span></label>`).join("")}</div><div class="aide">Sur les frises, le jalon passe en orange (risque élevé) ou en rouge (risque critique).</div>` : `<div class="muted" style="font-size:.88rem">Aucun risque ouvert dans ce projet.</div>`}</div>`; })()}
        <div class="field"><label>Notes</label><textarea id="jaNotes" data-capt="${j.id}" placeholder="Critères de passage, livrables attendus…">${esc(j.notes)}</textarea>${zoneCaptures(j)}</div>
        ${j.ancre ? `<div class="muted" style="font-size:.85rem">${j.verrou ? "🔒 Date verrouillée." : "🔓 Date calée automatiquement : la modifier la verrouillera."}</div>` : ""}
      </div>
      <div class="modal-foot">
        <div class="row">${!nouveau ? `<button class="btn danger" id="jaDel">🗑️ Supprimer</button>` : ""}${j.ancre && j.verrou ? `<button class="btn ghost" id="jaUnlock">🔓 Déverrouiller</button>` : ""}</div>
        <div class="row"><button class="btn ghost" data-act="close-modal">Fermer</button><button class="btn" id="jaOk">Enregistrer</button></div>
      </div>`);
    $("#jaOk").onclick = () => {
      const nom = $("#jaNom").value.trim(); if (!nom) { $("#jaNom").focus(); toast("✋ Donne un nom au jalon"); return; }
      const date = $("#jaDate").value;
      if (j.ancre && date !== j.date) j.verrou = true;
      Object.assign(j, { nom, date, frise: $("#jaFrise").checked, atteint: $("#jaAtteint").checked, notes: $("#jaNotes").value, risques: $$("#modal [data-jr]").filter(c => c.checked).map(c => c.dataset.jr) });
      if (date && !j.dateInitiale) j.dateInitiale = date;
      if (nouveau) pl.jalons.push(j);
      genererPlanning(p, pl); save(); closeModal(); toast(nouveau ? "◆ Jalon ajouté" : "✅ Jalon enregistré");
    };
    $("#jaRebase")?.addEventListener("click", () => { j.dateInitiale = j.date; save(); closeModal(); toast("Nouvelle date de référence enregistrée"); });
    $("#jaDel")?.addEventListener("click", () => { if (!confirm(`Supprimer le jalon « ${j.nom} » ?`)) return; pl.jalons = pl.jalons.filter(x => x.id !== j.id); genererPlanning(p, pl); save(); closeModal(); toast("🗑️ Jalon supprimé"); });
    $("#jaUnlock")?.addEventListener("click", () => { j.verrou = false; save(); closeModal(); toast("🔓 Déverrouillé : il sera réaligné au prochain « Recalculer »"); });
    if (nouveau) setTimeout(() => $("#jaNom")?.focus(), 30);
  }

  function ouvrirRecalcul() {
    const p = proj(); const pl = p.planning;
    const c = structuredClone(pl); genererPlanning(p, c);
    const L = diffPlanning(pl, c);
    const nbLock = [...pl.phases, ...pl.sprints, ...pl.jalons, ...pl.reunions].filter(x => x.verrou).length;
    const ligne = x => `<div class="diff-row"><span>${esc(x.nom)}</span><span class="spacer"></span>${x.ajout ? `<span class="pill ok">ajout · ${fmtJM(x.ajout)}</span>` : x.suppr ? `<span class="pill danger">retrait · ${fmtJM(x.suppr)}</span>` : `<span class="muted">${fmtJM(x.de) || "—"}</span> → <b>${fmtJM(x.a) || "—"}</b>`}</div>`;
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">↻ Recalculer le planning</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        ${L.length ? `<p style="margin:0"><b>${L.length} changement(s)</b> si tu valides :</p><div class="diff-list">${L.map(ligne).join("")}</div>`
          : `<p style="margin:0">✅ Tout est déjà aligné : aucune date ne changerait.</p>`}
        <p class="muted" style="font-size:.85rem;margin:0">🔒 ${nbLock} date(s) verrouillée(s) ne bougeront pas. Pour qu'une date soit recalculée, déverrouille-la d'abord (clic sur 🔒).</p>
      </div>
      <div class="modal-foot"><span></span><div class="row"><button class="btn ghost" data-act="close-modal">${L.length ? "Annuler" : "Fermer"}</button>${L.length ? `<button class="btn" id="rcOk">Appliquer</button>` : ""}</div></div>`);
    $("#rcOk")?.addEventListener("click", () => { p.planning = c; save(); closeModal(); toast(`↻ ${L.length} date(s) mises à jour`); });
  }

  // ─── Événements de la planification
  const trouver = (pl, k, id) => ({ reunion: pl.reunions, jalon: pl.jalons, sprint: pl.sprints, phase: pl.phases }[k] || []).find(x => x.id === id);
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || !el.dataset.act.startsWith("pl-")) return;
    const { act, id, k } = el.dataset; const p = proj(); const pl = p?.planning;
    switch (act) {
      case "pl-methode": ui.choixMethode = id; render(); break;
      case "pl-generer":
        if (!p.dateDebut) { toast("✋ Renseigne d'abord la date de début du projet"); return; }
        if (pl?.methode && !confirm("Recréer le planning avec cette méthode ? Les phases, sprints, jalons et réunions automatiques seront recréés.")) return;
        initPlanning(p, ui.choixMethode, ui.choixDuree); ui.choixOuvert = false; ui.vuePlanif = "frise"; ui.allerAujourdhui = true;
        save(); render(); toast("🗓️ Planning généré : tout reste modifiable"); break;
      case "pl-changer-methode": ui.choixOuvert = true; ui.choixMethode = pl.methode; ui.choixDuree = pl.sprint.duree; render(); break;
      case "pl-annuler-choix": ui.choixOuvert = false; render(); break;
      case "pl-vue": ui.vuePlanif = id; if (id === "frise") ui.allerAujourdhui = true; render(); window.scrollTo(0, 0); break;
      case "pl-filtre": ui.friseFiltres[id] = !ui.friseFiltres[id]; render(); break;
      case "pl-today": $("#friseToday")?.scrollIntoView({ behavior: "smooth", block: "center" }); break;
      case "pl-open":
        if (k === "reunion") ouvrirReunion(id);
        else if (k === "jalon") ouvrirJalon(id);
        else { ui.vuePlanif = k === "sprint" ? "sprints" : "jalons"; render(); window.scrollTo(0, 0); }
        break;
      case "pl-lock": {
        e.stopPropagation();
        const x = trouver(pl, k, id); if (!x) return;
        x.verrou = !x.verrou; save(); render();
        toast(x.verrou ? "🔒 Date verrouillée : elle ne bougera plus au recalcul" : "🔓 Déverrouillée : elle sera réalignée au prochain « Recalculer »");
        break;
      }
      case "pl-recalc": ouvrirRecalcul(); break;
      case "pl-rebase":
        if (!confirm("Figer le planning actuel comme nouvelle référence ? Les dates initiales actuelles seront remplacées par les dates revues, et les écarts repartiront de zéro.")) return;
        pl.jalons.forEach(j => { j.dateInitiale = j.date; });
        pl.phases.forEach(ph => { ph.debutInitial = ph.debut; ph.finInitiale = ph.fin; });
        pl.sprints.forEach(sp => { sp.debutInitial = sp.debut; sp.finInitiale = sp.fin; });
        pl.reunions.forEach(r => { r.dateInitiale = r.date; });
        pl.referenceLe = today(); save(); render(); toast("◇ Nouvelle référence enregistrée"); break;
      case "pl-new-reunion": ouvrirReunion(null); break;
      case "pl-new-jalon": ouvrirJalon(null); break;
      case "pl-passees": ui.reuPassees = el.checked; render(); break;
      case "pl-annuler-reu": { const r = trouver(pl, "reunion", id); r.annulee = !r.annulee; save(); render(); toast(r.annulee ? "Réunion annulée (elle reste visible, barrée)" : "↩︎ Réunion rétablie"); break; }
      case "pl-jalon-del": { const j = trouver(pl, "jalon", id); if (!confirm(`Supprimer le jalon « ${j.nom} » ?`)) return; pl.jalons = pl.jalons.filter(x => x.id !== id); appliquer(p, "🗑️ Jalon supprimé"); break; }
      case "pl-phase-add": pl.phases.push({ id: uid(), nom: "Nouvelle phase", jours: 28, sprints: false, verrou: false }); appliquer(p, "▶ Phase ajoutée à la fin"); break;
      case "pl-phase-del": {
        const ph = trouver(pl, "phase", id);
        if (!confirm(`Supprimer la phase « ${ph.nom} » ?${ph.sprints ? " Ses sprints seront aussi retirés." : ""}`)) return;
        pl.phases = pl.phases.filter(x => x.id !== id);
        pl.jalons.forEach(j => { if (j.ancre === "phase:" + id) j.ancre = null; });
        appliquer(p, "🗑️ Phase supprimée"); break;
      }
      case "pl-phase-up": case "pl-phase-down": {
        const i = pl.phases.findIndex(x => x.id === id); const j = act === "pl-phase-up" ? i - 1 : i + 1;
        if (j < 0 || j >= pl.phases.length) return;
        [pl.phases[i], pl.phases[j]] = [pl.phases[j], pl.phases[i]]; appliquer(p); break;
      }
    }
  });
  document.addEventListener("change", e => {
    if (e.target.id === "plDureeChoix") { ui.choixDuree = +e.target.value; return; }
    const d = e.target.dataset || {}; if (!d.pl) return;
    const p = proj(); const pl = p?.planning; if (!pl) return;
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    if (d.pl === "type") { const ty = typesComplets(pl)[d.id]; ty.actif = v; if (v && ["cadrage", "entretien", "avancement"].includes(d.id) && p.dateDebut && p.dateDebut < today()) ty.depuis = today(); appliquer(p, v ? "Réunions ajoutées au planning" : "Réunions automatiques de ce type retirées"); return; }
    if (d.pl === "param") {
      if (d.f === "regle") pl.types.copil.regle = v;
      else if (["tousLes", "rang", "jourSemaine"].includes(d.f)) pl.types.copil[d.f] = +v;
      else if (d.f === "entretienNombre") typesComplets(pl).entretien.nombre = +v;
      else if (d.f === "avancementTousLes") typesComplets(pl).avancement.tousLes = +v;
      else if (d.f === "avancementJour") typesComplets(pl).avancement.jourSemaine = +v;
      else pl.sprint[d.f] = +v;
      appliquer(p, "Planning mis à jour · les dates 🔒 n'ont pas bougé"); return;
    }
    const x = trouver(pl, d.pl, d.id); if (!x) return;
    if (d.pl === "phase") {
      if (d.f === "sprints") { pl.phases.forEach(ph => ph.sprints = ph.id === x.id); appliquer(p, "Les sprints se feront dans cette phase"); return; }
      if (d.f === "debut" && v) { x.debut = v; x.fin = addJ(v, Math.max(1, x.jours) - 1); }
      else if (d.f === "fin" && v) { if (v < x.debut) { toast("✋ La fin doit être après le début"); render(); return; } x.fin = v; x.jours = diffJ(x.debut, v) + 1; }
      else return;
      x.verrou = true; appliquer(p, "🔒 Phase verrouillée · les phases suivantes ont été décalées");
    } else if (d.pl === "sprint") {
      if (d.f === "duree") { x.duree = v ? +v : null; if (x.verrou) x.fin = finSprint(x.debut, x.duree || pl.sprint.duree); appliquer(p, "Durée du sprint mise à jour"); return; }
      if (d.f === "debut" && v) { x.debut = v; x.fin = finSprint(v, x.duree || pl.sprint.duree); }
      else if (d.f === "fin" && v) { if (v < x.debut) { toast("✋ La fin doit être après le début"); render(); return; } x.fin = v; }
      else return;
      x.verrou = true; appliquer(p, "🔒 Sprint verrouillé · les sprints suivants s'enchaînent derrière");
    } else if (d.pl === "jalon") {
      if (d.f === "date") { x.date = v; if (v && !x.dateInitiale) x.dateInitiale = v; if (x.ancre) x.verrou = true; appliquer(p, x.ancre ? "🔒 Jalon verrouillé" : "Jalon mis à jour"); }
      else if (d.f === "frise" || d.f === "atteint") { x[d.f] = v; save(); render(); }
    }
  });
  document.addEventListener("input", e => {
    const d = e.target.dataset || {}; if (!d.pl || !["nom", "objectif"].includes(d.f)) return;
    const pl = proj()?.planning; const x = pl && trouver(pl, d.pl, d.id); if (!x) return;
    x[d.f] = e.target.value; save();
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Étape 3 : frises horizontales (copil, portefeuille)
  // ═══════════════════════════════════════════════════════════════
  Object.assign(ui, { hPeriode: "projet", hOpts: { sprints: true, risques: true, autres: false, initial: true }, pfVue: "cartes", pfPeriode: "tout" });
  VUES_PLANIF.splice(1, 0, { id: "hfrise", nom: "Frise copil", emoji: "🖼️" });

  const tronque = (s, n) => (s = String(s || "")).length > n ? s.slice(0, Math.max(1, n - 1)) + "…" : s;
  const largeurDispo = () => Math.max(680, Math.min(1400, ($("#main")?.clientWidth || 1000) - (document.body.classList.contains("capture") ? 70 : 60)));
  const echelle = (debut, fin, x0, x1) => { const tot = Math.max(1, diffJ(debut, fin)); return d => x0 + Math.max(0, Math.min(1, diffJ(debut, d) / tot)) * (x1 - x0); };
  const nomMoisCourt = m => new Date(m + "-01T00:00").toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");

  // Axe des mois : graduations sur toute la hauteur + libellés en haut
  function axeMois(debut, fin, x, H, x0, x1) {
    const nbMois = diffJ(debut, fin) / 30.4; const pas = nbMois > 36 ? 3 : nbMois > 18 ? 2 : 1;
    let out = ""; let i = 0;
    for (let m = debut.slice(0, 7); m <= fin.slice(0, 7); m = moisSuivant(m), i++) {
      const d = m + "-01"; const xx = d < debut ? x0 : x(d);
      if (d >= debut) out += `<line x1="${xx}" y1="4" x2="${xx}" y2="${H}" class="hf-grid"/>`;
      if (i % pas === 0 && xx < x1 - 24) out += `<text x="${xx + 5}" y="17" class="hf-mois">${nomMoisCourt(m)}${m.endsWith("-01") || i === 0 ? " " + m.slice(0, 4) : ""}</text>`;
    }
    return out;
  }
  // Libellés qui ne se chevauchent pas : jusqu'à 3 niveaux
  function placeur(nb = 3) {
    const fins = Array(nb).fill(-1e9);
    return (cx, w) => { let lv = fins.findIndex(f => cx - w / 2 > f + 6); if (lv < 0) lv = fins.indexOf(Math.min(...fins)); fins[lv] = cx + w / 2; return lv; };
  }

  function friseHorizontale(p, W, o) {
    const pl = p.planning; const t = today(); const nums = numerosCopil(pl);
    let debut = p.dateDebut || t, fin = horizon(p, pl);
    if (o.periode === "aujourdhui") { debut = addJ(t, -45); fin = addJ(t, 180); }
    if (fin <= debut) fin = addJ(debut, 60);
    const L = 92, R = W - 14; const x = echelle(debut, fin, L, R);
    const dans = (a, b = a) => b >= debut && a <= fin;
    const clampX = (cx, w) => Math.min(R - w / 2, Math.max(L + w / 2, cx));
    let y = 26; let svg = ""; const lanes = [];
    const lane = (nom, h) => { lanes.push({ nom, y, h }); const y0 = y; y += h; return y0; };

    const fleche = (xi, xc, yy) => Math.abs(xc - xi) > 14 ? `<line x1="${xi + (xc > xi ? 9 : -9)}" y1="${yy}" x2="${xc + (xc > xi ? -11 : 11)}" y2="${yy}" class="hf-arrow" marker-end="url(#hfFleche)"/>` : "";
    if (pl.phases.length) {
      const bouge = ph => o.initial && ph.finInitiale && (ph.finInitiale !== ph.fin || ph.debutInitial !== ph.debut);
      const y0 = lane("Phases", pl.phases.some(bouge) ? 46 : 36);
      pl.phases.filter(ph => dans(ph.debut, ph.fin) || (bouge(ph) && dans(ph.debutInitial, ph.finInitiale))).forEach(ph => {
        const a = x(ph.debut), b = x(addJ(ph.fin, 1)); const enc = ph.debut <= t && ph.fin >= t;
        if (bouge(ph)) { const ia = x(ph.debutInitial), ib = x(addJ(ph.finInitiale, 1)); svg += `<rect x="${ia + 1}" y="${y0 + 34}" width="${Math.max(2, ib - ia - 2)}" height="6" rx="3" class="hf-init"><title>${esc(ph.nom)} · initialement ${fmtJM(ph.debutInitial)} → ${fmtJM(ph.finInitiale)}</title></rect>`; }
        const rl = o.reel ? Math.max(0, Math.min(100, +ph.reel || 0)) : null;
        svg += `<g><title>${esc(ph.nom)} · ${fmtJM(ph.debut)} → ${fmtJM(ph.fin)}${bouge(ph) ? ` (initialement ${fmtJM(ph.debutInitial)} → ${fmtJM(ph.finInitiale)})` : ""}${rl != null ? ` · réalisé ${rl} % (prévu ${Math.round(prevuPhase(ph) * 100)} %)` : ""}</title><rect x="${a + 1}" y="${y0 + 6}" width="${Math.max(2, b - a - 2)}" height="24" rx="5" class="hf-phase ${enc ? "enc" : ""}"/>
          ${rl ? `<rect x="${a + 1}" y="${y0 + 26}" width="${Math.max(2, (b - a - 2) * rl / 100)}" height="4" rx="2" class="hf-reel ${rl / 100 < prevuPhase(ph) - .05 ? "retard" : ""}"/>` : ""}
          ${rl != null && b - a > 70 ? `<text x="${b - 6}" y="${y0 + 22}" text-anchor="end" class="hf-t s ${enc ? "inv" : ""}">${rl} %</text>` : ""}
          ${b - a > 34 ? `<text x="${a + 8}" y="${y0 + 22}" class="hf-t ${enc ? "inv" : ""}">${esc(tronque(ph.nom, Math.floor((b - a - 14) / 6.6)))}</text>` : ""}</g>`;
      });
    }
    if (o.sprints && pl.sprints.length) {
      const bougeS = s => o.initial && s.finInitiale && (s.finInitiale !== s.fin || s.debutInitial !== s.debut);
      const y0 = lane("Sprints", pl.sprints.some(bougeS) ? 36 : 28);
      pl.sprints.filter(s => dans(s.debut, s.fin)).forEach(s => {
        const a = x(s.debut), b = x(addJ(s.fin, 3)); const enc = s.debut <= t && s.fin >= t;
        if (bougeS(s)) { const ia = x(s.debutInitial), ib = x(addJ(s.finInitiale, 3)); svg += `<rect x="${ia + 1}" y="${y0 + 27}" width="${Math.max(2, ib - ia - 2)}" height="5" rx="2.5" class="hf-init"><title>Sprint ${s.num} · initialement ${fmtJM(s.debutInitial)} → ${fmtJM(s.finInitiale)}</title></rect>`; }
        svg += `<g><title>Sprint ${s.num} · ${fmtJM(s.debut)} → ${fmtJM(s.fin)}${s.objectif ? " · " + esc(s.objectif) : ""}</title><rect x="${a + 1}" y="${y0 + 5}" width="${Math.max(2, b - a - 2)}" height="18" rx="4" class="hf-sprint ${s.num % 2 ? "" : "alt"} ${enc ? "enc" : ""}"/>
          ${b - a > 24 ? `<text x="${(a + b) / 2}" y="${y0 + 18}" text-anchor="middle" class="hf-t s ${enc ? "inv" : ""}">S${s.num}</text>` : ""}</g>`;
      });
    }
    const jal = pl.jalons.filter(j => j.frise && j.date && dans(j.date)).sort((a, b) => a.date.localeCompare(b.date));
    if (jal.length) {
      const place = placeur(4);
      const pos = jal.map(j => {
        const cx = x(j.date); const g = glissement(j); const lab = tronque(j.nom, 28);
        const w = (lab.length + (g ? 5 : 0)) * 7.1 + 10; const tx = clampX(cx, w);
        return { j, cx, g, lab, tx, lv: place(tx, w) };
      });
      const nbNiv = Math.max(...pos.map(o => o.lv)) + 1;
      const y0 = lane("Jalons", 30 + nbNiv * 15); const base = y0 + 14 + nbNiv * 15;
      svg += `<line x1="${L}" y1="${base}" x2="${R}" y2="${base}" class="hf-axe"/>`;
      pos.forEach(({ j, cx, g, lab, tx, lv }) => {
        const ly = base - 15 - lv * 15;
        const m = critMenace(p, j); const cls = j.atteint ? "ok" : m >= 9 ? "crit" : m >= 6 ? "warn" : "";
        if (o.initial && g && dans(j.dateInitiale)) { const xi = x(j.dateInitiale); svg += `<g><title>${esc(j.nom)} · date initiale ${fmtDate(j.dateInitiale)}</title><path d="M${xi} ${base - 7} l7 7 -7 7 -7 -7z" class="hf-ghost"/></g>${fleche(xi, cx, base)}`; }
        svg += `<g class="hf-click" data-act="pl-open" data-k="jalon" data-id="${j.id}"><title>${esc(j.nom)} · ${fmtDate(j.date)}${g ? ` · initialement le ${fmtDate(j.dateInitiale)} (${g > 0 ? "+" : ""}${g} j)` : ""}${risquesJalon(p, j).length ? " · menacé par " + risquesJalon(p, j).map(r => "R" + (p.risques.indexOf(r) + 1)).join(", ") : ""}</title>
          <line x1="${cx}" y1="${ly + 4}" x2="${cx}" y2="${base - 8}" class="hf-lead"/>
          <path d="M${cx} ${base - 8} l8 8 -8 8 -8 -8z" class="hf-jalon ${cls}"/>${j.atteint ? `<text x="${cx}" y="${base + 4}" text-anchor="middle" class="hf-check">✓</text>` : ""}
          <text x="${tx}" y="${ly}" text-anchor="middle" class="hf-t b">${esc(lab)}${g ? `<tspan class="${g > 0 ? "hf-late" : "hf-early"}"> ${g > 0 ? "+" : ""}${g}j</tspan>` : ""}</text></g>`;
      });
      if (o.risques) {
        const menaces = jal.filter(j => risquesJalon(p, j).length && !j.atteint);
        if (menaces.length) {
          const max = Math.min(3, Math.max(...menaces.map(j => risquesJalon(p, j).length)));
          const y1 = lane("Risques", 10 + max * 20 + (menaces.some(j => risquesJalon(p, j).length > 3) ? 14 : 0));
          menaces.forEach(j => {
            const cx = x(j.date); const rs = risquesJalon(p, j).sort((a, b) => crit(b) - crit(a));
            rs.slice(0, 3).forEach((r, i) => {
              const n = niveau(crit(r)); const lab = `R${p.risques.indexOf(r) + 1}`;
              svg += `<g class="hf-click" data-act="open" data-id="${r.id}"><title>${lab} · ${esc(r.titre)} (criticité ${crit(r)})</title><rect x="${cx - 17}" y="${y1 + 5 + i * 20}" width="34" height="17" rx="8" class="hf-risk ${n}"/><text x="${cx}" y="${y1 + 17 + i * 20}" text-anchor="middle" class="hf-t r">${lab}</text></g>`;
            });
            if (rs.length > 3) svg += `<text x="${cx}" y="${y1 + 18 + 3 * 20}" text-anchor="middle" class="hf-t s">+${rs.length - 3}</text>`;
          });
        }
      }
    }
    const cop = pl.reunions.filter(r => r.type === "copil" && !r.annulee && dans(r.date)).sort((a, b) => a.date.localeCompare(b.date));
    if (cop.length) {
      const y0 = lane("Copils", 52); const cy = y0 + 16; const place = placeur(2);
      svg += `<line x1="${L}" y1="${cy}" x2="${R}" y2="${cy}" class="hf-axe"/>`;
      cop.forEach(r => {
        const cx = x(r.date); const lab = `n°${nums.get(r.id) || ""}`; const lv = place(cx, lab.length * 7 + 4); const g = ecartReu(r);
        if (o.initial && g && dans(r.dateInitiale)) { const xi = x(r.dateInitiale); svg += `<g><title>${esc(titreReu(r, nums))} · date initiale ${fmtDate(r.dateInitiale)}</title><circle cx="${xi}" cy="${cy}" r="6" class="hf-ghost"/></g>${fleche(xi, cx, cy)}`; }
        svg += `<g class="hf-click" data-act="pl-open" data-k="reunion" data-id="${r.id}"><title>${esc(titreReu(r, nums))} · ${fmtDate(r.date)}${g ? ` · initialement le ${fmtDate(r.dateInitiale)} (${g > 0 ? "+" : ""}${g} j)` : ""}${r.motif ? " · " + esc(r.motif) : ""}</title>
          <circle cx="${cx}" cy="${cy}" r="7" class="hf-copil ${r.date < t ? "passe" : ""}"/>
          <text x="${cx}" y="${cy + 22 + lv * 12}" text-anchor="middle" class="hf-t s">${lab}</text></g>`;
      });
    }
    if (o.autres) {
      const au = pl.reunions.filter(r => !r.annulee && (TYPES_REU[r.type] || TYPES_REU.libre).cat === "autre" && dans(r.date)).sort((a, b) => a.date.localeCompare(b.date));
      if (au.length) {
        const y0 = lane("Réunions", 52); const cy = y0 + 16; const place = placeur(2);
        au.forEach(r => {
          const cx = x(r.date); const lab = tronque(titreReu(r, nums), 22); const w = lab.length * 6 + 6; const tx = clampX(cx, w); const lv = place(tx, w);
          svg += `<g class="hf-click" data-act="pl-open" data-k="reunion" data-id="${r.id}"><title>${esc(titreReu(r, nums))} · ${fmtDate(r.date)}</title><circle cx="${cx}" cy="${cy}" r="5" class="hf-autre"/><text x="${tx}" y="${cy + 20 + lv * 12}" text-anchor="middle" class="hf-t s">${esc(lab)}</text></g>`;
        });
      }
    }
    const H = y + 8;
    let fond = axeMois(debut, fin, x, H - 4, L, R);
    const JNO = joursNonOuvres(debut, fin);
    JNO.fermetures.forEach(f => { const a = x(f.debut < debut ? debut : f.debut), b = x(addJ(f.fin > fin ? fin : f.fin, 1)); fond += `<rect x="${a}" y="22" width="${Math.max(2, b - a)}" height="${H - 26}" class="hf-ferm"><title>🏖️ ${esc(f.libelle || "Fermeture")} · ${fmtJM(f.debut)} → ${fmtJM(f.fin)}</title></rect>`; });
    JNO.feries.forEach(j => { fond += `<line x1="${x(j.d)}" y1="22" x2="${x(j.d)}" y2="${H - 4}" class="hf-ferie"><title>🎌 ${esc(j.nom)} · ${fmtDate(j.d)}</title></line>`; });
    lanes.forEach((l, i) => { fond += `${i % 2 ? `<rect x="0" y="${l.y}" width="${R}" height="${l.h}" class="hf-band"/>` : ""}<text x="8" y="${l.y + l.h / 2 + 4}" class="hf-lane">${l.nom}</text>`; });
    let devant = "";
    if (t >= debut && t <= fin) { const xt = x(t); devant = `<line x1="${xt}" y1="22" x2="${xt}" y2="${H - 4}" class="hf-today"/><rect x="${clampX(xt, 84) - 42}" y="2" width="84" height="18" rx="9" class="hf-today-bg"/><text x="${clampX(xt, 84)}" y="15" text-anchor="middle" class="hf-today-t">Aujourd'hui</text>`; }
    // ordre de dessin : fond, aujourd'hui, contenu (les libellés restent lisibles)
    return `<svg class="hfrise" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Frise horizontale du projet"><defs><marker id="hfFleche" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8z" class="hf-arrow-head"/></marker></defs>${fond}${devant}${svg}</svg>`;
  }

  // Avancement réel (% saisi par phase) comparé à l'avancement prévu (part du temps écoulé dans chaque phase)
  const prevuPhase = (ph, t = today()) => ph.debut && ph.fin ? Math.max(0, Math.min(1, (diffJ(ph.debut, t) + 1) / (diffJ(ph.debut, ph.fin) + 1))) : 0;
  function avancementReel(p) {
    const pl = p.planning; if (!pl?.avReel) return null;
    const P = (pl.phases || []).filter(ph => ph.debut && ph.fin);
    if (P.length) {
      const poids = ph => diffJ(ph.debut, ph.fin) + 1; const tot = P.reduce((n, ph) => n + poids(ph), 0);
      return { source: "phases", reel: P.reduce((n, ph) => n + poids(ph) * (+ph.reel || 0) / 100, 0) / tot, prevu: P.reduce((n, ph) => n + poids(ph) * prevuPhase(ph), 0) / tot };
    }
    const A = analyseBacklog(p); const av = avancementTemps(p);
    return A && av ? { source: "backlog", reel: A.pct, prevu: av.pct } : null;
  }
  const libEcartAv = R => { const e = Math.round((R.reel - R.prevu) * 100); return Math.abs(e) < 3 ? `<span class="txt-ok">dans les temps</span>` : e < 0 ? `<span class="txt-danger">${e} pts de retard</span>` : `<span class="txt-ok">+${e} pts d'avance</span>`; };
  const chipAvReel = pl => `<button class="chip ${pl.avReel ? "on" : ""}" data-act="pl-avreel" title="Saisir le % réalisé de chaque phase et le comparer au prévu">📊 Avancement réel</button>`;
  document.addEventListener("change", e => {
    const id = e.target.dataset?.phreel; if (!id) return; const pl = proj()?.planning; const ph = pl?.phases.find(x => x.id === id); if (!ph) return;
    ph.reel = Math.max(0, Math.min(100, Math.round(+e.target.value || 0))); ph.reelLe = today(); save(); render();
  });
  function vueFriseCopil(p, pl) {
    const t = today(); const av = avancementTemps(p); const spr = sprintEnCours(pl); const o = { periode: ui.hPeriode, ...ui.hOpts, reel: !!pl.avReel }; const AR = avancementReel(p);
    const prochain = pl.jalons.filter(j => j.date && !j.atteint && j.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
    const glisses = pl.jalons.filter(j => !j.atteint && glissement(j) > 0);
    const copSuiv = prochainsPlanning(p).find(x => x.type === "copil");
    const chip = (on, act, id, nom) => `<button class="chip ${on ? "on" : ""}" data-act="${act}" data-id="${id}">${nom}</button>`;
    return `
      <div class="row cp-tools" style="margin-bottom:14px">
        <div class="seg2" style="width:auto"><button class="${ui.hPeriode === "projet" ? "on" : ""}" data-act="pl-hperiode" data-id="projet">Tout le projet</button><button class="${ui.hPeriode === "aujourdhui" ? "on" : ""}" data-act="pl-hperiode" data-id="aujourdhui">Autour d'aujourd'hui</button></div>
        <div class="chips" style="margin:0">${chipAvReel(pl)}${pl.sprints.length ? chip(ui.hOpts.sprints, "pl-hopt", "sprints", "Sprints") : ""}${chip(ui.hOpts.risques, "pl-hopt", "risques", "⚠ Risques sur les jalons")}${chip(ui.hOpts.autres, "pl-hopt", "autres", "📌 Autres réunions")}${chip(ui.hOpts.initial, "pl-hopt", "initial", "◇ Dates initiales")}</div>
        <span class="spacer"></span><button class="btn" data-act="capture">⛶ Mode capture</button>
      </div>
      <button class="btn ghost small cp-exit" data-act="quit-capture">✕ Quitter le mode capture (Échap)</button>
      <div class="copil hslide">
        <div class="cp-head">
          <div class="project-emoji" style="width:44px;height:44px;font-size:1.5rem" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div>
          <div style="flex:1"><div class="cp-proj">${esc(p.nom)} — Planning</div>
            <div class="muted">Situation au ${fmtDate(t)} · ${METHODES[pl.methode].emoji} ${METHODES[pl.methode].nom} · ${p.dateDebut ? fmtDate(p.dateDebut) : "?"} → ${p.dateFin ? fmtDate(p.dateFin) : "fin non fixée"} · référence du ${fmtDate(pl.referenceLe)}</div></div>
        </div>
        <div class="hf-tiles">
          <div><span>⏳ Temps écoulé</span><b>${av ? Math.round(av.pct * 100) + " %" : "—"}</b><small>${av ? (av.restants >= 0 ? `J-${av.restants}` : `dépassé de ${-av.restants} j`) : "pas de date de fin"}</small></div>
          ${AR ? `<div class="${AR.reel < AR.prevu - .03 ? "warn" : ""}"><span>📊 Avancement réel</span><b>${Math.round(AR.reel * 100)} %</b><small>prévu ${Math.round(AR.prevu * 100)} % · ${libEcartAv(AR)}</small></div>` : ""}
          ${pl.sprints.length ? `<div><span>🏃 Sprint en cours</span><b>${spr ? "Sprint " + spr.num : "—"}</b><small>${spr ? `${fmtJM(spr.debut)} → ${fmtJM(spr.fin)}` : "aucun aujourd'hui"}</small></div>` : ""}
          <div><span>◆ Prochain jalon</span><b>${prochain ? esc(tronque(prochain.nom, 26)) : "—"}</b><small>${prochain ? fmtDate(prochain.date) + (glissement(prochain) ? ` · ${glissement(prochain) > 0 ? "+" : ""}${glissement(prochain)} j` : "") : ""}</small></div>
          <div class="${glisses.length ? "warn" : ""}"><span>↗ Jalons en glissement</span><b>${glisses.length}</b><small>${glisses.length ? `jusqu'à +${Math.max(...glisses.map(glissement))} j` : "tout est à l'heure"}</small></div>
          <div><span>🏛️ Prochain copil</span><b>${copSuiv ? fmtDate(copSuiv.d) : "—"}</b><small>${copSuiv ? esc(copSuiv.txt) : ""}</small></div>
        </div>
        <div class="hf-wrap">${friseHorizontale(p, largeurDispo() - 56, o)}</div>
        <div class="cp-legend" style="margin-left:0">
          <span><i style="background:#5b6b80;border-radius:2px;transform:rotate(45deg)"></i>Jalon</span>
          <span><i style="background:#2e7d5b;border-radius:2px;transform:rotate(45deg)"></i>atteint</span>
          <span><i style="background:#d9822b;border-radius:2px;transform:rotate(45deg)"></i>menacé (risque élevé)</span>
          <span><i style="background:#c0392b;border-radius:2px;transform:rotate(45deg)"></i>menacé (risque critique)</span>
          <span><i style="background:var(--primary)"></i>Copil</span>
          ${ui.hOpts.initial ? `<span><i style="background:#fff;border:1.5px dashed #8a94a6;border-radius:2px;transform:rotate(45deg)"></i>date initiale → date revue</span>` : ""}
          <span><b style="color:#b13f38">+N j</b> écart par rapport à la date initiale</span>
          <span><i style="background:#d0574f;border-radius:0;width:2px;height:12px"></i>aujourd'hui</span>
        </div>
        ${ui.hOpts.initial ? tableauEcarts(p, pl) : ""}
      </div>
      <p class="muted cp-tools" style="font-size:.82rem;margin-top:10px">Astuce : passe en mode capture puis fais ta capture d'écran (Windows : touche Windows + Maj + S). Clique sur un jalon ou un copil pour le modifier.</p>`;
  }

  // Tableau « date initiale → date revue » des éléments qui ont bougé
  function tableauEcarts(p, pl) {
    const nums = numerosCopil(pl);
    const L = [
      ...pl.jalons.filter(j => glissement(j)).map(j => ({ ic: "◆", nom: j.nom, ini: j.dateInitiale, rev: j.date, g: glissement(j) })),
      ...pl.sprints.filter(sp => ecart(sp.finInitiale, sp.fin)).map(sp => ({ ic: "🏃", nom: `Fin du sprint ${sp.num}`, ini: sp.finInitiale, rev: sp.fin, g: ecart(sp.finInitiale, sp.fin) })),
      ...pl.phases.filter(ph => ecartPhase(ph)).map(ph => ({ ic: "▶", nom: `Fin de la phase « ${ph.nom} »`, ini: ph.finInitiale, rev: ph.fin, g: ecartPhase(ph) })),
      ...pl.reunions.filter(r => r.type === "copil" && !r.annulee && ecartReu(r)).map(r => ({ ic: "🏛️", nom: titreReu(r, nums), ini: r.dateInitiale, rev: r.date, g: ecartReu(r) })),
    ].sort((a, b) => a.rev.localeCompare(b.rev));
    if (!L.length) return `<p class="muted" style="font-size:.85rem;margin:12px 0 0">✅ Aucun écart : toutes les dates sont conformes à la référence du ${fmtDate(pl.referenceLe)}.</p>`;
    const max = 10;
    return `<div class="ecarts">
      <div class="ecarts-titre">Écarts par rapport à la référence du ${fmtDate(pl.referenceLe)}</div>
      <table><thead><tr><th>Élément</th><th>Date initiale</th><th>Date revue</th><th>Écart</th></tr></thead>
      <tbody>${L.slice(0, max).map(x => `<tr><td>${x.ic} ${esc(x.nom)}</td><td class="muted">${fmtDate(x.ini)}</td><td><b>${fmtDate(x.rev)}</b></td><td>${pillEcart(x.g, x.ini)}</td></tr>`).join("")}</tbody></table>
      ${L.length > max ? `<div class="muted" style="font-size:.78rem;margin-top:4px">… et ${L.length - max} autre(s) écart(s)</div>` : ""}
    </div>`;
  }

  // ─── Frise du portefeuille : une ligne par projet
  function frisePortefeuille(W) {
    const t = today();
    const lignes = S.projets.map(p => ({ p, d: p.dateDebut || p.creeLe || t, f: p.dateFin || (p.planning?.methode ? horizon(p, p.planning) : null) }));
    let debut, fin;
    if (ui.pfPeriode === "12mois") { debut = addJ(t, -30); fin = addJ(t, 335); }
    else { debut = lignes.reduce((m, l) => l.d < m ? l.d : m, t); fin = lignes.reduce((m, l) => (l.f || addJ(l.d, 180)) > m ? (l.f || addJ(l.d, 180)) : m, addJ(t, 60)); }
    const L = 220, R = W - 14, RH = 46; const x = echelle(debut, fin, L, R);
    const H = 28 + lignes.length * RH + 8;
    let svg = axeMois(debut, fin, x, H - 4, L, R);
    lignes.forEach((l, i) => {
      const { p } = l; const y0 = 28 + i * RH; const pl = p.planning; const finBarre = l.f || addJ(l.d, 180);
      if (i % 2) svg += `<rect x="0" y="${y0}" width="${R}" height="${RH}" class="hf-band"/>`;
      svg += `<g class="hf-click" data-act="ouvrir-projet" data-id="${p.id}"><title>Ouvrir ${esc(p.nom)}</title>
        <text x="8" y="${y0 + 20}" class="hf-t b">${esc(p.emoji)} ${esc(tronque(p.nom, 24))}</text>
        <text x="8" y="${y0 + 36}" class="hf-t s">${enTimeline(p) ? `${etapeCourante(p).emoji} ${esc(etapeCourante(p).court)} · ` : ""}${pl?.methode ? METHODES[pl.methode].nom : "pas de planning"}${p.code ? " · " + esc(p.code) : ""}</text></g>`;
      if (finBarre >= debut && l.d <= fin) {
        const a = x(l.d), b = x(finBarre);
        svg += `<rect x="${a}" y="${y0 + 12}" width="${Math.max(3, b - a)}" height="18" rx="5" fill="${p.couleur}" fill-opacity=".22" stroke="${p.couleur}" stroke-width="1.2" ${p.dateFin ? "" : `stroke-dasharray="4 3"`}/>`;
        (pl?.phases || []).filter(ph => ph.fin >= debut && ph.debut <= fin).forEach(ph => {
          const pa = x(ph.debut), pb = x(addJ(ph.fin, 1));
          svg += `<line x1="${pb}" y1="${y0 + 12}" x2="${pb}" y2="${y0 + 30}" stroke="${p.couleur}" stroke-width="1"/>${pb - pa > 46 ? `<text x="${pa + 5}" y="${y0 + 25}" class="hf-t s">${esc(tronque(ph.nom, Math.floor((pb - pa - 8) / 6)))}</text>` : ""}`;
        });
        if (!p.dateFin) svg += `<text x="${Math.min(R - 4, b + 4)}" y="${y0 + 25}" class="hf-t s">…</text>`;
      }
      (pl?.reunions || []).filter(r => r.type === "copil" && !r.annulee && r.date >= debut && r.date <= fin).forEach(r => { svg += `<circle cx="${x(r.date)}" cy="${y0 + 36}" r="3.5" class="hf-copil ${r.date < t ? "passe" : ""}"><title>Copil · ${fmtDate(r.date)}</title></circle>`; });
      (pl?.jalons || []).filter(j => j.frise && j.date && j.date >= debut && j.date <= fin).forEach(j => {
        const m = critMenace(p, j); const cls = j.atteint ? "ok" : m >= 9 ? "crit" : m >= 6 ? "warn" : ""; const cx = x(j.date);
        svg += `<path d="M${cx} ${y0 + 13} l7 7 -7 7 -7 -7z" class="hf-jalon ${cls}"><title>${esc(p.nom)} · ${esc(j.nom)} · ${fmtDate(j.date)}${glissement(j) ? ` (${glissement(j) > 0 ? "+" : ""}${glissement(j)} j)` : ""}</title></path>`;
      });
    });
    if (t >= debut && t <= fin) { const xt = x(t); svg += `<line x1="${xt}" y1="22" x2="${xt}" y2="${H - 4}" class="hf-today"/><rect x="${Math.min(R - 84, Math.max(L, xt - 42))}" y="2" width="84" height="18" rx="9" class="hf-today-bg"/><text x="${Math.min(R - 42, Math.max(L + 42, xt))}" y="15" text-anchor="middle" class="hf-today-t">Aujourd'hui</text>`; }
    return `<svg class="hfrise" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Frise de tous les projets">${svg}</svg>`;
  }

  function vueFrisePortefeuille() {
    return `
      <div class="row cp-tools" style="margin-bottom:14px">
        <div class="seg2" style="width:auto"><button class="${ui.pfPeriode === "tout" ? "on" : ""}" data-act="pl-pfperiode" data-id="tout">Toute la période</button><button class="${ui.pfPeriode === "12mois" ? "on" : ""}" data-act="pl-pfperiode" data-id="12mois">12 prochains mois</button></div>
        <span class="spacer"></span><button class="btn" data-act="capture">⛶ Mode capture</button>
      </div>
      <button class="btn ghost small cp-exit" data-act="quit-capture">✕ Quitter le mode capture (Échap)</button>
      <div class="copil hslide">
        <div class="cp-head"><div class="project-emoji" style="width:44px;height:44px;font-size:1.5rem">🗂️</div>
          <div><div class="cp-proj">Portefeuille de projets</div><div class="muted">Situation au ${fmtDate(today())} · ${S.projets.length} projet(s)</div></div></div>
        <div class="hf-wrap">${frisePortefeuille(largeurDispo() - 56)}</div>
        <div class="cp-legend" style="margin-left:0">
          <span><i style="background:#5b6b80;border-radius:2px;transform:rotate(45deg)"></i>Jalon (orange / rouge : menacé par un risque)</span>
          <span><i style="background:var(--primary)"></i>Copil</span>
          <span>Bordure en pointillés : date de fin non fixée</span>
        </div>
      </div>
      <p class="muted cp-tools" style="font-size:.82rem;margin-top:10px">Clique sur le nom d'un projet pour l'ouvrir.</p>`;
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const { act, id } = el.dataset;
    if (act === "pl-hperiode") { ui.hPeriode = id; render(); }
    else if (act === "pl-hopt") { ui.hOpts[id] = !ui.hOpts[id]; render(); }
    else if (act === "pl-avreel") { const pl = proj()?.planning; if (pl) { pl.avReel = !pl.avReel; save(); render(); toast(pl.avReel ? "📊 Avancement réel affiché : saisissez le % réalisé de chaque phase dans Jalons & phases" : "Avancement réel masqué (les % sont conservés)"); } }
    else if (act === "pl-pfperiode") { ui.pfPeriode = id; render(); }
    else if (act === "pf-vue") { ui.pfVue = id; render(); }
  });
  // Les frises horizontales s'adaptent à la largeur de la fenêtre
  let redimTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(redimTimer);
    redimTimer = setTimeout(() => { if ($(".hfrise") && $("#modalBack").hidden) render(); }, 200);
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Étape 4 : Instances & copils
  // ═══════════════════════════════════════════════════════════════
  const VUES_INST = [
    { id: "reunions", nom: "Réunions & comptes rendus", emoji: "📝" },
    { id: "copil", nom: "Préparer le copil", emoji: "🏛️" },
    { id: "diapos", nom: "Diapos copil", emoji: "🖼️" },
  ];
  const METEO = { soleil: ["☀️", "Tout va bien"], nuage: ["⛅", "Quelques points d'attention"], pluie: ["🌧️", "Difficultés"], orage: ["⛈️", "Situation critique"] };
  const AXES_METEO = { global: "Météo générale", delais: "Délais", budget: "Budget", perimetre: "Périmètre", equipe: "Équipe" };
  const DIAPOS = [
    { id: "titre", nom: "Page de titre", duree: 0 },
    { id: "odj", nom: "Ordre du jour", duree: 0 },
    { id: "meteo", nom: "Météo et faits marquants", duree: 10 },
    { id: "avancement", nom: "Avancement et frise du planning", duree: 15 },
    { id: "backlog", nom: "Backlog : avancement et vélocité", duree: 10 },
    { id: "ecarts", nom: "Écarts de planning", duree: 10 },
    { id: "risques", nom: "Top risques", duree: 15 },
    { id: "actions", nom: "Actions en retard et à venir", duree: 10 },
    { id: "releve", nom: "Relevé des décisions prises", duree: 5 },
    { id: "changements", nom: "Demandes de changement", duree: 10 },
    { id: "gonogo", nom: "Go / No-Go de mise en production", duree: 15 },
    { id: "decisions", nom: "Décisions attendues", duree: 20 },
    { id: "budget", nom: "Budget", duree: 10 },
    { id: "etapes", nom: "Prochaines étapes", duree: 5 },
  ];
  const FORMATS_RETRO = ["Start / Stop / Continue", "Météo de l'équipe", "4L (Liked, Learned, Lacked, Longed for)", "Speedboat (bateau)", "Mad / Sad / Glad"];
  Object.assign(ui, { vueInst: "reunions", copilSel: null, deckIdx: 0, instTout: false });

  // ─── Participants
  function participantsDefaut(p, r) {
    const I = p.interlocuteurs;
    if (r.type === "lancement") return I.map(i => i.id);
    if (r.type === "copil" || r.type === "cloture") return I.filter(i => i.copil).map(i => i.id);
    if (r.type === "cadrage") return I.filter(i => i.copil || ["Sponsor", "Chef de projet", "Directeur de projet", "Product Owner", "Référent métier", "MOA"].includes(i.role)).map(i => i.id);
    if (r.type === "entretien") return I.filter(i => ["Product Owner", "Chef de projet"].includes(i.role)).map(i => i.id);
    if (r.type === "avancement") return I.filter(i => ["Chef de projet", "Product Owner", "Référent métier", "Utilisateur clé", "MOA"].includes(i.role)).map(i => i.id);
    if (TYPES_REU[r.type]?.agile) return I.filter(i => ["Product Owner", "Scrum Master", "Équipe projet"].includes(i.role)).map(i => i.id);
    return [];
  }
  const participantsReu = (p, r) => (r.participants || participantsDefaut(p, r)).map(id => p.interlocuteurs.find(i => i.id === id)).filter(Boolean)
    .map(i => ({ ...(personne(i.personneId) || {}), role: i.role })).filter(x => x.nom);

  // ─── Données utiles aux ordres du jour
  const copilPrecedent = (pl, r) => pl.reunions.filter(x => x.type === "copil" && !x.annulee && x.date < r.date).sort((a, b) => b.date.localeCompare(a.date))[0];
  const copilSuivant = (pl, r) => pl.reunions.filter(x => x.type === "copil" && !x.annulee && x.date > r.date).sort((a, b) => a.date.localeCompare(b.date))[0];
  const critAu = (r, d) => { if (r.creeLe > d) return null; const h = (r.historique || []).filter(x => x.date <= d).pop(); return h ? h.p * h.g : (r.initial?.c ?? crit(r)); };
  function syntheseRisques(p, depuis) {
    const ouverts = p.risques.filter(r => !CLOS.has(r.statut));
    const hausse = depuis ? ouverts.filter(r => { const c0 = critAu(r, depuis); return c0 != null && crit(r) > c0; }) : [];
    const nouveaux = depuis ? p.risques.filter(r => r.creeLe > depuis) : [];
    return { ouverts, critiques: ouverts.filter(r => crit(r) >= 6).sort((a, b) => crit(b) - crit(a)), hausse, nouveaux };
  }
  const nomR = (p, r) => `R${p.risques.indexOf(r) + 1} ${r.titre}`;
  const actionsListe = p => p.risques.flatMap(r => r.actions.filter(a => !a.fait).map(a => ({ a, r })));
  const lignes = s => String(s || "").split("\n").map(x => x.trim()).filter(Boolean);
  function prepCopil(r) {
    r.prep = r.prep || {};
    const d = r.prep;
    d.meteo = d.meteo || {}; d.faits = d.faits || ""; d.decisions = d.decisions || ""; d.etapes = d.etapes || ""; d.budget = d.budget || "";
    if (!d.diapos) d.diapos = DIAPOS.map(x => x.id).filter(id => (id !== "budget" || (opt(proj(), "budget") && totauxBudget(proj()).prevu)) && (id !== "backlog" || dernierImport(proj())) && (id !== "changements" || changementsDe(proj()).length) && (id !== "gonogo" || proj().gonogo));
    // nouvelles diapos apparues depuis la préparation : ajoutées dès qu'elles ont du contenu
    if (!d.connues) d.connues = DIAPOS.map(x => x.id).filter(id => !["changements", "gonogo"].includes(id));
    const nouv = DIAPOS.map(x => x.id).filter(id => !d.connues.includes(id) && ((id === "changements" && changementsDe(proj()).length) || (id === "gonogo" && proj().gonogo)));
    if (nouv.length) { d.diapos = DIAPOS.map(x => x.id).filter(id => d.diapos.includes(id) || nouv.includes(id)); d.connues.push(...nouv); }
    return d;
  }

  // Ordre du jour proposé selon le type de réunion, nourri par les autres briques
  function ordreDuJour(p, r) {
    const pl = p.planning; const t = r.date;
    const spr = pl.sprints.find(s => r.cle?.endsWith(":" + s.id)) || pl.sprints.find(s => s.debut <= t && s.fin >= t);
    const suivant = spr ? pl.sprints.find(s => s.num === spr.num + 1) : null;
    const rs = syntheseRisques(p, spr?.debut);
    const jalProches = pl.jalons.filter(j => j.date && !j.atteint && j.date >= t).sort((a, b) => a.date.localeCompare(b.date));
    const I = (titre, duree, details = []) => ({ titre, duree, details: details.filter(Boolean) });
    switch (r.type) {
      case "copil": {
        const d = prepCopil(r); const prev = copilPrecedent(pl, r); const s = syntheseRisques(p, prev?.date);
        const ret = actionsToutes(p).filter(x => !x.a.fait && x.a.echeance && x.a.echeance < t);
        const prises = p.decisions.filter(x => x.statut !== "attente" && x.date <= t && x.instance !== r.id && (!prev || x.date >= prev.date));
        const attJ = p.decisions.filter(x => x.statut === "attente");
        const glisses = pl.jalons.filter(j => !j.atteint && glissement(j) > 0);
        const det = {
          meteo: [d.meteo.global ? `Météo : ${METEO[d.meteo.global][0]} ${METEO[d.meteo.global][1]}` : "Météo du projet à donner", ...lignes(d.faits).slice(0, 3)],
          avancement: [sprintEnCours(pl) ? `Sprint en cours : sprint ${sprintEnCours(pl).num}` : "", jalProches[0] ? `Prochain jalon : ${jalProches[0].nom} (${fmtJM(jalProches[0].date)}${glissement(jalProches[0]) ? `, ${glissement(jalProches[0]) > 0 ? "+" : ""}${glissement(jalProches[0])} j` : ""})` : ""],
          backlog: (() => { const A = analyseBacklog(p); return A ? [`${Math.round(A.pct * 100)} % terminé (${fmtU(A, A.fait)} sur ${fmtU(A, A.tot)})`, A.velocite ? `Vélocité : ${Math.round(A.velocite * 10) / 10} par sprint` : "", A.dateFinEstimee ? `Fin estimée : ${fmtDate(A.dateFinEstimee)}` : "", A.bloques.length ? `${A.bloques.length} élément(s) bloqué(s)` : ""] : ["Importer le backlog avant le copil"]; })(),
          ecarts: [glisses.length ? `${glisses.length} jalon(s) en glissement, jusqu'à +${Math.max(...glisses.map(glissement))} j` : "Aucun glissement de jalon"],
          risques: [`${s.critiques.length} risque(s) élevé(s) ou critique(s)`, ...s.critiques.slice(0, 3).map(x => nomR(p, x)), prev ? `${s.hausse.length} en hausse et ${s.nouveaux.length} nouveau(x) depuis le copil du ${fmtJM(prev.date)}` : ""],
          actions: [`${ret.length} action(s) en retard`, ...ret.slice(0, 3).map(x => x.a.texte)],
          releve: [`${prises.length} décision(s) prise(s)${prev ? ` depuis le copil du ${fmtJM(prev.date)}` : ""}`, ...prises.slice(0, 3).map(x => `${STATUTS_DEC[x.statut].emoji} ${x.titre}`)],
          decisions: [...lignes(d.decisions), ...attJ.map(x => x.titre)].length ? [...lignes(d.decisions), ...attJ.map(x => x.titre)] : ["Aucune décision attendue pour l'instant"],
          budget: (() => { const T = totauxBudget(p); return T.prevu ? [`Consommé ${fmtB(p, T.consomme)} sur ${fmtB(p, T.prevu)} (${Math.round(T.conso * 100)} %)`, `Atterrissage ${fmtB(p, T.atterrissage)} (${T.ecart > 0 ? "+" : ""}${fmtB(p, T.ecart)})`, d.budget] : [d.budget]; })(),
          etapes: [...jalProches.slice(0, 3).map(j => `${j.nom} · ${fmtJM(j.date)}`), ...lignes(d.etapes)],
          changements: (() => { const O = chgOuverts(p); return O.length ? [`${O.length} demande(s) à arbitrer`, ...O.slice(0, 3).map(c => `${numChg(p, c)} · ${c.titre}`)] : ["Aucune demande en attente"]; })(),
          gonogo: p.gonogo ? [p.gonogo.verdict ? `Décision : ${VERDICTS_GNG[p.gonogo.verdict.v].nom}` : evalGoNoGo(p).reco.lib, jalonMEP(p) ? `${jalonMEP(p).nom} · ${fmtDate(jalonMEP(p).date)}` : ""] : [],
        };
        return DIAPOS.filter(x => d.diapos.includes(x.id) && x.duree && (x.id !== "budget" || opt(p, "budget"))).map(x => I(x.nom, x.duree, det[x.id]));
      }
      case "revue": return [
        I("Rappel de l'objectif du sprint", 5, [spr?.objectif ? `Sprint ${spr.num} : ${spr.objectif}` : spr ? `Sprint ${spr.num} : objectif à rappeler` : ""]),
        I("Démonstration des éléments livrés", 35),
        I("Retours des parties prenantes", 10),
        I("Risques apparus pendant le sprint", 5, rs.nouveaux.length ? rs.nouveaux.map(x => nomR(p, x)) : ["Aucun nouveau risque enregistré"]),
        I("Prochaines échéances", 5, jalProches.slice(0, 2).map(j => `${j.nom} · ${fmtJM(j.date)}`)),
      ];
      case "retro": return [
        I("Suivi des actions de la rétro précédente", 10),
        I(`Format proposé : ${FORMATS_RETRO[((spr?.num || 1) - 1) % FORMATS_RETRO.length]}`, 30),
        I("Choix de 1 à 3 actions d'amélioration", 15),
        I("Mot de la fin", 5),
      ];
      case "planning": {
        const fin = spr?.fin || addJ(t, 14);
        const aPlanifier = actionsListe(p).filter(x => x.a.echeance && x.a.echeance <= fin);
        return [
          I("Objectif du sprint", 15, [spr ? `Sprint ${spr.num} · ${fmtJM(spr.debut)} → ${fmtJM(spr.fin)}` : "", spr?.objectif ? `Proposé : ${spr.objectif}` : ""]),
          I("Capacité de l'équipe (absences, congés)", 10),
          I("Sélection et découpage des éléments du backlog", 70),
          I("Risques à surveiller pendant le sprint", 10, rs.critiques.slice(0, 3).map(x => nomR(p, x))),
          I("Actions de traitement des risques à planifier", 15, aPlanifier.length ? aPlanifier.slice(0, 4).map(x => `${x.a.texte}${x.a.echeance ? ` (${fmtJM(x.a.echeance)})` : ""}`) : ["Aucune action de risque à échéance dans ce sprint"]),
        ];
      }
      case "affinage": return [
        I("Revue des éléments prévus pour les prochains sprints", 25, [suivant ? `Sprint ${suivant.num} à partir du ${fmtJM(suivant.debut)}` : ""]),
        I("Découpage et estimation", 25),
        I("Dépendances et risques", 10, rs.critiques.slice(0, 2).map(x => nomR(p, x))),
      ];
      case "lancement": return [
        I("Présentation du projet", 15, [p.enjeu ? `Enjeu : ${p.enjeu}` : "", ...lignes(p.objectifs).slice(0, 3)]),
        I("Périmètre", 10, [p.perimetreIn ? `Inclus : ${tronque(p.perimetreIn.replace(/\n/g, ", "), 120)}` : "", p.perimetreOut ? `Exclu : ${tronque(p.perimetreOut.replace(/\n/g, ", "), 120)}` : ""]),
        I("Organisation et rôles", 15, p.interlocuteurs.slice(0, 6).map(i => `${i.role} : ${personne(i.personneId)?.nom || "?"}`)),
        I("Planning et jalons clés", 15, [pl.methode ? `Méthode : ${METHODES[pl.methode].nom}` : "", ...jalProches.slice(0, 4).map(j => `${j.nom} · ${fmtJM(j.date)}`)]),
        I("Principaux risques identifiés", 15, rs.critiques.slice(0, 4).map(x => nomR(p, x))),
        I("Instances et règles de fonctionnement", 10, [`Copil : ${pl.types.copil.regle === "sprints" ? `tous les ${pl.types.copil.tousLes} sprints` : pl.types.copil.regle === "jalons" ? "à chaque jalon" : "mensuel"}`]),
      ];
      case "cadrage": return [
        I("Contexte et enjeux", 15, [p.description ? tronque(p.description, 140) : "", p.enjeu ? `Enjeu : ${p.enjeu}` : ""]),
        I("Objectifs et indicateurs de réussite", 20, lignes(p.objectifs).length ? lignes(p.objectifs).slice(0, 4) : ["Objectifs mesurables à définir"]),
        I("Périmètre : ce qui est inclus, ce qui est exclu", 20, [p.perimetreIn ? `Inclus : ${tronque(p.perimetreIn.replace(/\n/g, ", "), 120)}` : "Inclus : à préciser", p.perimetreOut ? `Exclu : ${tronque(p.perimetreOut.replace(/\n/g, ", "), 120)}` : "Exclu : à préciser"]),
        I("Parties prenantes et gouvernance", 15, p.interlocuteurs.slice(0, 5).map(i => `${i.role} : ${personne(i.personneId)?.nom || "?"}`)),
        I("Contraintes, hypothèses et risques", 20, [...rs.critiques.slice(0, 3).map(x => nomR(p, x)), "Contraintes de délai, de budget, techniques, réglementaires"]),
        I("Planning macro et jalons", 15, [pl.methode ? `Méthode : ${METHODES[pl.methode].nom}` : "", ...jalProches.slice(0, 3).map(j => `${j.nom} · ${fmtJM(j.date)}`)]),
        I("Prochaines étapes et livrables du cadrage", 15, ["Note de cadrage à rédiger et à faire valider", "Entretiens utilisateurs à planifier"]),
      ];
      case "entretien": return [
        I("Introduction", 5, ["Présenter les interlocuteurs et le contexte de l'entretien", "Présenter le déroulé de l'entretien", "Demander l'accord pour la prise de notes et l'enregistrement audio / vidéo ; rappeler que les informations sont confidentielles et peuvent être supprimées à tout moment sur demande écrite", "Demander s'il y a des questions"]),
        I("Dernière utilisation", 15, ["Pourriez-vous nous raconter la dernière fois que vous avez utilisé l'outil (ou réalisé cette tâche) ?", "Quel était l'objectif ?", "Dans quel contexte ?", "Qu'avez-vous pu faire ?", "Qu'est-ce qui vous a manqué ?"]),
        I("Freins et ressenti", 10, ["Quels sont les freins, les frustrations et les difficultés que vous avez rencontrés ?", "Que pensent vos collègues de l'outil ?"]),
        I("Questions orientées métier", 15, ["À adapter au projet : organisation du travail, données utilisées, qualité et cohérence des données, projection de l'outil dans le quotidien"]),
        I("Approfondissement", 5, ["Par rapport à vos réponses au questionnaire, pouvez-vous approfondir le point … (à compléter selon les réponses)"]),
        I("La baguette magique", 5, ["Si vous aviez une baguette magique, que rajouteriez-vous à l'outil pour qu'il soit incroyable ?"]),
        I("Conclusion", 5, ["Remercier, expliquer la suite donnée aux retours"]),
      ];
      case "avancement": {
        const ret = actionsToutes(p).filter(x => !x.a.fait && x.a.echeance && x.a.echeance < t);
        const A = analyseBacklog(p); const spr = sprintEnCours(pl);
        return [
          I("Avancement depuis le dernier point", 10, [spr ? `Sprint ${spr.num} en cours` : "", A ? `Backlog : ${Math.round(A.pct * 100)} % terminé` : "", jalProches[0] ? `Prochain jalon : ${jalProches[0].nom} · ${fmtJM(jalProches[0].date)}` : ""]),
          I("Démonstration ou réalisations à montrer", 10),
          I("Retours et besoins du métier", 10),
          I("Points ouverts", 5, [`${ret.length} action(s) en retard`, ...chgOuverts(p).slice(0, 2).map(c => `Demande ${numChg(p, c)} : ${c.titre}`)]),
          I("Décisions à prendre", 5, p.decisions.filter(x => x.statut === "attente").slice(0, 3).map(x => x.titre)),
          I("Prochaines étapes", 5),
        ];
      }
      case "cloture": {
        const tous = p.risques;
        return [
          I("Bilan des objectifs", 20, lignes(p.objectifs).slice(0, 4)),
          I("Bilan du planning", 15, pl.jalons.filter(j => glissement(j)).slice(0, 4).map(j => `${j.nom} : ${glissement(j) > 0 ? "+" : ""}${glissement(j)} j`)),
          I("Bilan des risques", 15, [`${tous.filter(x => x.statut === "leve").length} levé(s), ${tous.filter(x => x.statut === "survenu").length} survenu(s), ${tous.filter(x => !CLOS.has(x.statut)).length} encore ouvert(s)`]),
          I("Retour d'expérience", 30, [(p.retex || []).length ? `${p.retex.length} enseignement(s) déjà recueilli(s) dans l'onglet RETEX` : "Préparer le RETEX dans l'onglet 🎓 RETEX"]),
          I("Actions de clôture et transfert", 10),
        ];
      }
      default: return [];
    }
  }
  const odjTexte = items => items.map((x, i) => `${i + 1}. ${x.titre}${x.duree ? ` (${x.duree} min)` : ""}${x.details.map(d => `\n   - ${d}`).join("")}`).join("\n");
  const odjHtml = items => items.length ? `<ol class="odj">${items.map(x => `<li><b>${esc(x.titre)}</b>${x.duree ? ` <span class="muted">· ${x.duree} min</span>` : ""}${x.details.length ? `<ul>${x.details.map(d => `<li>${esc(d)}</li>`).join("")}</ul>` : ""}</li>`).join("")}</ol>` : `<p class="muted" style="margin:0">Pas d'ordre du jour type pour cette réunion.</p>`;

  // ─── Export Outlook (.ics)
  const icsTxt = s => String(s || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const plier = l => { const out = []; while (l.length > 60) { out.push(l.slice(0, 60)); l = " " + l.slice(60); } out.push(l); return out.join("\r\n"); };
  const heureOk = h => { const m = String(h || "").match(/(\d{1,2})\s*[:hH]?\s*(\d{2})?/); return m ? `${m[1].padStart(2, "0")}:${m[2] || "00"}` : "09:00"; };
  const icsDate = (d, h) => d.replace(/-/g, "") + "T" + heureOk(h).replace(":", "") + "00";
  const plusMinutes = (d, h, min) => { const [H, M] = heureOk(h).split(":").map(Number); const tot = H * 60 + M + (+min || 60); return { d: addJ(d, Math.floor(tot / 1440)), h: `${String(Math.floor(tot / 60) % 24).padStart(2, "0")}:${String(tot % 60).padStart(2, "0")}` }; };
  const VTZ = ["BEGIN:VTIMEZONE", "TZID:Europe/Paris", "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST", "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET", "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD", "END:VTIMEZONE"];
  function genererIcs(p, reunions, { participants = true } = {}) {
    const nums = numerosCopil(p.planning); const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
    const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cockpit Projet//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", ...VTZ];
    reunions.forEach(r => {
      const fin = plusMinutes(r.date, r.heure, r.duree);
      const odj = odjTexte(ordreDuJour(p, r));
      const desc = [odj && "Ordre du jour proposé :\n" + odj, r.notes && "Notes :\n" + r.notes].filter(Boolean).join("\n\n");
      L.push("BEGIN:VEVENT", `UID:${r.id}@cockpit-projet`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/Paris:${icsDate(r.date, r.heure)}`, `DTEND;TZID=Europe/Paris:${icsDate(fin.d, fin.h)}`,
        `SUMMARY:${icsTxt(`[${p.code || p.nom}] ${titreReu(r, nums)}`)}`, `DESCRIPTION:${icsTxt(desc)}`);
      if (participants) participantsReu(p, r).filter(x => x.email).forEach(x => L.push(`ATTENDEE;CN=${icsTxt(x.nom)};ROLE=REQ-PARTICIPANT:mailto:${x.email}`));
      if (r.annulee) L.push("STATUS:CANCELLED");
      L.push("END:VEVENT");
    });
    L.push("END:VCALENDAR");
    return L.map(plier).join("\r\n");
  }
  const nomFichier = p => (p.code || p.nom).replace(/[^\w-]+/g, "_");
  function telechargerIcs(p, reunions, nom, opts) {
    if (!reunions.length) { toast("Aucune réunion à exporter"); return; }
    telecharger(`${nom}.ics`, genererIcs(p, reunions, opts), "text/calendar;charset=utf-8");
    toast(`📅 ${reunions.length} réunion(s) exportée(s) : ouvre le fichier pour les ajouter à Outlook`);
  }
  function ouvrirExportIcs() {
    const p = proj(); const pl = p.planning; const t = today();
    const st = { periode: "avenir", copil: true, agile: true, autre: true, participants: true };
    const choix = () => pl.reunions.filter(r => !r.annulee && (st.periode === "tout" || r.date >= t) && st[(TYPES_REU[r.type] || TYPES_REU.libre).cat]);
    const draw = () => {
      openModal(`
        <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">📅 Exporter vers Outlook</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
        <div class="modal-body">
          <div class="seg2"><button class="${st.periode === "avenir" ? "on" : ""}" data-x="periode" data-v="avenir">Réunions à venir</button><button class="${st.periode === "tout" ? "on" : ""}" data-x="periode" data-v="tout">Toutes</button></div>
          <div>${[["copil", "🏛️ Copils"], pl.sprints.length ? ["agile", "🧩 Cérémonies agiles"] : null, ["autre", "📌 Autres réunions"]].filter(Boolean).map(([k, l]) => `<label class="type-row"><input type="checkbox" data-c="${k}" ${st[k] ? "checked" : ""}><span>${l}</span></label>`).join("")}
            <label class="type-row"><input type="checkbox" data-c="participants" ${st.participants ? "checked" : ""}><span>👥 Ajouter les participants (adresses e-mail de l'annuaire)</span></label></div>
          <p style="margin:0"><b>${choix().length}</b> réunion(s) seront exportées, avec leur ordre du jour proposé.</p>
          <div class="aide">Le fichier .ics s'ouvre avec Outlook : les réunions s'ajoutent à ton agenda. Tu pourras ensuite envoyer les invitations depuis Outlook. Rien n'est envoyé automatiquement.</div>
        </div>
        <div class="modal-foot"><span></span><div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button><button class="btn" id="icsOk">📅 Télécharger le fichier</button></div></div>`);
      $$("#modal [data-x]").forEach(b => b.onclick = () => { st[b.dataset.x] = b.dataset.v; draw(); });
      $$("#modal [data-c]").forEach(c => c.onchange = () => { st[c.dataset.c] = c.checked; draw(); });
      $("#icsOk").onclick = () => { telechargerIcs(p, choix(), `${nomFichier(p)}-reunions`, { participants: st.participants }); closeModal(); };
    };
    draw();
  }

  // ─── Vues de la brique
  function vueInstances() {
    const p = proj(); const pl = p.planning;
    const fn = { copil: vuePrepCopil, diapos: vueDiapos }[ui.vueInst];
    if (!fn || !pl?.methode) return vueModuleCR();
    return fn(p, pl);
  }

  function vueInstReunions(p, pl) {
    const t = today(); const nums = numerosCopil(pl); const lim = addJ(t, 42);
    const liste = pl.reunions.filter(r => !r.annulee && r.date >= t && (ui.instTout || r.date <= lim)).sort((a, b) => a.date.localeCompare(b.date) || heureOk(a.heure).localeCompare(heureOk(b.heure)));
    let sem = ""; let h = "";
    liste.forEach(r => {
      const lundi = addJ(r.date, -((jSem(r.date) + 6) % 7));
      if (lundi !== sem) { sem = lundi; h += `<div class="fr-mois" style="padding-left:0">Semaine du ${fmtJM(lundi)}</div>`; }
      const T = TYPES_REU[r.type] || TYPES_REU.libre; const odj = ordreDuJour(p, r); const pa = participantsReu(p, r);
      h += `<div class="inst-card">
        <span class="date-chip">${fmtCourt(r.date)}<br>${heureOk(r.heure).replace(":", "h")}</span>
        <div style="flex:1;min-width:0">
          <div class="row" style="gap:6px"><b>${T.emoji} ${esc(titreReu(r, nums))}</b>${r.type === "copil" && r.motif ? `<span class="muted" style="font-size:.82rem">${esc(r.motif)}</span>` : ""}</div>
          <div class="muted" style="font-size:.82rem;margin-top:2px">${odj.length ? odj.map(x => esc(x.titre)).slice(0, 4).join(" · ") + (odj.length > 4 ? " …" : "") : "Pas d'ordre du jour type"}</div>
          <div class="muted" style="font-size:.78rem;margin-top:2px">👥 ${pa.length ? pa.map(x => esc(x.nom)).slice(0, 5).join(", ") + (pa.length > 5 ? ` +${pa.length - 5}` : "") : "participants à choisir"}</div>
          ${puceTaches(p, r)}
        </div>
        <div class="row" style="gap:6px;flex-wrap:nowrap">
          ${r.type === "copil" ? `<button class="btn small" data-act="in-prep" data-id="${r.id}">🏛️ Préparer</button>` : ""}
          <button class="btn ghost small" data-act="pl-open" data-k="reunion" data-id="${r.id}">Ordre du jour</button>
          <button class="btn ghost small icon" data-act="in-ics" data-id="${r.id}" title="Télécharger pour Outlook (.ics)">📅</button>
        </div>
      </div>`;
    });
    return `
      <div class="toolbar"><h2 style="margin:0">🏛️ Instances & copils</h2><span class="muted">${ui.instTout ? "toutes les réunions à venir" : "6 prochaines semaines"}</span><span class="spacer"></span>
        <label class="row" style="font-size:.88rem;cursor:pointer"><input type="checkbox" data-act="in-tout" ${ui.instTout ? "checked" : ""}> Tout afficher</label>
        <button class="btn ghost small" data-act="pl-new-reunion">＋ Réunion</button>
        <button class="btn small" data-act="in-export">📅 Exporter vers Outlook</button></div>
      ${liste.length ? `<div class="inst-list">${h}</div>` : `<div class="empty"><span class="big">🗓️</span>Aucune réunion à venir sur cette période.</div>`}`;
  }

  const copilsDispo = pl => pl.reunions.filter(r => r.type === "copil" && !r.annulee).sort((a, b) => a.date.localeCompare(b.date));
  function copilChoisi(pl) {
    const L = copilsDispo(pl);
    let r = L.find(x => x.id === ui.copilSel);
    if (!r) { r = L.find(x => x.date >= today()) || L[L.length - 1]; ui.copilSel = r?.id || null; }
    return r;
  }

  function vuePrepCopil(p, pl) {
    const r = copilChoisi(pl); const nums = numerosCopil(pl);
    if (!r) return `<div class="empty"><span class="big">🏛️</span>Aucun copil planifié. Active les copils dans <span class="link" data-act="module" data-id="planif">Planification › Réunions</span>, ou ajoute-en un à la main.</div>`;
    const d = prepCopil(r); const odj = ordreDuJour(p, r); const prev = copilPrecedent(pl, r);
    const total = odj.reduce((n, x) => n + x.duree, 0);
    const choixMeteo = axe => `<div class="meteo-row"><span>${AXES_METEO[axe]}</span><div class="meteo-pick">${Object.entries(METEO).map(([k, [e, l]]) => `<button class="${d.meteo[axe] === k ? "on" : ""}" data-act="in-meteo" data-axe="${axe}" data-id="${k}" title="${l}">${e}</button>`).join("")}</div></div>`;
    const sel = p.interlocuteurs; const actifs = r.participants || participantsDefaut(p, r);
    return `
      <div class="toolbar">
        <h2 style="margin:0">🏛️ Préparer le copil</h2>
        <select class="inp" id="inCopilSel" style="width:auto">${copilsDispo(pl).map(x => `<option value="${x.id}" ${x.id === r.id ? "selected" : ""}>${esc(titreReu(x, nums))} · ${fmtDate(x.date)}</option>`).join("")}</select>
        <span class="spacer"></span>
        <button class="btn ghost small" data-act="cr-ouvrir" data-id="${r.id}" title="Participants, points abordés, décisions, actions">📝 Ordre du jour & compte rendu</button>
        <button class="btn ghost small" data-act="in-copier" data-id="${r.id}">📋 Copier l'ordre du jour</button>
        <button class="btn ghost small" data-act="in-ics" data-id="${r.id}">📅 Invitation .ics</button>
        <button class="btn small" data-act="in-vue" data-id="diapos">🖼️ Voir les diapos →</button>
      </div>
      <p class="muted" style="margin-top:-6px;font-size:.88rem">${fmtCourt(r.date)} à ${heureOk(r.heure).replace(":", "h")} · ${r.duree || 90} min${prev ? ` · copil précédent le ${fmtDate(prev.date)}` : " · premier copil"}. Tout ce que tu saisis ici est enregistré avec ce copil.</p>
      <div class="prep-grid">
        <div style="display:grid;gap:16px">
          <section class="panel"><h3>🌤️ Météo du projet</h3>${Object.keys(AXES_METEO).filter(a => a !== "budget" || opt(p, "budget")).map(choixMeteo).join("")}</section>
          <section class="panel"><h3>📈 Évolution de la météo</h3>${evolutionMeteo(p, pl, { W: Math.round(Math.min(620, largeurDispo() * 0.5)) })}</section>
          <section class="panel"><h3>📣 Faits marquants depuis le dernier copil</h3><textarea class="inp" rows="4" data-prep="faits" placeholder="Un fait par ligne">${esc(d.faits)}</textarea></section>
          <section class="panel"><h3>⚖️ Décisions attendues</h3><textarea class="inp" rows="4" data-prep="decisions" placeholder="Une décision par ligne. Ex : valider le report du jalon de recette">${esc(d.decisions)}</textarea></section>
          <section class="panel"><h3>➡️ Prochaines étapes (en plus des jalons)</h3><textarea class="inp" rows="3" data-prep="etapes" placeholder="Une étape par ligne">${esc(d.etapes)}</textarea></section>
          ${opt(p, "budget") && d.diapos.includes("budget") ? `<section class="panel"><h3>💶 Commentaire budget</h3><textarea class="inp" rows="2" data-prep="budget" placeholder="Consommé, reste à faire, alertes…">${esc(d.budget)}</textarea></section>` : ""}
          <section class="panel"><h3>👥 Participants</h3>
            ${sel.length ? sel.map(i => `<label class="type-row"><input type="checkbox" data-act="in-part" data-reu="${r.id}" data-id="${i.id}" ${actifs.includes(i.id) ? "checked" : ""}><span>${esc(personne(i.personneId)?.nom || "?")} <span class="muted" style="font-size:.8rem">· ${esc(i.role)}</span></span></label>`).join("") : `<p class="muted">Aucun interlocuteur. <span class="link" data-act="module" data-id="identite">En ajouter</span></p>`}
            <div class="aide">Par défaut : les interlocuteurs cochés « copil » dans la fiche d'identité.</div></section>
        </div>
        <div style="display:grid;gap:16px;align-content:start">
          ${tachesReunion(p, r).length ? `<section class="panel"><div class="row" style="margin-bottom:6px"><h3 style="margin:0">✅ Tâches de préparation</h3><span class="spacer"></span><span class="link" data-act="pl-vue" data-id="taches" data-module="planif">Régler</span></div>${puceTaches(p, r)}</section>` : ""}
          <section class="panel"><h3>🖼️ Diapos à présenter</h3>
            ${DIAPOS.filter(x => x.id !== "budget" || opt(p, "budget")).map(x => `<label class="type-row"><input type="checkbox" data-act="in-diapo" data-reu="${r.id}" data-id="${x.id}" ${d.diapos.includes(x.id) ? "checked" : ""}><span>${x.nom}</span><span class="spacer"></span>${x.duree ? `<span class="muted" style="font-size:.8rem">${x.duree} min</span>` : ""}</label>`).join("")}
          </section>
          <section class="panel"><div class="row" style="margin-bottom:6px"><h3 style="margin:0">📋 Ordre du jour proposé</h3><span class="spacer"></span><span class="pill soft">${total} min</span></div>${odjHtml(odj)}</section>
        </div>
      </div>`;
  }

  // ─── Diapos : chacune au format 16:9, affichées une par une en mode capture
  function vueDiapos(p, pl) {
    const r = copilChoisi(pl); const nums = numerosCopil(pl);
    if (!r) return vuePrepCopil(p, pl);
    const d = prepCopil(r); const ids = DIAPOS.map(x => x.id).filter(id => d.diapos.includes(id) && (id !== "budget" || opt(p, "budget")));
    if (!ids.length) return `<div class="empty">Aucune diapo cochée. <span class="link" data-act="in-vue" data-id="copil">Préparer le copil</span></div>`;
    ui.deckIdx = Math.min(ui.deckIdx, ids.length - 1);
    const W = Math.min(1280, largeurDispo());
    const slides = ids.map((id, i) => `<section class="slide ${i === ui.deckIdx ? "courante" : ""}" style="max-width:${W}px">${diapo(id, p, pl, r, nums, W)}<div class="slide-foot">${esc(p.nom)} · ${esc(titreReu(r, nums))} · ${fmtDate(r.date)}<span class="spacer"></span>${i + 1} / ${ids.length}</div></section>`).join("");
    return `
      <div class="toolbar cp-tools">
        <h2 style="margin:0">🖼️ Diapos copil</h2>
        <select class="inp" id="inCopilSel" style="width:auto">${copilsDispo(pl).map(x => `<option value="${x.id}" ${x.id === r.id ? "selected" : ""}>${esc(titreReu(x, nums))} · ${fmtDate(x.date)}</option>`).join("")}</select>
        <span class="muted">${ids.length} diapo(s)</span><span class="spacer"></span>
        <button class="btn ghost small" data-act="in-vue" data-id="copil">✏️ Préparer / choisir les diapos</button>
        <button class="btn" data-act="in-capture">⛶ Mode capture</button>
      </div>
      <div class="deck-nav cp-exit"><button class="btn ghost small" data-act="in-deck" data-id="-1">←</button><span>${ui.deckIdx + 1} / ${ids.length}</span><button class="btn ghost small" data-act="in-deck" data-id="1">→</button><button class="btn ghost small" data-act="quit-capture">✕ Quitter (Échap)</button></div>
      <div class="deck">${slides}</div>
      <p class="muted cp-tools" style="font-size:.82rem">En mode capture, une seule diapo s'affiche : capture-la (Windows + Maj + S), puis passe à la suivante avec la flèche → du clavier.</p>`;
  }

  function diapo(id, p, pl, r, nums, W) {
    const d = r.prep; const t = r.date < today() ? r.date : today(); const prev = copilPrecedent(pl, r); const suiv = copilSuivant(pl, r);
    const titre = (txt, sous = "") => `<div class="slide-titre"><h2>${txt}</h2>${sous ? `<span class="muted">${sous}</span>` : ""}</div>`;
    switch (id) {
      case "titre": {
        const pa = participantsReu(p, r);
        return `<div class="slide-cover"><div class="project-emoji" style="width:72px;height:72px;font-size:2.4rem" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div>
          <div class="cover-nom">${esc(p.nom)}</div><div class="cover-sous">${esc(titreReu(r, nums))} · ${fmtCourt(r.date)} ${new Date(r.date + "T00:00").getFullYear()}</div>
          ${p.code ? `<span class="code-pill">${esc(p.code)}</span>` : ""}
          ${pa.length ? `<div class="cover-part">${pa.map(x => `<span>${esc(x.nom)} <span class="muted">· ${esc(x.role)}</span></span>`).join("")}</div>` : ""}</div>`;
      }
      case "odj": {
        const odj = ordreDuJour(p, r); let h = heureOk(r.heure);
        return titre("Ordre du jour") + `<ol class="odj big">${odj.map(x => { const deb = h; h = plusMinutes(r.date, h, x.duree).h; return `<li><span class="odj-h">${deb.replace(":", "h")}</span><b>${esc(x.titre)}</b> <span class="muted">· ${x.duree} min</span></li>`; }).join("")}</ol>`;
      }
      case "meteo": {
        const m = d.meteo; const faits = lignes(d.faits);
        return titre("Météo et faits marquants") + `<div class="slide-2col">
          <div class="meteo-big">${m.global ? `<div class="meteo-ic">${METEO[m.global][0]}</div><div><b>${METEO[m.global][1]}</b></div>` : `<div class="muted">Météo générale non renseignée</div>`}
            <div class="meteo-axes">${["delais", "budget", "perimetre", "equipe"].filter(a => a !== "budget" || opt(p, "budget")).map(a => `<div><span>${AXES_METEO[a]}</span><b>${m[a] ? METEO[m[a]][0] : "—"}</b></div>`).join("")}</div></div>
          <div><h3>Faits marquants${prev ? ` depuis le ${fmtJM(prev.date)}` : ""}</h3>${faits.length ? `<ul class="slide-list">${faits.map(f => `<li>${esc(f)}</li>`).join("")}</ul>` : `<p class="muted">Aucun fait marquant saisi.</p>`}</div></div><h3 style="margin-top:16px">📈 Évolution copil après copil</h3>${evolutionMeteo(p, pl, { jusqua: r.date, W: W - 90 })}`;
      }
      case "avancement": {
        const av = avancementTemps(p); const spr = sprintEnCours(pl); const AR = avancementReel(p);
        const prochain = pl.jalons.filter(j => j.date && !j.atteint && j.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0];
        return titre("Avancement", `situation au ${fmtDate(t)}`) + `<div class="hf-tiles">
          <div><span>⏳ Temps écoulé</span><b>${av ? Math.round(av.pct * 100) + " %" : "—"}</b><small>${av ? (av.restants >= 0 ? `J-${av.restants}` : `dépassé de ${-av.restants} j`) : "pas de date de fin"}</small></div>
          ${AR ? `<div class="${AR.reel < AR.prevu - .03 ? "warn" : ""}"><span>📊 Avancement réel</span><b>${Math.round(AR.reel * 100)} %</b><small>prévu ${Math.round(AR.prevu * 100)} % · ${libEcartAv(AR)}</small></div>` : ""}
          ${pl.sprints.length ? `<div><span>🏃 Sprint en cours</span><b>${spr ? "Sprint " + spr.num : "—"}</b><small>${spr?.objectif ? esc(tronque(spr.objectif, 40)) : spr ? `${fmtJM(spr.debut)} → ${fmtJM(spr.fin)}` : ""}</small></div>` : ""}
          <div><span>◆ Prochain jalon</span><b>${prochain ? esc(tronque(prochain.nom, 26)) : "—"}</b><small>${prochain ? fmtDate(prochain.date) + (glissement(prochain) ? ` · ${glissement(prochain) > 0 ? "+" : ""}${glissement(prochain)} j` : "") : ""}</small></div>
          <div><span>✔ Jalons atteints</span><b>${pl.jalons.filter(j => j.atteint).length} / ${pl.jalons.length}</b><small>&nbsp;</small></div>
        </div><div class="hf-wrap">${friseHorizontale(p, W - 64, { periode: ui.hPeriode, ...ui.hOpts })}</div>`;
      }
      case "backlog": {
        const A = analyseBacklog(p); if (!A) return titre("Backlog") + `<p class="muted">Aucun import du backlog : onglet Analyse du backlog › Importer.</p>`;
        const demi = Math.round((W - 120) / 2);
        return titre("Backlog", `photo du ${fmtDate(A.I.date)}`) + tuilesBacklog(p, A) + barreStatuts(A) + `<div class="slide-2col" style="margin-top:14px"><div><h3>🏃 Vélocité par sprint</h3>${graphVelocite(A, demi, 180)}</div><div><h3>📈 Courbe cumulée</h3>${graphCumul(p, A, demi, 180)}</div></div>`;
      }
      case "ecarts": return titre("Écarts de planning") + tableauEcarts(p, pl);
      case "risques": {
        const s = syntheseRisques(p, prev?.date); const top = s.ouverts.slice().sort((a, b) => crit(b) - crit(a)).slice(0, 6);
        const tend = x => { if (!prev) return ""; const c0 = critAu(x, prev.date); if (c0 == null) return `<span class="pill soft">nouveau</span>`; const dd = crit(x) - c0; return dd > 0 ? `<span class="trend up">▲ ${dd}</span>` : dd < 0 ? `<span class="trend down">▼ ${-dd}</span>` : `<span class="muted">=</span>`; };
        return titre("Top risques", prev ? `évolution depuis le copil du ${fmtDate(prev.date)}` : "") + `<div class="slide-2col">
          <div>${s.ouverts.length ? miniMatrice(s.ouverts) : `<p class="muted">Aucun risque ouvert.</p>`}
            <div class="mini-kpis" style="margin-top:12px"><div><b>${s.ouverts.length}</b><span>ouverts</span></div><div class="${s.critiques.length ? "warn" : ""}"><b>${s.critiques.length}</b><span>élevés ou critiques</span></div><div><b>${prev ? s.hausse.length : "—"}</b><span>en hausse</span></div></div></div>
          <div>${top.map(x => `<div class="slide-risk"><span class="crit ${niveau(crit(x))}">${crit(x)}</span><div style="flex:1"><b>R${p.risques.indexOf(x) + 1} · ${esc(x.titre)}</b><div class="muted" style="font-size:.82rem">${STATUT[x.statut].emoji} ${STATUT[x.statut].nom}${x.responsable ? ` · 👤 ${esc(x.responsable)}` : ""} · ${x.actions.filter(a => a.fait).length}/${x.actions.length} action(s)</div></div>${tend(x)}</div>`).join("") || `<p class="muted">—</p>`}</div></div>`;
      }
      case "actions": {
        const all = actionsToutes(p).filter(x => !x.a.fait); const fin = suiv?.date || addJ(t, 30);
        const ret = all.filter(x => x.a.echeance && x.a.echeance < t).sort((a, b) => a.a.echeance.localeCompare(b.a.echeance));
        const avenir = all.filter(x => x.a.echeance && x.a.echeance >= t && x.a.echeance <= fin).sort((a, b) => a.a.echeance.localeCompare(b.a.echeance));
        const row = x => `<tr><td>${esc(x.a.texte)}</td><td class="muted">${x.r ? `R${p.risques.indexOf(x.r) + 1}` : `${x.ic} ${esc(tronque(x.lib, 28))}`}</td><td>${esc(x.a.responsable) || "—"}</td><td>${fmtDate(x.a.echeance)}</td></tr>`;
        const tab = (L, vide) => L.length ? `<table class="slide-table"><thead><tr><th>Action</th><th>Origine</th><th>Qui</th><th>Échéance</th></tr></thead><tbody>${L.slice(0, 7).map(row).join("")}</tbody></table>${L.length > 7 ? `<div class="muted" style="font-size:.8rem">… et ${L.length - 7} autre(s)</div>` : ""}` : `<p class="muted">${vide}</p>`;
        return titre("Actions") + `<div class="slide-2col"><div><h3>⏰ En retard (${ret.length})</h3>${tab(ret, "Aucune action en retard.")}</div><div><h3>📅 À échéance d'ici ${suiv ? "le prochain copil" : "30 jours"} (${avenir.length})</h3>${tab(avenir, "Aucune action à échéance.")}</div></div>`;
      }
      case "releve": {
        const prises = p.decisions.filter(x => x.statut !== "attente" && x.date <= t && x.instance !== r.id && (!prev || x.date >= prev.date)).sort((a, b) => a.date.localeCompare(b.date));
        return titre("Relevé des décisions prises", prev ? `depuis le copil du ${fmtDate(prev.date)}` : "") + (prises.length ? `<table class="slide-table big"><thead><tr><th>Date</th><th>Décision</th><th>Statut</th><th>Décideur</th></tr></thead><tbody>${prises.slice(0, 9).map(x => `<tr><td>${fmtJM(x.date)}</td><td><b>${esc(x.titre)}</b></td><td><span class="pill ${STATUTS_DEC[x.statut].cls}">${STATUTS_DEC[x.statut].emoji} ${STATUTS_DEC[x.statut].nom}</span></td><td>${esc(x.decideur) || "—"}</td></tr>`).join("")}</tbody></table>` : `<p class="muted">Aucune décision enregistrée sur la période.</p>`);
      }
      case "decisions": {
        const L = [...lignes(d.decisions), ...p.decisions.filter(x => x.statut === "attente").map(x => x.titre)];
        return titre("Décisions attendues") + (L.length ? `<ol class="slide-decisions">${L.map(x => `<li><span>${esc(x)}</span><span class="decision-box">☐ Validé&nbsp;&nbsp; ☐ Refusé&nbsp;&nbsp; ☐ Reporté</span></li>`).join("")}</ol>` : `<p class="muted">Aucune décision attendue.</p>`);
      }
      case "changements": {
        const O = chgOuverts(p).sort((a, b) => a.statut.localeCompare(b.statut));
        const arb = changementsDe(p).filter(c => c.arbitrage && (!prev || c.arbitrage.date >= prev.date) && c.arbitrage.date <= t);
        return titre("Demandes de changement", `${O.length} à arbitrer`) + (O.length ? `<table class="slide-table big"><thead><tr><th>N°</th><th>Demande</th><th>Impacts</th><th>Arbitrage</th></tr></thead><tbody>${O.slice(0, 6).map(c => `<tr><td><span class="code-pill">${numChg(p, c)}</span></td><td><b>${esc(c.titre)}</b>${c.demandeur ? `<div class="muted" style="font-size:.8rem">👤 ${esc(c.demandeur)}</div>` : ""}</td><td><div class="row" style="gap:4px">${puceImpacts(p, c) || "—"}</div></td><td><span class="decision-box">☐ Accepté&nbsp; ☐ Refusé&nbsp; ☐ Reporté</span></td></tr>`).join("")}</tbody></table>` : `<p class="muted">Aucune demande de changement en attente.</p>`)
          + (arb.length ? `<h3 style="margin-top:14px">Arbitrées${prev ? ` depuis le copil du ${fmtDate(prev.date)}` : ""}</h3><ul class="slide-list">${arb.map(c => `<li>${STATUTS_CHG[c.statut].emoji} <b>${numChg(p, c)} · ${esc(c.titre)}</b> <span class="muted">· ${STATUTS_CHG[c.statut].nom} le ${fmtJM(c.arbitrage.date)}</span></li>`).join("")}</ul>` : "");
      }
      case "gonogo": {
        if (!p.gonogo) return titre("Go / No-Go") + `<p class="muted">Évaluation non commencée : onglet Planification › Go / No-Go.</p>`;
        const E = evalGoNoGo(p); const j = jalonMEP(p); const V = p.gonogo.verdict ? VERDICTS_GNG[p.gonogo.verdict.v] : null;
        const cats = [...new Set(p.gonogo.criteres.map(c => c.cat))];
        return titre("Go / No-Go de mise en production", j ? `${j.nom} · ${fmtDate(j.date)}` : "") + `<div class="slide-2col">
          <div><div class="gng-reco ${V ? V.cls : E.reco.k}" style="margin-bottom:12px">${V ? `<span class="muted">Décision</span><b>${V.emoji} ${V.nom}</b>` : `<span class="muted">Recommandation</span><b>${E.reco.lib}</b><span>${E.reco.why}</span>`}</div>
            <div class="mini-kpis"><div><b>${E.ok.length}/${E.C.length}</b><span>critères remplis</span></div><div class="${E.koBloq.length ? "danger" : ""}"><b>${E.koBloq.length}</b><span>bloquant(s) KO</span></div><div class="${E.anoB ? "danger" : E.anoM ? "warn" : ""}"><b>${E.anoB} / ${E.anoM}</b><span>anomalies bloq. / maj.</span></div></div></div>
          <div>${cats.map(cat => { const L = p.gonogo.criteres.filter(c => c.cat === cat && c.statut !== "na"); const ok = L.filter(c => c.statut === "ok").length; return `<div class="kv"><span>${esc(cat)}</span><b class="${L.some(c => c.statut === "ko" && c.bloquant) ? "txt-danger" : ""}">${ok} / ${L.length} ${L.some(c => c.statut === "ko") ? "❌" : ok === L.length ? "✅" : "⏳"}</b></div>`; }).join("")}
            ${E.ko.length ? `<h3 style="margin-top:12px">Points non remplis</h3><ul class="slide-list">${E.ko.slice(0, 5).map(c => `<li>${c.bloquant ? "🔴" : "🟠"} ${esc(c.libelle)}${c.commentaire ? ` <span class="muted">· ${esc(c.commentaire)}</span>` : ""}</li>`).join("")}</ul>` : ""}</div></div>
          ${V ? "" : `<p style="margin-top:14px"><span class="decision-box">☐ Go&nbsp;&nbsp; ☐ Go sous réserves&nbsp;&nbsp; ☐ No-Go</span></p>`}`;
      }
      case "budget": return titre("Budget", `situation au ${fmtDate(t)}`) + tuilesBudget(p) + `<div class="slide-2col"><div>${courbeBudget(p, Math.round((W - 72) * 0.55), 230)}${legendeBudget}</div><div>
        ${(() => { const L = budgetDe(p).lignes.map(l => ({ l, ec: num(l.consomme) + rafLigne(l) - num(l.prevu) })).filter(x => Math.abs(x.ec) > 0.005).sort((a, b) => b.ec - a.ec).slice(0, 5); return L.length ? `<h3>Principaux écarts</h3><table class="slide-table"><tbody>${L.map(x => `<tr><td>${esc(x.l.poste || CATS_BUDGET[x.l.categorie])}</td><td class="num-txt ${x.ec > 0 ? "txt-danger" : "txt-ok"}">${x.ec > 0 ? "+" : ""}${fmtB(p, x.ec)}</td></tr>`).join("")}</tbody></table>` : ""; })()}
        <h3 style="margin-top:12px">Commentaire</h3>${lignes(d.budget).length ? `<ul class="slide-list">${lignes(d.budget).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="muted">Aucun commentaire.</p>`}
        ${d.meteo.budget ? `<p>Météo budget : ${METEO[d.meteo.budget][0]} ${METEO[d.meteo.budget][1]}</p>` : ""}</div></div>`;
      case "etapes": {
        const fin = suiv?.date || addJ(t, 60);
        const jal = pl.jalons.filter(j => j.date && !j.atteint && j.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
        const reus = pl.reunions.filter(x => !x.annulee && x.date > r.date && x.date <= fin && (TYPES_REU[x.type] || TYPES_REU.libre).cat !== "agile" && x.id !== r.id).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
        return titre("Prochaines étapes") + `<div class="slide-2col">
          <div><h3>◆ Jalons à venir</h3>${jal.length ? `<ul class="slide-list">${jal.map(j => `<li><b>${esc(j.nom)}</b> · ${fmtDate(j.date)} ${badgeGlissement(j)}</li>`).join("")}</ul>` : `<p class="muted">Aucun jalon à venir.</p>`}
            ${reus.length ? `<h3>🗓️ Rendez-vous</h3><ul class="slide-list">${reus.map(x => `<li>${esc(titreReu(x, nums))} · ${fmtDate(x.date)}</li>`).join("")}</ul>` : ""}</div>
          <div><h3>➡️ Actions et étapes</h3>${lignes(d.etapes).length ? `<ul class="slide-list">${lignes(d.etapes).map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="muted">Aucune étape saisie.</p>`}
            ${suiv ? `<p style="margin-top:16px">🏛️ Prochain copil : <b>${fmtDate(suiv.date)}</b></p>` : ""}</div></div>`;
      }
    }
    return "";
  }

  // ─── Événements
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || !el.dataset.act.startsWith("in-")) return;
    const { act, id } = el.dataset; const p = proj(); const pl = p?.planning; if (!pl) return;
    const reu = rid => pl.reunions.find(x => x.id === rid);
    switch (act) {
      case "in-vue": ui.vueInst = id; ui.deckIdx = 0; if (id === "cr") ui.crSel = null; render(); window.scrollTo(0, 0); break;
      case "in-prep": ui.copilSel = id; ui.vueInst = "copil"; render(); window.scrollTo(0, 0); break;
      case "in-tout": ui.instTout = el.checked; render(); break;
      case "in-export": ouvrirExportIcs(); break;
      case "in-ics": { const r = reu(id); telechargerIcs(p, [r], `${nomFichier(p)}-${r.type}-${r.date}`); break; }
      case "in-copier": {
        const r = reu(id); const txt = `${titreReu(r, numerosCopil(pl))} · ${fmtDate(r.date)}\n\n${odjTexte(ordreDuJour(p, r))}`;
        (navigator.clipboard?.writeText(txt) || Promise.reject()).then(() => toast("📋 Ordre du jour copié : colle-le dans ton invitation")).catch(() => toast("Copie impossible dans ce navigateur"));
        break;
      }
      case "in-meteo": { const d = prepCopil(reu(ui.copilSel)); d.meteo[el.dataset.axe] = d.meteo[el.dataset.axe] === id ? null : id; save(); render(); break; }
      case "in-diapo": { const d = prepCopil(reu(el.dataset.reu)); d.diapos = el.checked ? [...new Set([...d.diapos, id])] : d.diapos.filter(x => x !== id); save(); render(); break; }
      case "in-part": {
        const r = reu(el.dataset.reu); const cur = r.participants || participantsDefaut(p, r);
        r.participants = el.checked ? [...new Set([...cur, id])] : cur.filter(x => x !== id); save(); render(); break;
      }
      case "in-capture": ui.deckIdx = 0; document.body.classList.add("capture"); render(); window.scrollTo(0, 0); montrerSortieCapture(); toast("📸 Mode capture : capture la diapo, puis → pour la suivante, Échap pour revenir"); break;
      case "in-deck": navDeck(+id); break;
    }
  });
  function navDeck(dir) {
    const n = $$(".deck .slide").length; if (!n) return;
    ui.deckIdx = Math.max(0, Math.min(n - 1, ui.deckIdx + dir)); render(); window.scrollTo(0, 0);
  }
  document.addEventListener("keydown", e => {
    if (!document.body.classList.contains("capture") || !$(".deck")) return;
    if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); navDeck(1); }
    if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); navDeck(-1); }
  });
  document.addEventListener("change", e => {
    if (e.target.id === "inCopilSel") { ui.copilSel = e.target.value; ui.deckIdx = 0; render(); }
    if (e.target.dataset?.prep) render();
  });
  document.addEventListener("input", e => {
    const k = e.target.dataset?.prep; if (!k) return;
    const r = proj()?.planning?.reunions.find(x => x.id === ui.copilSel); if (!r) return;
    prepCopil(r)[k] = e.target.value; save();
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Étape 5 : Décisions & actions
  // ═══════════════════════════════════════════════════════════════
  const VUES_DEC = [{ id: "actions", nom: "Registre des actions", emoji: "✅" }, { id: "decisions", nom: "Journal des décisions", emoji: "⚖️" }, { id: "changements", nom: "Demandes de changement", emoji: "🔄" }];
  const STATUTS_DEC = {
    attente:  { nom: "En attente", emoji: "⏳", cls: "soft" },
    validee:  { nom: "Validée", emoji: "✅", cls: "ok" },
    refusee:  { nom: "Refusée", emoji: "⛔", cls: "danger" },
    reportee: { nom: "Reportée", emoji: "↪️", cls: "warn" },
  };
  const IMPACTS = ["Planning", "Budget", "Périmètre", "Risques", "Organisation"];
  Object.assign(ui, { vueDec: "actions", actFiltre: "ouvertes", actSource: "toutes", actQui: "", decFiltre: "toutes" });

  // ─── Registre unique : actions des risques + actions issues des réunions, décisions ou libres
  function sourceAction(p, a, nums) {
    const s = a.source || {};
    if (s.type === "reunion") { const r = p.planning?.reunions.find(x => x.id === s.id); return r ? { lib: `${titreReu(r, nums)} · ${fmtJM(r.date)}`, ic: (TYPES_REU[r.type] || TYPES_REU.libre).emoji } : { lib: "Réunion supprimée", ic: "🗓️" }; }
    if (s.type === "decision") { const d = p.decisions.find(x => x.id === s.id); return { lib: d ? `Décision : ${d.titre}` : "Décision supprimée", ic: "⚖️" }; }
    return { lib: "Action libre", ic: "✍️" };
  }
  function actionsToutes(p) {
    const nums = p.planning ? numerosCopil(p.planning) : new Map();
    return [
      ...p.risques.flatMap(r => r.actions.map(a => ({ a, src: "risque", r, lib: `R${p.risques.indexOf(r) + 1} · ${r.titre || "Sans titre"}`, ic: "🎯" }))),
      ...p.actions.map(a => ({ a, src: a.source?.type || "libre", ...sourceAction(p, a, nums) })),
    ];
  }
  const trouverAction = (p, aid) => actionsToutes(p).find(x => x.a.id === aid);
  function supprimerAction(p, x) {
    if (x.a.auto && p.planning) { reglagesTaches(p.planning); p.planning.tachesIgnorees.push(x.a.cle); }
    if (x.r) x.r.actions = x.r.actions.filter(a => a.id !== x.a.id);
    else p.actions = p.actions.filter(a => a.id !== x.a.id);
  }
  const optionsSource = (p, sel) => {
    const nums = p.planning ? numerosCopil(p.planning) : new Map();
    const reus = (p.planning?.reunions || []).filter(r => !r.annulee && r.date <= addJ(today(), 30)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);
    return `<option value="libre">✍️ Action libre</option>
      ${reus.length ? `<optgroup label="Réunion">${reus.map(r => `<option value="reunion:${r.id}" ${sel === "reunion:" + r.id ? "selected" : ""}>${(TYPES_REU[r.type] || TYPES_REU.libre).emoji} ${esc(titreReu(r, nums))} · ${fmtJM(r.date)}</option>`).join("")}</optgroup>` : ""}
      ${p.decisions.length ? `<optgroup label="Décision">${p.decisions.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25).map(d => `<option value="decision:${d.id}" ${sel === "decision:" + d.id ? "selected" : ""}>⚖️ ${esc(tronque(d.titre, 50))}</option>`).join("")}</optgroup>` : ""}
      ${p.risques.length ? `<optgroup label="Risque (action de traitement)">${p.risques.map(r => `<option value="risque:${r.id}" ${sel === "risque:" + r.id ? "selected" : ""}>🎯 R${p.risques.indexOf(r) + 1} · ${esc(tronque(r.titre || "Sans titre", 50))}</option>`).join("")}</optgroup>` : ""}`;
  };
  function ajouterAction(p, { texte, responsable = "", echeance = "", source = "libre" }) {
    const a = { id: uid(), texte, responsable, echeance, fait: false, creeLe: today() };
    const [type, id] = source.split(":");
    if (type === "risque") { const r = p.risques.find(x => x.id === id); r.actions.push(a); if (r.statut === "identifie") r.statut = "traitement"; }
    else { a.source = type === "libre" ? { type: "libre" } : { type, id }; a.notes = ""; p.actions.push(a); }
    return a;
  }

  function vueDecisionsModule() {
    const p = proj();
    return ui.vueDec === "changements" ? vueChangements(p) : ui.vueDec === "decisions" ? vueJournal(p) : vueRegistre2(p);
  }

  function vueRegistre2(p) {
    const t = today();
    let all = actionsToutes(p);
    const qui = [...new Set(all.map(x => x.a.responsable).filter(Boolean))].sort();
    if (ui.actSource !== "toutes") all = all.filter(x => ui.actSource === "reunion" ? x.src === "reunion" : x.src === ui.actSource || (ui.actSource === "libre" && x.src === "libre"));
    if (ui.actQui) all = all.filter(x => x.a.responsable === ui.actQui);
    const parEch = (x, y) => (x.a.echeance || "9999").localeCompare(y.a.echeance || "9999");
    const retard = all.filter(x => !x.a.fait && x.a.echeance && x.a.echeance < t).sort(parEch);
    const semaine = all.filter(x => !x.a.fait && x.a.echeance && x.a.echeance >= t && x.a.echeance <= addJ(t, 7)).sort(parEch);
    const plusTard = all.filter(x => !x.a.fait && x.a.echeance && x.a.echeance > addJ(t, 7)).sort(parEch);
    const sans = all.filter(x => !x.a.fait && !x.a.echeance);
    const faites = all.filter(x => x.a.fait).sort((x, y) => (y.a.faitLe || "").localeCompare(x.a.faitLe || ""));
    const row = x => `
      <div class="act-row ${x.a.fait ? "done" : ""} ${!x.a.fait && x.a.echeance && x.a.echeance < t ? "late" : ""}" style="--c:${x.r ? CAT[x.r.cat].couleur : x.src === "reunion" ? "#1f4e79" : x.src === "decision" ? "#7b5ea7" : "#98a2b3"}">
        <button class="check ${x.a.fait ? "on" : ""}" data-act="dc-fait" data-id="${x.a.id}" aria-label="Marquer comme faite">${x.a.fait ? "✓" : ""}</button>
        <div class="clic" data-act="dc-edit" data-id="${x.a.id}"><div class="act-text"><b>${esc(x.a.texte) || "<i>Action sans libellé</i>"}</b></div><span class="muted" style="font-size:.8rem">${x.ic} ${esc(x.lib)}</span></div>
        <span class="muted">${x.a.responsable ? "👤 " + esc(x.a.responsable) : ""}</span>
        <span class="pill ${x.a.echeance && x.a.echeance < t && !x.a.fait ? "danger" : "soft"}">${x.a.echeance ? "📅 " + fmtDate(x.a.echeance) : "📅 —"}</span>
        <button class="x-btn" data-act="dc-suppr" data-id="${x.a.id}" title="Supprimer">✕</button>
      </div>`;
    const section = (titre, items, ouvert = true) => items.length ? `<div class="act-section"><h3>${titre} <span class="pill soft">${items.length}</span></h3>${ouvert ? items.map(row).join("") : `<details><summary class="link">Afficher</summary>${items.map(row).join("")}</details>`}</div>` : "";
    const chip = (v, nom) => `<button class="chip ${ui.actSource === v ? "on" : ""}" data-act="dc-src" data-id="${v}">${nom}</button>`;
    const total = actionsToutes(p);
    return `
      <div class="toolbar"><h2 style="margin:0">✅ Registre des actions</h2>
        <span class="muted">${total.filter(x => !x.a.fait).length} ouverte(s) · ${total.filter(x => !x.a.fait && x.a.echeance && x.a.echeance < t).length} en retard</span>
        <span class="spacer"></span><button class="btn ghost small" data-act="dc-taches" title="Mettre les actions ouvertes dans votre liste de tâches (Outlook, Rappels…)">✅ Exporter en tâches</button><button class="btn ghost small" data-act="dc-csv">📊 Export CSV</button></div>
      <div class="panel" style="margin-bottom:16px">
        <div class="row">
          <b>⚡ Nouvelle action</b>
          <input id="dcTexte" class="inp" style="flex:2;min-width:200px" placeholder="Que faut-il faire ?">
          <input id="dcQui" class="inp" list="dlPersonnes" style="flex:1;min-width:130px" placeholder="👤 Qui ?">
          <input id="dcDate" type="date" class="inp" style="width:auto">
          <select id="dcSource" class="inp" style="width:auto;max-width:260px">${optionsSource(p)}</select>
          <button class="btn green" data-act="dc-ajout">＋ Ajouter</button>
        </div>
      </div>
      <div class="row" style="margin-bottom:14px">
        <div class="chips" style="margin:0">${chip("toutes", "Toutes")}${chip("risque", "🎯 Risques")}${chip("reunion", "🗓️ Réunions")}${chip("decision", "⚖️ Décisions")}${chip("libre", "✍️ Libres")}</div>
        <span class="spacer"></span>
        ${qui.length ? `<select class="inp" id="dcFiltreQui" style="width:auto"><option value="">Tous les responsables</option>${qui.map(n => `<option ${n === ui.actQui ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>` : ""}
      </div>
      ${!all.length ? `<div class="empty"><span class="big">✅</span>Aucune action ${ui.actSource !== "toutes" || ui.actQui ? "pour ce filtre" : "pour l'instant"}.</div>` : ""}
      ${section("⏰ En retard", retard)}${section("📅 Cette semaine", semaine)}${section("🗓️ Plus tard", plusTard)}${section("🗂️ Sans échéance", sans)}${section("🏆 Terminées", faites, false)}`;
  }

  function ouvrirAction(aid) {
    const p = proj(); const x = trouverAction(p, aid); if (!x) return;
    const a = x.a; const srcVal = x.r ? "risque:" + x.r.id : a.source?.type && a.source.type !== "libre" ? `${a.source.type}:${a.source.id}` : "libre";
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">✅ Action</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <div class="field"><label>Action *</label><input type="text" id="acTexte" value="${esc(a.texte)}"></div>
        <div class="three">
          <div class="field"><label>Responsable</label><input type="text" id="acQui" list="dlPersonnes" value="${esc(a.responsable)}"></div>
          <div class="field"><label>Échéance</label><input type="date" id="acDate" value="${esc(a.echeance)}"></div>
          <div class="field"><label>État</label><label class="row" style="padding-top:8px;cursor:pointer"><input type="checkbox" id="acFait" ${a.fait ? "checked" : ""}> Faite${a.faitLe ? ` le ${fmtJM(a.faitLe)}` : ""}</label></div>
        </div>
        <div class="field"><label>Origine</label><select id="acSource">${optionsSource(p, srcVal)}</select></div>
        ${x.r ? `<div class="field"><label>📷 Captures d'écran</label>${zoneCaptures(a)}</div>` : `<div class="field"><label>Notes</label><textarea id="acNotes" data-capt="${a.id}">${esc(a.notes || "")}</textarea>${zoneCaptures(a)}</div>`}
        <div class="muted" style="font-size:.8rem">Créée le ${fmtDate(a.creeLe)}</div>
      </div>
      <div class="modal-foot"><button class="btn danger" id="acDel">🗑️ Supprimer</button><div class="row"><button class="btn ghost" data-act="close-modal">Fermer</button><button class="btn" id="acOk">Enregistrer</button></div></div>`);
    $("#acOk").onclick = () => {
      const texte = $("#acTexte").value.trim(); if (!texte) { toast("✋ Décris l'action"); return; }
      const fait = $("#acFait").checked;
      if (a.auto && $("#acDate").value !== a.echeance) a.verrou = true;
      if (a.auto && texte !== a.texte) a.texteModifie = true;
      Object.assign(a, { texte, responsable: $("#acQui").value.trim(), echeance: $("#acDate").value, faitLe: fait ? (a.faitLe || today()) : "", fait });
      if (!x.r) a.notes = $("#acNotes").value;
      const ns = $("#acSource").value;
      if (ns !== srcVal) { supprimerAction(p, x); const n = ajouterAction(p, { texte: a.texte, responsable: a.responsable, echeance: a.echeance, source: ns }); Object.assign(n, { id: a.id, fait: a.fait, faitLe: a.faitLe, creeLe: a.creeLe, notes: a.notes, captures: a.captures }); }
      save(); closeModal(); toast("✅ Action enregistrée");
    };
    $("#acDel").onclick = () => { if (!confirm("Supprimer cette action ?")) return; supprimerAction(p, x); save(); closeModal(); toast("🗑️ Action supprimée"); };
  }

  // ─── Journal des décisions
  const copilsAStatuer = p => (p.planning?.reunions || []).filter(r => r.type === "copil" && !r.annulee && r.date <= today() && r.prep && lignes(r.prep.decisions).length && !r.prep.statue);
  function vueJournal(p) {
    const nums = p.planning ? numerosCopil(p.planning) : new Map();
    let L = p.decisions.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.creeLe || "").localeCompare(a.creeLe || ""));
    if (ui.decFiltre !== "toutes") L = L.filter(d => d.statut === ui.decFiltre);
    const inst = d => { const r = d.instance && p.planning?.reunions.find(x => x.id === d.instance); return r ? `${(TYPES_REU[r.type] || TYPES_REU.libre).emoji} ${esc(titreReu(r, nums))}` : "Hors instance"; };
    const aStatuer = copilsAStatuer(p);
    const chip = (v, nom) => `<button class="chip ${ui.decFiltre === v ? "on" : ""}" data-act="dc-decf" data-id="${v}">${nom}</button>`;
    return `
      <div class="toolbar"><h2 style="margin:0">⚖️ Journal des décisions</h2><span class="muted">${p.decisions.length} décision(s) · ${p.decisions.filter(d => d.statut === "attente").length} en attente</span><span class="spacer"></span>
        <button class="btn ghost small" data-act="dc-csv-dec">📊 Export CSV</button><button class="btn small" data-act="dc-new-dec">＋ Décision</button></div>
      ${aStatuer.map(r => `<div class="hl-banner" style="--k:#7b5ea7"><span>🏛️ <b>${esc(titreReu(r, nums))}</b> du ${fmtDate(r.date)} : ${lignes(r.prep.decisions).length} décision(s) attendue(s) à enregistrer.</span><span class="spacer"></span><button class="btn small" data-act="dc-statuer" data-id="${r.id}">Statuer</button></div>`).join("")}
      <div class="chips">${chip("toutes", "Toutes")}${Object.entries(STATUTS_DEC).map(([k, s]) => chip(k, `${s.emoji} ${s.nom}`)).join("")}</div>
      ${L.length ? `<div class="dec-list">${L.map(d => `
        <div class="dec-card" data-act="dc-edit-dec" data-id="${d.id}">
          <div class="dec-date">${fmtDate(d.date)}</div>
          <div style="flex:1;min-width:0">
            <div class="row" style="gap:8px"><b>${esc(d.titre)}</b><span class="pill ${STATUTS_DEC[d.statut].cls}">${STATUTS_DEC[d.statut].emoji} ${STATUTS_DEC[d.statut].nom}</span></div>
            ${d.description ? `<div class="muted" style="font-size:.86rem;margin-top:2px">${esc(tronque(d.description, 180))}</div>` : ""}
            <div class="row" style="gap:6px;margin-top:6px;font-size:.8rem">
              <span class="muted">${inst(d)}</span>${d.decideur ? `<span class="muted">· 👤 ${esc(d.decideur)}</span>` : ""}
              ${(d.impacts || []).map(i => `<span class="pill soft">${i}</span>`).join("")}
              ${(d.risques || []).map(id => p.risques.find(r => r.id === id)).filter(Boolean).map(r => `<span class="pill warn">⚠ R${p.risques.indexOf(r) + 1}</span>`).join("")}
              ${p.actions.filter(a => a.source?.type === "decision" && a.source.id === d.id).length ? `<span class="pill soft">✅ ${p.actions.filter(a => a.source?.type === "decision" && a.source.id === d.id).length} action(s)</span>` : ""}
            </div>
          </div>
        </div>`).join("")}</div>` : `<div class="empty"><span class="big">⚖️</span>${p.decisions.length ? "Aucune décision pour ce filtre." : "Aucune décision enregistrée. Les décisions attendues d'un copil peuvent être enregistrées ici une fois le copil passé."}</div>`}`;
  }

  function ouvrirDecision(id, defauts = {}) {
    const p = proj(); const nums = p.planning ? numerosCopil(p.planning) : new Map();
    const d = id ? p.decisions.find(x => x.id === id) : { id: uid(), titre: "", date: today(), statut: "validee", instance: "", decideur: "", description: "", impacts: [], risques: [], creeLe: today(), ...defauts };
    const nouveau = !id; let statut = d.statut;
    const reus = (p.planning?.reunions || []).filter(r => !r.annulee).sort((a, b) => b.date.localeCompare(a.date));
    const draw = () => {
      openModal(`
        <div class="modal-head" style="--c:#7b5ea7"><div class="row"><h2 style="margin:0">⚖️ ${nouveau ? "Nouvelle décision" : "Décision"}</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
        <div class="modal-body">
          <div class="field"><label>Décision *</label><input type="text" id="deTitre" value="${esc(d.titre)}" placeholder="Ex : Report du jalon de recette au 15 mars"></div>
          <div class="seg4">${Object.entries(STATUTS_DEC).map(([k, s]) => `<button class="${statut === k ? "on" : ""}" data-st="${k}">${s.emoji} ${s.nom}</button>`).join("")}</div>
          <div class="three">
            <div class="field"><label>Date</label><input type="date" id="deDate" value="${esc(d.date)}"></div>
            <div class="field"><label>Instance</label><select id="deInst"><option value="">Hors instance</option>${reus.map(r => `<option value="${r.id}" ${r.id === d.instance ? "selected" : ""}>${(TYPES_REU[r.type] || TYPES_REU.libre).emoji} ${esc(titreReu(r, nums))} · ${fmtJM(r.date)}</option>`).join("")}</select></div>
            <div class="field"><label>Décideur</label><input type="text" id="deQui" list="dlPersonnes" value="${esc(d.decideur)}" placeholder="Qui a tranché ?"></div>
          </div>
          <div class="field"><label>Contexte / justification</label><textarea id="deDesc" data-capt="${d.id}">${esc(d.description)}</textarea>${zoneCaptures(d)}</div>
          <div class="field"><label>Impacts</label><div class="row">${IMPACTS.map(i => `<label class="row" style="gap:5px;font-weight:400;cursor:pointer"><input type="checkbox" data-imp="${i}" ${(d.impacts || []).includes(i) ? "checked" : ""}> ${i}</label>`).join("")}</div></div>
          ${p.risques.length ? `<div class="field"><label>Risques concernés</label><div class="risk-pick">${p.risques.map(r => `<label><input type="checkbox" data-dr="${r.id}" ${(d.risques || []).includes(r.id) ? "checked" : ""}><span class="crit ${niveau(crit(r))}">${crit(r)}</span><span>R${p.risques.indexOf(r) + 1} · ${esc(r.titre) || "Sans titre"}</span></label>`).join("")}</div></div>` : ""}
          <div class="field"><label>Action de suivi (facultatif)</label><div class="row" style="flex-wrap:nowrap"><input class="inp" id="deAct" placeholder="Ex : mettre à jour le planning" style="flex:2"><input class="inp" id="deActQui" list="dlPersonnes" placeholder="👤 Qui ?" style="flex:1"><input class="inp" type="date" id="deActDate" style="width:auto"></div>
            <div class="aide">Elle s'ajoutera au registre des actions, rattachée à cette décision.</div></div>
        </div>
        <div class="modal-foot">${!nouveau ? `<button class="btn danger" id="deDel">🗑️ Supprimer</button>` : "<span></span>"}<div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button><button class="btn" id="deOk">Enregistrer</button></div></div>`);
      $$("#modal [data-st]").forEach(b => b.onclick = () => { statut = b.dataset.st; $$("#modal [data-st]").forEach(x => x.classList.toggle("on", x === b)); });
      $("#deOk").onclick = () => {
        const titre = $("#deTitre").value.trim(); if (!titre) { $("#deTitre").focus(); toast("✋ Décris la décision"); return; }
        Object.assign(d, { titre, statut, date: $("#deDate").value || today(), instance: $("#deInst").value, decideur: $("#deQui").value.trim(), description: $("#deDesc").value,
          impacts: $$("#modal [data-imp]").filter(c => c.checked).map(c => c.dataset.imp), risques: $$("#modal [data-dr]").filter(c => c.checked).map(c => c.dataset.dr) });
        if (nouveau) p.decisions.push(d);
        const act = $("#deAct").value.trim();
        if (act) ajouterAction(p, { texte: act, responsable: $("#deActQui").value.trim(), echeance: $("#deActDate").value, source: "decision:" + d.id });
        save(); closeModal(); toast(nouveau ? "⚖️ Décision enregistrée" : "✅ Décision mise à jour");
      };
      $("#deDel")?.addEventListener("click", () => { if (!confirm(`Supprimer la décision « ${d.titre} » ?`)) return; p.decisions = p.decisions.filter(x => x.id !== d.id); save(); closeModal(); toast("🗑️ Décision supprimée"); });
    };
    draw();
    if (nouveau) setTimeout(() => $("#deTitre")?.focus(), 30);
  }

  // Après un copil : transformer les décisions attendues en décisions du journal
  function ouvrirStatuer(rid) {
    const p = proj(); const pl = p.planning; const r = pl.reunions.find(x => x.id === rid); const nums = numerosCopil(pl);
    const L = lignes(r.prep.decisions).map(t => ({ titre: t, statut: "validee" }));
    const draw = () => {
      openModal(`
        <div class="modal-head" style="--c:#7b5ea7"><div class="row"><h2 style="margin:0">⚖️ Statuer · ${esc(titreReu(r, nums))} du ${fmtJM(r.date)}</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
        <div class="modal-body">
          <p class="muted" style="margin:0">Pour chaque décision attendue, indique ce qui a été décidé. Elles seront ajoutées au journal, rattachées à ce copil.</p>
          ${L.map((x, i) => `<div class="statuer-row"><input class="inp" data-sl="${i}" value="${esc(x.titre)}"><div class="seg4 small">${Object.entries(STATUTS_DEC).map(([k, s]) => `<button class="${x.statut === k ? "on" : ""}" data-si="${i}" data-sv="${k}" title="${s.nom}">${s.emoji} ${s.nom}</button>`).join("")}</div></div>`).join("")}
          <div class="field"><label>Décideur</label><input type="text" id="stQui" list="dlPersonnes" value="${esc(nomRole(p, "Sponsor"))}" placeholder="Qui a tranché ?"></div>
        </div>
        <div class="modal-foot"><span></span><div class="row"><button class="btn ghost" data-act="close-modal">Plus tard</button><button class="btn" id="stOk">Enregistrer ${L.length} décision(s)</button></div></div>`);
      $$("#modal [data-si]").forEach(b => b.onclick = () => { L.forEach((x, i) => x.titre = $(`#modal [data-sl="${i}"]`).value); L[+b.dataset.si].statut = b.dataset.sv; draw(); });
      $("#stOk").onclick = () => {
        const qui = $("#stQui").value.trim();
        L.forEach((x, i) => { const titre = $(`#modal [data-sl="${i}"]`).value.trim(); if (titre) p.decisions.push({ id: uid(), titre, statut: x.statut, date: r.date, instance: r.id, decideur: qui, description: "", impacts: [], risques: [], creeLe: today() }); });
        r.prep.statue = true; save(); closeModal(); toast("⚖️ Décisions ajoutées au journal");
      };
    };
    draw();
  }

  // Actions ouvertes → tâches : fichier pour Outlook (import CSV) ou fichier de tâches .ics (Rappels, Thunderbird…)
  function ouvrirExportTaches(p) {
    const T = actionsToutes(p).filter(x => !x.a.fait && x.a.texte);
    const gens = [...new Set(T.map(x => x.a.responsable).filter(Boolean))].sort();
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">✅ Exporter les actions en tâches</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <div class="two">
          <div class="field"><label>Quelles actions ?</label><select id="etQui"><option value="">Toutes les actions ouvertes (${T.length})</option>${gens.map(g => `<option value="${esc(g)}">Celles de ${esc(g)} (${T.filter(x => x.a.responsable === g).length})</option>`).join("")}</select></div>
          <div class="field"><label>Échéance</label><select id="etQuand"><option value="">Toutes</option><option value="30">Dans les 30 prochains jours (et en retard)</option><option value="avec">Seulement celles qui ont une échéance</option></select></div>
        </div>
        <div class="et-choix">
          <button class="et-format" data-fmt="outlook"><b>📧 Outlook (Windows)</b><span>Un fichier CSV. Dans Outlook : Fichier › Ouvrir et exporter › Importer/Exporter › « Importer à partir d'un autre programme ou fichier » › Valeurs séparées par des virgules › dossier <b>Tâches</b>.</span></button>
          <button class="et-format" data-fmt="ics"><b>🍎 Rappels, Thunderbird, autres</b><span>Un fichier de tâches .ics : double-cliquez dessus pour l'ajouter à votre liste de tâches.</span></button>
        </div>
        <div class="aide">Rien n'est envoyé : l'appli crée un fichier, vous l'importez vous-même. Outlook ne sait pas lire les tâches d'un fichier .ics : pour Outlook, prenez le CSV.</div>
      </div>`);
    const choix = () => T.filter(x => (!$("#etQui").value || x.a.responsable === $("#etQui").value) && ($("#etQuand").value === "avec" ? !!x.a.echeance : $("#etQuand").value === "30" ? x.a.echeance && x.a.echeance <= addJ(today(), 30) : true));
    $$("#modal [data-fmt]").forEach(b => b.onclick = () => {
      const L = choix(); if (!L.length) { toast("Aucune action ne correspond"); return; }
      const nom = `taches-${(p.code || p.nom).replace(/[^\w-]+/g, "_")}-${today()}`;
      const note = x => `${p.nom} · ${x.lib}${x.a.responsable ? ` · Responsable : ${x.a.responsable}` : ""}`;
      if (b.dataset.fmt === "outlook") {
        const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`; const fr = d => d ? d.split("-").reverse().join("/") : "";
        const lignesCSV = [["Objet", "Date de début", "Date d'échéance", "Notes", "Catégories"], ...L.map(x => [x.a.texte, fr(x.a.creeLe || today()), fr(x.a.echeance), note(x), p.code || p.nom])];
        telecharger(nom + ".csv", "\ufeff" + lignesCSV.map(r => r.map(q).join(",")).join("\r\n"), "text/csv;charset=utf-8");
      } else {
        const e = s => String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
        const st = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
        const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Cockpit Projet//FR", ...L.flatMap(x => ["BEGIN:VTODO", `UID:${x.a.id}@cockpit-projet`, `DTSTAMP:${st}`, `SUMMARY:${e(x.a.texte)}`, ...(x.a.echeance ? [`DUE;VALUE=DATE:${x.a.echeance.replace(/-/g, "")}`] : []), `DESCRIPTION:${e(note(x))}`, `CATEGORIES:${e(p.code || p.nom)}`, "STATUS:NEEDS-ACTION", "END:VTODO"]), "END:VCALENDAR"].join("\r\n");
        telecharger(nom + ".ics", ics, "text/calendar;charset=utf-8");
      }
      closeModal(); toast(`✅ ${L.length} tâche(s) exportée(s) : importez le fichier téléchargé`);
    });
  }
  function exporterCSVDec(p, type) {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`; const nums = p.planning ? numerosCopil(p.planning) : new Map();
    let cols, rows;
    if (type === "actions") {
      cols = ["Action", "Origine", "Responsable", "Échéance", "État", "Faite le", "Créée le"];
      rows = actionsToutes(p).map(x => [x.a.texte, x.lib, x.a.responsable, x.a.echeance, x.a.fait ? "Faite" : x.a.echeance && x.a.echeance < today() ? "En retard" : "À faire", x.a.faitLe, x.a.creeLe]);
    } else {
      cols = ["Date", "Décision", "Statut", "Instance", "Décideur", "Impacts", "Risques", "Contexte"];
      rows = p.decisions.slice().sort((a, b) => a.date.localeCompare(b.date)).map(d => { const r = p.planning?.reunions.find(x => x.id === d.instance);
        return [d.date, d.titre, STATUTS_DEC[d.statut].nom, r ? titreReu(r, nums) : "Hors instance", d.decideur, (d.impacts || []).join(", "), (d.risques || []).map(id => "R" + (p.risques.findIndex(x => x.id === id) + 1)).join(", "), d.description]; });
    }
    telecharger(`${type}-${(p.code || p.nom).replace(/[^\w-]+/g, "_")}-${today()}.csv`, "﻿" + [cols.map(q).join(";"), ...rows.map(r => r.map(q).join(";"))].join("\n"), "text/csv;charset=utf-8");
    toast("📊 Export CSV téléchargé");
  }

  // ─── Événements
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || !el.dataset.act.startsWith("dc-")) return;
    const { act, id } = el.dataset; const p = proj(); if (!p) return;
    switch (act) {
      case "dc-vue": ui.vueDec = id; render(); window.scrollTo(0, 0); break;
      case "dc-src": ui.actSource = id; render(); break;
      case "dc-decf": ui.decFiltre = id; render(); break;
      case "dc-ajout": {
        const texte = $("#dcTexte").value.trim(); if (!texte) { $("#dcTexte").focus(); toast("✋ Décris l'action"); return; }
        ajouterAction(p, { texte, responsable: $("#dcQui").value.trim(), echeance: $("#dcDate").value, source: $("#dcSource").value });
        save(); render(); toast("✅ Action ajoutée"); setTimeout(() => $("#dcTexte")?.focus(), 0); break;
      }
      case "dc-fait": { const x = trouverAction(p, id); x.a.fait = !x.a.fait; x.a.faitLe = x.a.fait ? today() : ""; save(); render(); if (x.a.fait) toast("💪 Action réalisée"); break; }
      case "dc-edit": ouvrirAction(id); break;
      case "dc-suppr": { const x = trouverAction(p, id); if (!confirm(`Supprimer l'action « ${x.a.texte} » ?`)) return; supprimerAction(p, x); save(); render(); break; }
      case "dc-new-dec": ouvrirDecision(null); break;
      case "dc-edit-dec": ouvrirDecision(id); break;
      case "dc-statuer": ouvrirStatuer(id); break;
      case "dc-csv": exporterCSVDec(p, "actions"); break;
      case "dc-taches": ouvrirExportTaches(p); return;
      case "dc-csv-dec": exporterCSVDec(p, "decisions"); break;
    }
  });
  document.addEventListener("change", e => { if (e.target.id === "dcFiltreQui") { ui.actQui = e.target.value; render(); } });
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "dcTexte") $("[data-act=dc-ajout]")?.click(); });

  // ═══════════════ Tâches de préparation des réunions (générées dans le registre des actions)
  const TACHES_DEFAUT = {
    copil: [["✉️ Envoyer l'invitation", -10], ["🏛️ Préparer le copil (météo, faits marquants, décisions attendues)", -5], ["📤 Envoyer le support", -1], ["📝 Envoyer le compte rendu et le relevé de décisions", 2]],
    lancement: [["✉️ Envoyer l'invitation", -10], ["🚀 Préparer le support de lancement", -3], ["📝 Envoyer le compte rendu", 2]],
    cadrage: [["✉️ Envoyer l'invitation", -10], ["🧭 Préparer le support de cadrage", -3], ["📝 Rédiger la note de cadrage", 5]],
    entretien: [["✉️ Inviter la personne interrogée", -7], ["📝 Rédiger la synthèse de l'entretien", 1]],
    cloture: [["✉️ Envoyer l'invitation", -10], ["🏁 Préparer le bilan du projet", -5], ["📝 Envoyer le compte rendu", 2]],
  };
  function reglagesTaches(pl) {
    if (!pl.taches) {
      pl.taches = { responsable: "", horizon: 45, modeles: {} };
      Object.keys(TYPES_REU).forEach(k => { pl.taches.modeles[k] = (TACHES_DEFAUT[k] || []).map(([libelle, decalage]) => ({ id: uid(), libelle, decalage, actif: true })); });
    }
    // nouveaux types de réunion : on leur donne leurs modèles de tâches
    Object.keys(TYPES_REU).forEach(k => { if (!pl.taches.modeles[k]) pl.taches.modeles[k] = (TACHES_DEFAUT[k] || []).map(([libelle, decalage]) => ({ id: uid(), libelle, decalage, actif: true })); });
    pl.tachesIgnorees = pl.tachesIgnorees || [];
    return pl.taches;
  }
  const echeanceTache = (date, dec) => dec < 0 ? ouvreAvant(addJ(date, dec)) : dec > 0 ? ouvre(addJ(date, dec)) : date;
  const quandTache = dec => dec === 0 ? "le jour J" : `J${dec > 0 ? "+" : "-"}${Math.abs(dec)}`;

  // Crée, déplace ou retire les tâches selon les réunions. Les tâches faites ou modifiées à la main ne bougent pas.
  function syncTaches(p) {
    const pl = p.planning; if (!pl?.methode) return false;
    const R = reglagesTaches(pl); const t = today(); const lim = addJ(t, R.horizon); let modif = false;
    const voulues = new Map();
    pl.reunions.filter(r => !r.annulee && r.date >= addJ(t, -7) && r.date <= lim).forEach(r => {
      (R.modeles[r.type] || []).filter(m => m.actif).forEach(m => voulues.set(`${r.id}:${m.id}`, { r, m }));
    });
    p.actions = p.actions.filter(a => {
      if (!a.auto) return true;
      const v = voulues.get(a.cle);
      if (!v) {
        // réunion annulée / supprimée ou modèle désactivé : on retire la tâche, sauf si elle est faite
        const r = pl.reunions.find(x => x.id === a.source?.id);
        if (a.fait || (r && !r.annulee && r.date > lim)) return true;
        modif = true; return false;
      }
      voulues.delete(a.cle);
      if (!a.fait && !a.verrou) { const e = echeanceTache(v.r.date, v.m.decalage); if (a.echeance !== e) { a.echeance = e; modif = true; } }
      if (!a.texteModifie && a.texte !== v.m.libelle) { a.texte = v.m.libelle; modif = true; }
      return true;
    });
    voulues.forEach(({ r, m }, cle) => {
      if (pl.tachesIgnorees.includes(cle) || echeanceTache(r.date, m.decalage) < t) return; // pas de tâche déjà en retard à sa création
      p.actions.push({ id: uid(), auto: true, cle, texte: m.libelle, responsable: R.responsable, echeance: echeanceTache(r.date, m.decalage), fait: false, creeLe: t, source: { type: "reunion", id: r.id }, notes: "" });
      modif = true;
    });
    return modif;
  }
  const tachesReunion = (p, r) => p.actions.filter(a => a.auto && a.source?.id === r.id).sort((a, b) => a.echeance.localeCompare(b.echeance));
  const puceTaches = (p, r) => {
    const T = tachesReunion(p, r); if (!T.length) return "";
    return `<div class="taches-mini">${T.map(a => `<button class="tache-chip ${a.fait ? "on" : ""} ${!a.fait && a.echeance < today() ? "late" : ""}" data-act="dc-fait" data-id="${a.id}" title="${esc(a.texte)} · ${fmtDate(a.echeance)}${a.fait ? " · faite" : ""}">${a.fait ? "✓" : "○"} ${esc(tronque(a.texte.replace(/^\S+\s/, ""), 26))} <span class="muted">${fmtJM(a.echeance)}</span></button>`).join("")}</div>`;
  };

  function vueReglagesTaches(p, pl) {
    const R = reglagesTaches(pl);
    const types = Object.entries(TYPES_REU).filter(([, T]) => !T.agile || pl.sprints.length);
    return `
      <div class="toolbar"><h2 style="margin:0">✅ Tâches de préparation</h2><span class="muted">créées automatiquement dans le registre des actions</span></div>
      <section class="panel" style="margin-bottom:16px">
        <div class="row">
          <label class="field" style="margin:0;flex:1;min-width:220px"><span class="lbl">Responsable par défaut</span><input class="inp" list="dlPersonnes" data-tr="responsable" value="${esc(R.responsable)}" placeholder="Ex : ton nom"></label>
          <label class="field" style="margin:0"><span class="lbl">Créer les tâches</span><select class="inp" data-tr="horizon" style="width:auto">${[21, 30, 45, 60, 90].map(n => `<option value="${n}" ${R.horizon === n ? "selected" : ""}>${n} jours avant la réunion</option>`).join("")}</select></label>
        </div>
        <p class="aide" style="margin:10px 0 0">Les tâches suivent la réunion si elle est déplacée et disparaissent si elle est annulée. Une tâche faite, ou dont tu changes l'échéance à la main, ne bouge plus. Une tâche supprimée n'est pas recréée, et aucune tâche n'est créée si son échéance est déjà passée.</p>
      </section>
      <div class="taches-grid">${types.map(([k, T]) => `
        <section class="panel">
          <div class="row" style="margin-bottom:6px"><h3 style="margin:0">${T.emoji} ${k === "libre" ? "Autres réunions" : T.nom}</h3><span class="spacer"></span><button class="btn ghost small" data-act="tc-ajout" data-id="${k}">＋ Tâche</button></div>
          ${(R.modeles[k] || []).length ? (R.modeles[k] || []).map(m => `
            <div class="tache-modele ${m.actif ? "" : "off"}">
              <input type="checkbox" data-tm="actif" data-type="${k}" data-id="${m.id}" ${m.actif ? "checked" : ""} title="Activer">
              <input class="inp" data-tm="libelle" data-type="${k}" data-id="${m.id}" value="${esc(m.libelle)}">
              <span class="row" style="gap:4px;flex-wrap:nowrap"><span class="muted" style="font-size:.8rem">J</span><input class="inp" type="number" data-tm="decalage" data-type="${k}" data-id="${m.id}" value="${m.decalage}" style="width:70px" title="Nombre de jours par rapport à la réunion (négatif = avant)"></span>
              <button class="x-btn" data-act="tc-suppr" data-type="${k}" data-id="${m.id}" title="Supprimer ce modèle">✕</button>
            </div>`).join("") : `<p class="muted" style="font-size:.86rem;margin:0">Aucune tâche générée pour ce type.</p>`}
        </section>`).join("")}</div>
      <p class="muted" style="font-size:.82rem;margin-top:10px">J-10 = 10 jours avant la réunion (ramené au jour ouvré précédent) · J+2 = 2 jours après.</p>`;
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || !el.dataset.act.startsWith("tc-")) return;
    const pl = proj()?.planning; if (!pl) return; const R = reglagesTaches(pl); const { act, id, type } = el.dataset;
    if (act === "tc-ajout") { (R.modeles[id] = R.modeles[id] || []).push({ id: uid(), libelle: "Nouvelle tâche", decalage: -3, actif: true }); }
    if (act === "tc-suppr") { if (!confirm("Supprimer ce modèle de tâche ? Les tâches déjà créées et non faites seront retirées.")) return; R.modeles[type] = R.modeles[type].filter(m => m.id !== id); }
    syncTaches(proj()); save(); render();
  });
  document.addEventListener("change", e => {
    const d = e.target.dataset || {}; const pl = proj()?.planning; if (!pl || (!d.tm && !d.tr)) return;
    const R = reglagesTaches(pl);
    if (d.tr) R[d.tr] = d.tr === "horizon" ? +e.target.value : e.target.value.trim();
    if (d.tm) { const m = R.modeles[d.type].find(x => x.id === d.id); m[d.tm] = d.tm === "actif" ? e.target.checked : d.tm === "decalage" ? Math.round(+e.target.value || 0) : e.target.value.trim(); }
    if (d.tr === "responsable") proj().actions.filter(a => a.auto && !a.fait && !a.responsable).forEach(a => a.responsable = R.responsable);
    syncTaches(proj()); save(); render(); toast("Tâches de préparation mises à jour");
  });

  // ═══════════════ « À faire aujourd'hui » : tous les projets confondus
  function aFaireAujourdhui() {
    const t = today(); let modif = false;
    const res = S.projets.map(p => {
      if (p.planning?.methode && syncTaches(p)) modif = true;
      const A = actionsToutes(p).filter(x => !x.a.fait && x.a.echeance && x.a.echeance <= t).sort((a, b) => a.a.echeance.localeCompare(b.a.echeance));
      const pl = p.planning?.methode ? p.planning : null; const nums = pl ? numerosCopil(pl) : new Map();
      return {
        p,
        retard: A.filter(x => x.a.echeance < t),
        jour: A.filter(x => x.a.echeance === t),
        reunions: pl ? pl.reunions.filter(r => !r.annulee && r.date === t).sort((a, b) => heureOk(a.heure).localeCompare(heureOk(b.heure))).map(r => ({ r, titre: titreReu(r, nums) })) : [],
        jalons: pl ? pl.jalons.filter(j => j.date === t && !j.atteint) : [],
        revues: p.risques.filter(r => !CLOS.has(r.statut) && r.revue && r.revue <= t),
        statuer: pl ? copilsAStatuer(p).map(r => ({ r, titre: titreReu(r, nums) })) : [],
        flash: p.flashRappel && jSem(t) === 5 && !p.flash?.[lundiDe(t)]?.envoyeLe ? [1] : [],
        docs: (p.livrables || []).filter(d => d.echeance && d.echeance <= t && !["valide", "diffuse"].includes(d.statut)),
        crs: pl ? pl.reunions.filter(r => !r.annulee && r.date < t && r.date >= addJ(t, -60) && !realisee(r) && (!TYPES_REU[r.type]?.agile || r.cr)).sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ r, titre: titreReu(r, nums) })) : [],
        gng: (() => { const j = pl ? jalonMEP(p) : null; return j && !j.atteint && j.date >= t && j.date <= addJ(t, 10) && !p.gonogo?.verdict ? [j] : []; })(),
      };
    });
    if (modif) save();
    res.forEach(x => { x.total = x.retard.length + x.jour.length + x.reunions.length + x.jalons.length + x.revues.length + x.statuer.length + x.flash.length + x.docs.length + x.gng.length + x.crs.length; });
    return res;
  }
  const nbAFaire = () => { try { return aFaireAujourdhui().reduce((n, x) => n + x.total, 0); } catch (e) { return 0; } };

  function ouvrirAujourdhui() {
    const t = today(); const L = aFaireAujourdhui().filter(x => x.total);
    const go = (p, k, id) => `data-act="aj-go" data-p="${p.id}" data-k="${k}" data-id="${id}"`;
    const action = (p, x) => `<div class="aj-item"><button class="check" data-act="aj-fait" data-p="${p.id}" data-id="${x.a.id}" aria-label="Marquer comme faite"></button>
      <div class="clic" ${go(p, "action", x.a.id)} style="flex:1;min-width:0"><b>${esc(x.a.texte)}</b><div class="muted" style="font-size:.8rem">${x.ic} ${esc(tronque(x.lib, 60))}${x.a.responsable ? ` · 👤 ${esc(x.a.responsable)}` : ""}</div></div>
      ${x.a.echeance < t ? `<span class="pill danger">${diffJ(x.a.echeance, t)} j de retard</span>` : `<span class="pill soft">aujourd'hui</span>`}</div>`;
    const ligne = (p, k, id, ic, txt, sous, pill = "") => `<div class="aj-item clic" ${go(p, k, id)}><span class="aj-ic">${ic}</span><div style="flex:1;min-width:0"><b>${txt}</b>${sous ? `<div class="muted" style="font-size:.8rem">${sous}</div>` : ""}</div>${pill}</div>`;
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">📌 À faire aujourd'hui</h2><span class="muted">${fmtCourt(t)}</span><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        ${L.length ? L.map(({ p, retard, jour, reunions, jalons, revues, statuer, flash, docs, gng, crs, total }) => `
          <section class="aj-projet">
            <div class="aj-head" style="--c:${p.couleur}"><span>${esc(p.emoji)}</span><b>${esc(p.nom)}</b><span class="pill soft">${total}</span></div>
            ${reunions.map(({ r, titre }) => ligne(p, "reunion", r.id, (TYPES_REU[r.type] || TYPES_REU.libre).emoji, `${heureOk(r.heure).replace(":", "h")} · ${esc(titre)}`, r.type === "copil" ? "Copil aujourd'hui : diapos prêtes ?" : "Réunion aujourd'hui", r.type === "copil" ? `<span class="pill soft">🖼️ diapos</span>` : "")).join("")}
            ${jalons.map(j => ligne(p, "jalon", j.id, "◆", esc(j.nom), "Jalon prévu aujourd'hui : est-il atteint ?")).join("")}
            ${retard.map(x => action(p, x)).join("")}
            ${jour.map(x => action(p, x)).join("")}
            ${crs.map(({ r, titre }) => ligne(p, "cr", r.id, "📝", `${r.cr ? "Finaliser" : "Rédiger"} le compte rendu · ${esc(titre)}`, `Réunion du ${fmtDate(r.date)}`, `<span class="pill ${diffJ(r.date, t) > 3 ? "danger" : "warn"}">${diffJ(r.date, t)} j</span>`)).join("")}
            ${statuer.map(({ r, titre }) => ligne(p, "statuer", r.id, "⚖️", `Statuer sur les décisions du ${esc(titre)}`, `Copil du ${fmtDate(r.date)}`)).join("")}
            ${gng.map(j => ligne(p, "gonogo", j.id, "🚦", `Préparer le Go / No-Go : ${esc(j.nom)}`, `Mise en production le ${fmtDate(j.date)}`, `<span class="pill warn">J-${diffJ(t, j.date)}</span>`)).join("")}
            ${flash.map(() => ligne(p, "flash", "x", "📰", "Envoyer le flash report de la semaine", "Rappel du vendredi")).join("")}
            ${docs.map(d => ligne(p, "livrable", d.id, "📚", esc(d.titre), `${CATS_DOC[d.cat] || ""} · ${STATUTS_DOC[d.statut]?.[0] || ""}`, d.echeance < t ? `<span class="pill danger">${diffJ(d.echeance, t)} j de retard</span>` : "")).join("")}
            ${revues.map(r => ligne(p, "risque", r.id, "🔁", `Revoir le risque R${p.risques.indexOf(r) + 1} · ${esc(r.titre)}`, `Revue prévue le ${fmtDate(r.revue)}`, r.revue < t ? `<span class="pill danger">${diffJ(r.revue, t)} j de retard</span>` : "")).join("")}
          </section>`).join("")
        : `<div class="empty" style="margin:0"><span class="big">🌤️</span>Rien d'urgent aujourd'hui : aucune action en retard ou à échéance, aucune réunion, aucun jalon.</div>`}
      </div>
      <div class="modal-foot"><span class="muted" style="font-size:.82rem">Actions en retard ou à échéance aujourd'hui, réunions et jalons du jour, comptes rendus à rédiger (60 derniers jours), revues de risques et décisions à statuer, sur tous tes projets.</span><button class="btn" data-act="close-modal">Fermer</button></div>`);
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || !["aujourdhui", "aj-fait", "aj-go"].includes(el.dataset.act)) return;
    const { act, id, k } = el.dataset;
    if (act === "aujourdhui") { ouvrirAujourdhui(); return; }
    const p = S.projets.find(x => x.id === el.dataset.p); if (!p) return;
    if (act === "aj-fait") {
      const x = actionsToutes(p).find(y => y.a.id === id); if (!x) return;
      x.a.fait = true; x.a.faitLe = today(); save(); toast("💪 Action réalisée");
      const sc = $("#modal").scrollTop; ouvrirAujourdhui(); $("#modal").scrollTop = sc; renderProjectBar(); return;
    }
    // aller à l'élément : on ouvre le projet, puis la fiche concernée
    S.actif = p.id; ui.ecran = "projet"; save(); closeModal();
    if (k === "action") { const x = actionsToutes(p).find(y => y.a.id === id); if (x?.r) ouvrirRisque(x.r.id); else ouvrirAction(id); }
    else if (k === "reunion") { const r = p.planning.reunions.find(y => y.id === id); if (r.type === "copil") { ui.copilSel = id; ui.vueInst = "diapos"; allerA("projet", "instances"); } else ouvrirReunion(id); }
    else if (k === "jalon") ouvrirJalon(id);
    else if (k === "cr") { ui.vueInst = "reunions"; allerA("projet", "instances"); ui.crSel = id; const r = p.planning.reunions.find(y => y.id === id); if (r) { crDe(p, r); save(); } render(); window.scrollTo(0, 0); }
    else if (k === "statuer") { ui.vueDec = "decisions"; allerA("projet", "decisions"); ouvrirStatuer(id); }
    else if (k === "risque") ouvrirRisque(id);
    else if (k === "flash") { allerA("projet", "cockpit"); ui.vueCk = "flash"; ui.flashSemaine = null; render(); }
    else if (k === "livrable") { allerA("projet", "livrables"); ouvrirLivrable(id); }
    else if (k === "gonogo") { allerA("projet", "planif"); ui.vuePlanif = "gonogo"; render(); }
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Comptes rendus de réunion
  // ═══════════════════════════════════════════════════════════════
  Object.assign(ui, { crSel: null, crTout: false, crAgile: false });
  function vueModuleCR() {
    const p = proj();
    return vueCR(p, p.planning || { reunions: [], sprints: [], jalons: [], phases: [] });
  }
  // Conteneur des réunions, créé si le projet n'a pas encore de planning (les réunions ajoutées à la main sont gardées à la mise en place du planning)
  function conteneurReunions(p) {
    if (!p.planning) p.planning = { methode: null, sprint: { duree: 2, jour: 1, avance: 6 }, types: typesParDefaut("agile"), phases: [], sprints: [], jalons: [], reunions: [], base: null };
    return p.planning;
  }
  function ouvrirNouveauCR() {
    const p = proj(); const h = new Date(); const heure = `${String(h.getHours()).padStart(2, "0")}:00`;
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">📝 Nouvelle réunion</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <div class="field"><label>Réunion *</label><input type="text" id="ncTitre" placeholder="Ex : Point d'urgence fournisseur, atelier métier…"></div>
        <div class="field"><label>Type</label><select id="ncType">${Object.entries(TYPES_REU).filter(([, T]) => !T.agile).map(([k, T]) => `<option value="${k}" ${k === "libre" ? "selected" : ""}>${T.emoji} ${k === "libre" ? "Autre réunion" : T.nom}</option>`).join("")}</select></div>
        <div class="three">
          <div class="field"><label>Date</label><input type="date" id="ncDate" value="${today()}"></div>
          <div class="field"><label>Heure</label><input type="text" id="ncHeure" value="${heure}"></div>
          <div class="field"><label>Durée (min)</label><input type="text" id="ncDuree" value="60"></div>
        </div>
        <div class="aide">Passée ou à venir : tu pourras la préparer, puis en rédiger le compte rendu. Elle apparaît aussi dans le planning du projet.</div>
      </div>
      <div class="modal-foot"><span></span><div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button><button class="btn" id="ncOk">Créer la réunion</button></div></div>`);
    setTimeout(() => $("#ncTitre")?.focus(), 30);
    $("#ncOk").onclick = () => {
      const titre = $("#ncTitre").value.trim(); if (!titre) { $("#ncTitre").focus(); toast("✋ Donne un nom à la réunion"); return; }
      const date = $("#ncDate").value || today();
      const pl = conteneurReunions(p);
      const r = { id: uid(), auto: false, horsPlanning: true, type: $("#ncType").value, date, dateInitiale: date, heure: heureOk($("#ncHeure").value), duree: +$("#ncDuree").value || 60, titre, notes: "", annulee: false, verrou: false };
      pl.reunions.push(r); crDe(p, r); ui.crSel = r.id;
      save(); closeModal(); toast("📝 Réunion créée");
    };
  }

  function crDe(p, r) {
    if (!r.cr) {
      const inv = r.participants || participantsDefaut(p, r);
      const pts = ordreDuJour(p, r).map(x => ({ id: uid(), titre: x.titre, notes: "" }));
      r.cr = { presence: Object.fromEntries(inv.map(id => [id, "present"])), autres: "", points: pts.length ? pts : [{ id: uid(), titre: "Points abordés", notes: "" }], creeLe: today(), diffuseLe: "" };
    }
    return r.cr;
  }
  const decisionsReu = (p, r) => p.decisions.filter(d => d.instance === r.id);
  const actionsReu = (p, r) => p.actions.filter(a => !a.auto && a.source?.type === "reunion" && a.source.id === r.id);
  const realisee = r => !!r.cr?.diffuseLe;
  const statutCR = r => realisee(r) ? ["Réalisée", "ok"] : r.date > today() ? (r.prepareeLe ? ["Prête", "ok"] : r.cr ? ["Préparation en cours", "soft"] : ["À préparer", "soft"]) : (r.cr ? ["CR à finaliser", "warn"] : ["CR à rédiger", "warn"]);
  const reunionSuivante = (pl, r) => pl.reunions.filter(x => !x.annulee && x.type === r.type && x.date > r.date).sort((a, b) => a.date.localeCompare(b.date))[0];

  function crTexte(p, r) {
    const pl = p.planning; const nums = numerosCopil(pl); const cr = crDe(p, r);
    const qui = st => p.interlocuteurs.filter(i => cr.presence[i.id] === st).map(i => `${personne(i.personneId)?.nom || "?"} (${i.role})`);
    const D = decisionsReu(p, r); const A = actionsReu(p, r); const suiv = reunionSuivante(pl, r);
    const L = [`${realisee(r) || r.date <= today() ? "COMPTE RENDU" : "PRÉPARATION"} — ${titreReu(r, nums)} — ${fmtDate(r.date)}`, `Projet : ${p.nom}${p.code ? " (" + p.code + ")" : ""}`, ""];
    L.push(`Présents : ${[...qui("present"), ...lignes(cr.autres.replace(/,/g, "\n"))].join(", ") || "—"}`);
    if (qui("excuse").length) L.push(`Excusés : ${qui("excuse").join(", ")}`);
    L.push("", "POINTS ABORDÉS");
    cr.points.forEach((x, i) => { L.push(`${i + 1}. ${x.titre}`); lignes(x.notes).forEach(n => L.push(`   ${n}`)); if (x.captures?.length) L.push(`   📷 ${x.captures.length} capture(s) d'écran (dans le CR imprimé)`); });
    L.push("", "DÉCISIONS");
    D.length ? D.forEach(d => L.push(`- [${STATUTS_DEC[d.statut].nom}] ${d.titre}${d.decideur ? " (" + d.decideur + ")" : ""}`)) : L.push("- Aucune décision");
    L.push("", "ACTIONS");
    A.length ? A.forEach(a => L.push(`- ${a.texte} — ${a.responsable || "à attribuer"} — ${a.echeance ? fmtDate(a.echeance) : "sans échéance"}${a.fait ? " (faite)" : ""}`)) : L.push("- Aucune action");
    if (suiv) L.push("", `Prochaine réunion : ${titreReu(suiv, nums)} le ${fmtDate(suiv.date)} à ${heureOk(suiv.heure).replace(":", "h")}`);
    return L.join("\n");
  }

  function vueCR(p, pl) {
    const r = ui.crSel && pl.reunions.find(x => x.id === ui.crSel);
    if (r) return vueEditeurCR(p, pl, r);
    const t = today(); const nums = numerosCopil(pl);
    const garder = x => !x.annulee && (ui.crAgile || !TYPES_REU[x.type]?.agile || x.cr);
    const avenir = pl.reunions.filter(x => garder(x) && !realisee(x) && x.date > t && x.date <= addJ(t, 45)).sort((a, b) => a.date.localeCompare(b.date));
    const passees = pl.reunions.filter(x => garder(x) && (x.date <= t || realisee(x)) && (ui.crTout || x.date >= addJ(t, -60))).sort((a, b) => b.date.localeCompare(a.date));
    const carte = r => { const [lib, cls] = statutCR(r); const T = TYPES_REU[r.type] || TYPES_REU.libre; return `
        <div class="inst-card clic" data-act="cr-ouvrir" data-id="${r.id}">
          <span class="date-chip">${fmtCourt(r.date)}<br>${heureOk(r.heure).replace(":", "h")}</span>
          <div style="flex:1;min-width:0"><b>${T.emoji} ${esc(titreReu(r, nums))}</b>
            <div class="muted" style="font-size:.8rem">${r.cr ? `${r.cr.points.filter(x => x.notes.trim()).length}/${r.cr.points.length} point(s) renseigné(s) · ` : ""}${decisionsReu(p, r).length} décision(s) · ${actionsReu(p, r).length} action(s)</div></div>
          <span class="pill ${cls}">${lib}</span>
          ${pl.methode ? `<button class="btn ghost small icon" data-act="in-ics" data-id="${r.id}" title="Invitation pour Outlook (.ics)">📅</button>` : ""}
          ${r.type === "copil" && pl.methode && r.date > t && !realisee(r) ? `<button class="btn small" data-act="in-prep" data-id="${r.id}" title="Ordre du jour du copil : météo, faits marquants, décisions attendues, diapos. La fiche de la réunion (participants, compte rendu) s'ouvre en cliquant sur la carte.">🏛️ Définir l'ordre du jour</button>`
            : `<button class="btn ${r.cr ? "ghost" : ""} small">${r.cr ? "Ouvrir" : r.date > t ? "Préparer" : "Rédiger le CR"}</button>`}
        </div>`; };
    return `
      <div class="toolbar"><h2 style="margin:0">📝 Réunions & comptes rendus</h2><span class="muted">préparer, puis rédiger le compte rendu</span><span class="spacer"></span>
        ${pl.sprints.length ? `<label class="row" style="font-size:.88rem;cursor:pointer"><input type="checkbox" data-act="cr-agile" ${ui.crAgile ? "checked" : ""}> Cérémonies agiles</label>` : ""}
        <label class="row" style="font-size:.88rem;cursor:pointer"><input type="checkbox" data-act="cr-tout" ${ui.crTout ? "checked" : ""}> Tout l'historique</label>
        ${pl.methode ? `<button class="btn ghost small" data-act="in-export">📅 Exporter vers Outlook</button>` : ""}
        <button class="btn small" data-act="cr-nouveau">＋ Réunion</button></div>
      <h3 style="margin:6px 0 8px">📅 À venir <span class="muted" style="font-weight:400;font-size:.85rem">· 45 prochains jours</span></h3>
      ${avenir.length ? `<div class="inst-list">${avenir.map(carte).join("")}</div>` : `<p class="muted">Aucune réunion à venir. <span class="link" data-act="cr-nouveau">Ajouter une réunion</span></p>`}
      <h3 style="margin:22px 0 8px">🗂️ Passées <span class="muted" style="font-weight:400;font-size:.85rem">· ${ui.crTout ? "tout l'historique" : "60 derniers jours"}</span></h3>
      ${passees.length ? `<div class="inst-list">${passees.map(carte).join("")}</div>` : `<p class="muted">Aucune réunion passée sur cette période.</p>`}`;
  }

  // État d'une réunion : un indicateur (pas des boutons) + une seule action, nommée par ce qu'elle fait
  function barreEtatReu(r) {
    const futur = r.date > today(); const rang = realisee(r) ? 2 : r.prepareeLe ? 1 : 0;
    const libs = [rang > 0 ? "Préparation" : futur ? (r.cr ? "En préparation" : "À préparer") : "Réunion passée · CR à rédiger", "Prête", "Réalisée"];
    const sous = [futur ? "ordre du jour, participants" : `le ${fmtJM(r.date)}`, r.prepareeLe ? `le ${fmtJM(r.prepareeLe)}` : "préparation terminée", realisee(r) ? `CR prêt le ${fmtJM(r.cr.diffuseLe)}` : "compte rendu prêt à envoyer"];
    const pas = libs.map((l, i) => {
      const etat = i < rang ? "fait" : i === rang ? "cours" : (i === 1 && !futur && !r.prepareeLe) ? "saute" : "suite";
      return `<div class="re-pas ${etat}"><span class="re-rond">${i < rang ? "✓" : i + 1}</span><span><b>${l}</b><small>${etat === "cours" ? "◀ état actuel · " : ""}${etat === "saute" ? "non utilisé" : sous[i]}</small></span></div>`;
    }).join(`<span class="re-trait" aria-hidden="true"></span>`);
    let action = "", retour = "";
    if (rang === 0 && futur) action = `<button class="btn small" data-act="cr-preparee" data-id="${r.id}">✓ Préparation terminée : marquer comme prête</button>`;
    if (rang < 2 && !futur) action = `<button class="btn small" data-act="cr-diffuse" data-id="${r.id}">✓ Réunion faite, CR prêt : marquer comme réalisée</button>`;
    if (rang === 1 && futur) action = `<span class="muted" style="font-size:.84rem">Prochaine étape après la réunion du ${fmtJM(r.date)} : « Réalisée ».</span>`;
    if (rang === 1) retour = `<span class="link" data-act="cr-preparee" data-id="${r.id}">↩︎ Pas encore prête</span>`;
    if (rang === 2) retour = `<span class="link" data-act="cr-diffuse" data-id="${r.id}">↩︎ Repasser en préparation</span>`;
    return `<div class="reu-etat" role="group" aria-label="État de la réunion"><span class="re-titre">État de la réunion</span><div class="re-pistes">${pas}</div><div class="re-actions">${action}${retour}</div></div>`;
  }
  function vueEditeurCR(p, pl, r) {
    const nums = numerosCopil(pl); const cr = crDe(p, r); const T = TYPES_REU[r.type] || TYPES_REU.libre;
    const D = decisionsReu(p, r); const A = actionsReu(p, r); const suiv = reunionSuivante(pl, r);
    const attendues = r.type === "copil" && r.prep && !r.prep.statue ? lignes(r.prep.decisions) : [];
    const pres = (i, v, lib) => `<button class="${cr.presence[i.id] === v ? "on" : ""}" data-act="cr-pres" data-id="${i.id}" data-v="${v}">${lib}</button>`;
    return `
      <div class="toolbar cr-tools">
        <button class="btn ghost small" data-act="cr-retour">← Comptes rendus</button>
        <h2 style="margin:0">${T.emoji} ${esc(titreReu(r, nums))}</h2>
        <label class="cr-date">${realisee(r) ? "Réalisée le" : "Prévue le"} <input type="date" class="inp" data-crd="date" value="${esc(r.date)}" title="Changer la date pour replanifier la réunion"> à <input class="inp" data-crd="heure" value="${heureOk(r.heure)}" style="width:72px"></label>
        ${r.dateInitiale && r.dateInitiale !== r.date ? `<span class="muted" style="font-size:.8rem">prévue le ${fmtJM(r.dateInitiale)}</span>` : ""}
        <span class="spacer"></span>
        <button class="btn ghost small" data-act="cr-copier" data-id="${r.id}">📋 Copier</button>
        <button class="btn ghost small" data-act="cr-mail" data-id="${r.id}" title="Ouvre ta messagerie avec le compte rendu (rien n'est envoyé automatiquement)">✉️ Messagerie</button>
        <button class="btn ghost small" data-act="cr-imprimer" data-id="${r.id}">🖨️ Imprimer / PDF</button>
        <button class="btn ghost small" data-act="cr-enregistrer">💾 Enregistrer</button>
        ${!r.auto ? `<button class="x-btn" data-act="cr-suppr-reu" data-id="${r.id}" title="Supprimer cette réunion et son compte rendu">🗑️</button>` : ""}
      </div>
      ${barreEtatReu(r)}
      <div class="prep-grid">
        <div style="display:grid;gap:16px;align-content:start">
          <section class="panel"><h3>👥 Participants</h3>
            ${p.interlocuteurs.length ? p.interlocuteurs.map(i => `<div class="cr-pres"><span>${esc(personne(i.personneId)?.nom || "?")} <span class="muted" style="font-size:.8rem">· ${esc(i.role)}</span></span><div class="seg3">${pres(i, "present", "Présent")}${pres(i, "excuse", "Excusé")}${pres(i, "", "—")}</div></div>`).join("") : `<p class="muted">Aucun interlocuteur dans la fiche d'identité.</p>`}
            <div class="field" style="margin-top:10px"><label>Autres participants</label><input class="inp" data-cr="autres" value="${esc(cr.autres)}" placeholder="Noms séparés par des virgules"></div>
          </section>
          <section class="panel"><div class="row" style="margin-bottom:8px"><h3 style="margin:0">🗒️ ${realisee(r) || r.date <= today() ? "Points abordés" : "Points à aborder"}</h3><span class="spacer"></span><button class="btn ghost small" data-act="cr-point">＋ Point</button></div>
            ${cr.points.map((x, i) => `<div class="cr-point">
              <div class="row" style="flex-wrap:nowrap"><b class="muted">${i + 1}.</b><input class="inp" data-crp="${x.id}" data-f="titre" value="${esc(x.titre)}"><button class="x-btn" data-act="cr-point-suppr" data-id="${x.id}" title="Retirer ce point">✕</button></div>
              <textarea class="inp" rows="3" data-crp="${x.id}" data-f="notes" data-capt="${x.id}" placeholder="Ce qui a été dit, échangé… (colle une capture d'écran avec ⌘ V)">${esc(x.notes)}</textarea>${zoneCaptures(x)}</div>`).join("")}
          </section>
        </div>
        <div style="display:grid;gap:16px;align-content:start">
          <section class="panel"><h3>⚖️ Décisions</h3>
            ${attendues.length ? `<div class="hl-banner" style="--k:#7b5ea7;margin-bottom:10px"><span>${attendues.length} décision(s) attendue(s) préparée(s) pour ce copil.</span><span class="spacer"></span><button class="btn small" data-act="cr-import" data-id="${r.id}">Importer</button></div>` : ""}
            ${D.map(d => `<div class="cr-dec"><div class="clic" style="flex:1;min-width:0" data-act="dc-edit-dec" data-id="${d.id}"><b>${esc(d.titre)}</b>${d.decideur ? `<div class="muted" style="font-size:.78rem">👤 ${esc(d.decideur)}</div>` : ""}</div>
              <div class="seg4 small">${Object.entries(STATUTS_DEC).map(([k, s]) => `<button class="${d.statut === k ? "on" : ""}" data-act="cr-dec-st" data-id="${d.id}" data-v="${k}" title="${s.nom}">${s.emoji}</button>`).join("")}</div></div>`).join("") || `<p class="muted" style="margin:0 0 8px">Aucune décision pour l'instant.</p>`}
            <div class="row" style="flex-wrap:nowrap;margin-top:8px"><input class="inp" id="crDec" placeholder="Nouvelle décision…"><select class="inp" id="crDecSt" style="width:auto">${Object.entries(STATUTS_DEC).map(([k, s]) => `<option value="${k}" ${k === "validee" ? "selected" : ""}>${s.emoji} ${s.nom}</option>`).join("")}</select><button class="btn small" data-act="cr-dec-ajout" data-id="${r.id}">＋</button></div>
            <div class="aide">Ajoutées au journal des décisions, rattachées à cette réunion.</div>
          </section>
          <section class="panel"><h3>✅ Actions</h3>
            ${A.map(a => `<div class="cr-act"><button class="check ${a.fait ? "on" : ""}" data-act="dc-fait" data-id="${a.id}">${a.fait ? "✓" : ""}</button><div class="clic" style="flex:1;min-width:0" data-act="dc-edit" data-id="${a.id}"><b>${esc(a.texte)}</b><div class="muted" style="font-size:.78rem">${a.responsable ? "👤 " + esc(a.responsable) : "à attribuer"} · ${a.echeance ? fmtDate(a.echeance) : "sans échéance"}</div></div></div>`).join("") || `<p class="muted" style="margin:0 0 8px">Aucune action pour l'instant.</p>`}
            <div class="row" style="flex-wrap:nowrap;margin-top:8px"><input class="inp" id="crAct" placeholder="Nouvelle action…" style="flex:2"><input class="inp" id="crActQui" list="dlPersonnes" placeholder="👤 Qui ?" style="flex:1"><input class="inp" type="date" id="crActDate" style="width:auto"><button class="btn small green" data-act="cr-act-ajout" data-id="${r.id}">＋</button></div>
            <div class="aide">Ajoutées au registre des actions, rattachées à cette réunion.</div>
          </section>
          <section class="panel"><h3>➡️ Prochaine réunion</h3><p style="margin:0">${suiv ? `${esc(titreReu(suiv, nums))} · <b>${fmtDate(suiv.date)}</b> à ${heureOk(suiv.heure).replace(":", "h")}` : `<span class="muted">Aucune réunion du même type planifiée.</span>`}</p></section>
        </div>
      </div>`;
  }

  async function imprimerCR(p, r) {
    const nums = numerosCopil(p.planning); const txt = crTexte(p, r);
    const w = window.open("", "_blank");
    if (!w) { toast("Autorise les fenêtres pop-up pour imprimer"); return; }
    let caps = "";
    for (const [i, x] of crDe(p, r).points.entries()) {
      const urls = []; for (const c of x.captures || []) { try { urls.push(await urlCapture(c.fichier)); } catch (e) {} }
      if (urls.length) caps += `<h2>${i + 1}. ${esc(x.titre)}</h2>${urls.map(u => `<img src="${u}">`).join("")}`;
    }
    if (caps) caps = `<h1 style="margin-top:32px">📷 Captures d'écran</h1>${caps}`;
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>CR ${esc(titreReu(r, nums))} ${r.date}</title>
      <style>body{font-family:Inter,Arial,sans-serif;max-width:760px;margin:40px auto;color:#1c2434;line-height:1.5}pre{white-space:pre-wrap;font-family:inherit;font-size:14px}h1{font-size:18px;color:#1f4e79;border-bottom:2px solid #1f4e79;padding-bottom:6px}h2{font-size:15px;margin:18px 0 6px}img{max-width:100%;border:1px solid #d0d5dd;border-radius:6px;margin:4px 0 10px;page-break-inside:avoid}</style></head>
      <body><h1>${esc(p.emoji)} ${esc(p.nom)}</h1><pre>${lienifier(esc(txt))}</pre>${caps}<script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    if (el.dataset.act === "cr-nouveau") { ouvrirNouveauCR(); return; }
    if (el.dataset.act === "cr-suppr-reu") {
      const p = proj(); const pl = p.planning; const r = pl.reunions.find(x => x.id === el.dataset.id);
      if (!confirm(`Supprimer la réunion « ${r.titre} » et son compte rendu ? Les décisions et actions déjà enregistrées sont conservées.`)) return;
      pl.reunions = pl.reunions.filter(x => x.id !== r.id); ui.crSel = null; save(); render(); toast("🗑️ Réunion supprimée"); return;
    }
  });
  document.addEventListener("change", e => {
    const k = e.target.dataset?.crd; if (!k) return;
    const p = proj(); const r = p?.planning?.reunions.find(x => x.id === ui.crSel); if (!r) return;
    if (k === "date") { const v = e.target.value; if (!v) return; if (r.auto && v !== r.date) r.verrou = true; r.date = v; }
    else r.heure = heureOk(e.target.value);
    save(); render(); toast(k === "date" ? "📅 Date de réalisation mise à jour" : "Heure mise à jour");
  });
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || !el.dataset.act.startsWith("cr-")) return;
    const p = proj(); const pl = p?.planning; if (!pl) return;
    const { act, id } = el.dataset; const r = pl.reunions.find(x => x.id === (id && pl.reunions.some(y => y.id === id) ? id : ui.crSel));
    switch (act) {
      case "cr-ouvrir": ui.crSel = id; if (ui.module === "instances") ui.vueInst = "reunions"; crDe(p, r); save(); render(); window.scrollTo(0, 0); return;
      case "cr-retour": ui.crSel = null; render(); return;
      case "cr-tout": ui.crTout = el.checked; render(); return;
      case "cr-agile": ui.crAgile = el.checked; render(); return;
      case "cr-pres": crDe(p, r).presence[id] = el.dataset.v; break;
      case "cr-point": crDe(p, r).points.push({ id: uid(), titre: "Nouveau point", notes: "" }); break;
      case "cr-point-suppr": { const c = crDe(p, r); c.points = c.points.filter(x => x.id !== id); break; }
      case "cr-import":
        lignes(r.prep.decisions).forEach(t => p.decisions.push({ id: uid(), titre: t, statut: "attente", date: r.date, instance: r.id, decideur: nomRole(p, "Sponsor"), description: "", impacts: [], risques: [], creeLe: today() }));
        r.prep.statue = true; toast("Décisions importées : choisis leur statut"); break;
      case "cr-dec-st": { const d = p.decisions.find(x => x.id === id); d.statut = el.dataset.v; break; }
      case "cr-dec-ajout": {
        const t = $("#crDec").value.trim(); if (!t) { $("#crDec").focus(); return; }
        p.decisions.push({ id: uid(), titre: t, statut: $("#crDecSt").value, date: r.date, instance: r.id, decideur: "", description: "", impacts: [], risques: [], creeLe: today() }); break;
      }
      case "cr-act-ajout": {
        const t = $("#crAct").value.trim(); if (!t) { $("#crAct").focus(); return; }
        ajouterAction(p, { texte: t, responsable: $("#crActQui").value.trim(), echeance: $("#crActDate").value, source: "reunion:" + r.id }); break;
      }
      case "cr-copier":
        (navigator.clipboard?.writeText(crTexte(p, r)) || Promise.reject()).then(() => toast("📋 Compte rendu copié")).catch(() => toast("Copie impossible dans ce navigateur"));
        return;
      case "cr-mail": {
        const txt = crTexte(p, r); const nums = numerosCopil(pl);
        const dest = participantsReu(p, r).map(x => x.email).filter(Boolean).join(";");
        const court = txt.length <= 1600;
        navigator.clipboard?.writeText(txt).catch(() => {});
        window.location.href = `mailto:${dest}?subject=${encodeURIComponent(`[${p.code || p.nom}] Compte rendu — ${titreReu(r, nums)} du ${fmtDate(r.date)}`)}&body=${encodeURIComponent(court ? txt : "(Le compte rendu est dans ton presse-papiers : colle-le ici avec Cmd/Ctrl + V)")}`;
        toast(court ? "✉️ Messagerie ouverte : relis puis envoie" : "✉️ Compte rendu long : il est copié, colle-le dans le message");
        return;
      }
      case "cr-imprimer": imprimerCR(p, r); return;
      case "cr-diffuse": {
        const c = crDe(p, r); c.diffuseLe = c.diffuseLe ? "" : today();
        if (c.diffuseLe) { if (r.prep) r.prep.statue = true; toast("✅ Réunion réalisée : le compte rendu est prêt à être envoyé"); }
        else toast("↩︎ Réunion repassée en préparation");
        break;
      }
      case "cr-preparee": {
        // les tâches de préparation (avant la réunion) sont cochées avec ; elles se décochent si on revient en arrière
        const T = p.actions.filter(a => a.auto && a.source?.id === r.id && a.echeance <= r.date);
        if (!r.prepareeLe) {
          crDe(p, r); r.prepareeLe = today();
          T.filter(a => !a.fait).forEach(a => { a.fait = true; a.faitLe = today(); a.faitParPrep = true; });
          toast(`✅ Réunion prête${T.length ? ` : ${T.length} tâche(s) de préparation cochée(s)` : ""}`);
        } else {
          delete r.prepareeLe;
          T.filter(a => a.faitParPrep).forEach(a => { a.fait = false; a.faitLe = ""; delete a.faitParPrep; });
          toast("↩︎ Réunion repassée en préparation");
        }
        break;
      }
      case "cr-enregistrer": toast("💾 Préparation enregistrée"); break;
    }
    save(); render();
  });
  document.addEventListener("input", e => {
    const d = e.target.dataset || {}; if (!d.cr && !d.crp) return;
    const p = proj(); const r = p?.planning?.reunions.find(x => x.id === ui.crSel); if (!r) return;
    const c = crDe(p, r);
    if (d.cr) c[d.cr] = e.target.value;
    else { const x = c.points.find(y => y.id === d.crp); if (x) x[d.f] = e.target.value; }
    save();
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    if (e.target.id === "crDec") $("[data-act=cr-dec-ajout]")?.click();
    if (e.target.id === "crAct") $("[data-act=cr-act-ajout]")?.click();
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Jours fériés et fermetures (communs à tous les projets)
  // ═══════════════════════════════════════════════════════════════
  function calendrier() { S.calendrier = S.calendrier || { alsace: false, pentecoteTravaillee: false, fermetures: [] }; return S.calendrier; }
  function paques(an) { // dimanche de Pâques (algorithme de Meeus)
    const a = an % 19, b = Math.floor(an / 100), c = an % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31), jour = ((h + l - 7 * m + 114) % 31) + 1;
    return `${an}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
  }
  const feriesCache = {};
  function feriesAnnee(an) {
    const C = calendrier(); const cle = `${an}${C.alsace ? "a" : ""}${C.pentecoteTravaillee ? "p" : ""}`;
    if (feriesCache[cle]) return feriesCache[cle];
    const P = paques(an);
    const L = [[`${an}-01-01`, "Jour de l'an"], [addJ(P, 1), "Lundi de Pâques"], [`${an}-05-01`, "Fête du travail"], [`${an}-05-08`, "Victoire 1945"], [addJ(P, 39), "Ascension"],
      ...(C.pentecoteTravaillee ? [] : [[addJ(P, 50), "Lundi de Pentecôte"]]), [`${an}-07-14`, "Fête nationale"], [`${an}-08-15`, "Assomption"], [`${an}-11-01`, "Toussaint"], [`${an}-11-11`, "Armistice 1918"], [`${an}-12-25`, "Noël"]];
    if (C.alsace) L.push([addJ(P, -2), "Vendredi saint"], [`${an}-12-26`, "Saint-Étienne"]);
    return (feriesCache[cle] = new Map(L.sort((x, y) => x[0].localeCompare(y[0]))));
  }
  const ferie = s => feriesAnnee(+s.slice(0, 4)).get(s) || null;
  const fermeture = s => calendrier().fermetures.find(f => f.debut && f.fin && f.debut <= s && s <= f.fin) || null;
  const nonOuvre = s => jSem(s) % 6 === 0 || !!ferie(s) || !!fermeture(s);
  const raisonNonOuvre = s => ferie(s) ? `🎌 ${ferie(s)}` : fermeture(s) ? `🏖️ ${fermeture(s).libelle || "Fermeture"}` : jSem(s) % 6 === 0 ? "week-end" : "";
  const alerteJour = s => s && nonOuvre(s) ? `<span class="pill warn" title="Cette date n'est pas un jour ouvré">⚠️ ${raisonNonOuvre(s)}</span>` : "";
  // Jours fériés et fermetures entre deux dates (pour les frises)
  function joursNonOuvres(debut, fin) {
    const L = [];
    for (let an = +debut.slice(0, 4); an <= +fin.slice(0, 4); an++) feriesAnnee(an).forEach((nom, d) => { if (d >= debut && d <= fin && jSem(d) % 6) L.push({ d, nom }); });
    return { feries: L, fermetures: calendrier().fermetures.filter(f => f.debut && f.fin && f.fin >= debut && f.debut <= fin) };
  }

  // Recalcule tous les plannings après un changement de calendrier (les dates 🔒 ne bougent pas)
  function appliquerCalendrier() {
    let n = 0, np = 0;
    S.projets.filter(p => p.planning?.methode).forEach(p => {
      const avant = structuredClone(p.planning); genererPlanning(p, p.planning); syncTaches(p);
      const L = diffPlanning(avant, p.planning).filter(x => !x.ajout && !x.suppr); if (L.length) { n += L.length; np++; }
    });
    save(); render();
    toast(n ? `📅 ${n} date(s) décalée(s) dans ${np} projet(s) · les dates 🔒 n'ont pas bougé` : "📅 Calendrier enregistré : aucune date à décaler");
  }
  // Réunions verrouillées ou ajoutées à la main qui tombent un jour non ouvré
  const conflitsCalendrier = () => S.projets.flatMap(p => (p.planning?.reunions || []).filter(r => !r.annulee && r.date >= today() && nonOuvre(r.date)).map(r => ({ p, r })));

  function vueReglages() {
    const C = calendrier(); const an = +today().slice(0, 4);
    const conflits = conflitsCalendrier();
    const liste = a => [...feriesAnnee(a)].map(([d, nom]) => `<div class="kv"><span>${nom}</span><span class="muted">${fmtCourt(d)}${jSem(d) % 6 ? "" : " · week-end"}</span></div>`).join("");
    return `
      <div class="toolbar"><h2 style="margin:0">⚙️ Réglages</h2><span class="muted">communs à tous tes projets</span></div>
      ${blocThemes()}
      <section class="panel" style="margin-bottom:16px"><div class="row"><div style="flex:1"><h3 style="margin:0">💾 Mes données</h3>
        <div class="muted" style="font-size:.88rem;margin-top:4px">${fichier.dir ? "📁 Dossier" : "📄 Fichier"} <b>${nomSupport()}</b>${fichier.dir ? ` · un fichier par projet (${S.projets.length}) + ${COMMUN}` : ""}${fichier.derniere ? ` · dernier enregistrement à ${fichier.derniere.toLocaleTimeString("fr-FR")}` : ""}</div></div>
        <button class="btn ghost small" data-act="stockage">Gérer : changer de dossier, copies, ajouter un projet</button></div></section>
      <section class="panel" style="margin-bottom:16px"><div class="row"><div style="flex:1"><h3 style="margin:0">👥 Annuaire</h3>
        <div class="muted" style="font-size:.88rem;margin-top:4px">${S.annuaire.length} personne(s), communes à tous tes projets</div></div>
        <button class="btn ghost small" data-act="pp-annu-ouvrir" data-id="charge">📊 Charge tous projets</button>
        <button class="btn small" data-act="pp-annu-ouvrir" data-id="liste">Ouvrir l'annuaire</button></div></section>
      <section class="panel" style="margin-bottom:16px"><h3 style="margin:0 0 4px">🗂️ Mes projets</h3>
        <div class="muted" style="font-size:.86rem;margin-bottom:8px">📤 Télécharge le fichier d'un projet seul (avec les fiches de ses interlocuteurs) pour l'envoyer à un autre PO. 🗑️ Supprimer : ${fichier.dir ? "le fichier du projet est déplacé dans le sous-dossier « corbeille »." : "pense à exporter une copie avant."}</div>
        ${S.projets.length ? S.projets.map(q => `<div class="kv" style="align-items:center"><span>${esc(q.emoji)} <b>${esc(q.nom)}</b>${q.code ? ` <span class="code-pill">${esc(q.code)}</span>` : ""}<span class="muted" style="font-size:.8rem"> · ${q.risques.length} risque(s)</span></span>
          <span class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn ghost small" data-act="rg-export" data-id="${q.id}">📤 Fichier du projet</button><button class="btn danger small" data-act="rg-suppr" data-id="${q.id}">🗑️ Supprimer</button></span></div>`).join("") : `<p class="muted" style="margin:0">Aucun projet.</p>`}
      </section>
      <section class="panel" style="margin-bottom:16px"><div class="row"><div style="flex:1"><h3 style="margin:0">📘 Documentation</h3>
        <div class="muted" style="font-size:.88rem;margin-top:4px">Le manuel pour utiliser l'appli au quotidien ; la documentation technique pour l'installer, la maintenir ou la présenter au service informatique.</div></div>
        <a class="btn ghost small" href="manuel/" target="_blank" rel="noopener">📗 Manuel utilisateur</a>
        <a class="btn small" href="manuel/doc-technique.html" target="_blank" rel="noopener">🛠️ Documentation technique</a></div></section>
      ${conflits.length ? `<div class="panel" style="margin-bottom:16px;border-color:#f3d3b5;background:#fdf6ee"><h3>⚠️ ${conflits.length} réunion(s) à venir tombent un jour non ouvré</h3><p class="muted" style="margin:0 0 8px;font-size:.88rem">Ce sont des réunions verrouillées 🔒 ou ajoutées à la main : l'outil ne les déplace pas tout seul.</p>
        ${conflits.map(({ p, r }) => `<div class="kv clic" data-act="aj-go" data-p="${p.id}" data-k="reunion" data-id="${r.id}"><span>${esc(p.emoji)} ${esc(p.nom)} · ${esc(titreReu(r, numerosCopil(p.planning)))}</span><span>${fmtCourt(r.date)} ${alerteJour(r.date)}</span></div>`).join("")}</div>` : ""}
      <div class="two-col">
        <section class="panel">
          <h3>🎌 Jours fériés français</h3>
          <p class="muted" style="margin-top:0;font-size:.88rem">Calculés automatiquement chaque année (Pâques, Ascension, Pentecôte compris). Aucune réunion ni tâche n'est placée ces jours-là.</p>
          <label class="type-row"><input type="checkbox" data-cal="pentecoteTravaillee" ${C.pentecoteTravaillee ? "checked" : ""}><span>Le lundi de Pentecôte est travaillé (journée de solidarité)</span></label>
          <label class="type-row"><input type="checkbox" data-cal="alsace" ${C.alsace ? "checked" : ""}><span>Alsace-Moselle : ajouter le Vendredi saint et le 26 décembre</span></label>
          <details style="margin-top:10px"><summary class="link">Voir les jours fériés ${an} et ${an + 1}</summary><h3 style="margin-top:10px">${an}</h3>${liste(an)}<h3 style="margin-top:12px">${an + 1}</h3>${liste(an + 1)}</details>
        </section>
        <section class="panel">
          <div class="row" style="margin-bottom:8px"><h3 style="margin:0">🏖️ Fermetures de l'entreprise</h3><span class="spacer"></span><button class="btn small ghost" data-act="cal-ajout">＋ Fermeture</button></div>
          <p class="muted" style="margin-top:0;font-size:.88rem">Ex : fermeture de Noël, pont, semaines d'août. Les réunions et tâches qui tombent dedans sont décalées au premier jour ouvré.</p>
          ${C.fermetures.length ? `<div class="pl-table">${C.fermetures.slice().sort((a, b) => (a.debut || "").localeCompare(b.debut || "")).map(f => `
            <div class="pl-tr ferm"><input class="inp" data-fe="${f.id}" data-f="libelle" value="${esc(f.libelle)}" placeholder="Libellé"><input class="inp" type="date" data-fe="${f.id}" data-f="debut" value="${esc(f.debut)}"><input class="inp" type="date" data-fe="${f.id}" data-f="fin" value="${esc(f.fin)}"><button class="x-btn" data-act="cal-suppr" data-id="${f.id}" title="Supprimer">✕</button></div>`).join("")}</div>` : `<p class="muted">Aucune fermeture.</p>`}
        </section>
      </div>
      <p class="muted" style="font-size:.82rem;margin-top:12px">Chaque changement recalcule les plannings de tous tes projets ; seules les dates non verrouillées 🔓 bougent.</p>`;
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const { act, id } = el.dataset;
    if (act === "reglages") { allerA("reglages"); return; }
    if (act === "rg-export") { const q = S.projets.find(x => x.id === id); if (q) exporterProjet(q); return; }
    if (act === "rg-suppr") {
      const q = S.projets.find(x => x.id === id); if (!q) return;
      if (!confirm(`Supprimer définitivement le projet « ${q.nom} » et ses ${q.risques.length} risque(s) ?${fichier.dir ? " Son fichier sera déplacé dans le sous-dossier « corbeille »." : " Pense à exporter une copie avant."}`)) return;
      S.projets = S.projets.filter(x => x.id !== id); if (S.actif === id) S.actif = S.projets[0]?.id || null;
      save(); render(); toast("🗑️ Projet supprimé"); return;
    }
    if (act === "cal-ajout") { calendrier().fermetures.push({ id: uid(), libelle: "Fermeture", debut: "", fin: "" }); save(); render(); return; }
    if (act === "cal-suppr") { const C = calendrier(); C.fermetures = C.fermetures.filter(f => f.id !== id); appliquerCalendrier(); }
  });
  document.addEventListener("change", e => {
    const d = e.target.dataset || {};
    if (d.cal) { calendrier()[d.cal] = e.target.checked; appliquerCalendrier(); }
    if (d.fe) {
      const f = calendrier().fermetures.find(x => x.id === d.fe); if (!f) return;
      f[d.f] = e.target.value;
      if (d.f === "debut" && f.debut && (!f.fin || f.fin < f.debut)) f.fin = f.debut;
      if (f.debut && f.fin) appliquerCalendrier(); else { save(); render(); }
    }
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Budget détaillé
  // ═══════════════════════════════════════════════════════════════
  const CATS_BUDGET = { interne: "👥 Interne", externe: "🤝 Prestations externes", licences: "💿 Licences / logiciels", materiel: "🖥️ Matériel / infrastructure", autre: "📦 Autre" };
  const num = v => { const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return isFinite(n) ? n : 0; };
  function budgetDe(p) { const b = p.budget; b.lignes = b.lignes || []; b.points = b.points || []; return b; }
  const rafLigne = l => l.raf === "" || l.raf == null ? Math.max(0, num(l.prevu) - num(l.consomme)) : num(l.raf);
  function totauxBudget(p) {
    const b = budgetDe(p); const L = b.lignes;
    const prevu = L.length ? L.reduce((n, l) => n + num(l.prevu), 0) : num(b.montant);
    const engage = L.reduce((n, l) => n + num(l.engage), 0), consomme = L.reduce((n, l) => n + num(l.consomme), 0);
    const raf = L.length ? L.reduce((n, l) => n + rafLigne(l), 0) : Math.max(0, prevu - consomme);
    const atterrissage = consomme + raf;
    return { prevu, engage, consomme, raf, atterrissage, ecart: atterrissage - prevu, conso: prevu ? consomme / prevu : 0, enveloppe: num(b.montant) };
  }
  const fmtB = (p, v) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v)} ${UNITES[p.budget.unite] || ""}`;
  function meteoBudget(p) {
    const T = totauxBudget(p); if (!T.prevu) return null;
    const r = T.atterrissage / T.prevu;
    return r > 1.1 ? "orage" : r > 1.02 ? "pluie" : r > 0.98 && T.conso > (avancementTemps(p)?.pct ?? 1) + 0.15 ? "nuage" : "soleil";
  }

  // Courbe : consommé, engagé et atterrissage à chaque point budgétaire, avec le budget prévu
  function courbeBudget(p, W = 640, H = 220) {
    const b = budgetDe(p); const T = totauxBudget(p);
    const pts = [...b.points].sort((x, y) => x.date.localeCompare(y.date));
    if (!pts.length || pts[pts.length - 1].date !== today()) pts.push({ date: today(), consomme: T.consomme, engage: T.engage, atterrissage: T.atterrissage, prevu: T.prevu, live: true });
    const d0 = p.dateDebut && p.dateDebut < pts[0].date ? p.dateDebut : pts[0].date;
    const d1 = p.dateFin && p.dateFin > today() ? p.dateFin : addJ(today(), 30);
    const max = Math.max(1, T.prevu, ...pts.map(x => Math.max(x.atterrissage || 0, x.engage || 0, x.consomme || 0))) * 1.1;
    const L = 56, R = W - 12, Hh = H - 26; const x = echelle(d0, d1, L, R); const y = v => 8 + (1 - v / max) * (Hh - 8);
    const serie = (k, cls) => pts.length > 1 ? `<polyline points="${pts.map(q => `${x(q.date)},${y(q[k] || 0)}`).join(" ")}" class="bc-l ${cls}"/>` : "";
    const dots = (k, cls) => pts.map(q => `<circle cx="${x(q.date)}" cy="${y(q[k] || 0)}" r="3.5" class="bc-d ${cls}"><title>${fmtDate(q.date)} · ${fmtB(p, q[k] || 0)}${q.commentaire ? " · " + esc(q.commentaire) : ""}</title></circle>`).join("");
    const grad = [0, .25, .5, .75, 1].map(f => { const v = max * f; return `<line x1="${L}" y1="${y(v)}" x2="${R}" y2="${y(v)}" class="hf-grid"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="hf-t s">${new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(v)}</text>`; }).join("");
    let mois = ""; for (let m = d0.slice(0, 7), i = 0; m <= d1.slice(0, 7); m = moisSuivant(m), i++) { const dd = m + "-01"; if (dd >= d0 && (diffJ(d0, d1) < 400 || i % 2 === 0)) mois += `<text x="${x(dd)}" y="${H - 6}" class="hf-mois" text-anchor="middle">${nomMoisCourt(m)}</text>`; }
    return `<svg class="hfrise" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du budget">${grad}${mois}
      ${T.prevu ? `<line x1="${L}" y1="${y(T.prevu)}" x2="${R}" y2="${y(T.prevu)}" class="bc-prevu"/><text x="${R}" y="${y(T.prevu) - 5}" text-anchor="end" class="hf-t s">prévu ${fmtB(p, T.prevu)}</text>` : ""}
      <line x1="${x(today())}" y1="4" x2="${x(today())}" y2="${Hh}" class="hf-today"/>
      ${serie("atterrissage", "att")}${serie("engage", "eng")}${serie("consomme", "con")}${dots("atterrissage", "att")}${dots("engage", "eng")}${dots("consomme", "con")}</svg>`;
  }
  const legendeBudget = `<div class="cp-legend" style="margin-left:0"><span><i style="background:#1f4e79"></i>Consommé</span><span><i style="background:#8fa6bf"></i>Engagé</span><span><i style="background:#d9822b"></i>Atterrissage (consommé + reste à faire)</span><span><i style="background:#2e7d5b;border-radius:0;height:2px"></i>Budget prévu</span></div>`;
  function tuilesBudget(p) {
    const T = totauxBudget(p); const av = avancementTemps(p);
    return `<div class="hf-tiles">
      <div><span>📋 Prévu</span><b>${fmtB(p, T.prevu)}</b><small>${T.enveloppe && Math.abs(T.enveloppe - T.prevu) > 0.01 ? `enveloppe ${fmtB(p, T.enveloppe)}` : "&nbsp;"}</small></div>
      <div><span>✍️ Engagé</span><b>${fmtB(p, T.engage)}</b><small>${T.prevu ? Math.round(T.engage / T.prevu * 100) + " % du prévu" : ""}</small></div>
      <div class="${av && T.conso > av.pct + 0.15 ? "warn" : ""}"><span>💸 Consommé</span><b>${fmtB(p, T.consomme)}</b><small>${Math.round(T.conso * 100)} %${av ? ` · temps écoulé ${Math.round(av.pct * 100)} %` : ""}</small></div>
      <div><span>⏳ Reste à faire</span><b>${fmtB(p, T.raf)}</b><small>&nbsp;</small></div>
      <div class="${T.ecart > 0.005 * T.prevu ? "warn" : ""}"><span>🎯 Atterrissage</span><b>${fmtB(p, T.atterrissage)}</b><small class="${T.ecart > 0 ? "txt-danger" : "txt-ok"}">${T.ecart > 0 ? "+" : ""}${fmtB(p, T.ecart)} ${T.ecart > 0 ? "de dépassement" : "de marge"}</small></div>
    </div>`;
  }

  function vueBudget() {
    const p = proj(); const b = budgetDe(p); const T = totauxBudget(p); const m = meteoBudget(p);
    const parCat = Object.keys(CATS_BUDGET).map(k => ({ k, L: b.lignes.filter(l => l.categorie === k) })).filter(x => x.L.length);
    const cell = (l, f, ph = "") => `<input class="inp num" data-bl="${l.id}" data-f="${f}" value="${esc(l[f] ?? "")}" placeholder="${ph}" inputmode="decimal">`;
    return `
      <div class="toolbar"><h2 style="margin:0">💶 Budget</h2><span class="muted">montants en ${UNITES[b.unite]}</span>
        ${m ? `<span class="pill ${m === "soleil" ? "ok" : m === "nuage" ? "soft" : "warn"}" title="Proposée à partir de l'atterrissage et du rythme de consommation">Météo suggérée : ${METEO[m][0]} ${METEO[m][1]}</span>` : ""}
        <span class="spacer"></span><button class="btn ghost small" data-act="bu-csv">📊 Export CSV</button><button class="btn small" data-act="bu-point">📸 Enregistrer un point budgétaire</button></div>
      ${tuilesBudget(p)}
      <section class="panel" style="margin-bottom:16px">
        <div class="row" style="margin-bottom:8px"><h3 style="margin:0">Postes budgétaires</h3><span class="spacer"></span>
          <select class="inp" id="buCat" style="width:auto">${Object.entries(CATS_BUDGET).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select><button class="btn small ghost" data-act="bu-ajout">＋ Poste</button></div>
        ${b.lignes.length ? `<div class="pl-table">
          <div class="pl-tr pl-th bud"><span>Poste</span><span>Prévu</span><span>Engagé</span><span>Consommé</span><span title="Laisse vide pour « prévu − consommé »">Reste à faire</span><span>Atterrissage</span><span>Écart</span><span></span></div>
          ${parCat.map(({ k, L }) => `<div class="pl-tr bud-cat">${CATS_BUDGET[k]}</div>${L.map(l => { const att = num(l.consomme) + rafLigne(l); const ec = att - num(l.prevu); return `
            <div class="pl-tr bud"><input class="inp" data-bl="${l.id}" data-f="poste" value="${esc(l.poste)}" placeholder="Ex : développement, recette…">${cell(l, "prevu")}${cell(l, "engage")}${cell(l, "consomme")}${cell(l, "raf", new Intl.NumberFormat("fr-FR").format(rafLigne(l)))}
              <span class="num-txt">${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(att)}</span><span class="num-txt ${ec > 0.005 ? "txt-danger" : ec < -0.005 ? "txt-ok" : ""}">${ec > 0 ? "+" : ""}${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(ec)}</span>
              <button class="x-btn" data-act="bu-suppr" data-id="${l.id}" title="Supprimer">✕</button></div>`; }).join("")}`).join("")}
          <div class="pl-tr bud bud-tot"><b>Total</b><b class="num-txt">${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(T.prevu)}</b><b class="num-txt">${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(T.engage)}</b><b class="num-txt">${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(T.consomme)}</b><b class="num-txt">${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(T.raf)}</b><b class="num-txt">${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(T.atterrissage)}</b><b class="num-txt ${T.ecart > 0.005 ? "txt-danger" : "txt-ok"}">${T.ecart > 0 ? "+" : ""}${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(T.ecart)}</b><span></span></div>
        </div>` : `<p class="muted">Aucun poste. Ajoute des postes (interne, prestations, licences…) pour suivre prévu, engagé et consommé. En attendant, l'enveloppe de la fiche d'identité (${fmtMontant(b) || "non renseignée"}) sert de budget prévu.</p>`}
        <p class="aide" style="margin:8px 0 0"><b>Engagé</b> = commandé ou contractualisé · <b>Consommé</b> = réellement dépensé · <b>Reste à faire</b> = ce qu'il faudra encore dépenser (vide = prévu − consommé) · <b>Atterrissage</b> = consommé + reste à faire.</p>
      </section>
      <div class="two-col" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr)">
        <section class="panel"><h3>📈 Évolution</h3>${b.points.length ? "" : `<p class="muted" style="margin:0 0 6px;font-size:.86rem">Enregistre un point budgétaire régulièrement (par exemple avant chaque copil) pour tracer la courbe.</p>`}<div class="hf-wrap">${courbeBudget(p, Math.min(760, largeurDispo() * 0.58))}</div>${legendeBudget}</section>
        <section class="panel"><h3>📸 Points budgétaires</h3>
          ${b.points.length ? b.points.slice().sort((x, y) => y.date.localeCompare(x.date)).map(q => `<div class="kv"><span>${fmtDate(q.date)}${q.commentaire ? `<div class="muted" style="font-size:.78rem">${esc(q.commentaire)}</div>` : ""}</span><span style="text-align:right">${fmtB(p, q.consomme)} <span class="muted">consommé</span><br><span class="muted" style="font-size:.8rem">atterrissage ${fmtB(p, q.atterrissage)}</span> <button class="x-btn" data-act="bu-point-suppr" data-id="${q.id}" title="Supprimer">✕</button></span></div>`).join("") : `<p class="muted">Aucun point enregistré.</p>`}
        </section>
      </div>`;
  }

  function exporterCSVBudget(p) {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`; const b = budgetDe(p);
    const rows = b.lignes.map(l => [CATS_BUDGET[l.categorie].replace(/^\S+\s/, ""), l.poste, num(l.prevu), num(l.engage), num(l.consomme), rafLigne(l), num(l.consomme) + rafLigne(l), num(l.consomme) + rafLigne(l) - num(l.prevu)]);
    const cols = ["Catégorie", "Poste", "Prévu", "Engagé", "Consommé", "Reste à faire", "Atterrissage", "Écart"];
    telecharger(`budget-${(p.code || p.nom).replace(/[^\w-]+/g, "_")}-${today()}.csv`, "﻿" + [cols.map(q).join(";"), ...rows.map(r => r.map(v => q(typeof v === "number" ? String(v).replace(".", ",") : v)).join(";"))].join("\n"), "text/csv;charset=utf-8");
    toast("📊 Budget exporté en CSV");
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || !el.dataset.act.startsWith("bu-")) return;
    const p = proj(); if (!p) return; const b = budgetDe(p); const { act, id } = el.dataset;
    if (act === "bu-ajout") { b.lignes.push({ id: uid(), categorie: $("#buCat").value, poste: "", prevu: "", engage: "", consomme: "", raf: "" }); save(); render(); setTimeout(() => { const ins = $$("[data-f=poste]"); ins[ins.length - 1]?.focus(); }, 0); }
    if (act === "bu-suppr") { if (!confirm("Supprimer ce poste budgétaire ?")) return; b.lignes = b.lignes.filter(l => l.id !== id); save(); render(); }
    if (act === "bu-point") {
      const com = prompt("Point budgétaire du " + fmtDate(today()) + "\nCommentaire (facultatif) :", ""); if (com === null) return;
      const T = totauxBudget(p); b.points = b.points.filter(x => x.date !== today());
      b.points.push({ id: uid(), date: today(), prevu: T.prevu, engage: T.engage, consomme: T.consomme, atterrissage: T.atterrissage, commentaire: com.trim() });
      save(); render(); toast("📸 Point budgétaire enregistré");
    }
    if (act === "bu-point-suppr") { b.points = b.points.filter(x => x.id !== id); save(); render(); }
    if (act === "bu-csv") exporterCSVBudget(p);
  });
  document.addEventListener("change", e => {
    const d = e.target.dataset || {}; if (!d.bl) return;
    const p = proj(); const l = budgetDe(p).lignes.find(x => x.id === d.bl); if (!l) return;
    l[d.f] = d.f === "poste" ? e.target.value : e.target.value.trim() === "" ? "" : String(num(e.target.value));
    save();
    setTimeout(() => { const a = document.activeElement; const sel = a?.dataset?.bl ? `[data-bl="${a.dataset.bl}"][data-f="${a.dataset.f}"]` : null; render(); if (sel) $(sel)?.focus(); }, 0);
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Modules optionnels (budget, charge) par projet
  // ═══════════════════════════════════════════════════════════════
  const opt = (p, k) => !!p?.options?.[k];
  const moduleActif = (p, id) => id !== "budget" || opt(p, "budget");

  // ═══════════════ Météo historisée (copil après copil)
  const NIV_METEO = { soleil: 4, nuage: 3, pluie: 2, orage: 1 };
  function histoMeteo(pl, jusqua) {
    const nums = numerosCopil(pl);
    return pl.reunions.filter(r => r.type === "copil" && !r.annulee && r.prep?.meteo && Object.values(r.prep.meteo).some(Boolean) && (!jusqua || r.date <= jusqua))
      .sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ r, n: nums.get(r.id), m: r.prep.meteo }));
  }
  function evolutionMeteo(p, pl, { jusqua, W = 620, compact = false } = {}) {
    const H = histoMeteo(pl, jusqua).slice(-12);
    if (!H.length) return `<p class="muted" style="margin:0;font-size:.86rem">Pas encore d'historique : la météo saisie à chaque copil (onglet Préparer le copil) construira la courbe.</p>`;
    const axes = Object.keys(AXES_METEO).filter(a => a !== "budget" || opt(p, "budget"));
    const L = 64, R = W - 24, h = compact ? 118 : 146, top = 14, bas = h - 26;
    const xs = i => H.length === 1 ? (L + R) / 2 : L + i * (R - L) / (H.length - 1);
    const y = v => top + (4 - v) * (bas - top) / 3;
    const cle = v => Object.keys(NIV_METEO).find(k => NIV_METEO[k] === v);
    let svg = [4, 3, 2, 1].map(v => `<line x1="${L}" y1="${y(v)}" x2="${R}" y2="${y(v)}" class="hf-grid"/><text x="${L - 12}" y="${y(v) + 5}" text-anchor="end" font-size="14">${METEO[cle(v)][0]}</text>`).join("");
    const pts = H.map((x, i) => x.m.global ? { cx: xs(i), cy: y(NIV_METEO[x.m.global]), x } : null).filter(Boolean);
    if (pts.length > 1) svg += `<polyline points="${pts.map(q => q.cx + "," + q.cy).join(" ")}" class="mt-l"/>`;
    svg += pts.map(q => `<circle cx="${q.cx}" cy="${q.cy}" r="6" class="mt-d m-${q.x.m.global}"><title>Copil n°${q.x.n} · ${fmtDate(q.x.r.date)} · ${METEO[q.x.m.global][1]}</title></circle>`).join("");
    svg += H.map((x, i) => `<text x="${xs(i)}" y="${h - 7}" text-anchor="middle" class="hf-t s">n°${x.n} · ${fmtJM(x.r.date)}</text>`).join("");
    const grille = `<table class="mt-grille"><thead><tr><th></th>${H.map(x => `<th>n°${x.n}</th>`).join("")}</tr></thead><tbody>${axes.map(a => `<tr><td>${AXES_METEO[a]}</td>${H.map((x, i) => {
      const v = x.m[a]; const pv = i ? H[i - 1].m[a] : null; const t = v && pv ? Math.sign(NIV_METEO[v] - NIV_METEO[pv]) : 0;
      return `<td title="${v ? METEO[v][1] : "non renseignée"}">${v ? METEO[v][0] : "·"}${t > 0 ? `<small class="txt-ok">↗</small>` : t < 0 ? `<small class="txt-danger">↘</small>` : ""}</td>`; }).join("")}</tr>`).join("")}</tbody></table>`;
    return `<div class="hf-wrap"><svg class="hfrise" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-label="Évolution de la météo du projet">${svg}</svg></div>${compact ? "" : grille}`;
  }
  function panneauMeteo(p) {
    const pl = p.planning; const H = pl?.methode ? histoMeteo(pl) : [];
    const der = H[H.length - 1];
    return `<div class="row" style="margin-bottom:8px"><h3 style="margin:0">🌤️ Météo du projet</h3><span class="spacer"></span>${pl?.methode ? `<span class="link" data-act="in-go-copil">Préparer le copil →</span>` : ""}</div>
      ${der ? `<div class="row" style="gap:10px;margin-bottom:6px"><span style="font-size:2rem">${der.m.global ? METEO[der.m.global][0] : "—"}</span><div><b>${der.m.global ? METEO[der.m.global][1] : "Météo générale non renseignée"}</b><div class="muted" style="font-size:.8rem">Copil n°${der.n} du ${fmtDate(der.r.date)}</div></div></div><div class="meteo-fluide">${evolutionMeteo(p, pl, { W: 330, compact: true })}</div>`
        : `<p class="muted" style="margin:0">Aucune météo enregistrée. Elle se saisit en préparant chaque copil.</p>`}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Brique Parties prenantes : matrice RACI + charge
  // ═══════════════════════════════════════════════════════════════
  const RACI = { R: ["Réalise", "r"], A: ["Approuve (responsable final)", "a"], C: ["Consulté", "c"], I: ["Informé", "i"] };
  const ACTIVITES_TYPES = ["Pilotage du projet", "Expression du besoin", "Rédaction des spécifications", "Validation des spécifications", "Réalisation", "Recette", "Validation des livrables", "Mise en production", "Conduite du changement / communication"];
  Object.assign(ui, { vuePP: "fiche", annuVue: "liste" });
  const VUES_PP = [{ id: "fiche", nom: "Fiche", emoji: "🪪" }, { id: "raci", nom: "Matrice RACI", emoji: "🧩" }, { id: "charge", nom: "Charge", emoji: "📊", opt: "charge" }];
  function raciDe(p) { p.raci = p.raci || { activites: [], cells: {} }; return p.raci; }
  const prenomNom = n => { const m = String(n || "?").trim().split(/\s+/); return m.length > 1 ? `${m[0]} ${m[m.length - 1][0]}.` : m[0]; };

  function vuePartiesPrenantes() {
    const p = proj();
    if (ui.vuePP === "charge" && opt(p, "charge")) return vueCharge(p);
    if (ui.vuePP === "raci") return vueRaci(p);
    return vueIdentite();
  }

  function vueRaci(p) {
    const R = raciDe(p); const I = p.interlocuteurs;
    if (!I.length) return `<div class="empty"><span class="big">🧩</span>Ajoute d'abord des interlocuteurs dans la <span class="link" data-act="module" data-id="identite">fiche d'identité</span>.</div>`;
    const cell = (a, i) => { const v = R.cells[a.id]?.[i.id] || ""; return `<button class="raci-cell ${v ? "raci-" + RACI[v][1] : ""}" data-act="pp-cell" data-a="${a.id}" data-i="${i.id}" title="${v ? RACI[v][0] : "Cliquer pour choisir R, A, C ou I"}">${v || "·"}</button>`; };
    const alerte = a => { const vals = I.map(i => R.cells[a.id]?.[i.id]).filter(Boolean); const nA = vals.filter(v => v === "A").length, nR = vals.filter(v => v === "R").length;
      return nA !== 1 || !nR ? `<span class="raci-warn" title="${[nA === 0 ? "Aucun A (qui approuve ?)" : nA > 1 ? `${nA} A : un seul responsable final recommandé` : "", !nR ? "Aucun R (qui réalise ?)" : ""].filter(Boolean).join(" · ")}">⚠️</span>` : `<span class="raci-ok" title="Un A et au moins un R">✓</span>`; };
    const proposables = [...new Set([...(p.planning?.phases || []).map(ph => ph.nom), ...ACTIVITES_TYPES])].filter(n => !R.activites.some(a => a.nom.toLowerCase() === n.toLowerCase()));
    return `
      <div class="toolbar cp-tools"><h2 style="margin:0">🧩 Matrice RACI</h2><span class="muted">qui fait quoi</span><span class="spacer"></span>
        ${proposables.length ? `<button class="btn ghost small" data-act="pp-proposer">✨ Proposer des activités</button>` : ""}
        <button class="btn ghost small" data-act="pp-csv">📊 Export CSV</button><button class="btn small" data-act="capture">⛶ Mode capture</button></div>
      <button class="btn ghost small cp-exit" data-act="quit-capture">✕ Quitter le mode capture (Échap)</button>
      <div class="copil hslide">
        <div class="cp-head"><div class="project-emoji" style="width:44px;height:44px;font-size:1.5rem" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div><div><div class="cp-proj">${esc(p.nom)} — Matrice RACI</div><div class="muted">Situation au ${fmtDate(today())}</div></div></div>
        <div class="raci-wrap"><table class="raci">
          <thead><tr><th class="raci-act">Activité / livrable</th>${I.map(i => { const x = personne(i.personneId); return `<th title="${esc(x?.nom || "?")} · ${esc(i.role)}"><div class="raci-nom">${esc(prenomNom(x?.nom))}</div><div class="raci-role">${esc(i.role)}</div></th>`; }).join("")}<th></th></tr></thead>
          <tbody>${R.activites.map(a => `<tr><td class="raci-act"><input class="inp" data-pp-act="${a.id}" value="${esc(a.nom)}"></td>${I.map(i => `<td>${cell(a, i)}</td>`).join("")}<td class="raci-fin">${alerte(a)}<button class="x-btn cp-tools" data-act="pp-act-suppr" data-id="${a.id}" title="Supprimer">✕</button></td></tr>`).join("")}
            <tr class="cp-tools"><td class="raci-act" colspan="${I.length + 2}"><div class="row" style="flex-wrap:nowrap"><input class="inp" id="ppNouv" placeholder="Nouvelle activité ou livrable…"><button class="btn small" data-act="pp-act-ajout">＋ Ajouter</button></div></td></tr>
          </tbody></table></div>
        <div class="cp-legend" style="margin-left:0">${Object.entries(RACI).map(([k, [lib, c]]) => `<span><b class="raci-cell raci-${c} mini">${k}</b> ${lib}</span>`).join("")}<span>⚠️ = pas exactement un A, ou aucun R</span></div>
      </div>
      <p class="muted cp-tools" style="font-size:.82rem;margin-top:10px">Clique sur une case pour passer de vide à R, A, C, I. Les colonnes suivent les interlocuteurs de la fiche d'identité.</p>`;
  }

  // ─── Charge des parties prenantes (jours prévus par mois)
  const capacite = x => num(x?.capacite) || 18;
  function moisEntre(d0, d1) { const L = []; for (let m = d0.slice(0, 7); m <= d1.slice(0, 7) && L.length < 36; m = moisSuivant(m)) L.push(m); return L; }
  const libMois = (m, i) => `${nomMoisCourt(m)}${m.endsWith("-01") || i === 0 ? " " + m.slice(2, 4) : ""}`;
  function chargeDe(p) { p.charge = p.charge || {}; return p.charge; }
  // temps réellement passé (jours), même découpage que la charge prévue
  function chargeReelDe(p) { p.chargeReel = p.chargeReel || {}; return p.chargeReel; }
  Object.assign(ui, { chargeVue: "prevu" });
  function chargeTotale(personneId, mois) {
    let tot = 0; const det = [];
    S.projets.filter(q => opt(q, "charge")).forEach(q => q.interlocuteurs.filter(i => i.personneId === personneId).forEach(i => { const v = num(q.charge?.[i.id]?.[mois]); if (v) { tot += v; det.push(`${q.nom} : ${v} j`); } }));
    return { tot, det };
  }
  const classeCharge = (tot, cap) => !tot ? "" : tot > cap ? "c-sur" : tot >= cap * 0.8 ? "c-plein" : "c-ok";
  function vueCharge(p) {
    const reel = ui.chargeVue === "reel"; const P = chargeDe(p); const C = reel ? chargeReelDe(p) : P; const I = p.interlocuteurs;
    const fmtJ = v => new Intl.NumberFormat("fr-FR").format(Math.round(v * 10) / 10);
    const d0 = p.dateDebut || today(); const d1 = p.dateFin || (p.planning?.methode ? horizon(p, p.planning) : addJ(d0, 365));
    const M = moisEntre(d0, d1);
    if (!I.length) return `<div class="empty"><span class="big">📊</span>Ajoute d'abord des interlocuteurs dans la <span class="link" data-act="module" data-id="identite">fiche d'identité</span>.</div>`;
    const totMois = m => I.reduce((n, i) => n + num(C[i.id]?.[m]), 0);
    const total = M.reduce((n, m) => n + totMois(m), 0);
    const jh = opt(p, "budget") && p.budget.unite === "jh" ? totauxBudget(p).prevu : 0;
    return `
      <div class="toolbar"><h2 style="margin:0">📊 Charge des parties prenantes</h2>
        <div class="seg2" style="width:auto"><button class="${!reel ? "on" : ""}" data-act="pp-chvue" data-id="prevu">📅 Prévu</button><button class="${reel ? "on" : ""}" data-act="pp-chvue" data-id="reel">⏱️ Temps passé</button></div>
        <span class="muted">${reel ? "jours réellement passés par mois, comparés au prévu" : "jours prévus par mois sur ce projet"}</span><span class="spacer"></span>
        <button class="btn ghost small" data-act="pp-voir-global">👥 Charge tous projets</button></div>
      <div class="panel" style="padding:8px 0">
        <div class="charge-wrap"><table class="charge">
          <thead><tr><th class="ch-nom">Personne</th>${M.map((m, i) => `<th class="${m === today().slice(0, 7) ? "ch-cour" : ""}">${libMois(m, i)}</th>`).join("")}<th>Total</th></tr></thead>
          <tbody>${I.map(i => { const x = personne(i.personneId); const cap = capacite(x); const tot = M.reduce((n, m) => n + num(C[i.id]?.[m]), 0); return `
            <tr><td class="ch-nom"><b>${esc(x?.nom || "?")}</b><div class="muted" style="font-size:.76rem">${esc(i.role)} · dispo ${cap} j/mois <button class="lien-mini" data-act="pp-remplir" data-id="${i.id}" title="Mettre le même nombre de jours sur tous les mois">⇥ remplir</button></div></td>
              ${M.map(m => { const g = chargeTotale(i.personneId, m); if (reel) { const pv = num(P[i.id]?.[m]); const rv = C[i.id]?.[m]; const ec = rv != null && rv !== "" ? num(rv) - pv : null;
                return `<td class="${m === today().slice(0, 7) ? "ch-cour" : ""}"><input class="inp ch-in" data-ch="${i.id}" data-m="${m}" value="${esc(rv ?? "")}" inputmode="decimal" placeholder="${m <= today().slice(0, 7) && pv ? "?" : ""}">${pv || ec ? `<div class="ch-g ${ec == null ? "" : ec > 0.5 ? "c-sur" : ec < -0.5 ? "c-ok" : ""}" title="Prévu : ${fmtJ(pv)} j">prévu ${fmtJ(pv)}${ec ? ` · ${ec > 0 ? "+" : ""}${fmtJ(ec)}` : ""}</div>` : ""}</td>`; }
                return `<td class="${m === today().slice(0, 7) ? "ch-cour" : ""}"><input class="inp ch-in" data-ch="${i.id}" data-m="${m}" value="${esc(C[i.id]?.[m] ?? "")}" inputmode="decimal">${g.tot ? `<div class="ch-g ${classeCharge(g.tot, cap)}" title="Tous projets : ${g.tot} j sur ${cap} j disponibles\n${g.det.join("\n")}">${Math.round(g.tot / cap * 100)} %</div>` : ""}</td>`; }).join("")}
              <td class="num-txt"><b>${new Intl.NumberFormat("fr-FR").format(tot)}</b></td></tr>`; }).join("")}
            <tr class="ch-tot"><td class="ch-nom"><b>Total projet</b>${reel ? `<div class="muted" style="font-size:.74rem">temps passé / prévu</div>` : ""}</td>${M.map(m => `<td class="num-txt">${totMois(m) ? fmtJ(totMois(m)) : ""}${reel ? `<div class="muted" style="font-size:.72rem">/ ${fmtJ(I.reduce((n, i) => n + num(P[i.id]?.[m]), 0))}</div>` : ""}</td>`).join("")}<td class="num-txt"><b>${fmtJ(total)}</b>${reel ? `<div class="muted" style="font-size:.72rem">/ ${fmtJ(M.reduce((n, m) => n + I.reduce((k, i) => k + num(P[i.id]?.[m]), 0), 0))}</div>` : ""}</td></tr>
          </tbody></table></div>
      </div>
      <p class="muted" style="font-size:.82rem;margin-top:10px">Sous chaque case, le pourcentage indique la charge de la personne <b>tous projets confondus</b> par rapport à sa disponibilité : <span class="ch-g c-ok">vert</span> &lt; 80 %, <span class="ch-g c-plein">orange</span> 80 à 100 %, <span class="ch-g c-sur">rouge</span> surcharge. La disponibilité (18 j/mois par défaut) se règle dans l'annuaire.
        ${jh ? `<br>Charge totale prévue : <b>${new Intl.NumberFormat("fr-FR").format(total)} j</b>, soit ${Math.round(total / jh * 100)} % du budget prévu (${new Intl.NumberFormat("fr-FR").format(jh)} jours-homme).` : ""}</p>`;
  }

  // Vue tous projets (dans l'annuaire)
  function vueChargeGlobale() {
    const t = today(); const M = moisEntre(addJ(t, -31), addJ(t, 330));
    const gens = S.annuaire.filter(x => M.some(m => chargeTotale(x.id, m).tot)).sort((a, b) => a.nom.localeCompare(b.nom));
    return `
      <div class="toolbar"><button class="btn ghost small" data-act="reglages">← Réglages</button><h2 style="margin:0">👥 Annuaire</h2>${segAnnuaire()}<span class="muted">charge prévue, tous projets confondus</span></div>
      ${S.projets.some(q => opt(q, "charge")) ? "" : `<div class="alert">Aucun projet ne suit la charge. Active le module « Charge » dans la fiche d'identité d'un projet.</div>`}
      ${gens.length ? `<div class="panel" style="padding:8px 0"><div class="charge-wrap"><table class="charge">
        <thead><tr><th class="ch-nom">Personne</th><th>Dispo / mois</th>${M.map((m, i) => `<th class="${m === t.slice(0, 7) ? "ch-cour" : ""}">${libMois(m, i)}</th>`).join("")}</tr></thead>
        <tbody>${gens.map(x => `<tr><td class="ch-nom"><b>${esc(x.nom)}</b><div class="muted" style="font-size:.76rem">${esc([x.fonction, x.entite].filter(Boolean).join(" · "))}</div></td>
          <td><input class="inp ch-in" data-cap="${x.id}" value="${esc(x.capacite ?? "")}" placeholder="18" inputmode="decimal"></td>
          ${M.map(m => { const g = chargeTotale(x.id, m); const cap = capacite(x); return `<td class="${m === t.slice(0, 7) ? "ch-cour" : ""}">${g.tot ? `<div class="ch-cell ${classeCharge(g.tot, cap)}" title="${g.det.join("\n")}"><b>${new Intl.NumberFormat("fr-FR").format(g.tot)} j</b><small>${Math.round(g.tot / cap * 100)} %</small></div>` : ""}</td>`; }).join("")}</tr>`).join("")}
        </tbody></table></div></div>` : `<div class="empty"><span class="big">📊</span>Aucune charge saisie sur les 12 prochains mois.</div>`}
      <p class="muted" style="font-size:.82rem;margin-top:10px">Survole une case pour voir le détail par projet. <span class="ch-g c-sur">Rouge</span> = la personne est sollicitée au-delà de sa disponibilité.</p>`;
  }
  const segAnnuaire = () => ""; // (Liste / Charge tous projets : désormais dans la ligne de sous-onglets)

  // ─── Événements
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const { act, id } = el.dataset;
    if (act === "pp-annu") { ui.annuVue = id; render(); return; }
    if (act === "pp-annu-ouvrir") { ui.annuVue = id; allerA("annuaire"); return; }
    if (act === "in-go-copil") { ui.vueInst = "copil"; allerA("projet", "instances"); return; }
    if (!act.startsWith("pp-") && act !== "set-opt") return;
    const p = proj(); if (!p) return; const R = raciDe(p);
    switch (act) {
      case "set-opt": p.options = p.options || {}; p.options[id] = el.checked; save(); render(); toast(el.checked ? "Module activé" : "Module masqué (les données sont conservées)"); return;
      case "pp-vue": ui.vuePP = id; break;
      case "pp-cell": { const ordre = ["", "R", "A", "C", "I"]; const c = (R.cells[el.dataset.a] = R.cells[el.dataset.a] || {}); c[el.dataset.i] = ordre[(ordre.indexOf(c[el.dataset.i] || "") + 1) % 5]; save(); break; }
      case "pp-act-ajout": { const v = $("#ppNouv").value.trim(); if (!v) { $("#ppNouv").focus(); return; } R.activites.push({ id: uid(), nom: v }); save(); render(); setTimeout(() => $("#ppNouv")?.focus(), 0); return; }
      case "pp-act-suppr": if (!confirm("Supprimer cette activité ?")) return; R.activites = R.activites.filter(a => a.id !== id); delete R.cells[id]; save(); break;
      case "pp-proposer": {
        const L = [...new Set([...(p.planning?.phases || []).map(ph => ph.nom), ...ACTIVITES_TYPES])].filter(n => !R.activites.some(a => a.nom.toLowerCase() === n.toLowerCase()));
        L.forEach(n => R.activites.push({ id: uid(), nom: n })); save(); toast(`✨ ${L.length} activité(s) ajoutée(s) : supprime celles qui ne servent pas`); break;
      }
      case "pp-csv": {
        const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const cols = ["Activité", ...p.interlocuteurs.map(i => `${personne(i.personneId)?.nom || "?"} (${i.role})`)];
        const rows = R.activites.map(a => [a.nom, ...p.interlocuteurs.map(i => R.cells[a.id]?.[i.id] || "")]);
        telecharger(`raci-${(p.code || p.nom).replace(/[^\w-]+/g, "_")}.csv`, "﻿" + [cols.map(q).join(";"), ...rows.map(r => r.map(q).join(";"))].join("\n"), "text/csv;charset=utf-8");
        toast("📊 Matrice RACI exportée"); return;
      }
      case "pp-remplir": {
        const v = prompt("Nombre de jours par mois pour cette personne sur ce projet (laisse vide pour tout effacer) :", ""); if (v === null) return;
        const C = ui.chargeVue === "reel" ? chargeReelDe(p) : chargeDe(p); const d0 = p.dateDebut || today(); const d1 = p.dateFin || (p.planning?.methode ? horizon(p, p.planning) : addJ(d0, 365));
        C[id] = C[id] || {}; moisEntre(d0, d1).forEach(m => { if (v.trim() === "") delete C[id][m]; else C[id][m] = String(num(v)); }); save(); break;
      }
      case "pp-voir-global": ui.annuVue = "charge"; allerA("annuaire"); return;
      case "pp-chvue": ui.chargeVue = id; ui.vuePP = "charge"; break;
      default: return;
    }
    render();
  });
  document.addEventListener("change", e => {
    const d = e.target.dataset || {};
    if (d.ch || d.cap) {
      if (d.ch) { const C = ui.chargeVue === "reel" ? chargeReelDe(proj()) : chargeDe(proj()); C[d.ch] = C[d.ch] || {}; const v = e.target.value.trim(); if (v === "") delete C[d.ch][d.m]; else C[d.ch][d.m] = String(num(v)); }
      else { const x = S.annuaire.find(y => y.id === d.cap); if (x) x.capacite = e.target.value.trim() === "" ? "" : String(num(e.target.value)); }
      save();
      setTimeout(() => { const a = document.activeElement; const sel = a?.dataset?.ch ? `[data-ch="${a.dataset.ch}"][data-m="${a.dataset.m}"]` : a?.dataset?.cap ? `[data-cap="${a.dataset.cap}"]` : null; render(); if (sel) $(sel)?.focus(); }, 0);
    }
  });
  document.addEventListener("input", e => {
    const id = e.target.dataset?.ppAct; if (!id) return;
    const a = raciDe(proj()).activites.find(x => x.id === id); if (a) { a.nom = e.target.value; save(); }
  });
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "ppNouv") $("[data-act=pp-act-ajout]")?.click(); });

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Analyse du backlog (import manuel d'un export CSV Jira / ClickUp…)
  // ═══════════════════════════════════════════════════════════════
  const OUTILS_BL = { jira: "Jira", clickup: "ClickUp", azure: "Azure DevOps", autre: "Autre outil" };
  const CATS_BL = { afaire: ["À faire", "#98a2b3"], encours: ["En cours", "#2e7d5b"], bloque: ["Bloqué", "#c0392b"], fait: ["Terminé", "#1c2434"] };
  const CHAMPS_BL = [
    ["k", "Identifiant", ["issue key", "cle", "key", "task id", "id", "work item id"]],
    ["t", "Titre", ["summary", "resume", "task name", "name", "titre", "title"]],
    ["type", "Type", ["issue type", "type de ticket", "work item type", "task type", "type"]],
    ["st", "Statut", ["status", "statut", "state", "etat"]],
    ["prio", "Priorité", ["priority", "priorite"]],
    ["qui", "Assigné à", ["assignee", "assignees", "assigned to", "responsable", "assigne"]],
    ["pts", "Points / estimation", ["custom field (story points)", "story points", "custom field (story point estimate)", "story point estimate", "sprint points", "points", "estimation", "effort"]],
    ["sprint", "Sprint", ["sprint", "sprints", "iteration path", "iteration"]],
    ["epic", "Epic / regroupement", ["epic link", "epic name", "parent summary", "custom field (epic link)", "parent", "epic", "list name", "liste", "area path"]],
    ["cree", "Date de création", ["created", "date created", "created date", "cree", "date de creation", "creation"]],
    ["resolu", "Date de fin réelle", ["resolved", "date closed", "date done", "closed date", "resolution date", "resolu", "date de resolution", "done date", "date de fin reelle"]],
    ["ech", "Échéance (due date)", ["due date", "date d'echeance", "echeance", "due", "target date", "date cible"]],
  ];
  Object.assign(ui, { blUnite: "auto" });
  const normTxt = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  function backlogDe(p) { p.backlog = p.backlog || {}; const b = p.backlog; b.outil = b.outil || ""; b.url = b.url || ""; b.imports = b.imports || []; b.mapping = b.mapping || null; return b; }
  const dernierImport = p => { const I = backlogDe(p).imports; return I[I.length - 1] || null; };

  // ─── Lecture CSV (séparateur auto, guillemets, retours à la ligne dans les cellules)
  function parseCSV(txt) {
    txt = txt.replace(/^﻿/, "");
    const l1 = txt.split(/\r?\n/)[0]; const d = [";", ",", "\t"].sort((a, b) => l1.split(b).length - l1.split(a).length)[0];
    const rows = []; let row = [], f = "", q = false;
    for (let i = 0; i < txt.length; i++) {
      const c = txt[i];
      if (q) { if (c === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true; else if (c === d) { row.push(f); f = ""; } else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; } else if (c !== "\r") f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    return rows.filter(r => r.some(x => x.trim()));
  }
  const MOIS_BL = { jan: 1, janv: 1, feb: 2, fev: 2, fevr: 2, mar: 3, mars: 3, apr: 4, avr: 4, may: 5, mai: 5, jun: 6, juin: 6, jul: 7, juil: 7, aug: 8, aou: 8, aout: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  function parseDateBl(v, fmt = "jm") {
    v = String(v || "").trim(); if (!v) return "";
    const local = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (/^\d{12,13}$/.test(v)) return local(new Date(+v));
    let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = v.match(/^(\d{1,2})[\/\-\s.]+([A-Za-zÀ-ÿ.]+)[\/\-\s.]+(\d{2,4})/);
    if (m) { const k = normTxt(m[2]).replace(/\./g, ""); const mo = MOIS_BL[k] || MOIS_BL[k.slice(0, 4)] || MOIS_BL[k.slice(0, 3)]; if (mo) { let y = +m[3]; if (y < 100) y += 2000; return `${y}-${String(mo).padStart(2, "0")}-${m[1].padStart(2, "0")}`; } }
    m = v.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})/);
    if (m) { let a = +m[1], b = +m[2], y = +m[3]; if (y < 100) y += 2000; let [j, mo] = fmt === "mj" ? [b, a] : [a, b]; if (mo > 12) [j, mo] = [mo, j]; return `${y}-${String(mo).padStart(2, "0")}-${String(j).padStart(2, "0")}`; }
    // « Monday, January 13th 2025 », « Jan 13, 2025 »…
    m = v.match(/([A-Za-zÀ-ÿ]+)\.?\s+(\d{1,2})(?:st|nd|rd|th|er)?,?\s+(\d{4})/);
    if (m) { const k = normTxt(m[1]); const mo = MOIS_BL[k] || MOIS_BL[k.slice(0, 4)] || MOIS_BL[k.slice(0, 3)]; if (mo) return `${m[3]}-${String(mo).padStart(2, "0")}-${m[2].padStart(2, "0")}`; }
    const d = new Date(v.replace(/(\d+)(st|nd|rd|th)/, "$1")); return isNaN(d) ? "" : local(d);
  }
  function catStatut(s) {
    const x = normTxt(s);
    if (/(bloqu|block|imped|on hold|waiting|en attente)/.test(x)) return "bloque";
    if (/(a valider|en validation|in review|review|revue|recette|test|qa|progress|en cours|doing|develop|dev |realis|wip)/.test(x)) return "encours";
    if (/(done|termin|clos|closed|resolu|resolved|complete|livr|fini|valide|accepted|ferme)/.test(x)) return "fait";
    return "afaire";
  }
  function devinerColonnes(entetes) {
    const H = entetes.map(normTxt); const M = {};
    CHAMPS_BL.forEach(([k, , motifs]) => {
      let i = -1;
      for (const m of motifs) { i = H.findIndex(h => h === m); if (i >= 0) break; }
      if (i < 0) for (const m of motifs) { i = H.findIndex(h => h.includes(m)); if (i >= 0) break; }
      M[k] = i >= 0 ? entetes[i] : "";
    });
    return M;
  }
  // Valeur d'un champ pour une ligne (si plusieurs colonnes portent le même nom, comme « Sprint » dans Jira : la dernière non vide)
  function valeurCol(entetes, ligne, nom) {
    if (!nom) return ""; let v = "";
    entetes.forEach((h, i) => { const x = nettoyerVal(ligne[i]); if (h === nom && x) v = x; });
    return v;
  }
  // ClickUp : « [] », « [Ophélie Caquelin] », « none »… ; Jira : valeurs vides
  function nettoyerVal(x) {
    let v = String(x ?? "").trim();
    if (/^\[.*\]$/.test(v)) v = v.slice(1, -1).split(",").map(t => t.trim().replace(/^["']|["']$/g, "")).filter(Boolean).join(", ");
    return /^(none|null|undefined|-|n\/a)$/i.test(v) ? "" : v;
  }
  function construireItems(rows, M) {
    const [entetes, ...L] = rows;
    return L.map(r => {
      const g = k => valeurCol(entetes, r, M.champs[k]);
      const st = g("st"); const pts = parseFloat(g("pts").replace(",", "."));
      return { k: g("k"), t: g("t"), type: g("type"), st, cat: M.statuts[st] || catStatut(st), prio: g("prio"), qui: g("qui"), pts: isFinite(pts) ? pts : null, sprint: g("sprint"), epic: g("epic"), cree: parseDateBl(g("cree"), M.dateFmt), resolu: parseDateBl(g("resolu"), M.dateFmt), ech: parseDateBl(g("ech"), M.dateFmt) };
    }).filter(x => x.t || x.k);
  }
  function totauxItems(items) {
    const T = { nb: items.length, pts: 0 }; Object.keys(CATS_BL).forEach(c => T[c] = { nb: 0, pts: 0 });
    items.forEach(x => { T.pts += x.pts || 0; T[x.cat].nb++; T[x.cat].pts += x.pts || 0; });
    return T;
  }

  // ─── Fenêtre d'import en deux étapes : fichier, puis correspondance des colonnes et des statuts
  function ouvrirImportBacklog() {
    const p = proj(); const b = backlogDe(p);
    const st = { rows: null, nom: "", date: today(), M: null };
    const etape1 = () => openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">📥 Importer le backlog</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <p class="muted" style="margin:0">Exporte ton backlog en CSV depuis ${b.outil ? OUTILS_BL[b.outil] : "Jira, ClickUp ou Azure DevOps"}, puis choisis le fichier. Chaque import est une « photo » datée : les imports successifs tracent l'évolution.</p>
        <div class="aide-box">${b.outil === "clickup" ? "ClickUp : dans la liste ou la vue voulue, menu ⋯ › <b>Export</b> › CSV (cocher toutes les colonnes)." : b.outil === "azure" ? "Azure DevOps : Boards › Queries › une requête › <b>Export to CSV</b>." : "Jira : Filtres › recherche avancée (JQL) du projet › <b>Exporter</b> › Exporter Excel CSV (tous les champs)."}</div>
        <div class="field"><label>Fichier CSV</label><input type="file" id="blFile" accept=".csv,text/csv"></div>
        <div class="field"><label>… ou colle le contenu CSV</label><textarea id="blTxt" rows="4" placeholder="Issue key;Summary;Status;…"></textarea></div>
        <div class="field" style="max-width:220px"><label>Date de la photo</label><input type="date" id="blDate" value="${st.date}"></div>
      </div>
      <div class="modal-foot"><span></span><div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button><button class="btn" id="blSuite">Suivant →</button></div></div>`);
    const lire = txt => {
      const rows = parseCSV(txt); if (rows.length < 2) { toast("✋ Le fichier ne contient pas de lignes"); return; }
      st.rows = rows; st.date = $("#blDate").value || today();
      const auto = devinerColonnes(rows[0]);
      const prec = b.mapping; // on reprend les choix du dernier import si les colonnes existent toujours
      st.M = { champs: {}, statuts: { ...(prec?.statuts || {}) }, dateFmt: prec?.dateFmt || (b.outil === "clickup" ? "mj" : "jm") };
      CHAMPS_BL.forEach(([k]) => { st.M.champs[k] = prec?.champs?.[k] && rows[0].includes(prec.champs[k]) ? prec.champs[k] : auto[k]; });
      if (st.M.champs.resolu && /due|echeance|cible|target/.test(normTxt(st.M.champs.resolu))) { st.M.champs.ech = st.M.champs.ech || st.M.champs.resolu; st.M.champs.resolu = ""; }
      etape2();
    };
    const etape2 = () => {
      const [entetes] = st.rows; const items = construireItems(st.rows, st.M);
      const statuts = [...new Set(items.map(x => x.st).filter(Boolean))].sort();
      statuts.forEach(s => { if (!st.M.statuts[s]) st.M.statuts[s] = catStatut(s); });
      const opts = sel => `<option value="">—</option>${[...new Set(entetes)].map(h => `<option ${h === sel ? "selected" : ""}>${esc(h)}</option>`).join("")}`;
      openModal(`
        <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">📥 Vérifier la correspondance</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
        <div class="modal-body">
          <p class="muted" style="margin:0"><b>${items.length}</b> élément(s) lus dans ${esc(st.nom || "le texte collé")}. Les colonnes ont été reconnues automatiquement : corrige si besoin.</p>
          <div class="bl-map">${CHAMPS_BL.map(([k, lib]) => `<label><span>${lib}</span><select class="inp" data-blm="${k}">${opts(st.M.champs[k])}</select></label>`).join("")}
            <label><span>Format des dates</span><select class="inp" data-blm="dateFmt"><option value="jm" ${st.M.dateFmt === "jm" ? "selected" : ""}>jj/mm/aaaa</option><option value="mj" ${st.M.dateFmt === "mj" ? "selected" : ""}>mm/jj/aaaa (américain)</option></select></label></div>
          ${statuts.length ? `<div class="field"><label>Classement des statuts</label><div class="bl-stats">${statuts.map(s => `<label><span>${esc(s)} <span class="muted">(${items.filter(x => x.st === s).length})</span></span><select class="inp" data-bls="${esc(s)}">${Object.entries(CATS_BL).map(([c, [l]]) => `<option value="${c}" ${st.M.statuts[s] === c ? "selected" : ""}>${l}</option>`).join("")}</select></label>`).join("")}</div></div>` : `<div class="alert"><b>Ton export ne contient pas de colonne de statut</b>${st.M.champs.st ? " (la colonne choisie est vide)" : ""} : sans elle, tout sera compté « À faire ».<br>
            ${b.outil === "jira" ? "Dans Jira, exporte avec « Tous les champs »." : "Dans ClickUp, l'export ne reprend que les colonnes affichées : dans la vue Liste ou Tableau, ajoute les colonnes <b>Status</b> (et si possible <b>Date Closed</b>, <b>Date Created</b>, <b>Sprint Points</b>, <b>Sprints</b>) avec le bouton ＋ en bout d'en-tête, puis exporte à nouveau."}</div>`}
          <div class="field"><label>Aperçu</label><div class="bl-apercu"><table><thead><tr><th>Id</th><th>Titre</th><th>Statut</th><th>Assigné</th><th>Pts</th><th>Sprint</th><th>Échéance</th><th>Fini le</th></tr></thead><tbody>${items.slice(0, 5).map(x => `<tr><td>${esc(x.k)}</td><td>${esc(tronque(x.t, 40))}</td><td>${esc(x.st) || `<span class="muted">vide</span>`} → ${CATS_BL[x.cat][0]}</td><td>${esc(x.qui)}</td><td>${x.pts ?? ""}</td><td>${esc(tronque(x.sprint, 16))}</td><td>${x.ech || ""}</td><td>${x.resolu}</td></tr>`).join("")}</tbody></table></div></div>
        </div>
        <div class="modal-foot"><button class="btn ghost" id="blRetour">← Autre fichier</button><div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button><button class="btn" id="blOk">Importer ${items.length} élément(s)</button></div></div>`);
      $$("#modal [data-blm]").forEach(s => s.onchange = () => { if (s.dataset.blm === "dateFmt") st.M.dateFmt = s.value; else st.M.champs[s.dataset.blm] = s.value; etape2(); });
      $$("#modal [data-bls]").forEach(s => s.onchange = () => { st.M.statuts[s.dataset.bls] = s.value; etape2(); });
      $("#blRetour").onclick = etape1Lier;
      $("#blOk").onclick = () => {
        const its = construireItems(st.rows, st.M);
        b.mapping = st.M;
        b.imports.push({ id: uid(), date: st.date, source: st.nom || "texte collé", totaux: totauxItems(its), items: its });
        b.imports.sort((x, y) => x.date.localeCompare(y.date));
        b.imports.slice(0, -2).forEach(x => delete x.items); // on garde le détail des 2 derniers imports
        save(); closeModal(); ui.module = "backlog"; render(); toast(`📥 ${its.length} élément(s) importé(s)`);
      };
    };
    const etape1Lier = () => {
      etape1();
      $("#blFile").onchange = e => { const f = e.target.files[0]; if (!f) return; st.nom = f.name; const rd = new FileReader(); rd.onload = () => lire(rd.result); rd.readAsText(f); };
      $("#blSuite").onclick = () => { const t = $("#blTxt").value.trim(); if (!t) { toast("✋ Choisis un fichier ou colle le contenu CSV"); return; } st.nom = ""; lire(t); };
    };
    etape1Lier();
  }

  // ─── Calculs du tableau de bord
  function analyseBacklog(p) {
    const I = dernierImport(p); if (!I?.items) return null;
    const items = I.items; const avecPts = items.some(x => x.pts);
    const u = ui.blUnite === "auto" ? (avecPts ? "pts" : "nb") : ui.blUnite === "pts" && !avecPts ? "nb" : ui.blUnite;
    const v = x => u === "pts" ? (x.pts || 0) : 1;
    const somme = L => L.reduce((n, x) => n + v(x), 0);
    const par = (cle, L = items) => { const m = new Map(); L.forEach(x => { const k = x[cle] || "(non renseigné)"; const o = m.get(k) || { nom: k, tot: 0, fait: 0, encours: 0, bloque: 0, afaire: 0, n: 0 }; o.tot += v(x); o[x.cat] += v(x); o.n++; m.set(k, o); }); return [...m.values()]; };
    const tot = somme(items), fait = somme(items.filter(x => x.cat === "fait"));
    // sprints, triés par numéro dans le nom
    const sprints = par("sprint").filter(s => s.nom !== "(non renseigné)").sort((a, b) => a.nom.localeCompare(b.nom, "fr", { numeric: true }));
    // sprint terminé = au moins un élément fini et plus rien en cours ni bloqué
    const finis = sprints.filter(s => s.fait > 0 && !s.encours && !s.bloque);
    const courant = sprints.find(s => s.encours || s.bloque) || null;
    const base = finis.slice(-3);
    const velocite = base.length ? base.reduce((n, s) => n + s.fait, 0) / base.length : 0;
    const reste = tot - fait;
    const dureeSprint = p.planning?.sprint?.duree || 2;
    const nbSprintsRestants = velocite ? Math.ceil(reste / velocite) : null;
    const dateFinEstimee = nbSprintsRestants != null ? addJ(today(), nbSprintsRestants * dureeSprint * 7) : null;
    const mep = p.planning?.jalons?.find(j => /production|mep|livraison/i.test(j.nom) && j.date)?.date || p.dateFin || null;
    // évolution depuis l'import précédent
    const prec = backlogDe(p).imports.slice(-2, -1)[0];
    let evol = null;
    if (prec?.items) {
      const P = new Map(prec.items.map(x => [x.k || x.t, x]));
      const C = new Map(items.map(x => [x.k || x.t, x]));
      evol = { date: prec.date, nouveaux: items.filter(x => !P.has(x.k || x.t)), termines: items.filter(x => x.cat === "fait" && P.get(x.k || x.t)?.cat !== "fait" && P.has(x.k || x.t)), retires: prec.items.filter(x => !C.has(x.k || x.t)) };
    }
    return { I, items, u, v, tot, fait, reste, pct: tot ? fait / tot : 0, parCat: Object.fromEntries(Object.keys(CATS_BL).map(c => [c, somme(items.filter(x => x.cat === c))])),
      types: par("type").sort((a, b) => b.tot - a.tot), qui: par("qui", items.filter(x => x.cat !== "fait")).sort((a, b) => b.tot - a.tot), epics: par("epic").sort((a, b) => b.tot - a.tot),
      retards: items.filter(x => x.cat !== "fait" && x.ech && x.ech < today()).sort((a, b) => a.ech.localeCompare(b.ech)),
      aVenir: items.filter(x => x.cat !== "fait" && x.ech && x.ech >= today()).sort((a, b) => a.ech.localeCompare(b.ech)),
      avecEch: items.some(x => x.ech), sansStatut: !items.some(x => x.st),
      sprints, velocite, courant, nbSprintsRestants, dateFinEstimee, mep, nonEstimes: avecPts ? items.filter(x => x.pts == null && x.cat !== "fait").length : 0, bloques: items.filter(x => x.cat === "bloque"), evol, avecPts };
  }
  const fmtU = (A, n) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n)} ${A.u === "pts" ? "pts" : "élément" + (n > 1 ? "s" : "")}`;

  function barreStatuts(A) {
    return `<div class="bl-stack">${Object.entries(CATS_BL).map(([c, [l, col]]) => A.parCat[c] ? `<div style="flex:${A.parCat[c]};background:${col}" title="${l} : ${fmtU(A, A.parCat[c])}">${A.tot && A.parCat[c] / A.tot > 0.08 ? `${l} ${Math.round(A.parCat[c] / A.tot * 100)} %` : ""}</div>` : "").join("")}</div>
      <div class="cp-legend" style="margin:6px 0 0">${Object.entries(CATS_BL).map(([c, [l, col]]) => `<span><i style="background:${col}"></i>${l} : ${fmtU(A, A.parCat[c])}</span>`).join("")}</div>`;
  }
  function barresGroupes(A, L, max = 8) {
    const m = Math.max(1, ...L.map(x => x.tot));
    return L.slice(0, max).map(x => `<div class="bl-row"><span title="${esc(x.nom)}">${esc(tronque(x.nom, 30))}</span><div class="bl-track">${Object.entries(CATS_BL).map(([c, [l, col]]) => x[c] ? `<div style="width:${x[c] / m * 100}%;background:${col}" title="${l} : ${fmtU(A, x[c])}"></div>` : "").join("")}</div><b>${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(x.tot)}</b></div>`).join("") + (L.length > max ? `<div class="muted" style="font-size:.78rem">… et ${L.length - max} autre(s)</div>` : "");
  }
  function graphVelocite(A, W = 460, H = 190) {
    const S = A.sprints.slice(-10); if (!S.length) return `<p class="muted" style="margin:0">Pas de colonne « Sprint » dans l'import.</p>`;
    const max = Math.max(1, ...S.map(s => s.tot)) * 1.1; const L = 36, R = W - 8, B = H - 34; const bw = (R - L) / S.length;
    const y = v => 8 + (1 - v / max) * (B - 8);
    let svg = [0, .5, 1].map(f => `<line x1="${L}" y1="${y(max * f)}" x2="${R}" y2="${y(max * f)}" class="hf-grid"/><text x="${L - 5}" y="${y(max * f) + 4}" text-anchor="end" class="hf-t s">${Math.round(max * f)}</text>`).join("");
    S.forEach((s, i) => { const x0 = L + i * bw + bw * 0.18, w = bw * 0.64;
      svg += `<rect x="${x0}" y="${y(s.tot)}" width="${w}" height="${B - y(s.tot)}" rx="3" class="bl-v-tot"><title>${esc(s.nom)} : ${fmtU(A, s.tot)} au total</title></rect>
        <rect x="${x0}" y="${y(s.fait)}" width="${w}" height="${B - y(s.fait)}" rx="3" class="bl-v-fait ${s.encours || s.bloque ? "cour" : ""}"><title>${esc(s.nom)} : ${fmtU(A, s.fait)} terminés</title></rect>
        <text x="${x0 + w / 2}" y="${H - 18}" text-anchor="middle" class="hf-t s">${esc(tronque(s.nom.replace(/^.*?(\d+)\s*$/, "S$1"), 9))}</text>`; });
    if (A.velocite) svg += `<line x1="${L}" y1="${y(A.velocite)}" x2="${R}" y2="${y(A.velocite)}" class="bl-v-moy"/><text x="${R}" y="${y(A.velocite) - 5}" text-anchor="end" class="hf-t s">vélocité moyenne ${Math.round(A.velocite * 10) / 10}</text>`;
    return `<svg class="hfrise" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vélocité par sprint">${svg}</svg>`;
  }
  // Courbe cumulée : éléments créés (périmètre) et terminés, à partir des dates de l'export, sinon des imports successifs
  function graphCumul(p, A, W = 560, H = 210) {
    let pts = [];
    const dates = A.items.map(x => x.cree).filter(Boolean).sort();
    if (dates.length > A.items.length * 0.6) {
      let d0 = dates[0], fin = today(); const pas = diffJ(d0, fin) > 180 ? 14 : 7;
      for (let d = d0; d <= fin; d = addJ(d, pas)) pts.push({ d, scope: A.items.filter(x => x.cree && x.cree <= d).reduce((n, x) => n + A.v(x), 0), fait: A.items.filter(x => x.cat === "fait" && x.resolu && x.resolu <= d).reduce((n, x) => n + A.v(x), 0) });
      pts.push({ d: fin, scope: A.tot, fait: A.fait });
    } else {
      pts = backlogDe(p).imports.map(i => ({ d: i.date, scope: A.u === "pts" ? i.totaux.pts : i.totaux.nb, fait: A.u === "pts" ? i.totaux.fait.pts : i.totaux.fait.nb }));
    }
    if (pts.length < 2) return `<p class="muted" style="margin:0">La courbe apparaîtra avec les dates de création / fin dans l'export, ou à partir de deux imports.</p>`;
    const max = Math.max(1, ...pts.map(q => q.scope)) * 1.08; const L = 40, R = W - 10, B = H - 24;
    const x = echelle(pts[0].d, pts[pts.length - 1].d, L, R); const y = v => 8 + (1 - v / max) * (B - 8);
    let svg = [0, .5, 1].map(f => `<line x1="${L}" y1="${y(max * f)}" x2="${R}" y2="${y(max * f)}" class="hf-grid"/><text x="${L - 5}" y="${y(max * f) + 4}" text-anchor="end" class="hf-t s">${Math.round(max * f)}</text>`).join("");
    let mois = ""; for (let m = pts[0].d.slice(0, 7), i = 0; m <= pts[pts.length - 1].d.slice(0, 7); m = moisSuivant(m), i++) { const dd = m + "-01"; if (dd >= pts[0].d) mois += `<text x="${x(dd)}" y="${H - 6}" text-anchor="middle" class="hf-mois">${nomMoisCourt(m)}</text>`; }
    const aire = `M${x(pts[0].d)},${B} ` + pts.map(q => `L${x(q.d)},${y(q.fait)}`).join(" ") + ` L${x(pts[pts.length - 1].d)},${B} Z`;
    svg += mois + `<path d="${aire}" class="bl-c-aire"/><polyline points="${pts.map(q => `${x(q.d)},${y(q.scope)}`).join(" ")}" class="bl-c-scope"/><polyline points="${pts.map(q => `${x(q.d)},${y(q.fait)}`).join(" ")}" class="bl-c-fait"/>`;
    return `<svg class="hfrise" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Courbe cumulée du backlog">${svg}</svg>
      <div class="cp-legend" style="margin:4px 0 0"><span><i style="background:#98a2b3;border-radius:0;height:2px"></i>Périmètre (créés)</span><span><i style="background:#1c2434"></i>Terminés</span></div>`;
  }
  function tuilesBacklog(p, A) {
    const retard = A.dateFinEstimee && A.mep && A.dateFinEstimee > A.mep;
    return `<div class="hf-tiles">
      <div><span>📦 Backlog</span><b>${fmtU(A, A.tot)}</b><small>${A.items.length} élément(s)${A.nonEstimes ? ` · ${A.nonEstimes} non estimé(s)` : ""}</small></div>
      <div><span>✅ Terminé</span><b>${Math.round(A.pct * 100)} %</b><small>${fmtU(A, A.fait)}</small></div>
      <div><span>🔄 En cours</span><b>${fmtU(A, A.parCat.encours)}</b><small>${A.bloques.length ? `<span class="txt-danger">${A.bloques.length} bloqué(s)</span>` : "aucun blocage"}</small></div>
      ${A.avecEch ? `<div class="${A.retards.length ? "danger" : ""}"><span>⏰ En retard</span><b>${A.retards.length}</b><small>échéance dépassée, non terminé${A.aVenir.length ? ` · ${A.aVenir.length} à venir` : ""}</small></div>` : ""}
      <div><span>🏃 Vélocité</span><b>${A.velocite ? Math.round(A.velocite * 10) / 10 : "—"}</b><small>${A.velocite ? `${A.u === "pts" ? "pts" : "éléments"} / sprint (3 derniers)` : "pas assez de sprints"}</small></div>
      <div class="${retard ? "warn" : ""}"><span>🎯 Fin estimée</span><b>${A.dateFinEstimee ? fmtDate(A.dateFinEstimee) : "—"}</b><small>${A.nbSprintsRestants != null ? `${A.nbSprintsRestants} sprint(s) restant(s)` : ""}${A.mep ? ` · cible ${fmtJM(A.mep)}` : ""}${retard ? ` · <span class="txt-danger">+${diffJ(A.mep, A.dateFinEstimee)} j</span>` : ""}</small></div>
    </div>`;
  }

  function vueBacklog() {
    const p = proj(); const b = backlogDe(p); const A = analyseBacklog(p);
    const lien = b.url ? `<a class="btn ghost small" href="${esc(b.url)}" target="_blank" rel="noopener">↗ Ouvrir dans ${OUTILS_BL[b.outil] || "l'outil"}</a>` : `<span class="link" data-act="module" data-id="identite">Renseigner le lien vers Jira / ClickUp</span>`;
    if (!A) return `
      <div class="toolbar"><h2 style="margin:0">📈 Analyse du backlog</h2><span class="spacer"></span>${lien}</div>
      <div class="empty" style="max-width:680px;margin:0 auto"><span class="big">📥</span><h3>Importe ton backlog pour voir le tableau de bord</h3>
        <p class="muted">Exporte le backlog en CSV depuis ${b.outil ? OUTILS_BL[b.outil] : "Jira, ClickUp ou Azure DevOps"} et importe-le ici. L'outil reconnaît les colonnes (statut, points, sprint, epic, dates…) ; tu pourras corriger la correspondance.</p>
        <button class="btn" data-act="bl-import">📥 Importer un export CSV</button></div>`;
    const W = largeurDispo(); const demi = Math.round(Math.min(620, (W - 80) / 2));
    const seg = ["pts", "nb"].map(u => `<button class="${A.u === u ? "on" : ""}" data-act="bl-unite" data-id="${u}" ${u === "pts" && !A.avecPts ? "disabled" : ""}>${u === "pts" ? "Points" : "Nombre"}</button>`).join("");
    return `
      <div class="toolbar cp-tools"><h2 style="margin:0">📈 Analyse du backlog</h2><span class="muted">photo du ${fmtDate(A.I.date)} · ${esc(A.I.source)}</span>
        <div class="seg2" style="width:auto">${seg}</div><span class="spacer"></span>${lien}
        <button class="btn ghost small" data-act="bl-historique">🗂️ Imports (${b.imports.length})</button>
        <button class="btn ghost small" data-act="bl-import">📥 Nouvel import</button><button class="btn small" data-act="capture">⛶ Mode capture</button></div>
      <button class="btn ghost small cp-exit" data-act="quit-capture">✕ Quitter le mode capture (Échap)</button>
      <div class="copil hslide">
        <div class="cp-head"><div class="project-emoji" style="width:44px;height:44px;font-size:1.5rem" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div><div><div class="cp-proj">${esc(p.nom)} — Backlog</div><div class="muted">Photo du ${fmtDate(A.I.date)}${b.outil ? ` · ${OUTILS_BL[b.outil]}` : ""} · en ${A.u === "pts" ? "points" : "nombre d'éléments"}</div></div></div>
        ${tuilesBacklog(p, A)}
        <h3>Répartition par statut</h3>${barreStatuts(A)}
        <div class="bl-grid">
          <section><h3>🏃 Vélocité par sprint</h3>${graphVelocite(A, demi)}<div class="cp-legend" style="margin:4px 0 0"><span><i style="background:#e4e7ec"></i>Engagé dans le sprint</span><span><i style="background:#1c2434"></i>Terminé</span><span><i style="background:#2e7d5b"></i>Terminé (sprint en cours)</span></div></section>
          <section><h3>📈 Courbe cumulée</h3>${graphCumul(p, A, demi)}</section>
          <section><h3>🧩 Avancement par epic</h3>${barresGroupes(A, A.epics)}</section>
          <section><h3>🏷️ Par type</h3>${barresGroupes(A, A.types)}<h3 style="margin-top:14px">👤 Reste à faire par personne</h3>${barresGroupes(A, A.qui, 6)}</section>
        </div>
        ${A.evol ? `<div class="bl-evol"><b>Depuis la photo du ${fmtDate(A.evol.date)} :</b> <span class="pill ok">✅ ${A.evol.termines.length} terminé(s)</span> <span class="pill soft">➕ ${A.evol.nouveaux.length} nouveau(x)</span> <span class="pill soft">➖ ${A.evol.retires.length} retiré(s)</span>
          ${A.evol.nouveaux.length ? `<div class="muted" style="font-size:.8rem;margin-top:4px">Nouveaux : ${A.evol.nouveaux.slice(0, 6).map(x => esc(x.k || tronque(x.t, 30))).join(", ")}${A.evol.nouveaux.length > 6 ? "…" : ""}</div>` : ""}</div>` : ""}
        ${A.sansStatut ? `<div class="alert" style="margin-top:14px">Cet import n'a pas de statut : tout est compté « À faire ». Ajoute la colonne Status dans ${OUTILS_BL[backlogDe(p).outil] || "ton outil"} avant d'exporter.</div>` : ""}
        ${A.avecEch && (A.retards.length || A.aVenir.length) ? `<div class="bl-grid" style="margin-top:14px">
          <section><h3>⏰ En retard (${A.retards.length})</h3>${A.retards.slice(0, 8).map(x => `<div class="kv"><span>${esc(tronque(x.t, 60))}${x.type ? ` <span class="pill soft">${esc(x.type)}</span>` : ""}</span><span class="txt-danger" style="white-space:nowrap">${fmtJM(x.ech)} · ${diffJ(x.ech, today())} j</span></div>`).join("") || `<p class="muted">Aucun retard.</p>`}${A.retards.length > 8 ? `<div class="muted" style="font-size:.78rem">… et ${A.retards.length - 8} autre(s)</div>` : ""}</section>
          <section><h3>📅 Prochaines échéances</h3>${A.aVenir.slice(0, 8).map(x => `<div class="kv"><span>${esc(tronque(x.t, 60))}${x.type ? ` <span class="pill soft">${esc(x.type)}</span>` : ""}</span><span class="muted" style="white-space:nowrap">${fmtJM(x.ech)}</span></div>`).join("") || `<p class="muted">Aucune échéance à venir.</p>`}</section>
        </div>` : ""}
        ${A.bloques.length ? `<div class="bl-bloques"><h3>⛔ Éléments bloqués (${A.bloques.length})</h3>${A.bloques.slice(0, 8).map(x => `<div class="kv"><span>${x.k ? `<b>${esc(x.k)}</b> · ` : ""}${esc(tronque(x.t, 80))}</span><span class="muted">${esc(x.qui || "non assigné")}</span></div>`).join("")}</div>` : ""}
      </div>
      <p class="muted cp-tools" style="font-size:.82rem;margin-top:10px">La vélocité est la moyenne des 3 derniers sprints terminés ; la fin estimée divise le reste à faire par cette vélocité (sprints de ${p.planning?.sprint?.duree || 2} semaines). Pour mettre à jour, refais un export et un nouvel import.</p>`;
  }

  function ouvrirHistoriqueBacklog() {
    const p = proj(); const b = backlogDe(p);
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">🗂️ Imports du backlog</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">${b.imports.slice().reverse().map(i => `<div class="kv"><span><b>${fmtDate(i.date)}</b> · ${esc(i.source)}<div class="muted" style="font-size:.8rem">${i.totaux.nb} élément(s) · ${i.totaux.pts} pts · ${i.totaux.fait.nb} terminé(s)</div></span><button class="x-btn" data-act="bl-suppr-import" data-id="${i.id}" title="Supprimer cet import">✕</button></div>`).join("") || `<p class="muted">Aucun import.</p>`}
        <p class="aide">Le détail des éléments est conservé pour les deux derniers imports ; les plus anciens gardent leurs totaux pour la courbe.</p></div>`);
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || !el.dataset.act.startsWith("bl-")) return;
    const p = proj(); if (!p) return; const b = backlogDe(p); const { act, id } = el.dataset;
    if (act === "bl-import") ouvrirImportBacklog();
    if (act === "bl-unite") { ui.blUnite = id; render(); }
    if (act === "bl-historique") ouvrirHistoriqueBacklog();
    if (act === "bl-suppr-import") { if (!confirm("Supprimer cet import ?")) return; b.imports = b.imports.filter(i => i.id !== id); save(); closeModal(); render(); toast("🗑️ Import supprimé"); }
  });
  document.addEventListener("change", e => {
    const k = e.target.dataset?.blf; if (!k) return;
    const b = backlogDe(proj()); b[k] = e.target.value.trim(); save(); render();
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Impression d'une page (flash report, CR de RETEX…)
  // ═══════════════════════════════════════════════════════════════
  function imprimerHTML(titre, html) {
    const w = window.open("", "_blank");
    if (!w) { toast("Autorise les fenêtres pop-up pour imprimer"); return; }
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(titre)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="${location.origin}/style.css">
      <style>body{background:#fff;padding:20px} .cp-tools,.x-btn,.lock{display:none!important} .copil{border:none;box-shadow:none} @page{size:A4;margin:12mm}</style></head>
      <body>${html}<script>window.onload=()=>setTimeout(()=>window.print(),400)<\/script></body></html>`);
    w.document.close();
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Flash report hebdomadaire (sous-onglet de la vue d'ensemble)
  // ═══════════════════════════════════════════════════════════════
  Object.assign(ui, { vueCk: "synthese", flashSemaine: null, docFiltre: "tous", retexVue: "atelier", retexCat: "toutes", retexQ: "" });
  const VUES_CK = [{ id: "synthese", nom: "Synthèse", emoji: "🧭" }, { id: "flash", nom: "Flash report", emoji: "📰" }, { id: "tendances", nom: "Tendances", emoji: "📈" }];
  // ─── Tendances : une photo des indicateurs par semaine (p.tendances[lundi]), mise à jour tant que la semaine dure
  const NOTE_METEO = { soleil: 4, nuage: 3, pluie: 2, orage: 1 };
  const METEO_NOTE = { 4: "soleil", 3: "nuage", 2: "pluie", 1: "orage" };
  const INDICATEURS = [
    { id: "meteo", emoji: "🌤️", nom: "Météo générale", sens: 1, f: p => { const F = p.flash?.[lundiDe(today())]; const g = F?.meteo?.global || (p.planning?.reunions || []).filter(r => r.type === "copil" && r.prep?.meteo?.global).sort((a, b) => b.date.localeCompare(a.date))[0]?.prep.meteo.global; return g ? NOTE_METEO[g] : null; } },
    { id: "reel", emoji: "📊", nom: "Avancement réel", unite: "%", sens: 1, f: p => { const A = avancementReel(p); return A ? Math.round(A.reel * 100) : null; } },
    { id: "temps", emoji: "⏳", nom: "Temps écoulé", unite: "%", sens: 0, f: p => { const A = avancementTemps(p); return A ? Math.round(A.pct * 100) : null; } },
    { id: "backlog", emoji: "📈", nom: "Backlog terminé", unite: "%", sens: 1, f: p => { const A = p.backlog?.imports?.length ? analyseBacklog(p) : null; return A ? Math.round(A.pct * 100) : null; } },
    { id: "risques", emoji: "🎯", nom: "Risques ouverts", sens: -1, f: p => statsRisques(p).ouverts.length },
    { id: "critiques", emoji: "🔥", nom: "Risques élevés ou critiques", sens: -1, f: p => statsRisques(p).critiques.length },
    { id: "problemes", emoji: "💥", nom: "Problèmes ouverts", sens: -1, f: p => problemesOuverts(p).length },
    { id: "retard", emoji: "⏰", nom: "Actions en retard", sens: -1, f: p => statsRisques(p).retard.length },
    { id: "glissement", emoji: "↗", nom: "Glissement max. des jalons", unite: " j", sens: -1, f: p => { const J = (p.planning?.jalons || []).filter(j => !j.atteint).map(glissement).filter(g => g > 0); return p.planning ? (J.length ? Math.max(...J) : 0) : null; } },
    { id: "budget", emoji: "💶", nom: "Budget consommé", unite: "%", sens: 0, f: p => opt(p, "budget") && budgetDe(p).lignes.length ? Math.round(totauxBudget(p).conso * 100) : null },
  ];
  function photoSemaine(p) {
    p.tendances = p.tendances || {}; const k = lundiDe(today()); const v = {};
    INDICATEURS.forEach(i => { let x = null; try { x = i.f(p); } catch (_) { x = null; } if (x != null && !Number.isNaN(x)) v[i.id] = x; });
    const avant = JSON.stringify(p.tendances[k] || {}); if (avant === JSON.stringify(v)) return false;
    p.tendances[k] = v; return true;
  }
  // petite courbe d'un indicateur sur les dernières semaines
  function courbeTendance(p, ind, W = 230, H = 56, n = 12) {
    const S = Object.keys(p.tendances || {}).sort().slice(-n).map(k => ({ k, v: p.tendances[k][ind.id] })).filter(x => x.v != null);
    if (S.length < 2) return `<div class="td-vide">${S.length ? "1re semaine : la courbe apparaîtra la semaine prochaine" : "pas encore de donnée"}</div>`;
    const vals = S.map(x => x.v); let min = Math.min(...vals), max = Math.max(...vals);
    if (ind.id === "meteo") { min = 1; max = 4; } else if (ind.unite === "%") { min = Math.min(min, 0); max = Math.max(max, 100); } else { min = Math.min(min, 0); if (max === min) max = min + 1; }
    const x = i => 6 + i * (W - 12) / (S.length - 1); const y = v => H - 8 - (v - min) / (max - min || 1) * (H - 16);
    const pts = S.map((s, i) => `${x(i).toFixed(1)},${y(s.v).toFixed(1)}`).join(" ");
    const d = vals[vals.length - 1] - vals[vals.length - 2]; const bon = ind.sens === 0 || d === 0 ? "neutre" : d * ind.sens > 0 ? "bon" : "mauvais";
    return `<svg class="td-svg ${bon}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution : ${esc(ind.nom)}"><polyline points="${pts}" class="td-ligne"/>${S.map((s, i) => `<circle cx="${x(i)}" cy="${y(s.v)}" r="${i === S.length - 1 ? 3.5 : 2}" class="td-pt"><title>Semaine du ${fmtJM(s.k)} : ${ind.id === "meteo" ? METEO[METEO_NOTE[s.v]]?.[0] : s.v + (ind.unite || "")}</title></circle>`).join("")}</svg>`;
  }
  function carteTendance(p, ind) {
    const S = Object.keys(p.tendances || {}).sort().map(k => p.tendances[k][ind.id]).filter(v => v != null);
    if (!S.length) return "";
    const v = S[S.length - 1]; const d = S.length > 1 ? v - S[S.length - 2] : 0;
    const cls = ind.sens === 0 || !d ? "" : d * ind.sens > 0 ? "txt-ok" : "txt-danger";
    const val = ind.id === "meteo" ? `${METEO[METEO_NOTE[v]]?.[0] || "—"}` : `${v}${ind.unite || ""}`;
    const delta = !d ? "stable" : ind.id === "meteo" ? (d > 0 ? "s'améliore" : "se dégrade") : `${d > 0 ? "+" : ""}${d}${(ind.unite || "").trim() === "%" ? " pts" : ind.unite || ""} en 1 semaine`;
    return `<div class="td-carte"><div class="row" style="gap:6px"><span>${ind.emoji}</span><b class="td-nom">${esc(ind.nom)}</b><span class="spacer"></span><b class="td-val">${val}</b></div>
      ${courbeTendance(p, ind)}<small class="${cls}">${delta}</small></div>`;
  }
  function vueTendances(p) {
    const n = Object.keys(p.tendances || {}).length; const debut = Object.keys(p.tendances || {}).sort()[0];
    return `
      <div class="toolbar cp-tools"><h2 style="margin:0">📈 Tendances</h2><span class="muted">une photo des indicateurs chaque semaine, prise automatiquement</span><span class="spacer"></span><button class="btn small" data-act="capture">⛶ Mode capture</button></div>
      <div class="copil">
        <div class="cp-head"><div class="project-emoji" style="width:44px;height:44px;font-size:1.5rem" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div><div><div class="cp-proj">${esc(p.nom)} — Tendances</div><div class="muted">${n} semaine(s) suivie(s)${debut ? ` depuis le ${fmtDate(debut)}` : ""} · situation au ${fmtDate(today())}</div></div></div>
        <div class="td-grille">${INDICATEURS.map(i => carteTendance(p, i)).join("")}</div>
        <p class="muted" style="font-size:.8rem;margin:10px 0 0">Vert : ça s'améliore · rouge : ça se dégrade, par rapport à la semaine précédente. La photo de la semaine en cours se met à jour jusqu'au dimanche.</p>
      </div>`;
  }
  const lundiDe = d => addJ(d, -((jSem(d) + 6) % 7));
  function flashDe(p, L) {
    p.flash = p.flash || {};
    if (!p.flash[L]) {
      const prec = Object.keys(p.flash).filter(k => k < L).sort().pop();
      const cop = p.planning?.methode ? histoMeteo(p.planning).pop() : null;
      p.flash[L] = { meteo: { ...(prec ? p.flash[prec].meteo : cop?.m || {}) }, faits: "", attention: "", besoins: "", envoyeLe: "" };
    }
    return p.flash[L];
  }
  function donneesFlash(p, L) {
    const fin = addJ(L, 6); const dans = d => d && d >= L && d <= fin; const pl = p.planning?.methode ? p.planning : null; const nums = pl ? numerosCopil(pl) : new Map();
    const ouverts = p.risques.filter(r => !CLOS.has(r.statut));
    const A = actionsToutes(p);
    return {
      fin, av: avancementTemps(p), spr: pl ? sprintEnCours(pl) : null, bl: analyseBacklog(p),
      jalons: pl ? pl.jalons.filter(j => j.date && j.date >= L && j.date <= addJ(L, 34)).sort((a, b) => a.date.localeCompare(b.date)) : [],
      reuSemaine: pl ? pl.reunions.filter(r => !r.annulee && dans(r.date) && !TYPES_REU[r.type]?.agile).sort((a, b) => a.date.localeCompare(b.date)) : [],
      reuSuivante: pl ? pl.reunions.filter(r => !r.annulee && r.date >= addJ(L, 7) && r.date <= addJ(L, 13) && !TYPES_REU[r.type]?.agile).sort((a, b) => a.date.localeCompare(b.date)) : [],
      top: ouverts.slice().sort((a, b) => crit(b) - crit(a)).slice(0, 5),
      nouveaux: p.risques.filter(r => dans(r.creeLe)),
      hausse: ouverts.filter(r => { const c0 = critAu(r, addJ(L, -1)); return c0 != null && crit(r) > c0; }),
      decisions: p.decisions.filter(d => dans(d.date)),
      faites: A.filter(x => x.a.fait && dans(x.a.faitLe)),
      retard: A.filter(x => !x.a.fait && x.a.echeance && x.a.echeance < today()),
      nums,
    };
  }
  function blocFlash(p, L) {
    const F = flashDe(p, L); const D = donneesFlash(p, L); const m = F.meteo;
    const liste = (arr, vide) => arr.length ? `<ul class="fl-list">${arr.map(x => `<li>${x}</li>`).join("")}</ul>` : `<p class="muted fl-vide">${vide}</p>`;
    const axes = Object.keys(AXES_METEO).filter(a => a !== "global" && (a !== "budget" || opt(p, "budget")));
    const T = opt(p, "budget") ? totauxBudget(p) : null;
    return `<div class="copil hslide flash" id="flashPage">
      <div class="cp-head"><div class="project-emoji" style="width:44px;height:44px;font-size:1.5rem" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div>
        <div style="flex:1"><div class="cp-proj">${esc(p.nom)} — Flash report</div><div class="muted">Semaine du ${fmtDate(L)} au ${fmtDate(D.fin)}${p.code ? ` · ${esc(p.code)}` : ""}</div></div>
        <div class="fl-meteo"><span>${m.global ? METEO[m.global][0] : "—"}</span><div><b>${m.global ? METEO[m.global][1] : "Météo à renseigner"}</b><div class="fl-axes">${axes.map(a => `<span>${AXES_METEO[a]} ${m[a] ? METEO[m[a]][0] : "·"}</span>`).join("")}</div></div></div></div>
      <div class="fl-grid">
        <section><h3>📣 Faits marquants de la semaine</h3>${liste(lignes(F.faits).map(esc), "—")}</section>
        <section><h3>⚠️ Points d'attention</h3>${liste(lignes(F.attention).map(esc), "Aucun point d'attention.")}</section>
        <section><h3>⏳ Avancement</h3>${liste([
          D.av ? `Temps écoulé : <b>${Math.round(D.av.pct * 100)} %</b> (${D.av.restants >= 0 ? `J-${D.av.restants}` : `dépassé de ${-D.av.restants} j`})` : "",
          D.spr ? `Sprint en cours : <b>sprint ${D.spr.num}</b> (${fmtJM(D.spr.debut)} → ${fmtJM(D.spr.fin)})` : "",
          D.bl ? `Backlog : <b>${Math.round(D.bl.pct * 100)} % terminé</b>${D.bl.dateFinEstimee ? ` · fin estimée ${fmtJM(D.bl.dateFinEstimee)}` : ""}` : "",
          T && T.prevu ? `Budget : ${Math.round(T.conso * 100)} % consommé · atterrissage ${fmtB(p, T.atterrissage)}${T.ecart > 0 ? ` (<span class="txt-danger">+${fmtB(p, T.ecart)}</span>)` : ""}` : "",
          D.faites.length ? `${D.faites.length} action(s) terminée(s) cette semaine` : "",
        ].filter(Boolean), "—")}</section>
        <section><h3>◆ Jalons (5 semaines)</h3>${liste(D.jalons.map(j => `${j.atteint ? "✔ " : ""}<b>${esc(j.nom)}</b> · ${fmtJM(j.date)} ${badgeGlissement(j)} ${badgeMenace(p, j)}`), "Aucun jalon sur la période.")}</section>
        <section><h3>🎯 Risques principaux</h3>${liste(D.top.map(r => `<span class="crit ${niveau(crit(r))} fl-crit">${crit(r)}</span> R${p.risques.indexOf(r) + 1} · ${esc(r.titre)}${D.hausse.includes(r) ? ` <span class="trend up">▲</span>` : ""}${D.nouveaux.includes(r) ? ` <span class="pill soft">nouveau</span>` : ""}`), "Aucun risque ouvert.")}</section>
        <section><h3>⚖️ Décisions de la semaine</h3>${liste(D.decisions.map(d => `${STATUTS_DEC[d.statut].emoji} ${esc(d.titre)}`), "Aucune décision cette semaine.")}</section>
        <section><h3>⏰ Actions en retard (${D.retard.length})</h3>${liste(D.retard.slice(0, 5).map(x => `${esc(x.a.texte)} <span class="muted">· ${esc(x.a.responsable || "?")} · ${fmtJM(x.a.echeance)}</span>`), "Aucune action en retard.")}</section>
        <section><h3>🙋 Besoins / demandes</h3>${liste(lignes(F.besoins).map(esc), "Aucune demande particulière.")}</section>
        <section class="fl-large"><h3>➡️ Semaine prochaine</h3>${liste(D.reuSuivante.map(r => `${fmtCourt(r.date)} · ${(TYPES_REU[r.type] || TYPES_REU.libre).emoji} ${esc(titreReu(r, D.nums))}`), "Aucune réunion importante prévue.")}</section>
      </div></div>`;
  }
  function flashTexte(p, L) {
    const F = flashDe(p, L); const D = donneesFlash(p, L); const m = F.meteo;
    const sec = (t, arr) => [``, t, ...(arr.length ? arr.map(x => `- ${x}`) : ["- —"])];
    return [`FLASH REPORT — ${p.nom} — semaine du ${fmtDate(L)}`, `Météo : ${m.global ? METEO[m.global][0] + " " + METEO[m.global][1] : "—"}`,
      ...sec("FAITS MARQUANTS", lignes(F.faits)), ...sec("POINTS D'ATTENTION", lignes(F.attention)),
      ...sec("JALONS", D.jalons.map(j => `${j.nom} · ${fmtDate(j.date)}${glissement(j) ? ` (${glissement(j) > 0 ? "+" : ""}${glissement(j)} j)` : ""}`)),
      ...sec("RISQUES PRINCIPAUX", D.top.map(r => `R${p.risques.indexOf(r) + 1} ${r.titre} (criticité ${crit(r)})`)),
      ...sec("DÉCISIONS DE LA SEMAINE", D.decisions.map(d => `[${STATUTS_DEC[d.statut].nom}] ${d.titre}`)),
      ...sec("BESOINS / DEMANDES", lignes(F.besoins)),
      ...sec("SEMAINE PROCHAINE", D.reuSuivante.map(r => `${fmtCourt(r.date)} · ${titreReu(r, D.nums)}`))].join("\n");
  }
  function vueFlash() {
    const p = proj(); const L = ui.flashSemaine || lundiDe(today()); const F = flashDe(p, L);
    const semaines = [...new Set([lundiDe(today()), ...Object.keys(p.flash || {})])].sort().reverse();
    const choix = axe => `<div class="meteo-row"><span>${AXES_METEO[axe]}</span><div class="meteo-pick">${Object.entries(METEO).map(([k, [e, l]]) => `<button class="${F.meteo[axe] === k ? "on" : ""}" data-act="fl-meteo" data-axe="${axe}" data-id="${k}" title="${l}">${e}</button>`).join("")}</div></div>`;
    return `
      <div class="toolbar cp-tools"><h2 style="margin:0">📰 Flash report</h2>
        <select class="inp" id="flSemaine" style="width:auto">${semaines.map(s => `<option value="${s}" ${s === L ? "selected" : ""}>Semaine du ${fmtDate(s)}${p.flash?.[s]?.envoyeLe ? " · envoyé" : ""}</option>`).join("")}</select>
        ${F.envoyeLe ? `<span class="pill ok">Envoyé le ${fmtJM(F.envoyeLe)}</span>` : ""}<span class="spacer"></span>
        <label class="row" style="font-size:.85rem;cursor:pointer" title="Rappel dans « À faire aujourd'hui » chaque vendredi"><input type="checkbox" data-act="fl-rappel" ${p.flashRappel ? "checked" : ""}> Rappel le vendredi</label>
        <button class="btn ghost small" data-act="fl-copier">📋 Copier</button><button class="btn ghost small" data-act="fl-mail">✉️ Messagerie</button>
        <button class="btn ghost small" data-act="fl-imprimer">🖨️ Imprimer / PDF</button><button class="btn ghost small" data-act="capture">⛶ Capture</button>
        <button class="btn small" data-act="fl-envoye">${F.envoyeLe ? "↩︎ Non envoyé" : "✅ Marquer comme envoyé"}</button></div>
      <button class="btn ghost small cp-exit" data-act="quit-capture">✕ Quitter le mode capture (Échap)</button>
      <div class="prep-grid cp-tools" style="margin-bottom:16px">
        <section class="panel"><h3>🌤️ Météo de la semaine</h3>${Object.keys(AXES_METEO).filter(a => a !== "budget" || opt(p, "budget")).map(choix).join("")}</section>
        <section class="panel" style="display:grid;gap:10px">
          <label class="field" style="margin:0"><span class="lbl">📣 Faits marquants (un par ligne)</span><textarea class="inp" rows="3" data-fl="faits">${esc(F.faits)}</textarea></label>
          <label class="field" style="margin:0"><span class="lbl">⚠️ Points d'attention</span><textarea class="inp" rows="2" data-fl="attention">${esc(F.attention)}</textarea></label>
          <label class="field" style="margin:0"><span class="lbl">🙋 Besoins / demandes au sponsor</span><textarea class="inp" rows="2" data-fl="besoins">${esc(F.besoins)}</textarea></label>
          <div class="aide">Le reste (avancement, jalons, risques, décisions, actions, semaine prochaine) est rempli automatiquement.</div>
        </section>
      </div>
      ${blocFlash(p, L)}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Livrables & documentation
  // ═══════════════════════════════════════════════════════════════
  const CATS_DOC = { doc: "📘 Documentation projet", specs: "📐 Spécifications", crreu: "📝 CR de réunion", crcopil: "🏛️ CR de copil", manuel: "📗 Manuel utilisateur", tuto: "🎬 Tutoriels", support: "🛟 How-to support", contrat: "📜 Contrat", nda: "🔏 NDA", retex: "🎓 CR de Retex / rétrospective", autre: "📦 Autre" };
  const STATUTS_DOC = { afaire: ["À produire", "soft"], redaction: ["En rédaction", "soft"], relecture: ["En relecture", "warn"], valide: ["Validé", "ok"], diffuse: ["Diffusé", "ok"] };
  const livrablesDe = p => (p.livrables = p.livrables || []);
  // Documents produits automatiquement par l'outil : comptes rendus, CR de RETEX
  function docsAuto(p) {
    const pl = p.planning; const nums = pl ? numerosCopil(pl) : new Map(); const L = [];
    (pl?.reunions || []).filter(r => r.cr && !r.annulee).forEach(r => L.push({ auto: "cr", id: r.id, titre: `CR · ${titreReu(r, nums)} du ${fmtJM(r.date)}`, cat: r.type === "copil" ? "crcopil" : "crreu", statut: realisee(r) ? "diffuse" : "redaction", echeance: r.date, maj: r.cr.diffuseLe || r.date }));
    if ((p.retex || []).length) L.push({ auto: "retex", id: "retex", titre: `CR de Retex / rétrospective (${p.retex.length} enseignement(s))`, cat: "retex", statut: "redaction", maj: p.retex.map(x => x.date).sort().pop() });
    return L;
  }
  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Templates de documents (sous-onglet de Livrables & docs)
  // Chaque modèle produit un document HTML, pré-rempli avec les données du projet,
  // téléchargeable au format Word (.doc), imprimable en PDF, ou ajouté aux livrables.
  // ═══════════════════════════════════════════════════════════════
  Object.assign(ui, { livVue: "liste", tplPhase: "toutes" });
  const VUES_LIV = [{ id: "liste", nom: "Livrables", emoji: "📚" }, { id: "templates", nom: "Templates", emoji: "🧩" }];
  const PHASES_TPL = { cadrage: "🧭 Cadrage", conception: "📐 Conception", recette: "🧪 Recette", deploiement: "🚀 Déploiement", pilotage: "🎛️ Pilotage", cloture: "🏁 Clôture", contrat: "📜 Contractuel" };
  // briques de mise en forme des modèles
  const tC = s => `<p class="consigne">${s}</p>`;                       // consigne à supprimer
  const tUl = L => `<ul>${L.map(x => `<li>${x}</li>`).join("")}</ul>`;
  const tTab = (tete, lignesT, vides = 0) => `<table><thead><tr>${tete.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${lignesT.map(l => `<tr>${l.map(c => `<td>${c ?? ""}</td>`).join("")}</tr>`).join("")}${Array.from({ length: vides }, () => `<tr>${tete.map(() => "<td>&nbsp;</td>").join("")}</tr>`).join("")}</tbody></table>`;
  const tKv = L => `<table class="kv">${L.map(([k, v]) => `<tr><th>${k}</th><td>${v || "&nbsp;"}</td></tr>`).join("")}</table>`;
  const tSign = roles => tTab(["Rôle", "Nom", "Date", "Visa"], roles.map(r => [r, "", "", ""]));
  // données du projet utiles au pré-remplissage (toutes échappées)
  function ctxTpl(p) {
    const role = r => p.interlocuteurs.filter(i => i.role === r).map(i => esc(personne(i.personneId)?.nom || "")).filter(Boolean).join(", ");
    const L = s => lignes(s).map(esc);
    const jalons = (p.planning?.jalons || []).filter(j => j.date).sort((a, b) => a.date.localeCompare(b.date));
    const risques = p.risques.filter(r => !CLOS.has(r.statut)).sort((a, b) => crit(b) - crit(a)).slice(0, 6);
    return {
      nom: esc(p.nom), code: esc(p.code || ""), chef: role("Chef de projet") || role("Directeur de projet"), sponsor: role("Sponsor"), po: role("Product Owner"),
      debut: p.dateDebut ? fmtDate(p.dateDebut) : "", fin: p.dateFin ? fmtDate(p.dateFin) : "", budget: opt(p, "budget") ? esc(fmtMontant(p.budget)) : "",
      description: esc(p.description || "").replace(/\n/g, "<br>"), enjeu: esc(p.enjeu || "").replace(/\n/g, "<br>"),
      objectifs: L(p.objectifs), dedans: L(p.perimetreIn), dehors: L(p.perimetreOut),
      equipe: p.interlocuteurs.map(i => [esc(personne(i.personneId)?.nom || ""), esc(i.role), esc(personne(i.personneId)?.entite || personne(i.personneId)?.service || ""), i.copil ? "Membre du copil" : ""]).filter(x => x[0]),
      jalons: jalons.map(j => [esc(j.nom), fmtDate(j.date), j.atteint ? "Atteint" : "Prévu"]),
      risques: risques.map(r => [esc(r.titre), String(crit(r)), esc(r.actions.filter(a => !a.fait).map(a => a.texte).filter(Boolean).join(" ; ") || "")]),
      retex: (p.retex || []).slice(0, 8).map(x => [esc(x.constat), esc(x.recommandation || "")]),
      // matrice RACI saisie dans Identité › Matrice RACI (colonnes = interlocuteurs du projet)
      raci: (() => {
        const R = raciDe(p); const I = p.interlocuteurs.filter(i => personne(i.personneId));
        return { cols: I.map(i => `${esc(personne(i.personneId).nom)}<br><small>${esc(i.role)}</small>`), lignes: R.activites.map(a => [esc(a.nom), ...I.map(i => `<b>${R.cells[a.id]?.[i.id] || ""}</b>`)]) };
      })(),
      methode: p.planning?.methode ? METHODES[p.planning.methode].nom : "",
    };
  }
  const ouA = (L, consigne) => L.length ? tUl(L) : tC(consigne);
  const TEMPLATES = [
    { id: "cadrage", phase: "cadrage", cat: "doc", emoji: "🧭", nom: "Note de cadrage", desc: "Le document fondateur : pourquoi, quoi, qui, quand, combien. À faire valider par le sponsor.",
      corps: c => [
        ["1. Contexte et enjeux", (c.description ? `<p>${c.description}</p>` : tC("Décrivez la situation actuelle et ce qui motive le projet.")) + (c.enjeu ? `<p><b>Enjeu :</b> ${c.enjeu}</p>` : tC("Quel est l'enjeu principal ? Que se passe-t-il si on ne fait rien ?"))],
        ["2. Objectifs mesurables", ouA(c.objectifs, "3 à 5 objectifs SMART, chacun avec un indicateur et une cible. Ex : « Réduire de 30 % le délai de traitement d'ici juin ».")],
        ["3. Périmètre", `<h3>Inclus</h3>${ouA(c.dedans, "Ce que le projet livre.")}<h3>Exclu</h3>${ouA(c.dehors, "Ce que le projet ne fera pas (aussi important que l'inclus).")}`],
        ["4. Parties prenantes et gouvernance", (c.equipe.length ? tTab(["Nom", "Rôle", "Entité", "Instance"], c.equipe) : tTab(["Nom", "Rôle", "Entité", "Instance"], [], 4)) + tC("Précisez la fréquence du comité de pilotage et qui y décide.")],
        ["5. Planning macro", (c.jalons.length ? tTab(["Jalon", "Date", "État"], c.jalons) : tTab(["Jalon", "Date", "État"], [], 4)) + (c.debut ? `<p>Du <b>${c.debut}</b> au <b>${c.fin || "…"}</b>${c.methode ? ` · méthode ${c.methode}` : ""}.</p>` : "")],
        ["6. Budget et ressources", c.budget ? `<p>Budget alloué : <b>${c.budget}</b></p>` + tC("Détaillez : interne (jours/homme), externe, licences, matériel.") : tC("Budget estimé, ressources internes (jours/homme), prestations externes.")],
        ["7. Principaux risques", (c.risques.length ? tTab(["Risque", "Criticité", "Parade prévue"], c.risques) : tTab(["Risque", "Criticité", "Parade prévue"], [], 3))],
        ["8. Hypothèses et contraintes", tC("Ce qu'on suppose vrai (disponibilité des équipes, outils…) et ce qui s'impose (réglementaire, date butoir, technique).")],
        ["9. Validation", tSign(["Sponsor", "Chef de projet", "Référent métier"])],
      ] },
    { id: "besoin", phase: "cadrage", cat: "specs", emoji: "🗣️", nom: "Expression de besoin", desc: "Ce que veulent les utilisateurs, dans leurs mots, avec des priorités. Base des spécifications.",
      corps: c => [
        ["1. Contexte", c.description ? `<p>${c.description}</p>` : tC("Quel problème les utilisateurs rencontrent-ils aujourd'hui ?")],
        ["2. Utilisateurs concernés", tTab(["Profil", "Nombre", "Ce qu'ils font aujourd'hui", "Ce qui les gêne"], [], 3)],
        ["3. Processus actuel", tC("Décrivez les étapes actuelles (qui fait quoi, avec quel outil). Un schéma suffit souvent.")],
        ["4. Besoins fonctionnels", tTab(["N°", "Besoin (« L'utilisateur doit pouvoir… »)", "Profil", "Priorité (MoSCoW)"], [["B1", "", "", "Must"], ["B2", "", "", "Should"], ["B3", "", "", "Could"]], 3) + tC("Must = indispensable · Should = important · Could = confort · Won't = pas cette fois.")],
        ["5. Besoins non fonctionnels", tUl(["Performance : …", "Sécurité / confidentialité : …", "Accessibilité / ergonomie : …", "Disponibilité : …"])],
        ["6. Contraintes", tC("Réglementaires, techniques (SI existant), calendrier, budget.")],
        ["7. Critères d'acceptation", tC("Comment saura-t-on que le besoin est couvert ? Un critère vérifiable par besoin prioritaire.")],
        ["8. Validation", tSign(["Référent métier", "Product Owner / MOA", "Chef de projet"])],
      ] },
    { id: "entretien", phase: "cadrage", cat: "doc", emoji: "🎙️", nom: "Guide d'entretien utilisateur", desc: "Les questions à poser pendant un entretien, avec la place pour noter les réponses.",
      corps: c => [
        ["Informations", tKv([["Personne interviewée", ""], ["Fonction / service", ""], ["Date", ""], ["Intervieweur", c.chef]])],
        ["1. Introduction (5 min)", tUl(["Présenter le projet et l'objectif de l'entretien", "Rappeler la durée et la confidentialité des réponses", "Demander l'accord pour prendre des notes"])],
        ["2. Son rôle et son quotidien", tUl(["Pouvez-vous décrire votre rôle et vos missions principales ?", "À quoi ressemble une journée type ?", "Quels outils utilisez-vous ?"])],
        ["3. Le processus actuel", tUl(["Comment se passe [l'activité concernée] aujourd'hui, étape par étape ?", "Qui intervient ? Combien de temps cela prend-il ?", "Pouvez-vous me montrer un exemple réel ?"])],
        ["4. Irritants et attentes", tUl(["Qu'est-ce qui vous fait perdre du temps ?", "Quelle est la dernière fois où ça s'est mal passé ?", "Si vous aviez une baguette magique, que changeriez-vous ?", "Qu'est-ce qui marche bien et qu'il faut garder ?"])],
        ["5. Usage futur", tUl(["Comment imaginez-vous utiliser le nouvel outil ?", "Qu'est-ce qui vous ferait dire que le projet est réussi ?", "Quelles inquiétudes avez-vous ?"])],
        ["6. Conclusion (5 min)", tUl(["Y a-t-il un sujet qu'on n'a pas abordé ?", "Qui d'autre devrions-nous rencontrer ?", "Accepteriez-vous de tester les premières versions ?"])],
        ["Synthèse à chaud", tTab(["Besoin / irritant", "Importance (1-3)", "Verbatim"], [], 4)],
      ] },
    { id: "raci", phase: "cadrage", cat: "doc", emoji: "🗂️", nom: "Matrice RACI", desc: "Qui Réalise, qui est Responsable (rend des comptes), qui est Consulté, qui est Informé.",
      corps: c => {
        const legende = ["Légende", tUl(["<b>R</b> : Réalise l'activité", "<b>A</b> : Approuve, rend des comptes (un seul A par ligne)", "<b>C</b> : Consulté avant", "<b>I</b> : Informé après"])];
        // la matrice du projet si elle existe, sinon une trame vierge avec les activités types
        if (c.raci.lignes.length && c.raci.cols.length) return [legende, ["Matrice", tTab(["Activité / livrable", ...c.raci.cols], c.raci.lignes) + tC("Reprise de la matrice RACI saisie dans Cockpit Projet (Identité › Matrice RACI).")]];
        const roles = [...new Set((c.equipe.length ? c.equipe.map(e => e[1]) : ["Sponsor", "Chef de projet", "Référent métier", "Équipe projet"]))].slice(0, 7);
        return [legende, ["Matrice", tTab(["Activité", ...roles], ACTIVITES_TYPES.map(a => [a, ...roles.map(() => "")])) + tC("Astuce : remplissez la matrice dans Identité › Matrice RACI, ce template la reprendra automatiquement.")]];
      } },
    { id: "specs", phase: "conception", cat: "specs", emoji: "📐", nom: "Spécifications fonctionnelles", desc: "Le détail de ce que l'outil fait : règles de gestion, écrans, données, cas d'utilisation.",
      corps: c => [
        ["1. Objet du document", tC("Ce que couvre ce document, et les documents de référence (expression de besoin, note de cadrage).")],
        ["2. Glossaire", tTab(["Terme", "Définition"], [], 3)],
        ["3. Vue d'ensemble", tC("Schéma des processus cibles et des acteurs. Lien avec le périmètre :") + ouA(c.dedans, "Périmètre fonctionnel couvert.")],
        ["4. Cas d'utilisation", tKv([["Identifiant", "UC-01"], ["Acteur", ""], ["Déclencheur", ""], ["Préconditions", ""], ["Scénario nominal", "1. …<br>2. …<br>3. …"], ["Scénarios alternatifs", ""], ["Résultat attendu", ""]]) + tC("Dupliquez ce tableau pour chaque cas d'utilisation.")],
        ["5. Règles de gestion", tTab(["N°", "Règle", "Exemple"], [["RG-01", "", ""], ["RG-02", "", ""]], 2)],
        ["6. Écrans et maquettes", tC("Insérez les maquettes, avec pour chaque champ : libellé, obligatoire, format, valeur par défaut.")],
        ["7. Données", tTab(["Donnée", "Source", "Format", "Règle / contrôle"], [], 3)],
        ["8. Interfaces avec d'autres systèmes", tTab(["Système", "Sens", "Données échangées", "Fréquence"], [], 2)],
        ["9. Exigences non fonctionnelles", tUl(["Performance", "Sécurité et droits d'accès", "RGPD : données personnelles traitées, durée de conservation", "Disponibilité, sauvegarde"])],
        ["10. Traçabilité", tTab(["Besoin", "Cas d'utilisation / règle", "Cas de test"], [], 3)],
        ["Validation", tSign(["Référent métier", "Product Owner / MOA", "MOE / architecte"])],
      ] },
    { id: "us", phase: "conception", cat: "specs", emoji: "🃏", nom: "User story", desc: "Une fonctionnalité vue par l'utilisateur, avec ses critères d'acceptation. Pour les projets agiles.",
      corps: c => [
        ["User story", tKv([["Identifiant", "US-…"], ["En tant que", "[profil utilisateur]"], ["Je veux", "[action]"], ["Afin de", "[bénéfice]"], ["Priorité", ""], ["Estimation", " points"]])],
        ["Critères d'acceptation", tTab(["#", "Étant donné…", "Quand…", "Alors…"], [["1", "", "", ""], ["2", "", "", ""]], 1)],
        ["Règles de gestion et maquette", tC("Règles particulières, cas limites, lien vers la maquette.")],
        ["Definition of Ready", tUl(["☐ La valeur est claire", "☐ Les critères d'acceptation sont écrits", "☐ Elle tient dans un sprint", "☐ Les dépendances sont levées"])],
        ["Definition of Done", tUl(["☐ Développée et revue", "☐ Testée (critères d'acceptation passés)", "☐ Documentée", "☐ Validée par le Product Owner"])],
      ] },
    { id: "plan-recette", phase: "recette", cat: "doc", emoji: "🧪", nom: "Plan et cahier de recette", desc: "Comment on teste, qui teste, quand, et la liste des cas de test.",
      corps: c => [
        ["1. Objectifs et périmètre", ouA(c.dedans, "Fonctionnalités à tester (et celles exclues de la recette).")],
        ["2. Organisation", tTab(["Rôle", "Nom", "Disponibilité"], [["Responsable de recette", c.chef, ""], ["Testeurs métier", "", ""], ["Support technique", "", ""]])],
        ["3. Environnement et jeux de données", tC("Environnement de recette, accès, comptes de test, données anonymisées.")],
        ["4. Planning", tTab(["Étape", "Début", "Fin"], [["Recette fonctionnelle", "", ""], ["Correction des anomalies", "", ""], ["Non-régression", "", ""], ["PV de recette", "", ""]])],
        ["5. Critères d'entrée et de sortie", `<h3>Entrée</h3>${tUl(["Livraison installée et vérifiée", "Cas de test rédigés", "Testeurs disponibles"])}<h3>Sortie</h3>${tUl(["100 % des cas de test exécutés", "0 anomalie bloquante, 0 majeure non acceptée", "Réserves listées dans le PV"])}`],
        ["6. Gestion des anomalies", tTab(["Gravité", "Définition", "Délai de correction"], [["Bloquante", "Empêche un usage essentiel, pas de contournement", ""], ["Majeure", "Gêne forte, contournement possible", ""], ["Mineure", "Gêne faible ou cosmétique", ""]])],
        ["7. Cahier de tests", tTab(["N°", "Fonction", "Étapes", "Résultat attendu", "Obtenu", "OK / KO", "Testeur"], [["CT-01", "", "", "", "", "", ""]], 5)],
      ] },
    { id: "pv-recette", phase: "recette", cat: "doc", emoji: "✅", nom: "PV de recette", desc: "Le procès-verbal qui acte la fin de la recette, avec ou sans réserves.",
      corps: c => [
        ["Objet", `<p>Le présent procès-verbal acte la recette du projet <b>${c.nom}</b>${c.code ? ` (${c.code})` : ""}, version : …</p>`],
        ["Résultats", tKv([["Période de recette", "du … au …"], ["Cas de test exécutés", "… / …"], ["Cas de test réussis", "… %"], ["Anomalies bloquantes ouvertes", ""], ["Anomalies majeures ouvertes", ""], ["Anomalies mineures ouvertes", ""]])],
        ["Décision", tUl(["☐ Recette <b>prononcée sans réserve</b>", "☐ Recette <b>prononcée avec réserves</b> (listées ci-dessous)", "☐ Recette <b>refusée</b> : nouvelle livraison nécessaire"])],
        ["Réserves", tTab(["N°", "Réserve", "Engagement de levée", "Échéance"], [], 3)],
        ["Signatures", tSign(["Référent métier", "Product Owner / MOA", "Chef de projet", "Fournisseur / MOE"])],
      ] },
    { id: "communication", phase: "deploiement", cat: "doc", emoji: "📣", nom: "Plan de conduite du changement", desc: "Qui est impacté, quels messages, par quels canaux et quand. Formation comprise.",
      corps: c => [
        ["1. Analyse d'impact", tTab(["Population", "Nombre", "Ce qui change pour elle", "Impact (faible / moyen / fort)", "Adhésion pressentie"], [], 4)],
        ["2. Messages clés", tUl(["Pourquoi on change : " + (c.enjeu || "…"), "Ce qui change concrètement : …", "Ce que ça apporte à chacun : …", "Où trouver de l'aide : …"])],
        ["3. Plan de communication", tTab(["Quand", "Cible", "Message", "Canal", "Émetteur", "Fait"], [["J-30", "Tous les utilisateurs", "Annonce du projet", "Mail / réunion", c.sponsor, ""], ["J-15", "", "Formation", "", "", ""], ["J0", "", "Mise en service", "", "", ""], ["J+15", "", "Retours et ajustements", "", "", ""]])],
        ["4. Formation", tTab(["Population", "Format (présentiel, vidéo, tuto)", "Durée", "Formateur", "Dates"], [], 3)],
        ["5. Relais et ambassadeurs", tC("Identifiez 1 relais par service : il teste en avant-première et répond aux questions de proximité.")],
        ["6. Mesure de l'adoption", tUl(["Taux d'utilisation à J+30 : …", "Nombre de tickets support : …", "Satisfaction (sondage) : …"])],
      ] },
    { id: "mep", phase: "deploiement", cat: "doc", emoji: "🚀", nom: "Plan de mise en production", desc: "Le déroulé minute par minute de la bascule, avec le retour arrière prévu.",
      corps: c => [
        ["Informations", tKv([["Date et heure de la bascule", ""], ["Responsable de la bascule", c.chef], ["Version déployée", ""], ["Décision Go / No-Go du", ""]])],
        ["1. Prérequis", tUl(["☐ PV de recette signé", "☐ Go / No-Go prononcé", "☐ Sauvegarde réalisée", "☐ Utilisateurs prévenus de l'interruption", "☐ Support renforcé planifié"])],
        ["2. Déroulé", tTab(["Heure", "Étape", "Responsable", "Durée", "Vérification", "Fait"], [["", "Arrêt des accès", "", "", "", ""], ["", "Sauvegarde", "", "", "", ""], ["", "Déploiement", "", "", "", ""], ["", "Tests de bon fonctionnement", "", "", "", ""], ["", "Réouverture des accès", "", "", "", ""], ["", "Communication de fin", "", "", "", ""]])],
        ["3. Retour arrière", tC("Critère de déclenchement (ex : test critique KO après 1 h), qui décide, étapes de restauration, durée estimée.")],
        ["4. Contacts pendant la bascule", tTab(["Rôle", "Nom", "Téléphone"], [["Chef de projet", c.chef, ""], ["Technique", "", ""], ["Métier", "", ""], ["Fournisseur", "", ""]])],
        ["5. Après la bascule", tUl(["Surveillance renforcée pendant … jours", "Point quotidien les 5 premiers jours", "Bilan à J+15"])],
      ] },
    { id: "manuel", phase: "deploiement", cat: "manuel", emoji: "📗", nom: "Manuel utilisateur", desc: "La trame d'un manuel clair : prise en main, tâches courantes, questions fréquentes.",
      corps: c => [
        ["1. Présentation", `<p>${c.description || "À quoi sert l'outil, pour qui."}</p>` + tC("Une phrase sur le bénéfice pour l'utilisateur.")],
        ["2. Accès et connexion", tC("Adresse, identifiants, navigateur conseillé. Une capture de l'écran de connexion.")],
        ["3. L'écran principal", tC("Une capture annotée (numéros 1, 2, 3…) et une légende pour chaque zone.")],
        ["4. Les tâches courantes", tC("Une section par tâche, écrite comme un tuto : un titre en verbe (« Créer une demande »), des étapes numérotées courtes, une capture par étape importante.") + "<h3>4.1 [Tâche]</h3><ol><li>…</li><li>…</li><li>…</li></ol>"],
        ["5. Questions fréquentes", tTab(["Question", "Réponse"], [], 4)],
        ["6. Besoin d'aide ?", tKv([["Support", ""], ["Référent de votre service", ""]])],
      ] },
    { id: "howto", phase: "deploiement", cat: "support", emoji: "🛟", nom: "Fiche How-to support", desc: "Une fiche par incident connu : symptôme, cause, solution, quand escalader.",
      corps: c => [
        ["Fiche", tKv([["Titre", "[Symptôme vu par l'utilisateur]"], ["Application", c.nom], ["Niveau de support", "N1 / N2"], ["Mise à jour le", ""]])],
        ["Symptôme", tC("Ce que voit ou dit l'utilisateur, avec le message d'erreur exact.")],
        ["Cause probable", tC("")],
        ["Résolution", "<ol><li>…</li><li>…</li><li>…</li></ol>"],
        ["Vérification", tC("Comment s'assurer que c'est résolu.")],
        ["Escalade", tKv([["Quand escalader", ""], ["À qui", ""], ["Informations à transmettre", "Capture, heure, identifiant de l'utilisateur, étapes réalisées"]])],
      ] },
    { id: "cr", phase: "pilotage", cat: "crreu", emoji: "📝", nom: "Compte rendu de réunion", desc: "Trame vierge de CR, si vous n'utilisez pas l'éditeur intégré à l'onglet Réunions & copils.",
      corps: c => [
        ["Informations", tKv([["Réunion", ""], ["Date et lieu", ""], ["Animateur", c.chef], ["Rédacteur", ""]])],
        ["Participants", tTab(["Nom", "Rôle", "Présent / excusé"], [], 4)],
        ["Ordre du jour", "<ol><li>…</li><li>…</li><li>…</li></ol>"],
        ["Points abordés", tC("Pour chaque point : les faits, les échanges, la conclusion. Restez factuel.")],
        ["Décisions", tTab(["N°", "Décision", "Décideur"], [], 3)],
        ["Actions", tTab(["Action", "Responsable", "Échéance"], [], 4)],
        ["Prochaine réunion", tC("Date, lieu, sujets prévus.")],
      ] },
    { id: "changement", phase: "pilotage", cat: "doc", emoji: "🔀", nom: "Demande de changement", desc: "Pour toute modification du périmètre, du délai ou du budget : impacts et décision.",
      corps: c => [
        ["Demande", tKv([["N°", "DC-…"], ["Demandeur", ""], ["Date", ""], ["Projet", c.nom]])],
        ["Description", tC("Ce qui est demandé, précisément.")],
        ["Justification", tC("Pourquoi : nouveau besoin, contrainte réglementaire, problème découvert…")],
        ["Impacts", tTab(["Axe", "Impact", "Détail"], [["Périmètre", "", ""], ["Délai", "+ … jours", ""], ["Budget", "+ … €", ""], ["Qualité / risques", "", ""], ["Autres projets", "", ""]])],
        ["Options", tTab(["Option", "Avantages", "Inconvénients"], [["A. Accepter", "", ""], ["B. Refuser", "", ""], ["C. Reporter / adapter", "", ""]])],
        ["Décision", tUl(["☐ Acceptée", "☐ Refusée", "☐ Reportée"]) + tKv([["Décidée par", c.sponsor], ["Date", ""], ["Commentaire", ""]])],
      ] },
    { id: "cloture", phase: "cloture", cat: "doc", emoji: "🏁", nom: "Bilan et PV de clôture", desc: "Objectifs atteints ou non, écarts, enseignements, transfert : on referme proprement le projet.",
      corps: c => [
        ["1. Rappel du projet", `<p>${c.description || "Contexte et objectifs initiaux."}</p>` + tKv([["Dates prévues", c.debut ? `${c.debut} → ${c.fin}` : ""], ["Dates réelles", ""], ["Budget prévu", c.budget], ["Budget consommé", ""]])],
        ["2. Atteinte des objectifs", tTab(["Objectif", "Cible", "Résultat", "Atteint ?"], c.objectifs.length ? c.objectifs.map(o => [o, "", "", ""]) : [], c.objectifs.length ? 0 : 4)],
        ["3. Bilan des jalons", c.jalons.length ? tTab(["Jalon", "Date", "État"], c.jalons) : tC("Jalons prévus et réels, avec les écarts expliqués.")],
        ["4. Enseignements", c.retex.length ? tTab(["Constat", "Recommandation"], c.retex) : tTab(["Constat", "Recommandation"], [], 4)],
        ["5. Transfert et suite", tTab(["Sujet", "Repris par", "Date"], [["Maintenance / support", "", ""], ["Évolutions restantes (backlog)", "", ""], ["Documentation", "", ""], ["Accès et licences", "", ""]])],
        ["6. Prononcé de la clôture", tSign(["Sponsor", "Chef de projet", "Référent métier"])],
      ] },
    { id: "offres", phase: "contrat", cat: "doc", emoji: "⚖️", nom: "Grille d'analyse des offres", desc: "Comparer les réponses des fournisseurs (ou les produits du marché) sur des critères pondérés, puis justifier le choix.",
      corps: c => [
        ["1. Contexte de la consultation", tKv([["Projet", c.nom], ["Objet de l'achat", ""], ["Type", "Prestation de développement / produit du marché (build ou buy)"], ["Date limite de réponse", ""], ["Fournisseurs consultés", ""]])],
        ["2. Critères et pondération", tTab(["Critère", "Poids (%)", "Ce qu'on regarde"], [["Couverture fonctionnelle", "30", "Besoins « Must » couverts, démonstration"], ["Coût total sur 3 ans", "25", "Licences, mise en œuvre, maintenance, interne"], ["Délai et méthode", "15", "Planning proposé, équipe, références"], ["Technique et sécurité", "15", "Hébergement, RGPD, intégration au SI"], ["Solidité du fournisseur", "10", "Taille, pérennité, support"], ["Conditions contractuelles", "5", "Engagements, pénalités, réversibilité"]]) + tC("Ajustez les poids (total 100 %) avant de recevoir les offres.")],
        ["3. Notation (de 0 à 5)", tTab(["Critère", "Poids", "Fournisseur A", "Fournisseur B", "Fournisseur C"], [["Couverture fonctionnelle", "30 %", "", "", ""], ["Coût total sur 3 ans", "25 %", "", "", ""], ["Délai et méthode", "15 %", "", "", ""], ["Technique et sécurité", "15 %", "", "", ""], ["Solidité du fournisseur", "10 %", "", "", ""], ["Conditions contractuelles", "5 %", "", "", ""], ["<b>Note pondérée</b>", "100 %", "", "", ""]])],
        ["4. Points forts et points de vigilance", tTab(["Fournisseur", "Points forts", "Points de vigilance"], [["A", "", ""], ["B", "", ""], ["C", "", ""]])],
        ["5. Négociation", tC("Points négociés (prix, délais, pénalités, réversibilité) et résultat obtenu.")],
        ["6. Recommandation", tC("Fournisseur ou produit retenu et pourquoi, en 3 lignes.") + tSign(["Sponsor", "Chef de projet", "Acheteur", "Référent métier"])],
      ] },
    { id: "nda", phase: "contrat", cat: "nda", emoji: "🔏", nom: "Accord de confidentialité (NDA)", desc: "Une trame de départ, à faire relire et adapter par le service juridique avant tout usage.",
      corps: c => [
        ["Avertissement", tC("Cette trame est un point de départ. Elle doit être relue et validée par le service juridique avant signature.")],
        ["Entre les soussignés", tKv([["Partie 1", "[Société], représentée par …"], ["Partie 2", "[Société], représentée par …"]])],
        ["1. Objet", `<p>Les parties souhaitent échanger des informations confidentielles dans le cadre du projet <b>${c.nom}</b>. Le présent accord fixe les conditions de ces échanges.</p>`],
        ["2. Informations confidentielles", tC("Définition : toute information, quel qu'en soit le support, signalée comme confidentielle ou dont la nature l'impose. Préciser les exclusions usuelles (informations publiques, déjà connues, obtenues légitimement d'un tiers).")],
        ["3. Engagements", tUl(["Utiliser les informations uniquement pour le projet", "Ne les communiquer qu'aux personnes qui en ont besoin, tenues à la même obligation", "Les protéger avec le même soin que ses propres informations", "Les restituer ou les détruire à la fin des échanges"])],
        ["4. Durée", tC("Durée de l'accord et durée de l'obligation de confidentialité après sa fin.")],
        ["5. Droit applicable", tC("Droit applicable et juridiction compétente, à préciser par le service juridique.")],
        ["Signatures", tTab(["Partie", "Nom et fonction", "Date", "Signature"], [["Partie 1", "", "", ""], ["Partie 2", "", "", ""]])],
      ] },
  ];
  const CSS_TPL = `body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1d2433;line-height:1.45;max-width:800px;margin:0 auto}
    h1{color:#1f4e79;font-size:20pt;margin:0 0 4pt} h2{color:#1f4e79;font-size:13.5pt;border-bottom:1.5pt solid #1f4e79;padding-bottom:2pt;margin:18pt 0 6pt} h3{font-size:11.5pt;color:#2b3a55;margin:10pt 0 4pt}
    .sous{color:#5b6475;margin:0 0 12pt} table{border-collapse:collapse;width:100%;margin:4pt 0 8pt} th,td{border:1px solid #b8c2d3;padding:4pt 6pt;text-align:left;vertical-align:top;font-size:10pt}
    th{background:#e8eef6;color:#1f4e79} table.kv th{width:32%} .consigne{color:#7a8597;font-style:italic;background:#f5f7fa;border-left:3pt solid #c5cfdd;padding:3pt 8pt;margin:4pt 0}`;
  // document complet (le même sert à l'aperçu, au Word et au PDF)
  function htmlTemplate(p, t) {
    const c = ctxTpl(p);
    return `<h1>${t.nom}</h1><p class="sous">Projet <b>${c.nom}</b>${c.code ? ` · ${c.code}` : ""}${c.chef ? ` · Chef de projet : ${c.chef}` : ""}</p>
      ${tTab(["Version", "Date", "Auteur", "Modification"], [["0.1", fmtDate(today()), c.chef, "Création"]])}
      <p class="consigne">Les textes en gris italique sont des consignes : remplacez-les puis supprimez-les.</p>
      ${t.corps(c).map(([h, contenu]) => `<h2>${h}</h2>${contenu}`).join("")}`;
  }
  const nomFichierTpl = (p, t) => `${t.nom} - ${p.code || p.nom}`.replace(/[\\/:*?"<>|]+/g, "-") + ".doc";
  // Word ouvre directement un HTML enregistré en .doc (mise en page, titres et tableaux conservés)
  const docWord = (p, t) => `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${esc(t.nom)}</title><style>${CSS_TPL}</style></head><body>${htmlTemplate(p, t)}</body></html>`;
  function telechargerTemplate(p, t) { telecharger(nomFichierTpl(p, t), "﻿" + docWord(p, t), "application/msword"); toast(`⬇️ « ${t.nom} » téléchargé : ouvre-le avec Word`); }
  function imprimerTemplate(p, t) {
    const w = window.open("", "_blank"); if (!w) { toast("Autorise les fenêtres pop-up pour imprimer"); return; }
    w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${esc(t.nom)}</title><style>${CSS_TPL} @page{size:A4;margin:15mm}</style></head><body>${htmlTemplate(p, t)}<script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    w.document.close();
  }
  // crée le livrable correspondant et, si possible, range le fichier Word dans documents/
  async function livrableDepuisTemplate(p, t) {
    const d = { id: uid(), titre: t.nom, cat: t.cat, statut: "redaction", responsable: ctxTpl(p).chef.split(", ")[0] || "", valideur: "", echeance: "", version: "0.1", lien: "", jalonId: "", notes: `Créé à partir du template « ${t.nom} ».`, fichier: null, maj: today() };
    if (fichier.dir) {
      try {
        const docs = await (await fichier.dir.getDirectoryHandle("documents", { create: true })).getDirectoryHandle(nomFichierProjet(p), { create: true });
        const nom = nomFichierTpl(p, t); const w = await (await docs.getFileHandle(nom, { create: true })).createWritable();
        const f0 = new Blob(["﻿" + docWord(p, t)], { type: "application/msword" }); await w.write(f0); await w.close();
        d.fichier = { nom, taille: f0.size };
      } catch (e) { /* le livrable est créé quand même, sans fichier */ }
    }
    livrablesDe(p).push(d); save();
    toast(d.fichier ? `📚 Livrable créé, fichier Word joint` : `📚 Livrable créé`);
    ui.livVue = "liste"; render(); ouvrirLivrable(d.id);
  }
  function apercuTemplate(p, t) {
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">${t.emoji} ${t.nom}</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body"><div class="tpl-apercu">${htmlTemplate(p, t)}</div></div>
      <div class="modal-foot"><button class="btn ghost" data-act="tpl-pdf" data-id="${t.id}">🖨️ Imprimer / PDF</button><div class="row"><button class="btn ghost" data-act="tpl-word" data-id="${t.id}">⬇️ Télécharger (Word)</button><button class="btn" data-act="tpl-livrable" data-id="${t.id}">＋ Ajouter aux livrables</button></div></div>`);
  }
  // ─── Templates personnels (modèles de l'entreprise) : communs à tous les projets.
  // Fichiers rangés dans documents/templates/, description dans _commun.json (S.modeles).
  const modelesDe = () => (S.modeles = Array.isArray(S.modeles) ? S.modeles : []);
  const ICONES_EXT = { docx: "📘", doc: "📘", dotx: "📘", xlsx: "📗", xls: "📗", xltx: "📗", pptx: "📙", ppt: "📙", potx: "📙", pdf: "📕", md: "📝", txt: "📝" };
  const extDe = nom => (String(nom).match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
  const dossierModeles = create => fichier.dir.getDirectoryHandle("documents", { create }).then(d => d.getDirectoryHandle("templates", { create }));
  const nomPropre = s => String(s).replace(/[\\/:*?"<>|]+/g, "-").trim();
  async function fichierModele(m) { return (await (await dossierModeles(false)).getFileHandle(m.fichier.nom)).getFile(); }
  async function ouvrirModele(m) {
    try {
      if (fichier.dir.serveur) { window.open(`/api/fichier?chemin=${encodeURIComponent(`documents/templates/${m.fichier.nom}`)}`, "_blank"); return; }
      const f = await fichierModele(m);
      if (["pdf", "txt", "md", "png", "jpg"].includes(extDe(f.name))) window.open(URL.createObjectURL(f), "_blank");
      else telecharger(f.name, f, f.type || "application/octet-stream");
    } catch (e) { toast("❌ Fichier du template introuvable dans documents/templates"); }
  }
  function editerModele(id) {
    const nouveau = !id; const m = id ? modelesDe().find(x => x.id === id) : { id: uid(), nom: "", phase: "maison", cat: "doc", desc: "", fichier: null };
    let choisi = null;
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">🏢 ${nouveau ? "Ajouter un template" : esc(m.nom)}</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <div class="field"><label>Fichier *</label><div class="row"><span id="moFic">${m.fichier ? `${ICONES_EXT[extDe(m.fichier.nom)] || "📄"} ${esc(m.fichier.nom)}` : `<span class="muted">Aucun</span>`}</span><button class="btn ghost small" id="moChoisir">${m.fichier ? "Remplacer" : "📎 Choisir le fichier"}</button></div>
          <div class="aide">Word, Excel, PowerPoint, PDF… Le fichier est copié dans <code>documents/templates/</code> et servira pour tous les projets.</div></div>
        <div class="field"><label>Nom *</label><input type="text" id="moNom" value="${esc(m.nom)}" placeholder="Ex : Note de cadrage (modèle groupe)"></div>
        <div class="two">
          <div class="field"><label>Phase</label><select id="moPhase"><option value="maison" ${m.phase === "maison" ? "selected" : ""}>🏢 Sans phase</option>${Object.entries(PHASES_TPL).map(([k, n]) => `<option value="${k}" ${k === m.phase ? "selected" : ""}>${n}</option>`).join("")}</select></div>
          <div class="field"><label>Catégorie du livrable créé</label><select id="moCat">${Object.entries(CATS_DOC).filter(([c]) => !["crreu", "crcopil"].includes(c) || m.cat === c).map(([c, n]) => `<option value="${c}" ${c === m.cat ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label>Description</label><input type="text" id="moDesc" value="${esc(m.desc)}" placeholder="À quoi sert ce modèle, quand l'utiliser"></div>
      </div>
      <div class="modal-foot">${nouveau ? "<span></span>" : `<button class="btn danger" id="moDel">🗑️ Retirer</button>`}<div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button><button class="btn" id="moOk">Enregistrer</button></div></div>`);
    $("#moChoisir").onclick = async () => {
      try {
        const [f] = await choisirFichiers(); if (!f) return; choisi = f;
        $("#moFic").textContent = `${ICONES_EXT[extDe(f.name)] || "📄"} ${f.name}`;
        if (!$("#moNom").value.trim()) $("#moNom").value = f.name.replace(/\.[^.]+$/, "");
      } catch (e) { /* annulé */ }
    };
    $("#moOk").onclick = async () => {
      const nom = $("#moNom").value.trim();
      if (!choisi && !m.fichier) { toast("✋ Choisis d'abord le fichier"); return; }
      if (!nom) { $("#moNom").focus(); toast("✋ Donne un nom"); return; }
      if (choisi) {
        try {
          const dir = await dossierModeles(true); let nf = nomPropre(choisi.name);
          if (modelesDe().some(x => x.id !== m.id && x.fichier?.nom === nf)) nf = nf.replace(/(\.[^.]+)?$/, ` (${uid().slice(0, 4)})$1`);
          const w = await (await dir.getFileHandle(nf, { create: true })).createWritable(); await w.write(choisi); await w.close();
          if (m.fichier && m.fichier.nom !== nf) { try { await dir.removeEntry(m.fichier.nom); } catch (e) { /* déjà absent */ } }
          m.fichier = { nom: nf, taille: choisi.size };
          m.balises = remplissable(nf) ? await balisesDuFichier(choisi) : [];
        } catch (e) { toast("❌ Copie du fichier impossible"); return; }
      }
      Object.assign(m, { nom, phase: $("#moPhase").value, cat: $("#moCat").value, desc: $("#moDesc").value.trim(), maj: today() });
      if (nouveau) modelesDe().push(m);
      save(); closeModal(); render(); toast(`🏢 Template « ${nom} » enregistré`);
    };
    $("#moDel")?.addEventListener("click", async () => {
      if (!confirm(`Retirer le template « ${m.nom} » ?\nSon fichier part dans la corbeille de l'appli. Les livrables déjà créés à partir de lui ne changent pas.`)) return;
      try {
        const f = await fichierModele(m);
        const cb = await fichier.dir.getDirectoryHandle("corbeille", { create: true });
        const w = await (await cb.getFileHandle(`${today()} - template - ${m.fichier.nom}`, { create: true })).createWritable(); await w.write(f); await w.close();
        await (await dossierModeles(false)).removeEntry(m.fichier.nom);
      } catch (e) { /* fichier déjà absent : on retire quand même la fiche */ }
      S.modeles = modelesDe().filter(x => x.id !== m.id); save(); closeModal(); render(); toast("🗑️ Template retiré");
    });
  }
  // copie le fichier du template dans les documents du projet et crée le livrable
  async function livrableDepuisModele(p, m) {
    const d = { id: uid(), titre: m.nom, cat: m.cat || "doc", statut: "redaction", responsable: ctxTpl(p).chef.split(", ")[0] || "", valideur: "", echeance: "", version: "0.1", lien: "", jalonId: "", notes: `Créé à partir du template « ${m.nom} ».`, fichier: null, maj: today() };
    try {
      const f0 = await fichierModele(m); const ext = extDe(f0.name);
      let f = f0; try { f = await remplirFichier(p, f0); } catch (e) { console.error(e); toast("⚠️ Balises non remplacées : copie du modèle tel quel"); }
      const nom = nomPropre(`${m.nom} - ${p.code || p.nom}`) + (ext ? "." + ext : "");
      const docs = await (await fichier.dir.getDirectoryHandle("documents", { create: true })).getDirectoryHandle(nomFichierProjet(p), { create: true });
      const w = await (await docs.getFileHandle(nom, { create: true })).createWritable(); await w.write(f); await w.close();
      d.fichier = { nom, taille: f.size };
    } catch (e) { toast("❌ Fichier du template introuvable : livrable créé sans fichier"); }
    livrablesDe(p).push(d); save();
    if (d.fichier) toast("📚 Livrable créé, copie du template jointe");
    ui.livVue = "liste"; render(); ouvrirLivrable(d.id);
  }
  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Balises {{…}} dans les templates personnels (publipostage)
  // Un .docx / .xlsx / .pptx est une archive zip de fichiers XML : on la lit, on remplace les balises
  // dans le texte, puis on la réécrit (sans compression). Les fichiers texte (.txt, .md, .csv, .html) sont remplacés directement.
  // ═══════════════════════════════════════════════════════════════
  const EXT_OOXML = ["docx", "dotx", "docm", "xlsx", "xltx", "xlsm", "pptx", "potx", "pptm"];
  const EXT_TEXTE = ["txt", "md", "csv", "html", "htm"];
  const remplissable = nom => EXT_OOXML.includes(extDe(nom)) || EXT_TEXTE.includes(extDe(nom));
  const zipPossible = () => typeof DecompressionStream === "function";
  // valeurs des balises pour un projet (texte brut ; les listes sont des tableaux)
  function valeursBalises(p) {
    const role = re => p.interlocuteurs.filter(i => re.test(i.role || "")).map(i => personne(i.personneId)?.nom).filter(Boolean).join(", ");
    const pl = p.planning?.methode ? p.planning : null; const t = today();
    const prochain = pl ? pl.jalons.filter(j => j.date && !j.atteint && j.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0] : null;
    const mep = pl ? jalonMEP(p) : null; const et = etapesActives(p).length ? etapeCourante(p) : null;
    return {
      projet: p.nom || "", code: p.code || "",
      chef_de_projet: role(/chef de projet|directeur de projet/i), sponsor: role(/sponsor/i), product_owner: role(/product owner/i),
      date_debut: p.dateDebut ? fmtDate(p.dateDebut) : "", date_fin: p.dateFin ? fmtDate(p.dateFin) : "", date_du_jour: fmtDate(t),
      description: p.description || "", enjeu: p.enjeu || "",
      objectifs: lignes(p.objectifs), perimetre_inclus: lignes(p.perimetreIn), perimetre_exclu: lignes(p.perimetreOut),
      budget: opt(p, "budget") ? fmtMontant(p.budget) : "", methode: pl ? METHODES[pl.methode].nom : "", etape: et ? et.nom : "",
      prochain_jalon: prochain ? `${prochain.nom} (${fmtDate(prochain.date)})` : "", mise_en_production: mep ? fmtDate(mep.date) : "",
    };
  }
  const BALISES = [
    ["projet", "Nom du projet"], ["code", "Code du projet"], ["chef_de_projet", "Chef de projet"], ["sponsor", "Sponsor"], ["product_owner", "Product Owner"],
    ["date_debut", "Date de début"], ["date_fin", "Date de fin"], ["date_du_jour", "Date du jour"], ["description", "Description"], ["enjeu", "Enjeu"],
    ["objectifs", "Objectifs mesurables (liste)"], ["perimetre_inclus", "Périmètre inclus (liste)"], ["perimetre_exclu", "Périmètre exclu (liste)"],
    ["budget", "Budget"], ["methode", "Méthode"], ["etape", "Étape en cours"], ["prochain_jalon", "Prochain jalon et sa date"], ["mise_en_production", "Date de mise en production"],
  ];
  // ─── zip minimal (lecture : stockée ou « deflate » ; écriture : stockée)
  const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xffffffff; for (let i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function inflerBrut(u) { const s = new Blob([u]).stream().pipeThrough(new DecompressionStream("deflate-raw")); return new Uint8Array(await new Response(s).arrayBuffer()); }
  async function lireZip(buf) {
    const u = new Uint8Array(buf); const v = new DataView(buf); let e = -1;
    for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
    if (e < 0) throw new Error("archive illisible");
    const n = v.getUint16(e + 10, true); let o = v.getUint32(e + 16, true); const L = [];
    for (let k = 0; k < n; k++) {
      const meth = v.getUint16(o + 10, true), cs = v.getUint32(o + 20, true), ln = v.getUint16(o + 28, true), lx = v.getUint16(o + 30, true), lc = v.getUint16(o + 32, true), lo = v.getUint32(o + 42, true);
      const nom = new TextDecoder().decode(u.subarray(o + 46, o + 46 + ln));
      const debut = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true); const brut = u.subarray(debut, debut + cs);
      L.push({ nom, data: meth === 8 ? await inflerBrut(brut) : brut.slice() });
      o += 46 + ln + lx + lc;
    }
    return L;
  }
  function ecrireZip(L) {
    const enc = new TextEncoder(); const parts = [], centre = []; let o = 0;
    const h = (n, ...champs) => { const b = new DataView(new ArrayBuffer(n)); let i = 0; champs.forEach(([t, x]) => { if (t === 4) b.setUint32(i, x, true); else b.setUint16(i, x, true); i += t; }); return new Uint8Array(b.buffer); };
    L.forEach(f => {
      const nom = enc.encode(f.nom); const crc = crc32(f.data); const t = f.data.length;
      parts.push(h(30, [4, 0x04034b50], [2, 20], [2, 0x0800], [2, 0], [2, 0], [2, 0x21], [4, crc], [4, t], [4, t], [2, nom.length], [2, 0]), nom, f.data);
      centre.push(h(46, [4, 0x02014b50], [2, 20], [2, 20], [2, 0x0800], [2, 0], [2, 0], [2, 0x21], [4, crc], [4, t], [4, t], [2, nom.length], [2, 0], [2, 0], [2, 0], [2, 0], [4, 0], [4, o]), nom);
      o += 30 + nom.length + t;
    });
    const tc = centre.reduce((n, x) => n + x.length, 0);
    return new Blob([...parts, ...centre, h(22, [4, 0x06054b50], [2, 0], [2, 0], [2, L.length], [2, L.length], [4, tc], [4, o], [2, 0])]);
  }
  // parties XML qui contiennent du texte visible
  const partieTexte = (ext, nom) => /^(word\/(document|header\d*|footer\d*|footnotes|endnotes)\.xml|xl\/(sharedStrings|worksheets\/sheet\d+)\.xml|ppt\/(slides\/slide\d+|notesSlides\/notesSlide\d+)\.xml)$/.test(nom);
  const escXml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // une balise peut être découpée par Word en plusieurs morceaux (« {{pro</w:t></w:r><w:r><w:t>jet}} ») :
  // on la reconnaît malgré les balises XML intermédiaires, et on garde ces dernières pour que le fichier reste valide
  const RX_BALISE_XML = /\{(?:<[^>]+>)*\{((?:<[^>]+>|[^<{}])*?)\}(?:<[^>]+>)*\}/g;
  const cleBalise = brut => brut.replace(/<[^>]+>/g, "").trim().toLowerCase();
  function remplacerXml(xml, V, ext) {
    const word = /^do[ct]/.test(ext);
    return xml.replace(RX_BALISE_XML, (m, dedans) => {
      const k = cleBalise(dedans); if (!(k in V)) return m;
      const tags = (m.match(/<[^>]+>/g) || []).join("");
      const val = V[k]; const txt = Array.isArray(val) ? (word ? val.map(escXml).join('</w:t><w:br/><w:t xml:space="preserve">') : val.map(escXml).join(" • ")) : escXml(val);
      return txt + tags;
    });
  }
  function balisesDansXml(xml) { const s = new Set(); for (const m of xml.matchAll(RX_BALISE_XML)) s.add(cleBalise(m[1])); return s; }
  // renvoie un nouveau fichier (Blob) rempli avec les valeurs du projet
  async function remplirFichier(p, f) {
    const ext = extDe(f.name); const V = valeursBalises(p);
    if (EXT_TEXTE.includes(ext)) {
      const html = ext.startsWith("htm"); const txt = await f.text();
      return new Blob([txt.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (m, k) => { k = k.toLowerCase(); if (!(k in V)) return m; const v = Array.isArray(V[k]) ? V[k].join(html ? "<br>" : "\n") : V[k]; return html ? (Array.isArray(V[k]) ? V[k].map(esc).join("<br>") : esc(v)) : v; })], { type: f.type || "text/plain" });
    }
    if (!EXT_OOXML.includes(ext) || !zipPossible()) return f;
    const L = await lireZip(await f.arrayBuffer()); const dec = new TextDecoder(), enc = new TextEncoder();
    L.forEach(x => { if (partieTexte(ext, x.nom)) x.data = enc.encode(remplacerXml(dec.decode(x.data), V, ext)); });
    return ecrireZip(L);
  }
  // balises trouvées dans un fichier (pour l'afficher sur la carte du template)
  async function balisesDuFichier(f) {
    const ext = extDe(f.name); const s = new Set();
    try {
      if (EXT_TEXTE.includes(ext)) for (const m of (await f.text()).matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)) s.add(m[1].toLowerCase());
      else if (EXT_OOXML.includes(ext) && zipPossible()) { const dec = new TextDecoder(); (await lireZip(await f.arrayBuffer())).filter(x => partieTexte(ext, x.nom)).forEach(x => balisesDansXml(dec.decode(x.data)).forEach(b => s.add(b))); }
    } catch (e) { console.error(e); }
    return [...s];
  }
  // fenêtre (i) : les balises possibles, à copier, avec leur valeur pour le projet ouvert
  function ouvrirAideBalises(p) {
    const V = valeursBalises(p); const aff = v => Array.isArray(v) ? v.join(" • ") : v;
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">ℹ️ Balises pour vos templates</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <p style="margin-top:0">Dans votre modèle <b>Word, Excel ou PowerPoint</b> (ou un fichier texte), écrivez une balise entre doubles accolades là où vous voulez une valeur du projet. Avec <b>＋ Livrable</b> ou <b>⬇️ Rempli</b>, chaque balise est remplacée par la valeur du projet ; votre modèle d'origine ne change pas.</p>
        <div class="bal-ex">Projet : <b>{{projet}}</b> ({{code}}) · Chef de projet : <b>{{chef_de_projet}}</b> · Du {{date_debut}} au {{date_fin}}</div>
        <table class="bal-tab"><thead><tr><th>Balise</th><th>Contenu</th><th>Pour « ${esc(p.nom)} »</th><th></th></tr></thead><tbody>
          ${BALISES.map(([k, lib]) => `<tr><td><code>{{${k}}}</code></td><td>${lib}</td><td class="muted">${esc(aff(V[k])) || "<i>vide</i>"}</td><td><button class="btn ghost small" data-act="mo-copier" data-id="{{${k}}}" title="Copier la balise">📋</button></td></tr>`).join("")}
        </tbody></table>
        <div class="aide">💡 Tapez ou collez chaque balise <b>d'un seul trait</b>. Les listes (objectifs, périmètre) donnent une ligne par élément dans Word, et des puces « • » dans Excel et PowerPoint. Une balise inconnue est laissée telle quelle. Les PDF ne peuvent pas être remplis.</div>
      </div>`);
  }
  function blocMesTemplates(p, deja) {
    const L = modelesDe().filter(m => ui.tplPhase === "toutes" || ui.tplPhase === "maison" || m.phase === ui.tplPhase);
    if (!["toutes", "maison"].includes(ui.tplPhase) && !L.length) return "";
    const carte = m => `<div class="tpl-carte tpl-maison">
        <div class="tpl-tete clic" data-act="mo-ouvrir" data-id="${m.id}"><span class="tpl-ico">${ICONES_EXT[extDe(m.fichier?.nom)] || "📄"}</span><div style="flex:1;min-width:0"><b>${esc(m.nom)}</b><div class="muted">${m.phase !== "maison" ? PHASES_TPL[m.phase] + " · " : ""}${esc(m.fichier?.nom || "")}</div></div>${deja.has(m.nom) ? `<span class="pill ok" title="Un livrable porte déjà ce nom">✓ Suivi</span>` : ""}</div>
        <p>${esc(m.desc) || `<span class="muted">${CATS_DOC[m.cat] || ""}</span>`}</p>
        ${m.balises?.length ? (() => { const inc = m.balises.filter(b => !BALISES.some(([k]) => k === b)); return `<div class="bal-info"><span class="pill soft" title="${esc(m.balises.map(b => `{{${b}}}`).join(" "))}">🏷️ ${m.balises.length} balise(s)</span>${inc.length ? `<span class="pill warn" title="Balise(s) inconnue(s), laissée(s) telle(s) quelle(s)">⚠️ ${inc.map(b => `{{${esc(b)}}}`).join(" ")}</span>` : ""}</div>`; })() : ""}
        <div class="tpl-actions"><button class="btn ghost small icon" data-act="mo-edit" data-id="${m.id}" title="Modifier ou retirer">✏️</button>
          <button class="btn ghost small" data-act="mo-ouvrir" data-id="${m.id}">📂 Ouvrir</button>
          ${remplissable(m.fichier?.nom) ? `<button class="btn ghost small" data-act="mo-rempli" data-id="${m.id}" title="Télécharger une copie où les balises {{…}} sont remplacées par les valeurs du projet">⬇️ Rempli</button>` : ""}
          <button class="btn small" data-act="mo-livrable" data-id="${m.id}" title="Créer le livrable avec une copie du fichier">＋ Livrable</button></div></div>`;
    return `<div class="row tpl-phase" style="gap:10px"><h3 style="margin:0;font-size:inherit;color:inherit">🏢 Mes templates</h3><button class="bal-i" data-act="mo-balises" title="Balises {{…}} pour intégrer les valeurs du projet dans vos templates" aria-label="Balises disponibles">i</button><span class="muted" style="font-size:.8rem;font-weight:400">les modèles de votre entreprise, pour tous les projets</span><span class="spacer"></span>${fichier.dir ? `<button class="btn small" data-act="mo-ajout">＋ Ajouter un template</button>` : ""}</div>
      ${L.length ? `<div class="tpl-grille">${L.map(carte).join("")}</div>` : `<div class="tpl-vide">${fichier.dir ? `Ajoutez ici les modèles de votre entreprise (Word, Excel, PowerPoint, PDF…). <b>＋ Livrable</b> en fera une copie pour le projet, rangée avec ses documents. Pour y intégrer des valeurs du projet, utilisez des balises comme <code>{{projet}}</code> : voir le bouton <b>i</b>.` : "Choisissez un dossier de données pour pouvoir ajouter vos propres templates."}</div>`}`;
  }
  function vueTemplates() {
    const p = proj();
    const deja = new Set(livrablesDe(p).map(d => d.titre));
    const L = TEMPLATES.filter(t => ui.tplPhase === "toutes" || t.phase === ui.tplPhase);
    const carte = t => `<div class="tpl-carte">
        <div class="tpl-tete clic" data-act="tpl-apercu" data-id="${t.id}"><span class="tpl-ico">${t.emoji}</span><div style="flex:1;min-width:0"><b>${t.nom}</b><div class="muted">${CATS_DOC[t.cat]}</div></div>${deja.has(t.nom) ? `<span class="pill ok" title="Un livrable porte déjà ce nom">✓ Suivi</span>` : ""}</div>
        <p>${t.desc}</p>
        <div class="tpl-actions">
          <button class="btn ghost small" data-act="tpl-apercu" data-id="${t.id}">👁️ Aperçu</button>
          <button class="btn ghost small" data-act="tpl-word" data-id="${t.id}" title="Télécharger au format Word">⬇️ Word</button>
          <button class="btn small" data-act="tpl-livrable" data-id="${t.id}" title="Créer le livrable et joindre le fichier Word">＋ Livrable</button></div></div>`;
    const phases = Object.keys(PHASES_TPL).filter(ph => L.some(t => t.phase === ph));
    return `
      <div class="toolbar"><h2 style="margin:0">🧩 Templates de documents</h2><span class="muted">vos modèles et des modèles pré-remplis avec les informations du projet</span></div>
      <div class="chips"><button class="chip ${ui.tplPhase === "toutes" ? "on" : ""}" data-act="tpl-phase" data-id="toutes">Toutes les phases</button><button class="chip ${ui.tplPhase === "maison" ? "on" : ""}" data-act="tpl-phase" data-id="maison">🏢 Mes templates <span class="n">${modelesDe().length}</span></button>${Object.entries(PHASES_TPL).map(([k, n]) => `<button class="chip ${ui.tplPhase === k ? "on" : ""}" data-act="tpl-phase" data-id="${k}">${n} <span class="n">${TEMPLATES.filter(t => t.phase === k).length}</span></button>`).join("")}</div>
      <p class="aide" style="margin:0 0 14px">💡 <b>Aperçu</b> pour lire le modèle · <b>Word</b> pour le télécharger et l'éditer · <b>＋ Livrable</b> pour l'ajouter à la liste des livrables, avec le fichier Word joint dans le dossier <code>documents/</code>. Le nom, l'équipe, les objectifs, le périmètre, les jalons et les risques du projet sont repris automatiquement.</p>
      ${blocMesTemplates(p, deja)}
      ${phases.length ? `<h3 class="tpl-phase" style="margin-top:22px">🧩 Templates fournis</h3>` : ""}
      ${phases.map(ph => `<h3 class="tpl-phase tpl-sousphase">${PHASES_TPL[ph]}</h3><div class="tpl-grille">${L.filter(t => t.phase === ph).map(carte).join("")}</div>`).join("")}`;
  }

  function vueLivrables() { return ui.livVue === "templates" ? vueTemplates() : vueLivrablesListe(); }
  function vueLivrablesListe() {
    const p = proj(); const t = today();
    const tous = [...livrablesDe(p), ...docsAuto(p)];
    const L = tous.filter(d => ui.docFiltre === "tous" || d.cat === ui.docFiltre);
    const manuels = livrablesDe(p);
    const retard = manuels.filter(d => d.echeance && d.echeance < t && !["valide", "diffuse"].includes(d.statut));
    const prochain = p.planning?.methode ? p.planning.jalons.filter(j => j.date && !j.atteint && j.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0] : null;
    const pourJalon = prochain ? manuels.filter(d => d.jalonId === prochain.id) : [];
    const ligne = d => {
      const late = d.echeance && d.echeance < t && !["valide", "diffuse"].includes(d.statut) && !d.auto;
      const [lib, cls] = STATUTS_DOC[d.statut] || STATUTS_DOC.afaire;
      return `<div class="doc-row ${d.auto ? "auto" : ""}">
        <div class="clic" style="min-width:0" data-act="${d.auto ? "dl-auto" : "dl-edit"}" data-k="${d.auto || ""}" data-id="${d.id}"><b>${esc(d.titre)}</b>${d.version ? ` <span class="muted">v${esc(d.version)}</span>` : ""}${d.auto ? ` <span class="pill soft" title="Produit par Cockpit Projet">auto</span>` : ""}
          <div class="muted" style="font-size:.78rem">${CATS_DOC[d.cat] || d.cat}${d.responsable ? ` · 👤 ${esc(d.responsable)}` : ""}${d.valideur ? ` · valideur ${esc(d.valideur)}` : ""}</div></div>
        <span class="pill ${cls}">${lib}</span>
        <span class="${late ? "txt-danger" : "muted"}" style="font-size:.84rem;white-space:nowrap">${d.echeance ? fmtJM(d.echeance) : "—"}</span>
        <span class="row" style="gap:4px;flex-wrap:nowrap;justify-content:flex-end">
          ${d.lien ? `<a class="btn ghost small icon" href="${esc(d.lien)}" target="_blank" rel="noopener" title="Ouvrir le lien">↗</a>` : ""}
          ${d.fichier ? `<button class="btn ghost small icon" data-act="dl-ouvrir-fichier" data-id="${d.id}" title="Ouvrir ${esc(d.fichier.nom)}">📎</button>` : ""}
          ${d.auto ? `<button class="btn ghost small icon" data-act="dl-imprimer-auto" data-k="${d.auto}" data-id="${d.id}" title="Imprimer / PDF">🖨️</button>` : ""}
        </span></div>`;
    };
    const parCat = Object.keys(CATS_DOC).map(c => ({ c, L: L.filter(d => d.cat === c) })).filter(x => x.L.length);
    return `
      <div class="toolbar"><h2 style="margin:0">📚 Livrables & documentation</h2><span class="spacer"></span><button class="btn small" data-act="dl-nouveau">＋ Livrable / document</button></div>
      <div class="hf-tiles">
        <div><span>📚 Documents</span><b>${tous.length}</b><small>dont ${docsAuto(p).length} produit(s) par l'outil</small></div>
        <div><span>✅ Validés ou diffusés</span><b>${manuels.length ? Math.round(manuels.filter(d => ["valide", "diffuse"].includes(d.statut)).length / manuels.length * 100) : 0} %</b><small>des livrables suivis</small></div>
        <div><span>✍️ En cours</span><b>${manuels.filter(d => ["redaction", "relecture"].includes(d.statut)).length}</b><small>${manuels.filter(d => d.statut === "afaire").length} à produire</small></div>
        <div class="${retard.length ? "danger" : ""}"><span>⏰ En retard</span><b>${retard.length}</b><small>échéance dépassée</small></div>
        ${prochain ? `<div><span>◆ Pour « ${esc(tronque(prochain.nom, 22))} »</span><b>${pourJalon.filter(d => ["valide", "diffuse"].includes(d.statut)).length} / ${pourJalon.length}</b><small>livrable(s) prêt(s) · ${fmtJM(prochain.date)}</small></div>` : ""}
      </div>
      <div class="chips"><button class="chip ${ui.docFiltre === "tous" ? "on" : ""}" data-act="dl-filtre" data-id="tous">Tous</button>${Object.entries(CATS_DOC).filter(([c]) => tous.some(d => d.cat === c)).map(([c, n]) => `<button class="chip ${ui.docFiltre === c ? "on" : ""}" data-act="dl-filtre" data-id="${c}">${n} <span class="n">${tous.filter(d => d.cat === c).length}</span></button>`).join("")}</div>
      ${parCat.length ? parCat.map(({ c, L }) => `<section class="panel" style="margin-bottom:12px"><h3>${CATS_DOC[c]} <span class="pill soft">${L.length}</span></h3>${L.sort((a, b) => (a.echeance || "9").localeCompare(b.echeance || "9")).map(ligne).join("")}</section>`).join("")
        : `<div class="empty"><span class="big">📚</span>Aucun document. Ajoute la documentation, le manuel utilisateur, les tutos, le how-to support, le contrat, le NDA… Les comptes rendus de réunion et le CR de RETEX apparaissent ici automatiquement.</div>`}`;
  }
  function ouvrirLivrable(id) {
    const p = proj(); const nouveau = !id;
    const d = id ? livrablesDe(p).find(x => x.id === id) : { id: uid(), titre: "", cat: "doc", statut: "afaire", responsable: "", valideur: "", echeance: "", version: "", lien: "", jalonId: "", notes: "", fichier: null };
    const jalons = p.planning?.jalons || [];
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">📚 ${nouveau ? "Nouveau livrable / document" : esc(d.titre)}</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <div class="field"><label>Titre *</label><input type="text" id="doTitre" value="${esc(d.titre)}" placeholder="Ex : Manuel utilisateur V1, NDA prestataire…"></div>
        <div class="three">
          <div class="field"><label>Catégorie</label><select id="doCat">${Object.entries(CATS_DOC).filter(([c]) => !["crreu", "crcopil"].includes(c) || d.cat === c).map(([c, n]) => `<option value="${c}" ${c === d.cat ? "selected" : ""}>${n}</option>`).join("")}</select></div>
          <div class="field"><label>Statut</label><select id="doSt">${Object.entries(STATUTS_DOC).map(([k, [l]]) => `<option value="${k}" ${k === d.statut ? "selected" : ""}>${l}</option>`).join("")}</select></div>
          <div class="field"><label>Version</label><input type="text" id="doVer" value="${esc(d.version)}" placeholder="1.0"></div>
        </div>
        <div class="three">
          <div class="field"><label>Responsable</label><input type="text" id="doResp" list="dlPersonnes" value="${esc(d.responsable)}"></div>
          <div class="field"><label>Valideur</label><input type="text" id="doVal" list="dlPersonnes" value="${esc(d.valideur)}"></div>
          <div class="field"><label>Échéance</label><input type="date" id="doEch" value="${esc(d.echeance)}"></div>
        </div>
        ${jalons.length ? `<div class="field"><label>Attendu pour le jalon</label><select id="doJal"><option value="">—</option>${jalons.map(j => `<option value="${j.id}" ${j.id === d.jalonId ? "selected" : ""}>◆ ${esc(j.nom)}${j.date ? " · " + fmtJM(j.date) : ""}</option>`).join("")}</select></div>` : ""}
        <div class="field"><label>Lien (SharePoint, Confluence, Teams, ClickUp…)</label><input type="text" id="doLien" value="${esc(d.lien)}" placeholder="https://…"></div>
        ${fichier.dir ? `<div class="field"><label>Fichier joint</label><div class="row">${d.fichier ? `<span>📎 ${esc(d.fichier.nom)}</span><button class="btn ghost small" id="doOuvrir">Ouvrir</button>` : `<span class="muted">Aucun</span>`}<button class="btn ghost small" id="doJoindre">${d.fichier ? "Remplacer" : "📎 Joindre un fichier"}</button></div>
          <div class="aide">Le fichier est copié dans ton dossier de données, sous-dossier <code>documents/</code>.</div></div>` : ""}
        <div class="field"><label>Notes</label><textarea id="doNotes" data-capt="${d.id}">${esc(d.notes)}</textarea>${zoneCaptures(d)}</div>
      </div>
      <div class="modal-foot">${nouveau ? "<span></span>" : `<button class="btn danger" id="doDel">🗑️ Supprimer</button>`}<div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button><button class="btn" id="doOk">Enregistrer</button></div></div>`);
    const lire = () => Object.assign(d, { titre: $("#doTitre").value.trim(), cat: $("#doCat").value, statut: $("#doSt").value, version: $("#doVer").value.trim(), responsable: $("#doResp").value.trim(), valideur: $("#doVal").value.trim(), echeance: $("#doEch").value, jalonId: $("#doJal")?.value || "", lien: $("#doLien").value.trim(), notes: $("#doNotes").value, maj: today() });
    $("#doOk").onclick = () => { lire(); if (!d.titre) { $("#doTitre").focus(); toast("✋ Donne un titre"); return; } if (nouveau) livrablesDe(p).push(d); save(); closeModal(); toast("📚 Document enregistré"); };
    $("#doDel")?.addEventListener("click", () => { if (!confirm(`Supprimer « ${d.titre} » de la liste ? (le fichier joint reste dans le dossier)`)) return; p.livrables = livrablesDe(p).filter(x => x.id !== d.id); save(); closeModal(); });
    $("#doOuvrir")?.addEventListener("click", () => ouvrirFichierJoint(d));
    $("#doJoindre")?.addEventListener("click", async () => {
      lire(); if (!d.titre) { toast("✋ Donne d'abord un titre"); return; }
      try {
        const [f] = await choisirFichiers(); if (!f) return;
        const docs = await (await fichier.dir.getDirectoryHandle("documents", { create: true })).getDirectoryHandle(nomFichierProjet(p), { create: true });
        const nom = f.name.replace(/[\\/:*?"<>|]+/g, "-");
        const w = await (await docs.getFileHandle(nom, { create: true })).createWritable(); await w.write(f); await w.close();
        d.fichier = { nom, taille: f.size };
        if (nouveau && !livrablesDe(p).includes(d)) livrablesDe(p).push(d);
        save(); toast(`📎 « ${nom} » copié dans le dossier documents`); ouvrirLivrable(d.id);
      } catch (e) { if (e.name !== "AbortError") toast("❌ Copie du fichier impossible"); }
    });
  }
  async function ouvrirFichierJoint(d) {
    try {
      const docs = await (await fichier.dir.getDirectoryHandle("documents")).getDirectoryHandle(nomFichierProjet(proj()));
      if (fichier.dir.serveur) { window.open(`/api/fichier?chemin=${encodeURIComponent(`documents/${nomFichierProjet(proj())}/${d.fichier.nom}`)}`, "_blank"); return; }
      const f = await (await docs.getFileHandle(d.fichier.nom)).getFile();
      window.open(URL.createObjectURL(f), "_blank");
    } catch (e) { toast("❌ Fichier introuvable dans le dossier documents"); }
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ RETEX (retour d'expérience)
  // ═══════════════════════════════════════════════════════════════
  const CATS_RETEX = ["Planning", "Budget", "Périmètre / besoin", "Technique", "Qualité / recette", "Organisation & équipe", "Communication", "Fournisseurs", "Outils", "Autre"];
  const retexDe = p => (p.retex = p.retex || []);
  const sprintsDe = p => p.planning?.sprints || [];
  function libSprint(p, id) {
    if (!id || id === "aucun") return "Hors sprint";
    const s = sprintsDe(p).find(x => x.id === id); return s ? `Sprint ${s.num}` : "Sprint supprimé";
  }
  const optionsSprint = (p, sel) => `<option value="">— Hors sprint</option>${sprintsDe(p).map(s => `<option value="${s.id}" ${s.id === sel ? "selected" : ""}>Sprint ${s.num} · ${fmtJM(s.debut)} → ${fmtJM(s.fin)}</option>`).join("")}`;
  // sprint proposé à la saisie : celui filtré, sinon le sprint en cours, sinon le dernier sprint commencé
  const sprintParDefaut = p => ui.retexSprint !== "tous" && ui.retexSprint !== "aucun" ? ui.retexSprint : (sprintEnCours(p.planning)?.id || sprintsDe(p).filter(s => s.debut <= today()).pop()?.id || "");
  Object.assign(ui, { retexSprint: "tous" });
  function carteRetex(x, p, autreProjet) {
    return `<div class="rx-card ${x.nature}" ${autreProjet ? "" : `data-act="rx-edit" data-id="${x.id}"`}>
      <div class="row" style="gap:6px"><span class="pill soft">${esc(x.categorie)}</span>${x.sprintId ? `<span class="pill soft">🏃 ${esc(libSprint(p, x.sprintId))}</span>` : ""}${x.phase ? `<span class="muted" style="font-size:.76rem">${esc(x.phase)}</span>` : ""}${autreProjet ? `<span class="muted" style="font-size:.76rem">${esc(p.emoji)} ${esc(p.nom)}</span>` : ""}<span class="spacer"></span>${x.actionId ? `<span class="pill soft" title="Action créée">✅ action</span>` : ""}</div>
      <div class="rx-constat">${esc(x.constat)}</div>
      ${x.cause ? `<div class="muted" style="font-size:.82rem">Cause : ${esc(x.cause)}</div>` : ""}
      ${x.recommandation ? `<div class="rx-reco">💡 ${esc(x.recommandation)}</div>` : ""}</div>`;
  }
  function vueRetex() {
    const p = proj(); const R = retexDe(p);
    if (ui.retexVue === "biblio") return vueBiblioRetex();
    const f = x => (ui.retexCat === "toutes" || x.categorie === ui.retexCat) && (ui.retexSprint === "tous" || (ui.retexSprint === "aucun" ? !x.sprintId : x.sprintId === ui.retexSprint));
    const aSprints = sprintsDe(p).length; const defS = sprintParDefaut(p);
    const col = (nature, titre, aide) => `<section class="rx-col ${nature}"><h3>${titre} <span class="pill soft">${R.filter(x => x.nature === nature && f(x)).length}</span></h3>
      <div class="rx-ajout cp-tools"><textarea class="inp" rows="2" id="rxNouv-${nature}" placeholder="${aide}"></textarea>
        <div class="row" style="flex-wrap:nowrap"><select class="inp" id="rxCat-${nature}" style="flex:1">${CATS_RETEX.map(c => `<option>${c}</option>`).join("")}</select>${aSprints ? `<select class="inp" id="rxSpr-${nature}" style="flex:1" title="Sprint concerné">${optionsSprint(p, defS)}</select>` : ""}<button class="btn small" data-act="rx-ajout" data-id="${nature}">＋</button></div></div>
      ${R.filter(x => x.nature === nature && f(x)).map(x => carteRetex(x, p)).join("") || `<p class="muted" style="font-size:.86rem">—</p>`}</section>`;
    return `
      <div class="toolbar cp-tools"><h2 style="margin:0">🎓 Retex / rétrospective</h2>

        <span class="spacer"></span><button class="btn ghost small" data-act="rx-csv">📊 CSV</button><button class="btn ghost small" data-act="rx-imprimer">🖨️ Compte rendu</button><button class="btn small" data-act="capture">⛶ Capture</button></div>
      <button class="btn ghost small cp-exit" data-act="quit-capture">✕ Quitter le mode capture (Échap)</button>
      ${aSprints ? `<div class="row cp-tools" style="margin-bottom:10px"><label class="row" style="gap:8px;font-weight:600;font-size:.9rem">🏃 Sprint
        <select class="inp" id="rxFiltreSprint" style="width:auto"><option value="tous" ${ui.retexSprint === "tous" ? "selected" : ""}>Tous les sprints (${R.length})</option>${sprintsDe(p).map(s => `<option value="${s.id}" ${ui.retexSprint === s.id ? "selected" : ""}>Sprint ${s.num} · ${fmtJM(s.debut)} → ${fmtJM(s.fin)} (${R.filter(x => x.sprintId === s.id).length})</option>`).join("")}<option value="aucun" ${ui.retexSprint === "aucun" ? "selected" : ""}>Hors sprint (${R.filter(x => !x.sprintId).length})</option></select></label>
        <span class="muted" style="font-size:.84rem">Choisis un sprint pour mener sa rétrospective ; « Tous les sprints » pour le retex du projet.</span></div>` : ""}
      <div class="chips cp-tools"><button class="chip ${ui.retexCat === "toutes" ? "on" : ""}" data-act="rx-cat" data-id="toutes">Toutes</button>${CATS_RETEX.filter(c => R.some(x => x.categorie === c)).map(c => `<button class="chip ${ui.retexCat === c ? "on" : ""}" data-act="rx-cat" data-id="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      <div class="copil hslide" id="retexPage">
        <div class="cp-head"><div class="project-emoji" style="width:44px;height:44px;font-size:1.5rem" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div><div><div class="cp-proj">${esc(p.nom)} — Retex / rétrospective${ui.retexSprint !== "tous" ? ` · ${esc(libSprint(p, ui.retexSprint))}` : ""}</div><div class="muted">${R.filter(f).length} enseignement(s) · ${fmtDate(today())}</div></div></div>
        <div class="rx-board">${col("positif", "✅ Ce qui a bien marché", "Ex : le copil mensuel a fluidifié les arbitrages")}${col("ameliorer", "⚠️ À améliorer", "Ex : recette démarrée trop tard, testeurs indisponibles")}</div>
      </div>
      <p class="muted cp-tools" style="font-size:.82rem;margin-top:10px">Clique sur une carte pour ajouter la cause, la recommandation, ou créer une action. Les enseignements « partagés » apparaissent dans la bibliothèque, consultable depuis tous tes projets.</p>`;
  }
  function vueBiblioRetex() {
    const q = normTxt(ui.retexQ);
    const tous = S.projets.flatMap(p => retexDe(p).filter(x => x.partage !== false).map(x => ({ x, p })))
      .filter(({ x, p }) => !q || normTxt([x.constat, x.cause, x.recommandation, x.categorie, p.nom].join(" ")).includes(q))
      .filter(({ x }) => ui.retexCat === "toutes" || x.categorie === ui.retexCat);
    return `
      <div class="toolbar"><h2 style="margin:0">🎓 Retex / rétrospective</h2>

        <input class="search" id="rxRecherche" type="search" placeholder="🔎 Rechercher (recette, fournisseur…)" value="${esc(ui.retexQ)}" style="max-width:300px"></div>
      <div class="chips"><button class="chip ${ui.retexCat === "toutes" ? "on" : ""}" data-act="rx-cat" data-id="toutes">Toutes</button>${CATS_RETEX.map(c => `<button class="chip ${ui.retexCat === c ? "on" : ""}" data-act="rx-cat" data-id="${esc(c)}">${esc(c)}</button>`).join("")}</div>
      ${tous.length ? `<div class="rx-biblio">${tous.map(({ x, p }) => carteRetex(x, p, true)).join("")}</div>` : `<div class="empty"><span class="big">📚</span>Aucun enseignement partagé${q ? " pour cette recherche" : ""}.</div>`}`;
  }
  function ouvrirRetex(id) {
    const p = proj(); const x = retexDe(p).find(y => y.id === id); if (!x) return;
    const phases = (p.planning?.phases || []).map(ph => ph.nom);
    openModal(`
      <div class="modal-head" style="--c:${x.nature === "positif" ? "#2e7d5b" : "#d9822b"}"><div class="row"><h2 style="margin:0">${x.nature === "positif" ? "✅ Ce qui a bien marché" : "⚠️ À améliorer"}</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <div class="field"><label>Constat *</label><textarea id="rxConstat" data-capt="${x.id}">${esc(x.constat)}</textarea></div>
        <div class="two"><div class="field"><label>Catégorie</label><select id="rxCatE">${CATS_RETEX.map(c => `<option ${c === x.categorie ? "selected" : ""}>${c}</option>`).join("")}</select></div>
          <div class="field"><label>Phase / moment</label><input type="text" id="rxPhase" list="rxPhases" value="${esc(x.phase || "")}"><datalist id="rxPhases">${phases.map(n => `<option value="${esc(n)}">`).join("")}</datalist></div></div>
        ${sprintsDe(p).length ? `<div class="field"><label>🏃 Sprint</label><select id="rxSprE">${optionsSprint(p, x.sprintId)}</select></div>` : ""}
        <div class="field"><label>Cause</label><textarea id="rxCause" rows="2" data-capt="${x.id}">${esc(x.cause || "")}</textarea></div>
        <div class="field"><label>💡 Recommandation pour les prochains projets</label><textarea id="rxReco" rows="2" data-capt="${x.id}">${esc(x.recommandation || "")}</textarea></div>
        <div class="field"><label>📷 Captures d'écran</label>${zoneCaptures(x)}</div>
        <label class="row" style="cursor:pointer"><input type="checkbox" id="rxPartage" ${x.partage !== false ? "checked" : ""}> Partager dans la bibliothèque tous projets</label>
        ${x.actionId ? `<div class="muted">✅ Une action a été créée dans le registre.</div>` : `<div class="row"><button class="btn ghost small" id="rxAction">✅ Créer une action à partir de cet enseignement</button></div>`}
      </div>
      <div class="modal-foot"><button class="btn danger" id="rxDel">🗑️ Supprimer</button><div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button><button class="btn" id="rxOk">Enregistrer</button></div></div>`);
    const lire = () => Object.assign(x, { constat: $("#rxConstat").value.trim(), categorie: $("#rxCatE").value, phase: $("#rxPhase").value.trim(), sprintId: $("#rxSprE") ? $("#rxSprE").value : (x.sprintId || ""), cause: $("#rxCause").value.trim(), recommandation: $("#rxReco").value.trim(), partage: $("#rxPartage").checked });
    $("#rxOk").onclick = () => { lire(); if (!x.constat) { toast("✋ Décris le constat"); return; } save(); closeModal(); };
    $("#rxDel").onclick = () => { if (!confirm("Supprimer cet enseignement ?")) return; p.retex = retexDe(p).filter(y => y.id !== x.id); save(); closeModal(); };
    $("#rxAction")?.addEventListener("click", () => { lire(); const a = ajouterAction(p, { texte: x.recommandation || x.constat, source: "libre" }); a.notes = "Issue du RETEX : " + x.constat; x.actionId = a.id; save(); closeModal(); toast("✅ Action ajoutée au registre"); });
  }
  function htmlCRRetex(p) {
    const R = retexDe(p).filter(x => ui.retexSprint === "tous" || (ui.retexSprint === "aucun" ? !x.sprintId : x.sprintId === ui.retexSprint));
    const bloc = nature => CATS_RETEX.map(c => ({ c, L: R.filter(x => x.nature === nature && x.categorie === c) })).filter(g => g.L.length)
      .map(g => `<h3 style="margin:12px 0 4px">${esc(g.c)}</h3><ul>${g.L.map(x => `<li><b>${esc(x.constat)}</b>${x.sprintId && ui.retexSprint === "tous" ? ` <span class="muted">(${esc(libSprint(p, x.sprintId))})</span>` : ""}${x.cause ? `<br><span class="muted">Cause : ${esc(x.cause)}</span>` : ""}${x.recommandation ? `<br>💡 ${esc(x.recommandation)}` : ""}</li>`).join("")}</ul>`).join("") || "<p class='muted'>—</p>";
    const recos = R.filter(x => x.recommandation);
    return `<div class="copil"><div class="cp-head"><div><div class="cp-proj">${esc(p.emoji)} ${esc(p.nom)} — Compte rendu de Retex / rétrospective${ui.retexSprint !== "tous" ? ` · ${esc(libSprint(p, ui.retexSprint))}` : ""}</div><div class="muted">${fmtDate(today())} · ${R.length} enseignement(s)</div></div></div>
      <h2>✅ Ce qui a bien marché</h2>${bloc("positif")}<h2 style="margin-top:20px">⚠️ À améliorer</h2>${bloc("ameliorer")}
      ${recos.length ? `<h2 style="margin-top:20px">💡 Recommandations</h2><ol>${recos.map(x => `<li>${esc(x.recommandation)}</li>`).join("")}</ol>` : ""}</div>`;
  }

  // ─── Événements des trois briques
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const { act, id, k } = el.dataset; const p = proj();
    if (!/^(ck-|fl-|dl-|rx-|lv-|tpl-|mo-)/.test(act) || !p) return;
    const L = ui.flashSemaine || lundiDe(today());
    switch (act) {
      case "ck-vue": ui.vueCk = id; break;
      case "fl-meteo": { const F = flashDe(p, L); F.meteo[el.dataset.axe] = F.meteo[el.dataset.axe] === id ? null : id; save(); break; }
      case "fl-rappel": p.flashRappel = el.checked; save(); break;
      case "fl-envoye": { const F = flashDe(p, L); F.envoyeLe = F.envoyeLe ? "" : today(); save(); toast(F.envoyeLe ? "✅ Flash report marqué comme envoyé" : "Flash report repassé en non envoyé"); break; }
      case "fl-copier": (navigator.clipboard?.writeText(flashTexte(p, L)) || Promise.reject()).then(() => toast("📋 Flash report copié")).catch(() => toast("Copie impossible")); return;
      case "fl-mail": {
        const txt = flashTexte(p, L); navigator.clipboard?.writeText(txt).catch(() => {});
        const dest = p.interlocuteurs.filter(i => i.copil).map(i => personne(i.personneId)?.email).filter(Boolean).join(";");
        window.location.href = `mailto:${dest}?subject=${encodeURIComponent(`[${p.code || p.nom}] Flash report — semaine du ${fmtDate(L)}`)}&body=${encodeURIComponent(txt.length <= 1600 ? txt : "(Le flash report est dans ton presse-papiers : colle-le ici)")}`;
        toast("✉️ Messagerie ouverte : relis puis envoie"); return;
      }
      case "fl-imprimer": imprimerHTML(`Flash report ${p.nom} ${L}`, blocFlash(p, L)); return;
      case "dl-nouveau": ouvrirLivrable(null); return;
      case "lv-vue": ui.livVue = id; break;
      case "tpl-phase": ui.tplPhase = id; break;
      case "mo-ajout": editerModele(null); return;
      case "mo-balises": ouvrirAideBalises(p); return;
      case "mo-copier": (navigator.clipboard?.writeText(id) || Promise.reject()).then(() => toast(`📋 ${id} copiée : collez-la dans votre modèle`)).catch(() => toast("Copie impossible")); return;
      case "mo-edit": editerModele(id); return;
      case "mo-ouvrir": case "mo-livrable": case "mo-rempli": {
        const m = modelesDe().find(x => x.id === id); if (!m) return;
        if (act === "mo-ouvrir") ouvrirModele(m);
        else if (act === "mo-rempli") { (async () => { try { const f = await fichierModele(m); const r = await remplirFichier(p, f); const ext = extDe(f.name);
          if (!m.balises) { m.balises = await balisesDuFichier(f); save(); render(); }
          telecharger(nomPropre(`${m.nom} - ${p.code || p.nom}`) + (ext ? "." + ext : ""), r, r.type || "application/octet-stream"); toast("⬇️ Copie remplie téléchargée"); } catch (e) { console.error(e); toast("❌ Remplissage impossible"); } })(); }
        else livrableDepuisModele(p, m);
        return;
      }
      case "tpl-apercu": case "tpl-word": case "tpl-pdf": case "tpl-livrable": {
        const tp = TEMPLATES.find(x => x.id === id); if (!tp) return;
        if (act === "tpl-apercu") apercuTemplate(p, tp);
        else if (act === "tpl-word") telechargerTemplate(p, tp);
        else if (act === "tpl-pdf") imprimerTemplate(p, tp);
        else { closeModal(); livrableDepuisTemplate(p, tp); }
        return;
      }
      case "dl-edit": ouvrirLivrable(id); return;
      case "dl-filtre": ui.docFiltre = id; break;
      case "dl-ouvrir-fichier": { const d = livrablesDe(p).find(x => x.id === id); if (d) ouvrirFichierJoint(d); return; }
      case "dl-auto": if (k === "cr") { ui.crSel = id; allerA("projet", "cr"); ui.crSel = id; render(); } else allerA("projet", "retex"); return;
      case "dl-imprimer-auto": if (k === "cr") imprimerCR(p, p.planning.reunions.find(r => r.id === id)); else imprimerHTML(`RETEX ${p.nom}`, htmlCRRetex(p)); return;
      case "rx-vue": ui.retexVue = id; break;
      case "rx-cat": ui.retexCat = id; break;
      case "rx-ajout": {
        const v = $(`#rxNouv-${id}`).value.trim(); if (!v) { $(`#rxNouv-${id}`).focus(); return; }
        retexDe(p).push({ id: uid(), date: today(), nature: id, categorie: $(`#rxCat-${id}`).value, sprintId: $(`#rxSpr-${id}`)?.value || "", constat: v, cause: "", recommandation: "", phase: "", partage: true }); save(); break;
      }
      case "rx-edit": ouvrirRetex(id); return;
      case "rx-imprimer": imprimerHTML(`RETEX ${p.nom}`, htmlCRRetex(p)); return;
      case "rx-csv": {
        const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const rows = retexDe(p).map(x => [x.date, x.nature === "positif" ? "Bien marché" : "À améliorer", x.categorie, x.sprintId ? libSprint(p, x.sprintId) : "", x.phase, x.constat, x.cause, x.recommandation]);
        telecharger(`retex-${(p.code || p.nom).replace(/[^\w-]+/g, "_")}.csv`, "﻿" + [["Date", "Nature", "Catégorie", "Sprint", "Phase", "Constat", "Cause", "Recommandation"].map(q).join(";"), ...rows.map(r => r.map(q).join(";"))].join("\n"), "text/csv;charset=utf-8");
        return;
      }
      default: return;
    }
    render();
  });
  document.addEventListener("change", e => {
    if (e.target.id === "flSemaine") { ui.flashSemaine = e.target.value; render(); }
    if (e.target.id === "rxFiltreSprint") { ui.retexSprint = e.target.value; render(); }
  });
  document.addEventListener("input", e => {
    const k = e.target.dataset?.fl;
    if (k) { const p = proj(); flashDe(p, ui.flashSemaine || lundiDe(today()))[k] = e.target.value; save(); }
    if (e.target.id === "rxRecherche") { ui.retexQ = e.target.value; const pos = e.target.selectionStart; render(); const el = $("#rxRecherche"); el.focus(); el.setSelectionRange(pos, pos); }
  });
  document.addEventListener("change", e => { if (e.target.dataset?.fl) render(); });

  // ═══════════════ Captures d'écran : coller (⌘ V) ou glisser une image dans un champ texte
  // Les images sont enregistrées dans le dossier de données : documents/captures/<fichier>
  const capObjets = new Map();   // id de l'objet porteur (point de CR, décision, action…) -> objet
  const capURLs = new Map();     // nom du fichier -> URL affichable
  const capDe = o => (o.captures = o.captures || []);
  function zoneCaptures(o) {
    if (!o.id) o.id = uid();
    capObjets.set(o.id, o);
    const C = o.captures || [];
    return `<div class="cap-zone" data-capz="${o.id}" data-capt="${o.id}">${C.map(c => `<figure class="cap-vig"><img data-capimg="${esc(c.fichier)}" alt="${esc(c.nom || "Capture")}" title="Agrandir" data-act="cap-voir" data-id="${o.id}" data-c="${c.id}"><button type="button" class="cap-x" data-act="cap-suppr" data-id="${o.id}" data-c="${c.id}" title="Retirer cette capture">✕</button></figure>`).join("")}
      <button type="button" class="cap-add" data-act="cap-ajout" data-id="${o.id}" title="Ajouter une capture d'écran ou une image">📷${C.length ? "" : " Capture"}</button>${C.length ? "" : `<span class="cap-aide">ou colle-la (⌘ V) dans le champ texte</span>`}</div>`;
  }
  const majZoneCaptures = id => { const o = capObjets.get(id); if (o) $$(`[data-capz="${id}"]`).forEach(z => { z.outerHTML = zoneCaptures(o); }); };
  async function dossierCaptures(creer) {
    return (await fichier.dir.getDirectoryHandle("documents", { create: creer })).getDirectoryHandle("captures", { create: creer });
  }
  async function compresserImage(b) {
    try {
      const bmp = await createImageBitmap(b); const k = Math.min(1, 2000 / bmp.width);
      const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      const out = await new Promise(r => c.toBlob(r, "image/webp", 0.9));
      return out && out.size < b.size ? out : b;
    } catch (e) { return b; }
  }
  async function urlCapture(nom) {
    if (capURLs.has(nom)) return capURLs.get(nom);
    const f = await (await (await dossierCaptures(false)).getFileHandle(nom)).getFile();
    const u = URL.createObjectURL(f); capURLs.set(nom, u); return u;
  }
  async function ajouterCaptures(id, liste) {
    const o = capObjets.get(id); const imgs = [...liste].filter(estImage);
    if (!o || !imgs.length) return;
    if (!fichier.dir) { toast("📁 Les captures s'enregistrent dans ton dossier de données : connecte un dossier dans ⚙️ Réglages"); return; }
    try {
      const dir = await dossierCaptures(true);
      for (const f of imgs) {
        const b = await compresserImage(f);
        const nom = `${today()}_${uid()}.${(b.type.split("/")[1] || "png").replace("jpeg", "jpg")}`;
        const w = await (await dir.getFileHandle(nom, { create: true })).createWritable(); await w.write(b); await w.close();
        capURLs.set(nom, URL.createObjectURL(b));
        capDe(o).push({ id: uid(), fichier: nom, nom: f.name && !/^image\.\w+$/.test(f.name) ? f.name : "Capture d'écran", date: today() });
      }
      save(); majZoneCaptures(id); toast(imgs.length > 1 ? `📷 ${imgs.length} captures ajoutées` : "📷 Capture ajoutée");
    } catch (e) { console.error(e); toast("❌ Impossible d'enregistrer la capture dans le dossier"); }
  }
  // affiche les vignettes dès qu'elles apparaissent à l'écran (vues, fenêtres, compte rendu)
  function chargerVignettes() {
    $$("img[data-capimg]:not([data-ok])").forEach(img => {
      img.dataset.ok = "1";
      if (!fichier.dir && !capURLs.has(img.dataset.capimg)) { img.classList.add("cap-ko"); img.alt = "Image introuvable"; return; }
      urlCapture(img.dataset.capimg).then(u => { img.src = u; }).catch(() => { img.classList.add("cap-ko"); img.alt = "Image introuvable dans le dossier"; img.title = "Image introuvable dans documents/captures"; });
    });
  }
  new MutationObserver(chargerVignettes).observe(document.body, { childList: true, subtree: true });
  function voirCapture(src, nom) {
    const lb = document.createElement("div"); lb.className = "cap-lb";
    lb.innerHTML = `<figure><img src="${src}" alt=""><figcaption>${esc(nom || "")} <span class="muted">· clic ou Échap pour fermer</span></figcaption></figure>`;
    const fermer = () => { lb.remove(); document.removeEventListener("keydown", esc_); };
    const esc_ = e => { if (e.key === "Escape") { e.stopPropagation(); fermer(); } };
    lb.onclick = fermer; document.addEventListener("keydown", esc_, true); document.body.appendChild(lb);
  }
  // images du presse-papiers : capture d'écran (⌘ Ctrl Maj 4), image copiée, ou fichier copié dans le Finder
  const estImage = f => f && (f.type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(f.name || ""));
  const imagesPressePapiers = cd => {
    const fs = [...(cd?.files || [])];
    [...(cd?.items || [])].forEach(it => { if (it.kind === "file") { const f = it.getAsFile(); if (f && !fs.some(x => x.size === f.size && x.type === f.type)) fs.push(f); } });
    return fs.filter(estImage);
  };
  document.addEventListener("paste", e => {
    let t = e.target.closest?.("[data-capt]");
    // collé hors d'un champ : s'il n'y a qu'une zone de captures dans la fenêtre ouverte, on l'utilise
    if (!t) { const m = $("#modalBack")?.hidden === false ? $$("#modal .cap-zone") : []; if (m.length === 1) t = m[0]; }
    if (!t) return;
    const fs = imagesPressePapiers(e.clipboardData);
    if (!fs.length) { if ((e.clipboardData?.files || []).length) toast("✋ Seules les images peuvent être collées comme capture"); return; }
    e.preventDefault(); ajouterCaptures(t.dataset.capt, fs);
  }, true);
  document.addEventListener("dragover", e => {
    const t = e.target.closest?.("[data-capt]"); if (!t || ![...(e.dataTransfer?.types || [])].includes("Files")) return;
    e.preventDefault(); t.classList.add("cap-survol");
  });
  document.addEventListener("dragleave", e => e.target.closest?.("[data-capt]")?.classList.remove("cap-survol"));
  document.addEventListener("drop", e => {
    const t = e.target.closest?.("[data-capt]"); if (!t || !e.dataTransfer?.files?.length) return;
    e.preventDefault(); t.classList.remove("cap-survol"); ajouterCaptures(t.dataset.capt, e.dataTransfer.files);
  });
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el || !el.dataset.act.startsWith("cap-")) return;
    e.stopPropagation();
    const id = el.dataset.id; const o = capObjets.get(id); if (!o) return;
    if (el.dataset.act === "cap-ajout") {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
      inp.onchange = () => ajouterCaptures(id, inp.files); inp.click(); return;
    }
    const c = capDe(o).find(x => x.id === el.dataset.c); if (!c) return;
    if (el.dataset.act === "cap-voir") { if (el.src) voirCapture(el.src, c.nom); return; }
    if (el.dataset.act === "cap-suppr") {
      if (!confirm("Retirer cette capture d'écran ? L'image sera supprimée du dossier documents/captures.")) return;
      o.captures = capDe(o).filter(x => x !== c);
      if (fichier.dir) dossierCaptures(false).then(d => d.removeEntry(c.fichier)).catch(() => {});
      save(); majZoneCaptures(id); toast("🗑️ Capture retirée");
    }
  }, true);

  // ═══════════════ Liens web cliquables, dans tous les textes affichés et sous les champs de saisie
  const RX_URL = /\b((?:https?:\/\/|www\.)[^\s<>"'«»]*[^\s<>"'«».,;:!?)\]}])/gi;
  const hrefDe = u => /^www\./i.test(u) ? "https://" + u : u;
  const libLien = u => { const t = u.replace(/^https?:\/\//i, "").replace(/\/$/, ""); return t.length > 48 ? t.slice(0, 45) + "…" : t; };
  const aLien = u => `<a class="lien-auto" href="${esc(hrefDe(u))}" target="_blank" rel="noopener noreferrer" title="${esc(u)}">${esc(libLien(u))}</a>`;
  // texte déjà échappé → liens (pour les fenêtres d'impression)
  const lienifier = h => h.replace(RX_URL, u => { const brut = u.replace(/&amp;/g, "&"); return `<a href="${esc(hrefDe(brut))}">${u}</a>`; });
  const EXCLUS = "a, textarea, input, select, option, script, style, svg, button, [contenteditable]";
  function lienifierNoeud(racine) {
    if (racine.nodeType === 3) { if (racine.parentElement && !racine.parentElement.closest(EXCLUS)) remplacerTexte(racine); return; }
    if (racine.nodeType !== 1 || racine.closest(EXCLUS)) return;
    const tw = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, { acceptNode: n => /https?:\/\/|www\./i.test(n.data) && !n.parentElement.closest(EXCLUS) ? 1 : 3 });
    const L = []; while (tw.nextNode()) L.push(tw.currentNode);
    L.forEach(remplacerTexte);
  }
  function remplacerTexte(n) {
    const t = n.data; RX_URL.lastIndex = 0; if (!RX_URL.test(t)) return; RX_URL.lastIndex = 0;
    const f = document.createDocumentFragment(); let i = 0, m;
    while ((m = RX_URL.exec(t))) {
      if (m.index > i) f.append(t.slice(i, m.index));
      const a = document.createElement("a"); a.className = "lien-auto"; a.href = hrefDe(m[1]); a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = m[1];
      f.append(a); i = m.index + m[1].length;
    }
    if (i < t.length) f.append(t.slice(i));
    n.replaceWith(f);
  }
  // sous un champ en cours de saisie : la liste de ses liens, cliquables
  const barresLiens = new WeakMap();
  const champAvecLiens = el => el.matches?.("textarea, .field input[type=text], .field input[type=url], .field input:not([type])") && !el.closest(".cap-lb");
  function majLiensChamp(el) {
    if (!champAvecLiens(el)) return;
    const urls = [...new Set(el.value.match(RX_URL) || [])];
    let b = barresLiens.get(el);
    if (!urls.length) { if (b) { b.remove(); barresLiens.delete(el); } return; }
    if (!b || !b.isConnected) { b = document.createElement("div"); b.className = "liens-champ"; el.after(b); barresLiens.set(el, b); }
    b.innerHTML = `<span>🔗</span>${urls.map(aLien).join("")}`;
  }
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
    lienifierNoeud(n);
    if (n.nodeType === 1) [n, ...n.querySelectorAll("textarea, input")].forEach(majLiensChamp);
  }))).observe(document.body, { childList: true, subtree: true });
  lienifierNoeud(document.body); $$("textarea, input").forEach(majLiensChamp);
  document.addEventListener("input", e => majLiensChamp(e.target));
  // ⌘ clic (ou Ctrl clic) sur un lien écrit dans un champ : l'ouvre directement
  document.addEventListener("click", e => {
    if (e.target.closest?.("a.lien-auto")) { e.stopPropagation(); return; }   // ne pas ouvrir la carte en dessous
    const el = e.target; if (!(e.metaKey || e.ctrlKey) || !el.matches?.("textarea, input")) return;
    const v = el.value, c = el.selectionStart ?? 0; let m; RX_URL.lastIndex = 0;
    while ((m = RX_URL.exec(v))) if (c >= m.index && c <= m.index + m[1].length) { window.open(hrefDe(m[1]), "_blank", "noopener"); break; }
  }, true);

  // ═══════════════ Nouvelle version de l'appli : bandeau « Recharger »
  {
    const empreinte = async () => { const r = await fetch("app.js", { method: "HEAD", cache: "no-store" }); return (r.headers.get("Last-Modified") || "") + (r.headers.get("Content-Length") || ""); };
    let ref = null;
    const verifier = async () => {
      try {
        const e = await empreinte(); if (ref === null) { ref = e; return; }
        if (e && e !== ref && !$(".maj-bandeau")) {
          const b = document.createElement("div"); b.className = "maj-bandeau";
          b.innerHTML = `<span>✨ Une nouvelle version de Cockpit Projet est disponible.</span><button class="btn small">🔄 Recharger</button>`;
          b.querySelector("button").onclick = () => location.reload();
          document.body.appendChild(b);
        }
      } catch (e) {}
    };
    verifier(); setInterval(verifier, 30000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) verifier(); });
  }

  // ═══════════════ Thèmes : intermédiaire (par défaut), sobre, fun
  // Le choix est enregistré dans _commun.json (S.theme) et recopié dans le navigateur pour s'appliquer dès l'ouverture.
  const THEMES = {
    inter: { nom: "Intermédiaire", emoji: "⚖️", desc: "Professionnel, bleu marine, boutons arrondis, emojis, un peu de couleur pour l'information et des cartes et boutons qui bougent au survol." },
    sobre: { nom: "Sobre", emoji: "🏛️", desc: "Très professionnel et strict : tons bleu foncé, peu de couleur, angles à peine arrondis, sans emojis ni animations." },
    fun: { nom: "Fun", emoji: "🎉", desc: "Ludique et joyeux : plein de couleurs, formes rondes, petites animations et confettis quand une tâche est terminée." },
  };
  const CLE_THEME = "cockpit-theme";
  let themeApplique = null;
  const themeVoulu = () => { let t = S.theme; if (!DEMO_MODE && !t) { try { t = localStorage.getItem(CLE_THEME); } catch (e) {} } return THEMES[t] ? t : "inter"; };
  const brandOrigine = $(".brand")?.innerHTML;
  function syncTheme() {
    const t = themeVoulu(); if (t === themeApplique) return;
    const avant = themeApplique; themeApplique = t;
    const h = document.documentElement;
    h.classList.toggle("theme-sobre", t === "sobre"); h.classList.toggle("theme-fun", t === "fun");
    if (!DEMO_MODE) try { localStorage.setItem(CLE_THEME, t); } catch (e) {}
    if (t === "fun" && !$("#policeFun")) { const l = document.createElement("link"); l.id = "policeFun"; l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=Nunito:wght@500;700;800;900&display=swap"; document.head.appendChild(l); }
    if (t === "sobre") sansEmojis(document.body);
    else if (avant === "sobre" && brandOrigine != null) { const b = $(".brand"); if (b) b.innerHTML = brandOrigine; }
  }
  function choisirTheme(t) {
    if (!THEMES[t]) return;
    S.theme = t; save(); render();
    toast(t === "fun" ? "🎉 Thème Fun activé !" : t === "sobre" ? "Thème Sobre activé" : "⚖️ Thème Intermédiaire activé");
    if (t === "fun") setTimeout(() => confettis(innerWidth / 2, 140), 150);
  }
  // ── Thème sobre : les emojis décoratifs disparaissent ; ceux qui servent d'icône seule (🗑️, 🔒, ⚙️…) restent, en gris
  const RX_EMO = /(?:[0-9#*]️?⃣|\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?(?:‍\p{Extended_Pictographic}(?:️|\p{Emoji_Modifier})?)*)️?/gu;
  const RX_EMO1 = new RegExp(RX_EMO.source, "u");
  const HORS_EMO = "textarea, input, select, script, style, .meteo-pick, .fl-meteo, .cap-lb, .project-emoji[data-mono]";
  function sansEmojis(racine) {
    if (!racine || themeApplique !== "sobre") return;
    if (racine.nodeType === 3) { traiterEmo(racine); return; }
    if (racine.nodeType !== 1) return;
    if (racine.closest?.(HORS_EMO) && racine.tagName !== "SELECT") return;
    const tw = document.createTreeWalker(racine, NodeFilter.SHOW_TEXT, { acceptNode: n => RX_EMO1.test(n.data) ? 1 : 3 });
    const L = []; while (tw.nextNode()) L.push(tw.currentNode);
    L.forEach(traiterEmo);
  }
  function traiterEmo(n) {
    const par = n.parentElement; if (!par || (par.closest(HORS_EMO) && par.tagName !== "OPTION")) return;
    if (!RX_EMO1.test(n.data)) return;
    const reste = n.data.replace(RX_EMO, "");
    // l'emoji est décoratif s'il accompagne un libellé (dans le même bouton, onglet, titre, ligne…)
    const bloc = par.closest("button, a, label, h1, h2, h3, h4, li, td, th, option, summary, p, .pill, .chip, .tab, .subtab, .row, .kv") || par;
    const texteAutour = (bloc.textContent || "").replace(RX_EMO, "").trim();
    if (reste.trim() || texteAutour) n.data = reste.replace(/^\s+/, par.firstChild === n ? "" : " ").replace(/\s{2,}/g, " ");
    else par.classList.add("emo-seul");
  }
  new MutationObserver(ms => { if (themeApplique !== "sobre") return; ms.forEach(m => m.addedNodes.forEach(sansEmojis)); }).observe(document.body, { childList: true, subtree: true });
  // ── Thème fun : confettis quand on coche une action ou qu'une réunion est réalisée
  function confettis(x, y) {
    const couleurs = ["#ff5d8f", "#ffb703", "#06d6a0", "#4cc9f0", "#9b5de5", "#f15bb5", "#fb8500"];
    for (let i = 0; i < 46; i++) {
      const c = document.createElement("i"); c.className = "confetti";
      const a = Math.random() * Math.PI * 2, v = 120 + Math.random() * 220;
      c.style.cssText = `left:${x}px;top:${y}px;background:${couleurs[i % couleurs.length]};--dx:${Math.cos(a) * v}px;--dy:${Math.sin(a) * v - 160}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * 60}ms`;
      document.body.appendChild(c); setTimeout(() => c.remove(), 1400);
    }
  }
  document.addEventListener("click", e => {
    if (themeApplique !== "fun") return;
    const el = e.target.closest?.("[data-act]"); if (!el) return;
    const a = el.dataset.act;
    if ((["dc-fait", "aj-fait"].includes(a) && !el.classList.contains("on")) || (a === "cr-diffuse" && /réalisée/.test(el.textContent) && !/Repasser/.test(el.textContent)) || (a === "cr-preparee" && /marquer/.test(el.textContent)) || (a === "tache-fait" && !el.classList.contains("on")))
      confettis(e.clientX, e.clientY);
  }, true);
  document.addEventListener("click", e => { const el = e.target.closest?.("[data-act=rg-theme]"); if (el) choisirTheme(el.dataset.id); });
  syncTheme();
  function blocThemes() {
    const t = themeVoulu();
    const apercu = k => `<div class="th-apercu th-${k}"><div class="th-barre"><span></span><i></i><i></i></div><div class="th-corps"><b></b><em></em><em></em><span class="th-btn">${k === "sobre" ? "VALIDER" : k === "fun" ? "Go ! 🚀" : "Valider"}</span></div></div>`;
    return `<section class="panel" style="margin-bottom:16px"><h3 style="margin:0 0 4px">🎨 Apparence</h3>
      <div class="muted" style="font-size:.88rem;margin-bottom:12px">Choisis le style de l'appli. Ton choix est mémorisé dans ton dossier de données et s'applique tout de suite.</div>
      <div class="th-grille">${Object.entries(THEMES).map(([k, x]) => `
        <button class="th-carte ${t === k ? "on" : ""}" data-act="rg-theme" data-id="${k}" aria-pressed="${t === k}">
          ${apercu(k)}
          <span class="th-nom">${x.emoji} ${x.nom}${k === "inter" ? ` <span class="muted" style="font-weight:500">· par défaut</span>` : ""}${t === k ? ` <span class="pill ok">Actuel</span>` : ""}</span>
          <span class="th-desc">${x.desc}</span>
        </button>`).join("")}</div></section>`;
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Demandes de changement
  // ═══════════════════════════════════════════════════════════════
  const STATUTS_CHG = {
    analyse:   { nom: "À analyser", emoji: "🔍", cls: "soft" },
    arbitrage: { nom: "À arbitrer", emoji: "⚖️", cls: "warn" },
    acceptee:  { nom: "Acceptée", emoji: "✅", cls: "ok" },
    refusee:   { nom: "Refusée", emoji: "⛔", cls: "danger" },
    reportee:  { nom: "Reportée", emoji: "↪️", cls: "soft" },
  };
  const PRIO_CHG = { haute: "🔴 Haute", moyenne: "🟠 Moyenne", basse: "⚪ Basse" };
  const changementsDe = p => (p.changements = p.changements || []);
  const chgOuverts = p => changementsDe(p).filter(c => c.statut === "analyse" || c.statut === "arbitrage");
  const numChg = (p, c) => "DC" + (changementsDe(p).indexOf(c) + 1);
  const nbr = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isNaN(n) ? 0 : n; };
  const signe = n => (n > 0 ? "+" : "") + new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(n);
  const uniteBudget = p => UNITES[p.budget?.unite] || "k€";
  function puceImpacts(p, c) {
    const I = c.impacts || {}; const L = [];
    if (nbr(I.delai)) L.push(`<span class="pill ${nbr(I.delai) > 0 ? "warn" : "ok"}">⏱️ ${signe(nbr(I.delai))} j</span>`);
    if (nbr(I.cout)) L.push(`<span class="pill ${nbr(I.cout) > 0 ? "warn" : "ok"}">💶 ${signe(nbr(I.cout))} ${uniteBudget(p)}</span>`);
    if (nbr(I.charge)) L.push(`<span class="pill soft">👥 ${signe(nbr(I.charge))} j/h</span>`);
    if (I.perimetre) L.push(`<span class="pill soft" title="${esc(I.perimetre)}">📐 ${esc(tronque(I.perimetre, 38))}</span>`);
    return L.join("");
  }
  Object.assign(ui, { chgFiltre: "ouvertes" });

  function vueChangements(p) {
    const C = changementsDe(p);
    const acc = C.filter(c => c.statut === "acceptee");
    const cumul = k => acc.reduce((n, c) => n + nbr(c.impacts?.[k]), 0);
    const f = ui.chgFiltre;
    const L = C.filter(c => f === "toutes" || (f === "ouvertes" ? ["analyse", "arbitrage"].includes(c.statut) : c.statut === f))
      .sort((a, b) => (["arbitrage", "analyse", "reportee", "acceptee", "refusee"].indexOf(a.statut) - ["arbitrage", "analyse", "reportee", "acceptee", "refusee"].indexOf(b.statut)) || (b.date || "").localeCompare(a.date || ""));
    const pl = p.planning; const nums = pl ? numerosCopil(pl) : new Map();
    const chip = (id, lib, n) => `<button class="chip ${f === id ? "on" : ""}" data-act="chg-filtre" data-id="${id}">${lib}${n != null ? ` <span class="muted">${n}</span>` : ""}</button>`;
    const carte = c => {
      const S_ = STATUTS_CHG[c.statut]; const reu = pl?.reunions.find(r => r.id === c.instance);
      const jal = (c.jalons || []).map(id => pl?.jalons.find(j => j.id === id)).filter(Boolean);
      return `<div class="chg-card ${c.statut}" data-act="chg-edit" data-id="${c.id}">
        <div class="row" style="gap:8px;flex-wrap:nowrap"><span class="code-pill">${numChg(p, c)}</span><b style="flex:1;min-width:0">${esc(c.titre) || "<i>Sans titre</i>"}</b><span class="pill ${S_.cls}">${S_.emoji} ${S_.nom}</span></div>
        <div class="muted" style="font-size:.82rem">${c.demandeur ? `👤 ${esc(c.demandeur)} · ` : ""}demandée le ${fmtDate(c.date)}${c.priorite ? ` · ${PRIO_CHG[c.priorite]}` : ""}${reu ? ` · 🏛️ ${esc(titreReu(reu, nums))}` : ""}</div>
        ${c.description ? `<div class="chg-desc">${esc(tronque(c.description, 180))}</div>` : ""}
        <div class="row" style="gap:6px">${puceImpacts(p, c) || `<span class="muted" style="font-size:.82rem">Impacts à évaluer</span>`}${jal.map(j => `<span class="pill soft">◆ ${esc(j.nom)}</span>`).join("")}</div>
        ${c.arbitrage ? `<div class="muted" style="font-size:.82rem">⚖️ Arbitrée le ${fmtDate(c.arbitrage.date)}${c.arbitrage.decideur ? ` par ${esc(c.arbitrage.decideur)}` : ""}${c.arbitrage.commentaire ? ` · ${esc(tronque(c.arbitrage.commentaire, 90))}` : ""}</div>` : ""}
        ${["analyse", "arbitrage"].includes(c.statut) ? `<div class="row"><span class="spacer"></span><button class="btn small" data-act="chg-arbitrer" data-id="${c.id}">⚖️ Arbitrer</button></div>` : ""}
      </div>`;
    };
    return `
      <div class="toolbar cp-tools"><h2 style="margin:0">🔄 Demandes de changement</h2><span class="muted">toute évolution du périmètre, des délais ou du budget, analysée puis arbitrée</span><span class="spacer"></span>
        <button class="btn ghost small" data-act="chg-csv">📊 Export CSV</button><button class="btn" data-act="chg-nouveau">＋ Demande</button></div>
      <div class="hf-tiles" style="margin-bottom:14px">
        <div><span>🔍 À analyser</span><b>${C.filter(c => c.statut === "analyse").length}</b><small>impacts à évaluer</small></div>
        <div class="${C.some(c => c.statut === "arbitrage") ? "warn" : ""}"><span>⚖️ À arbitrer</span><b>${C.filter(c => c.statut === "arbitrage").length}</b><small>à présenter en copil</small></div>
        <div><span>✅ Acceptées</span><b>${acc.length}</b><small>${[cumul("delai") ? `${signe(cumul("delai"))} j` : "", cumul("cout") ? `${signe(cumul("cout"))} ${uniteBudget(p)}` : ""].filter(Boolean).join(" · ") || "aucun impact cumulé"}</small></div>
        <div><span>⛔ Refusées / ↪️ reportées</span><b>${C.filter(c => c.statut === "refusee").length} / ${C.filter(c => c.statut === "reportee").length}</b><small>&nbsp;</small></div>
      </div>
      <div class="chips cp-tools" style="margin-bottom:12px">${chip("ouvertes", "En cours", chgOuverts(p).length)}${Object.entries(STATUTS_CHG).map(([k, x]) => chip(k, `${x.emoji} ${x.nom}`, C.filter(c => c.statut === k).length)).join("")}${chip("toutes", "Toutes", C.length)}</div>
      ${L.length ? `<div class="chg-grid">${L.map(carte).join("")}</div>`
        : `<div class="empty"><span class="big">🔄</span>${C.length ? "Aucune demande pour ce filtre." : "Aucune demande de changement. Dès qu'on vous demande d'ajouter, retirer ou décaler quelque chose, enregistrez-le ici : impacts évalués, puis arbitrage en copil."}<br><button class="btn" style="margin-top:12px" data-act="chg-nouveau">＋ Nouvelle demande</button></div>`}
      <p class="muted" style="font-size:.82rem;margin-top:12px">L'arbitrage crée la décision dans le journal, et peut décaler les jalons impactés et ajouter le surcoût au budget.</p>`;
  }

  function ouvrirChangement(id) {
    const p = proj(); const pl = p.planning; const nums = pl ? numerosCopil(pl) : new Map();
    const nouveau = !id;
    const c = id ? changementsDe(p).find(x => x.id === id) : { id: uid(), titre: "", demandeur: "", date: today(), priorite: "moyenne", description: "", justification: "", impacts: { delai: "", cout: "", charge: "", perimetre: "" }, jalons: [], instance: "", statut: "analyse", creeLe: today() };
    c.impacts = c.impacts || {};
    const copils = pl ? pl.reunions.filter(r => !r.annulee && r.type === "copil").sort((a, b) => a.date.localeCompare(b.date)) : [];
    const jalons = pl?.jalons.filter(j => j.date) || [];
    openModal(`
      <div class="modal-head" style="--c:#d9822b"><div class="row"><h2 style="margin:0">🔄 ${nouveau ? "Nouvelle demande de changement" : `${numChg(p, c)} · Demande de changement`}</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <div class="field"><label>Demande *</label><input type="text" id="chTitre" value="${esc(c.titre)}" placeholder="Ex : ajouter l'export des bulletins en PDF"></div>
        <div class="three">
          <div class="field"><label>Demandeur</label><input type="text" id="chQui" list="dlPersonnes" value="${esc(c.demandeur)}"></div>
          <div class="field"><label>Date de la demande</label><input type="date" id="chDate" value="${esc(c.date)}"></div>
          <div class="field"><label>Priorité</label><select id="chPrio">${Object.entries(PRIO_CHG).map(([k, v]) => `<option value="${k}" ${c.priorite === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label>Description</label><textarea id="chDesc" data-capt="${c.id}" placeholder="Qu'est-ce qui est demandé ?">${esc(c.description)}</textarea>${zoneCaptures(c)}</div>
        <div class="field"><label>Justification / bénéfice attendu</label><textarea id="chJust" rows="2" placeholder="Pourquoi ? Que se passe-t-il si on ne le fait pas ?">${esc(c.justification || "")}</textarea></div>
        <div class="field"><label>Impacts estimés</label>
          <div class="three">
            <label class="field" style="margin:0"><span class="lbl">⏱️ Délai (jours, + ou −)</span><input type="number" step="1" id="chDelai" value="${esc(c.impacts.delai)}" placeholder="0"></label>
            <label class="field" style="margin:0"><span class="lbl">💶 Coût (${uniteBudget(p)}, + ou −)</span><input type="number" step="0.1" id="chCout" value="${esc(c.impacts.cout)}" placeholder="0"></label>
            <label class="field" style="margin:0"><span class="lbl">👥 Charge (jours-homme)</span><input type="number" step="0.5" id="chCharge" value="${esc(c.impacts.charge)}" placeholder="0"></label>
          </div>
          <input type="text" id="chPer" value="${esc(c.impacts.perimetre)}" placeholder="📐 Impact sur le périmètre (ce qui s'ajoute, ce qui sort…)" style="margin-top:8px"></div>
        ${jalons.length ? `<div class="field"><label>Jalons impactés</label><div class="risk-pick">${jalons.map(j => `<label><input type="checkbox" data-chj="${j.id}" ${(c.jalons || []).includes(j.id) ? "checked" : ""}><span>◆ ${esc(j.nom)} · ${fmtDate(j.date)}</span></label>`).join("")}</div></div>` : ""}
        <div class="two-col" style="gap:14px">
          <div class="field"><label>Statut</label><select id="chStatut">${Object.entries(STATUTS_CHG).map(([k, x]) => `<option value="${k}" ${c.statut === k ? "selected" : ""} ${["acceptee", "refusee", "reportee"].includes(k) && !c.arbitrage ? "disabled" : ""}>${x.emoji} ${x.nom}</option>`).join("")}</select><div class="aide">Pour accepter, refuser ou reporter : bouton « Arbitrer ».</div></div>
          <div class="field"><label>Instance d'arbitrage</label><select id="chInst"><option value="">— À définir</option>${copils.map(r => `<option value="${r.id}" ${r.id === c.instance ? "selected" : ""}>🏛️ ${esc(titreReu(r, nums))} · ${fmtJM(r.date)}</option>`).join("")}</select></div>
        </div>
      </div>
      <div class="modal-foot">${!nouveau ? `<button class="btn danger" id="chDel">🗑️ Supprimer</button>` : "<span></span>"}<div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button>${["analyse", "arbitrage"].includes(c.statut) ? `<button class="btn ghost" id="chArb">⚖️ Arbitrer</button>` : ""}<button class="btn" id="chOk">Enregistrer</button></div></div>`);
    const lire = () => {
      const titre = $("#chTitre").value.trim(); if (!titre) { $("#chTitre").focus(); toast("✋ Décris la demande"); return false; }
      Object.assign(c, { titre, demandeur: $("#chQui").value.trim(), date: $("#chDate").value || today(), priorite: $("#chPrio").value, description: $("#chDesc").value, justification: $("#chJust").value,
        impacts: { delai: $("#chDelai").value, cout: $("#chCout").value, charge: $("#chCharge").value, perimetre: $("#chPer").value.trim() },
        jalons: $$("#modal [data-chj]").filter(x => x.checked).map(x => x.dataset.chj), instance: $("#chInst").value, statut: $("#chStatut").value });
      if (nouveau && !changementsDe(p).includes(c)) changementsDe(p).push(c);
      save(); return true;
    };
    $("#chOk").onclick = () => { if (lire()) { closeModal(); toast(nouveau ? "🔄 Demande de changement enregistrée" : "✅ Demande mise à jour"); } };
    $("#chArb")?.addEventListener("click", () => { if (lire()) ouvrirArbitrage(c.id); });
    $("#chDel")?.addEventListener("click", () => { if (!confirm(`Supprimer la demande ${numChg(p, c)} « ${c.titre} » ? La décision éventuellement créée reste dans le journal.`)) return; p.changements = changementsDe(p).filter(x => x !== c); save(); closeModal(); toast("🗑️ Demande supprimée"); });
    if (nouveau) setTimeout(() => $("#chTitre")?.focus(), 30);
  }

  function ouvrirArbitrage(id) {
    const p = proj(); const c = changementsDe(p).find(x => x.id === id); if (!c) return;
    const pl = p.planning; const delai = nbr(c.impacts?.delai); const cout = nbr(c.impacts?.cout);
    const jal = (c.jalons || []).map(j => pl?.jalons.find(x => x.id === j)).filter(Boolean);
    let verdict = "acceptee";
    const sponsor = nomRole(p, "Sponsor");
    const draw = () => openModal(`
      <div class="modal-head" style="--c:#7b5ea7"><div class="row"><h2 style="margin:0">⚖️ Arbitrer ${numChg(p, c)}</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <div class="panel" style="padding:12px 14px"><b>${esc(c.titre)}</b><div class="row" style="gap:6px;margin-top:6px">${puceImpacts(p, c)}</div></div>
        <div class="seg4">${["acceptee", "refusee", "reportee"].map(k => `<button class="${verdict === k ? "on" : ""}" data-v="${k}">${STATUTS_CHG[k].emoji} ${STATUTS_CHG[k].nom}</button>`).join("")}</div>
        <div class="two-col" style="gap:14px">
          <div class="field"><label>Date de l'arbitrage</label><input type="date" id="arDate" value="${(() => { const d = pl?.reunions.find(r => r.id === c.instance)?.date; return d && d <= today() ? d : today(); })()}"></div>
          <div class="field"><label>Décideur</label><input type="text" id="arQui" list="dlPersonnes" value="${esc(sponsor.split(",")[0] || "")}"></div>
        </div>
        <div class="field"><label>Commentaire / conditions</label><textarea id="arCom" rows="2" placeholder="Ex : accepté à condition de ne pas décaler la mise en production"></textarea></div>
        ${verdict === "acceptee" && delai && jal.length ? `<label class="type-row"><input type="checkbox" id="arJal" checked><span>Décaler ${jal.length > 1 ? `les ${jal.length} jalons impactés` : `le jalon « ${esc(jal[0].nom)} »`} de <b>${signe(delai)} jours</b> (${jal.map(j => `${esc(j.nom)} : ${fmtJM(j.date)} → ${fmtJM(addJ(j.date, delai))}`).join(" · ")})</span></label>` : ""}
        ${verdict === "acceptee" && cout && opt(p, "budget") ? `<label class="type-row"><input type="checkbox" id="arBud" checked><span>Ajouter <b>${signe(cout)} ${uniteBudget(p)}</b> au budget prévu (nouveau poste « ${numChg(p, c)} »)</span></label>` : ""}
        <div class="aide">La décision est ajoutée au journal des décisions${c.instance ? ", rattachée au copil choisi" : ""}.</div>
      </div>
      <div class="modal-foot"><span></span><div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button><button class="btn" id="arOk">Enregistrer l'arbitrage</button></div></div>`);
    const lier = () => {
      $$("#modal [data-v]").forEach(b => b.onclick = () => { verdict = b.dataset.v; const v = { d: $("#arDate").value, q: $("#arQui").value, c: $("#arCom").value }; draw(); lier(); $("#arDate").value = v.d; $("#arQui").value = v.q; $("#arCom").value = v.c; });
      $("#arOk").onclick = () => {
        const date = $("#arDate").value || today(); const decideur = $("#arQui").value.trim(); const com = $("#arCom").value.trim();
        c.statut = verdict; c.arbitrage = { date, decideur, commentaire: com };
        const statutDec = { acceptee: "validee", refusee: "refusee", reportee: "reportee" }[verdict];
        const imp = [delai && "Planning", cout && "Budget", c.impacts?.perimetre && "Périmètre"].filter(Boolean);
        const d = { id: uid(), titre: `Demande de changement ${numChg(p, c)} : ${c.titre}`, date, statut: statutDec, instance: c.instance || "", decideur, description: [c.description, com && `Arbitrage : ${com}`].filter(Boolean).join("\n\n"), impacts: imp, risques: [], creeLe: today(), changementId: c.id };
        if (c.decisionId) p.decisions = p.decisions.filter(x => x.id !== c.decisionId);
        p.decisions.push(d); c.decisionId = d.id;
        let msg = `⚖️ ${numChg(p, c)} ${STATUTS_CHG[verdict].nom.toLowerCase()}`;
        if ($("#arJal")?.checked) { jal.forEach(j => { j.date = addJ(j.date, delai); if (j.ancre) j.verrou = true; }); msg += ` · ${jal.length} jalon(s) décalé(s)`; }
        if ($("#arBud")?.checked) { budgetDe(p).lignes.push({ id: uid(), categorie: "autre", poste: `${numChg(p, c)} · ${c.titre}`, prevu: String(cout), engage: "", consomme: "", raf: "" }); msg += " · budget mis à jour"; }
        save(); closeModal(); toast(msg);
      };
    };
    draw(); lier();
  }

  function exporterCSVChg(p) {
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`; const nums = p.planning ? numerosCopil(p.planning) : new Map();
    const rows = changementsDe(p).map(c => { const r = p.planning?.reunions.find(x => x.id === c.instance); return [numChg(p, c), c.date, c.titre, c.demandeur, PRIO_CHG[c.priorite]?.replace(/^\S+\s/, "") || "", STATUTS_CHG[c.statut].nom, nbr(c.impacts?.delai) || "", nbr(c.impacts?.cout) || "", nbr(c.impacts?.charge) || "", c.impacts?.perimetre || "", r ? `${titreReu(r, nums)} ${r.date}` : "", c.arbitrage?.date || "", c.arbitrage?.decideur || "", c.arbitrage?.commentaire || "", c.description]; });
    telecharger(`changements-${nomFichier(p)}.csv`, "﻿" + [["N°", "Date", "Demande", "Demandeur", "Priorité", "Statut", "Délai (j)", `Coût (${uniteBudget(p)})`, "Charge (j/h)", "Périmètre", "Instance", "Arbitrée le", "Décideur", "Commentaire", "Description"].map(q).join(";"), ...rows.map(r => r.map(q).join(";"))].join("\n"), "text/csv;charset=utf-8");
  }

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Go / No-Go de mise en production
  // ═══════════════════════════════════════════════════════════════
  const CRITERES_GNG = [
    ["Recette", "La recette fonctionnelle est validée par le métier", true],
    ["Recette", "Aucune anomalie bloquante n'est ouverte", true],
    ["Recette", "Le PV de recette est signé", false],
    ["Technique", "Les tests de performance et de charge sont concluants", false],
    ["Technique", "La sécurité et les droits d'accès sont validés", false],
    ["Technique", "Le plan de retour arrière est prêt et testé", true],
    ["Technique", "Les sauvegardes et la restauration sont vérifiées", false],
    ["Exploitation & support", "Le support est formé et connaît la procédure d'escalade", true],
    ["Exploitation & support", "Les procédures d'exploitation et la supervision sont en place", false],
    ["Utilisateurs", "Les utilisateurs clés sont formés", false],
    ["Utilisateurs", "La documentation utilisateur est disponible", false],
    ["Utilisateurs", "La communication de lancement est prête", false],
    ["Organisation", "La date et le créneau de bascule sont validés par le sponsor", true],
    ["Organisation", "L'équipe est mobilisée pour la bascule et l'hypercare (J à J+5)", false],
  ];
  const VERDICTS_GNG = {
    go:      { nom: "Go", emoji: "✅", cls: "ok", texte: "Mise en production autorisée" },
    reserve: { nom: "Go sous réserves", emoji: "⚠️", cls: "warn", texte: "Mise en production autorisée, avec des réserves à lever" },
    nogo:    { nom: "No-Go", emoji: "⛔", cls: "danger", texte: "Mise en production reportée" },
  };
  function gonogoDe(p) {
    if (!p.gonogo) p.gonogo = { jalonId: "", criteres: CRITERES_GNG.map(([cat, libelle, bloquant]) => ({ id: uid(), cat, libelle, bloquant, statut: "", commentaire: "" })), anomalies: { bloquantes: "", majeures: "", mineures: "", majLe: "" }, verdict: null };
    return p.gonogo;
  }
  const RX_MEP = /production|\bmep\b|mise en service|bascule|d[ée]ploiement|go.?live|livraison/i;
  function jalonMEP(p) {
    const J = p.planning?.jalons?.filter(j => j.date) || []; const g = p.gonogo;
    return (g?.jalonId && J.find(j => j.id === g.jalonId)) || J.filter(j => RX_MEP.test(j.nom)).sort((a, b) => a.date.localeCompare(b.date)).find(j => !j.atteint) || J.filter(j => RX_MEP.test(j.nom)).pop() || null;
  }
  function evalGoNoGo(p) {
    const g = gonogoDe(p); const C = g.criteres.filter(c => c.statut !== "na");
    const ok = C.filter(c => c.statut === "ok"), ko = C.filter(c => c.statut === "ko"), vides = C.filter(c => !c.statut);
    const koBloq = ko.filter(c => c.bloquant), videsBloq = vides.filter(c => c.bloquant);
    const anoB = nbr(g.anomalies.bloquantes), anoM = nbr(g.anomalies.majeures);
    const critiques = p.risques.filter(r => !CLOS.has(r.statut) && crit(r) >= 9);
    let reco;
    if (koBloq.length || anoB > 0) reco = { k: "nogo", lib: "⛔ No-Go recommandé", why: [koBloq.length && `${koBloq.length} critère(s) bloquant(s) non rempli(s)`, anoB > 0 && `${anoB} anomalie(s) bloquante(s) ouverte(s)`].filter(Boolean).join(" · ") };
    else if (videsBloq.length) reco = { k: "attente", lib: "⏳ Évaluation à compléter", why: `${videsBloq.length} critère(s) bloquant(s) non évalué(s)` };
    else if (ko.length || anoM > 0 || critiques.length) reco = { k: "reserve", lib: "⚠️ Go sous réserves", why: [ko.length && `${ko.length} critère(s) non bloquant(s) non rempli(s)`, anoM > 0 && `${anoM} anomalie(s) majeure(s)`, critiques.length && `${critiques.length} risque(s) critique(s) ouvert(s)`].filter(Boolean).join(" · ") };
    else if (vides.length) reco = { k: "reserve", lib: "⚠️ Go possible, évaluation incomplète", why: `${vides.length} critère(s) non évalué(s)` };
    else reco = { k: "go", lib: "✅ Go recommandé", why: "Tous les critères sont remplis" };
    return { g, C, ok, ko, vides, koBloq, anoB, anoM, critiques, reco, pct: C.length ? ok.length / C.length : 0 };
  }
  // indices tirés des autres briques
  function indiceGNG(p, c) {
    const g = p.gonogo;
    if (/anomalie bloquante/i.test(c.libelle) && g.anomalies.bloquantes !== "") return nbr(g.anomalies.bloquantes) ? `🐞 ${nbr(g.anomalies.bloquantes)} anomalie(s) bloquante(s) au compteur` : "🐞 Compteur : 0 anomalie bloquante";
    if (/documentation utilisateur/i.test(c.libelle)) { const D = (p.livrables || []).filter(d => ["manuel", "tuto"].includes(d.cat)); if (D.length) return `📚 ${D.map(d => `${esc(d.titre)} : ${STATUTS_DOC[d.statut]?.[0] || ""}`).join(" · ")}`; }
    if (/PV de recette/i.test(c.libelle)) { const D = (p.livrables || []).filter(d => /recette|pv/i.test(d.titre)); if (D.length) return `📚 ${D.map(d => `${esc(d.titre)} : ${STATUTS_DOC[d.statut]?.[0] || ""}`).join(" · ")}`; }
    return "";
  }

  // Objectifs mesurables (fiche d'identité) : cible, valeur actuelle et atteinte, suivis dans le Go / No-Go
  const ETATS_OBJ = { ok: ["✅", "Atteint"], encours: ["🟡", "En bonne voie"], ko: ["❌", "Non atteint"] };
  function objectifsSuivis(p) {
    const g = gonogoDe(p); g.objectifs = g.objectifs || {};
    return lignes(p.objectifs).map(texte => ({ texte, ...(g.objectifs[texte] || (g.objectifs[texte] = { cible: "", actuel: "", statut: "", majLe: "" })) , cle: texte }));
  }
  function blocObjectifsGNG(p) {
    const O = objectifsSuivis(p); const nOk = O.filter(o => o.statut === "ok").length;
    if (!O.length) return `<h3 style="margin:16px 0 6px">🎯 Objectifs du projet</h3><p class="muted" style="font-size:.88rem">Aucun objectif mesurable dans la fiche d'identité. <span class="link cp-tools" data-act="module" data-id="identite">Les ajouter →</span></p>`;
    return `<h3 style="margin:16px 0 6px">🎯 Objectifs du projet <span class="pill ${nOk === O.length ? "ok" : "soft"}">${nOk} / ${O.length} atteint(s)</span></h3>
      <div class="obj-liste">${O.map(o => `<div class="obj-ligne ${o.statut || "vide"}">
        <div class="obj-txt"><b>${esc(o.texte)}</b>${o.majLe ? `<small class="muted">mis à jour le ${fmtJM(o.majLe)}</small>` : ""}</div>
        <label>Cible<input class="inp" data-gno="${esc(o.cle)}" data-k="cible" value="${esc(o.cible)}" placeholder="ex. 100 %"></label>
        <label>Mesure actuelle<input class="inp" data-gno="${esc(o.cle)}" data-k="actuel" value="${esc(o.actuel)}" placeholder="ex. 70 %"></label>
        <div class="seg3 gng-seg">${Object.entries(ETATS_OBJ).map(([v, [ic, lib]]) => `<button class="${o.statut === v ? "on " + v : ""}" data-act="gn-obj" data-id="${esc(o.cle)}" data-v="${v}" title="${lib}">${ic}</button>`).join("")}</div>
      </div>`).join("")}</div>
      <p class="muted cp-tools" style="font-size:.8rem;margin:4px 0 0">Les objectifs viennent de la fiche d'identité. À mettre à jour avant la décision, puis au bilan de clôture.</p>`;
  }
  function vueGoNoGo(p, pl) {
    const E = evalGoNoGo(p); const g = E.g; const j = jalonMEP(p); const t = today();
    const cats = [...new Set(g.criteres.map(c => c.cat))];
    const seg = c => `<div class="seg3 gng-seg">${[["ok", "✅", "Rempli"], ["ko", "❌", "Non rempli"], ["na", "➖", "Sans objet"]].map(([v, ic, lib]) => `<button class="${c.statut === v ? "on " + v : ""}" data-act="gn-statut" data-id="${c.id}" data-v="${v}" title="${lib}">${ic}</button>`).join("")}</div>`;
    const V = g.verdict ? VERDICTS_GNG[g.verdict.v] : null;
    return `
      <div class="toolbar cp-tools"><h2 style="margin:0">🚦 Go / No-Go de mise en production</h2>
        <select class="inp" id="gnJalon" style="width:auto" title="Jalon de mise en production">${(pl.jalons || []).filter(x => x.date).map(x => `<option value="${x.id}" ${j?.id === x.id ? "selected" : ""}>◆ ${esc(x.nom)} · ${fmtDate(x.date)}</option>`).join("") || `<option>Aucun jalon</option>`}</select>
        <span class="spacer"></span><button class="btn small" data-act="capture">⛶ Mode capture</button></div>
      <div class="copil">
        <div class="cp-head"><div class="project-emoji" style="width:44px;height:44px;font-size:1.5rem" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div><div><div class="cp-proj">${esc(p.nom)} — Go / No-Go</div><div class="muted">${j ? `Mise en production : <b>${esc(j.nom)}</b> le ${fmtDate(j.date)}${j.date >= t ? ` (J-${diffJ(t, j.date)})` : ""}` : "Aucun jalon de mise en production : choisissez-en un ci-dessus"} · situation au ${fmtDate(t)}</div></div></div>
        <div class="gng-top">
          <div class="gng-reco ${V ? V.cls : E.reco.k}">
            ${V ? `<span class="muted">Décision du ${fmtDate(g.verdict.date)}${g.verdict.decideur ? ` · ${esc(g.verdict.decideur)}` : ""}</span><b>${V.emoji} ${V.nom}</b><span>${esc(g.verdict.commentaire || V.texte)}</span>
              <button class="btn ghost small cp-tools" data-act="gn-refaire" style="margin-top:6px">↺ Rouvrir l'évaluation</button>`
            : `<span class="muted">Recommandation</span><b>${E.reco.lib}</b><span>${E.reco.why}</span>
              <div class="row cp-tools" style="margin-top:8px">${Object.entries(VERDICTS_GNG).map(([k, x]) => `<button class="btn small ${k === "nogo" ? "danger" : k === "go" ? "green" : "ghost"}" data-act="gn-decider" data-id="${k}">${x.emoji} ${x.nom}</button>`).join("")}</div>`}
          </div>
          <div class="gng-score"><span class="muted">Critères remplis</span><b>${E.ok.length} / ${E.C.length}</b><div class="progress"><div style="width:${E.pct * 100}%"></div></div>
            <small>${E.koBloq.length ? `<span class="txt-danger">${E.koBloq.length} bloquant(s) KO</span> · ` : ""}${E.vides.length} à évaluer</small></div>
          <div class="gng-ano"><span class="muted">🐞 Anomalies de recette ouvertes</span>
            <div class="gng-ano-grid">${[["bloquantes", "Bloquantes", "danger"], ["majeures", "Majeures", "warn"], ["mineures", "Mineures", "soft"]].map(([k, lib, cls]) => `<label class="${cls}"><input type="number" min="0" class="inp" data-gna="${k}" value="${esc(g.anomalies[k])}" placeholder="0"><span>${lib}</span></label>`).join("")}</div>
            <small class="muted">${g.anomalies.majLe ? `mis à jour le ${fmtDate(g.anomalies.majLe)}` : "à reporter depuis votre outil de recette"}</small></div>
        </div>
        ${E.critiques.length ? `<div class="hl-banner" style="--k:#c9605a;margin:10px 0"><span>⚠️ ${E.critiques.length} risque(s) critique(s) encore ouvert(s) : ${E.critiques.map(r => esc(r.titre)).join(", ")}</span></div>` : ""}
        ${blocObjectifsGNG(p)}
        ${cats.map(cat => `<h3 style="margin:16px 0 6px">${esc(cat)}</h3><div class="gng-liste">${g.criteres.filter(c => c.cat === cat).map(c => `
          <div class="gng-crit ${c.statut || "vide"}">
            ${seg(c)}
            <div style="flex:1;min-width:0"><b>${esc(c.libelle)}</b>${c.bloquant ? ` <span class="pill danger" title="Si ce critère n'est pas rempli, le No-Go est recommandé">bloquant</span>` : ""}
              ${indiceGNG(p, c) ? `<div class="muted" style="font-size:.8rem">${indiceGNG(p, c)}</div>` : ""}
              <input class="inp gng-com" data-gnc="${c.id}" value="${esc(c.commentaire)}" placeholder="Commentaire, preuve, réserve…"></div>
            <button class="x-btn cp-tools" data-act="gn-suppr" data-id="${c.id}" title="Retirer ce critère">✕</button>
          </div>`).join("")}</div>`).join("")}
        <div class="row cp-tools" style="margin-top:14px;flex-wrap:nowrap"><select class="inp" id="gnCat" style="width:auto">${[...new Set([...cats, "Autre"])].map(x => `<option>${esc(x)}</option>`).join("")}</select><input class="inp" id="gnNouv" placeholder="Ajouter un critère…"><label class="row" style="gap:4px;white-space:nowrap;font-size:.86rem"><input type="checkbox" id="gnBloq"> bloquant</label><button class="btn small" data-act="gn-ajout">＋</button></div>
      </div>
      <p class="muted cp-tools" style="font-size:.82rem;margin-top:10px">Évaluez chaque critère (✅ rempli, ❌ non rempli, ➖ sans objet). Un critère <b>bloquant</b> non rempli, ou une anomalie bloquante, entraîne une recommandation de No-Go. La décision finale est ajoutée au journal des décisions.</p>`;
  }

  function ouvrirVerdictGNG(v) {
    const p = proj(); const g = gonogoDe(p); const E = evalGoNoGo(p); const j = jalonMEP(p); const pl = p.planning; const nums = numerosCopil(pl);
    const reus = pl.reunions.filter(r => !r.annulee && ["copil", "libre", "cloture"].includes(r.type)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
    const V = VERDICTS_GNG[v];
    const reserves = [...E.ko.map(c => c.libelle), E.anoM ? `${E.anoM} anomalie(s) majeure(s) à corriger` : ""].filter(Boolean);
    openModal(`
      <div class="modal-head" style="--c:${v === "nogo" ? "#b4413c" : v === "go" ? "#2e7d5b" : "#d9822b"}"><div class="row"><h2 style="margin:0">${V.emoji} Décision : ${V.nom}</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <p style="margin:0">${V.texte}${j ? ` pour <b>${esc(j.nom)}</b> (${fmtDate(j.date)})` : ""}. Recommandation de l'outil : <b>${E.reco.lib}</b>.</p>
        <div class="three">
          <div class="field"><label>Date</label><input type="date" id="gvDate" value="${today()}"></div>
          <div class="field"><label>Décideur</label><input type="text" id="gvQui" list="dlPersonnes" value="${esc(nomRole(p, "Sponsor").split(",")[0] || "")}"></div>
          <div class="field"><label>Instance</label><select id="gvInst"><option value="">Hors instance</option>${reus.map(r => `<option value="${r.id}">${(TYPES_REU[r.type] || TYPES_REU.libre).emoji} ${esc(titreReu(r, nums))} · ${fmtJM(r.date)}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label>${v === "nogo" ? "Motif et conditions pour une nouvelle date" : v === "reserve" ? "Réserves à lever" : "Commentaire"}</label><textarea id="gvCom" rows="3">${v === "reserve" ? esc(reserves.join("\n")) : v === "nogo" ? esc([...E.koBloq.map(c => c.libelle), E.anoB ? `${E.anoB} anomalie(s) bloquante(s)` : ""].filter(Boolean).join("\n")) : ""}</textarea></div>
        ${v === "reserve" && reserves.length ? `<label class="type-row"><input type="checkbox" id="gvAct" checked><span>Créer une action par réserve dans le registre des actions</span></label>` : ""}
        ${v === "go" && j && !j.atteint && j.date <= today() ? `<label class="type-row"><input type="checkbox" id="gvJal" checked><span>Marquer le jalon « ${esc(j.nom)} » comme atteint</span></label>` : ""}
      </div>
      <div class="modal-foot"><span></span><div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button><button class="btn" id="gvOk">Enregistrer la décision</button></div></div>`);
    $("#gvOk").onclick = () => {
      const date = $("#gvDate").value || today(); const decideur = $("#gvQui").value.trim(); const com = $("#gvCom").value.trim(); const inst = $("#gvInst").value;
      const d = { id: uid(), titre: `${V.emoji} ${V.nom} de mise en production${j ? ` : ${j.nom}` : ""}`, date, statut: "validee", instance: inst, decideur, description: com, impacts: v === "nogo" ? ["Planning"] : [], risques: [], creeLe: today() };
      if (g.verdict?.decisionId) p.decisions = p.decisions.filter(x => x.id !== g.verdict.decisionId);
      p.decisions.push(d);
      g.verdict = { v, date, decideur, commentaire: com, instance: inst, decisionId: d.id, reco: E.reco.k };
      if ($("#gvAct")?.checked) lignes(com).forEach(l => ajouterAction(p, { texte: `Lever la réserve : ${l}`, echeance: j?.date || "", source: "decision:" + d.id }));
      if ($("#gvJal")?.checked && j) j.atteint = true;
      save(); closeModal(); render(); toast(`${V.emoji} Décision « ${V.nom} » enregistrée dans le journal`);
    };
  }

  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const { act, id } = el.dataset;
    if (!/^(chg|gn)-/.test(act)) return;
    const p = proj(); if (!p) return;
    switch (act) {
      case "chg-nouveau": ouvrirChangement(null); return;
      case "chg-edit": if (e.target.closest("[data-act=chg-arbitrer]")) return; ouvrirChangement(id); return;
      case "chg-arbitrer": e.stopPropagation(); ouvrirArbitrage(id); return;
      case "chg-filtre": ui.chgFiltre = id; render(); return;
      case "chg-csv": exporterCSVChg(p); return;
    }
    const g = gonogoDe(p);
    switch (act) {
      case "gn-obj": { const o = objectifsSuivis(p).find(x => x.cle === id); if (o) { const s = g.objectifs[o.cle]; s.statut = s.statut === el.dataset.v ? "" : el.dataset.v; s.majLe = today(); } break; }
      case "gn-statut": { const c = g.criteres.find(x => x.id === id); c.statut = c.statut === el.dataset.v ? "" : el.dataset.v; break; }
      case "gn-suppr": { const c = g.criteres.find(x => x.id === id); if (!confirm(`Retirer le critère « ${c.libelle} » ?`)) return; g.criteres = g.criteres.filter(x => x !== c); break; }
      case "gn-ajout": { const v = $("#gnNouv").value.trim(); if (!v) { $("#gnNouv").focus(); return; } g.criteres.push({ id: uid(), cat: $("#gnCat").value, libelle: v, bloquant: $("#gnBloq").checked, statut: "", commentaire: "" }); break; }
      case "gn-decider": ouvrirVerdictGNG(id); return;
      case "gn-refaire": if (!confirm("Rouvrir l'évaluation ? La décision déjà enregistrée reste dans le journal des décisions.")) return; g.verdict = null; break;
      default: return;
    }
    save(); render();
  });
  document.addEventListener("input", e => {
    const p = proj(); if (!p) return;
    if (e.target.dataset?.gnc) { const c = gonogoDe(p).criteres.find(x => x.id === e.target.dataset.gnc); if (c) { c.commentaire = e.target.value; save(); } }
    if (e.target.dataset?.gna) { const g = gonogoDe(p); g.anomalies[e.target.dataset.gna] = e.target.value; g.anomalies.majLe = today(); save(); }
    if (e.target.dataset?.gno) { objectifsSuivis(p); const s = gonogoDe(p).objectifs[e.target.dataset.gno]; if (s) { s[e.target.dataset.k] = e.target.value; s.majLe = today(); save(); } }
  });
  document.addEventListener("change", e => {
    if (e.target.dataset?.gna) render();
    if (e.target.id === "gnJalon") { gonogoDe(proj()).jalonId = e.target.value; save(); render(); }
  });

  // ═══════════════════════════════════════════════════════════════
  // ═══════════════ Rapport de portefeuille (synthèse direction)
  // ═══════════════════════════════════════════════════════════════
  function meteoProjet(p) {
    const C = p.planning?.methode ? histoMeteo(p.planning).map(x => ({ d: x.r.date, m: x.m.global })).filter(x => x.m) : [];
    const F = Object.entries(p.flash || {}).filter(([, f]) => f?.meteo?.global).map(([d, f]) => ({ d, m: f.meteo.global }));
    return [...C, ...F].filter(x => x.d <= today()).sort((a, b) => a.d.localeCompare(b.d)).pop() || null;
  }
  document.addEventListener("click", e => {
    const el = e.target.closest?.("[data-module][data-act]"); if (!el) return;
    ui.ecran = "projet"; ui.module = el.dataset.module === "cr" ? "instances" : el.dataset.module; window.scrollTo(0, 0);
    if (el.dataset.module === "cr") ui.vueInst = "reunions";
  }, true);
  function flechesNav(nav) {
    if (!nav || !nav.children.length) return;
    if (!nav.querySelector(":scope > .nav-fleche")) {
      nav.insertAdjacentHTML("afterbegin", `<button class="nav-fleche g" data-sens="-1" aria-label="Onglets précédents" tabindex="-1">‹</button>`);
      nav.insertAdjacentHTML("beforeend", `<button class="nav-fleche d" data-sens="1" aria-label="Onglets suivants" tabindex="-1">›</button>`);
      const actif = nav.querySelector(".active");
      if (actif && (actif.offsetLeft < nav.scrollLeft || actif.offsetLeft + actif.offsetWidth > nav.scrollLeft + nav.clientWidth)) nav.scrollLeft = actif.offsetLeft - 40;
    }
    nav.classList.toggle("deborde-g", nav.scrollLeft > 2);
    nav.classList.toggle("deborde-d", nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 2);
  }
  ["#tabs", "#subtabs"].forEach(sel => {
    const nav = $(sel); if (!nav) return;
    new MutationObserver(() => flechesNav(nav)).observe(nav, { childList: true });
    nav.addEventListener("scroll", () => flechesNav(nav), { passive: true });
    nav.addEventListener("click", e => { const f = e.target.closest(".nav-fleche"); if (!f) return; e.stopPropagation(); nav.scrollBy({ left: +f.dataset.sens * nav.clientWidth * .6, behavior: "smooth" }); }, true);
  });
  window.addEventListener("resize", () => ["#tabs", "#subtabs"].forEach(sel => flechesNav($(sel))));

  // Vue d'ensemble : tuiles empilées sans trous (chaque tuile prend la hauteur de son contenu)
  function tassementTuiles() {
    const g = $(".dash-grid"); if (!g) return;
    $$(".dash-grid > .panel").forEach(t => { t.style.gridRowEnd = "auto"; });
    $$(".dash-grid > .panel").forEach(t => { t.style.gridRowEnd = `span ${Math.ceil(t.getBoundingClientRect().height) + 20}`; });
  }
  new MutationObserver(() => requestAnimationFrame(tassementTuiles)).observe($("#main"), { childList: true });
  window.addEventListener("resize", () => requestAnimationFrame(tassementTuiles));
  document.fonts?.ready.then(() => tassementTuiles());

  function vueRapportPortefeuille() {
    const t = today(); const fin3m = addJ(t, 92);
    const nbf = v => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v);
    const P = S.projets.map(p => {
      const st = statsRisques(p); const av = avancementTemps(p); const pl = p.planning?.methode ? p.planning : null;
      const prochain = pl ? pl.jalons.filter(j => j.date && !j.atteint && j.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0] : null;
      const glisses = pl ? pl.jalons.filter(j => !j.atteint && glissement(j) > 0) : [];
      const T = opt(p, "budget") && budgetDe(p).lignes.length ? totauxBudget(p) : null;
      const att = p.decisions.filter(d => d.statut === "attente").length + (pl ? copilsAStatuer(p).length : 0) + chgOuverts(p).length;
      const mep = jalonMEP(p);
      const gng = p.gonogo ? (p.gonogo.verdict ? VERDICTS_GNG[p.gonogo.verdict.v] : { nom: evalGoNoGo(p).reco.lib.replace(/^\S+\s/, ""), cls: { go: "ok", reserve: "warn", nogo: "danger", attente: "soft" }[evalGoNoGo(p).reco.k] }) : null;
      // points de vigilance : courts, du plus grave au moins grave
      const V = [];
      if (st.critiques.length) V.push([st.critiques.some(r => crit(r) >= 9) ? "rouge" : "orange", `${st.critiques.length} risque${st.critiques.length > 1 ? "s" : ""} élevé${st.critiques.length > 1 ? "s" : ""}`]);
      if (st.retard.length) V.push(["rouge", `${st.retard.length} action${st.retard.length > 1 ? "s" : ""} en retard`]);
      if (T && T.ecart > 0.005) V.push(["orange", `Budget +${fmtB(p, T.ecart)}`]);
      if (att) V.push(["bleu", `${att} arbitrage${att > 1 ? "s" : ""} attendu${att > 1 ? "s" : ""}`]);
      return { p, st, av, prochain, glisses, T, att, mep, gng, V, meteo: meteoProjet(p) };
    });
    const jalons = P.flatMap(x => x.p.planning?.methode ? x.p.planning.jalons.filter(j => j.date && !j.atteint && j.date >= t && j.date <= fin3m).map(j => ({ x, j })) : []).sort((a, b) => a.j.date.localeCompare(b.j.date)).slice(0, 6);
    const risques = P.flatMap(x => x.st.critiques.map(r => ({ x, r }))).sort((a, b) => crit(b.r) - crit(a.r)).slice(0, 5);
    const arbitrages = P.flatMap(x => [
      ...x.p.decisions.filter(d => d.statut === "attente").map(d => ({ x, txt: d.titre, sous: "Décision" })),
      ...chgOuverts(x.p).map(c => ({ x, txt: c.titre, sous: `Changement ${numChg(x.p, c)}${nbr(c.impacts?.delai) ? ` · ${signe(nbr(c.impacts.delai))} j` : ""}${nbr(c.impacts?.cout) ? ` · ${signe(nbr(c.impacts.cout))} ${uniteBudget(x.p)}` : ""}` })),
    ]).slice(0, 6);
    const budg = P.filter(x => x.T); const tot = k => budg.reduce((n, x) => n + (x.T[k] || 0), 0);
    const nomCourt = x => esc(x.p.code || tronque(x.p.nom, 18));
    const chiffre = (n, lib, alerte) => `<div><b class="${alerte && n ? "rp2-alerte" : ""}">${n}</b><span>${lib}</span></div>`;
    const ligne = x => { const m = x.meteo ? METEO[x.meteo.m] : null; return `
      <tr class="clic" data-act="ouvrir-projet" data-id="${x.p.id}">
        <td><b>${esc(x.p.nom)}</b><small>${[x.p.code, nomRole(x.p, "Sponsor") || nomRole(x.p, "Chef de projet")].filter(Boolean).map(esc).join(" · ")}</small></td>
        <td class="rp2-meteo" title="${m ? `${m[1]} · ${fmtDate(x.meteo.d)}` : "Météo non renseignée"}">${m ? m[0] : `<span class="muted">—</span>`}</td>
        <td>${x.av ? `<div class="rp2-barre"><i style="width:${Math.round(x.av.pct * 100)}%"></i></div><small>${Math.round(x.av.pct * 100)} % du temps</small>` : `<span class="muted">—</span>`}</td>
        <td>${x.prochain ? `${esc(tronque(x.prochain.nom, 30))}<small>${fmtDate(x.prochain.date)}${glissement(x.prochain) > 0 ? ` <span class="rp2-rouge">· +${glissement(x.prochain)} j</span>` : ""}</small>` : `<span class="muted">—</span>`}</td>
        <td>${x.V.length ? `<ul class="rp2-pts">${x.V.map(([c, txt]) => `<li class="${c}">${txt}</li>`).join("")}</ul>` : `<span class="rp2-ok">Rien à signaler</span>`}</td>
        <td>${x.gng ? `<span class="rp2-mep ${x.gng.cls}">${esc(x.gng.nom)}</span>${x.mep ? `<small>${fmtDate(x.mep.date)}</small>` : ""}` : x.mep && !x.mep.atteint ? `${fmtDate(x.mep.date)}<small>${esc(tronque(x.mep.nom, 24))}</small>` : `<span class="muted">—</span>`}</td>
      </tr>`; };
    return `
      <div class="copil rp2">
        <div class="cp-head"><div><div class="cp-proj">Rapport de portefeuille</div><div class="muted">Situation au ${fmtDate(t)} · ${S.projets.length} projet${S.projets.length > 1 ? "s" : ""}</div></div><span class="spacer"></span><button class="btn small cp-tools" data-act="capture">⛶ Mode capture</button></div>
        <div class="rp2-chiffres">
          ${chiffre(P.filter(x => x.glisses.length).length, "en glissement", true)}
          ${chiffre(P.reduce((n, x) => n + x.st.critiques.length, 0), "risques élevés", true)}
          ${chiffre(P.reduce((n, x) => n + x.st.retard.length, 0), "actions en retard", true)}
          ${chiffre(P.reduce((n, x) => n + x.att, 0), "arbitrages attendus", false)}
          ${budg.length ? `<div><b class="${tot("ecart") > 0.005 ? "rp2-alerte" : ""}">${Math.round(tot("consomme") / (tot("prevu") || 1) * 100)} %</b><span>budget consommé${tot("ecart") > 0.005 ? ` · atterrissage +${nbf(tot("ecart"))}${new Set(budg.map(x => x.p.budget.unite)).size === 1 ? " " + uniteBudget(budg[0].p) : ""}` : ""}</span></div>` : ""}
        </div>
        <table class="rp2-table"><thead><tr><th>Projet</th><th>Météo</th><th>Avancement</th><th>Prochain jalon</th><th>Points de vigilance</th><th>Mise en production</th></tr></thead><tbody>${P.map(ligne).join("")}</tbody></table>
        <div class="rp2-bas">
          <section><h4>Prochains jalons</h4>${jalons.length ? jalons.map(({ x, j }) => `<div class="rp2-item"><span class="rp2-date">${fmtJM(j.date)}</span><span>${esc(j.nom)}${glissement(j) > 0 ? ` <span class="rp2-rouge">+${glissement(j)} j</span>` : ""}<small>${nomCourt(x)}</small></span></div>`).join("") : `<p class="muted">Aucun jalon dans les 3 prochains mois.</p>`}</section>
          <section><h4>Risques à surveiller</h4>${risques.length ? risques.map(({ x, r }) => `<div class="rp2-item"><span class="rp2-score ${niveau(crit(r))}">${crit(r)}</span><span>${esc(r.titre)}<small>${nomCourt(x)}${r.responsable ? ` · ${esc(r.responsable)}` : ""}</small></span></div>`).join("") : `<p class="muted">Aucun risque élevé ou critique.</p>`}</section>
          <section><h4>Arbitrages attendus</h4>${arbitrages.length ? arbitrages.map(a => `<div class="rp2-item"><span>${esc(a.txt)}<small>${nomCourt(a.x)} · ${esc(a.sous)}</small></span></div>`).join("") : `<p class="muted">Aucun arbitrage en attente.</p>`}</section>
        </div>
      </div>
      <p class="muted cp-tools" style="font-size:.82rem;margin-top:10px">Météo : dernière saisie (copil ou flash report). Cliquez sur une ligne pour ouvrir le projet.</p>`;
  }

  // ═══════════════ Fiche d'identité : mode lecture (présentation soignée, rien n'est modifiable)
  Object.assign(ui, { ficheMode: "lecture" });
  function basculeFiche() {
    return `<div class="seg2 fiche-mode" role="group" aria-label="Mode de la fiche"><button class="${ui.ficheMode !== "saisie" ? "on" : ""}" data-act="fiche-mode" data-id="lecture">👁️ Lecture</button><button class="${ui.ficheMode === "saisie" ? "on" : ""}" data-act="fiche-mode" data-id="saisie">✏️ Saisie</button></div>`;
  }
  function vueIdentiteLecture(p) {
    const av = avancementTemps(p); const t = today();
    const vide = (lib = "Non renseigné") => `<span class="idl-vide">${lib} · <span class="link" data-act="fiche-mode" data-id="saisie">compléter</span></span>`;
    const texte = v => v && String(v).trim() ? `<div class="idl-texte">${esc(v).replace(/\n/g, "<br>")}</div>` : vide();
    const liste = (v, cls = "") => { const L = lignes(v); return L.length ? `<ul class="idl-liste ${cls}">${L.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : vide(); };
    const duree = p.dateDebut && p.dateFin && p.dateFin >= p.dateDebut ? (() => { const j = diffJ(p.dateDebut, p.dateFin); return j >= 60 ? `${Math.round(j / 30.4)} mois` : `${Math.round(j / 7)} semaines`; })() : "";
    const pl = p.planning?.methode ? p.planning : null;
    const prochain = pl ? pl.jalons.filter(j => j.date && !j.atteint && j.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0] : null;
    const bl = backlogDe(p);
    const ordreRoles = r => { const i = ROLES.indexOf(r); return i < 0 ? 99 : i; };
    const inter = p.interlocuteurs.slice().sort((a, b) => ordreRoles(a.role) - ordreRoles(b.role));
    if (p.captures?.length) capObjets.set(p.id, p);
    return `
      <div class="toolbar cp-tools"><h2 style="margin:0">🪪 Fiche d'identité</h2>${basculeFiche()}<span class="spacer"></span><button class="btn small" data-act="capture">⛶ Mode capture</button></div>
      <div class="idl">
        <section class="idl-tete" style="--c:${p.couleur}">
          <div class="project-emoji" style="width:64px;height:64px;font-size:2.1rem" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div>
          <div style="flex:1;min-width:0">
            <div class="row" style="gap:10px"><h2 class="idl-nom">${esc(p.nom)}</h2>${p.code ? `<span class="code-pill">${esc(p.code)}</span>` : ""}</div>
            <div class="idl-meta">
              <span>📅 ${p.dateDebut ? `${fmtDate(p.dateDebut)} → ${p.dateFin ? `${fmtDate(p.dateFin)} <span class="muted">(${p.finFerme ? "date ferme" : "date estimée"}${duree ? ` · ${duree}` : ""})</span>` : "fin non fixée"}` : "Dates à préciser"}</span>
              ${opt(p, "budget") && fmtMontant(p.budget) ? `<span>💶 ${fmtMontant(p.budget)}</span>` : ""}
              ${pl ? `<span>${METHODES[pl.methode].emoji} ${METHODES[pl.methode].nom}</span>` : ""}
            </div>
          </div>
          ${av ? `<div class="idl-av"><b>${Math.round(av.pct * 100)} %</b><span>du temps écoulé</span><div class="progress time"><div style="width:${av.pct * 100}%"></div></div><small>${av.restants >= 0 ? `J-${av.restants}` : `dépassé de ${-av.restants} j`}</small></div>` : ""}
        </section>

        ${blocEtapesLecture(p)}
        <div class="idl-grille">
          <div class="idl-principal">
            <section class="panel"><h3>📝 Description</h3>${texte(p.description)}</section>
            <section class="panel idl-enjeu"><h3>🎯 Enjeu</h3>${p.enjeu && p.enjeu.trim() ? `<blockquote>${esc(p.enjeu).replace(/\n/g, "<br>")}</blockquote>` : vide()}</section>
            <section class="panel"><h3>🏁 Objectifs mesurables</h3>${liste(p.objectifs, "idl-obj")}</section>
            <section class="panel"><h3>📐 Périmètre</h3>
              <div class="idl-perim"><div><h4>Inclus</h4>${liste(p.perimetreIn, "idl-in")}</div><div><h4>Exclu</h4>${liste(p.perimetreOut, "idl-out")}</div></div></section>
          </div>
          <div class="idl-cote">
            <section class="panel"><h3>📅 Repères</h3>
              <div class="kv"><span class="muted">Début</span><b>${p.dateDebut ? fmtDate(p.dateDebut) : "—"}</b></div>
              <div class="kv"><span class="muted">Fin</span><b>${p.dateFin ? fmtDate(p.dateFin) : "—"}</b></div>
              ${etapesActives(p).length ? `<div class="kv"><span class="muted">Étape</span><b>${etapeCourante(p).emoji} ${esc(etapeCourante(p).nom)}${etapesDe(p).mode === "timeline" ? "" : ` <span class="muted" style="font-weight:400">(navigation libre)</span>`}</b></div>` : ""}
              ${prochain ? `<div class="kv"><span class="muted">Prochain jalon</span><b>${esc(prochain.nom)} · ${fmtJM(prochain.date)} ${badgeGlissement(prochain)}</b></div>` : ""}
              ${opt(p, "budget") ? `<div class="kv"><span class="muted">Budget</span><b>${fmtMontant(p.budget) || "—"}</b></div>` : ""}
              <div class="kv"><span class="muted">Modules</span><b>${[opt(p, "budget") && "💶 Budget", opt(p, "charge") && "📊 Charge"].filter(Boolean).join(" · ") || "aucun"}</b></div>
            </section>
            <section class="panel"><h3>🔗 Liens</h3>
              ${bl.url ? `<a class="idl-lien" href="${esc(bl.url)}" target="_blank" rel="noopener"><span>📋 Backlog${bl.outil ? ` · ${OUTILS_BL[bl.outil]}` : ""}</span><span>↗</span></a>` : ""}
              ${p.liens.filter(l => l.url).map(l => `<a class="idl-lien" href="${esc(l.url)}" target="_blank" rel="noopener"><span>${esc(l.libelle || l.url)}</span><span>↗</span></a>`).join("")}
              ${!bl.url && !p.liens.some(l => l.url) ? vide("Aucun lien") : ""}
            </section>
          </div>
        </div>

        <section class="panel"><h3>👥 Interlocuteurs <span class="muted" style="font-weight:400;font-size:.85rem">· ${p.interlocuteurs.length} personne(s), ${p.interlocuteurs.filter(i => i.copil).length} au copil</span></h3>
          ${inter.length ? `<div class="idl-gens">${inter.map(i => { const x = personne(i.personneId) || { nom: "(personne supprimée)" }; return `
            <div class="idl-pers">
              <div class="idl-init">${esc((x.nom || "?").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase())}</div>
              <div style="min-width:0"><b>${esc(x.nom)}</b><div class="idl-role">${esc(i.role)}${i.copil ? ` <span class="pill soft">copil</span>` : ""}</div>
                <div class="muted" style="font-size:.8rem">${[x.fonction, x.entite].filter(Boolean).map(esc).join(" · ")}</div>
                ${x.email ? `<a class="idl-mail" href="mailto:${esc(x.email)}">${esc(x.email)}</a>` : ""}</div>
            </div>`; }).join("")}</div>` : vide("Aucun interlocuteur")}
        </section>

        ${p.notes?.trim() || p.captures?.length ? `<section class="panel"><h3>🗒️ Notes</h3>${p.notes?.trim() ? `<div class="idl-texte">${esc(p.notes).replace(/\n/g, "<br>")}</div>` : ""}
          ${p.captures?.length ? `<div class="cap-zone" style="margin-top:10px">${p.captures.map(c => `<figure class="cap-vig"><img data-capimg="${esc(c.fichier)}" alt="${esc(c.nom || "Capture")}" title="Agrandir" data-act="cap-voir" data-id="${p.id}" data-c="${c.id}"></figure>`).join("")}</div>` : ""}</section>` : ""}
      </div>`;
  }
  document.addEventListener("click", e => {
    const el = e.target.closest?.("[data-act]"); if (!el) return;
    if (el.dataset.act === "fiche-mode") { ui.ficheMode = el.dataset.id; render(); window.scrollTo(0, 0); }
    if (el.dataset.act === "fiche-saisie") { allerA("projet", "identite"); ui.ficheMode = "saisie"; render(); }
  });

  // ═══════════════ Vue d'ensemble personnalisable : catalogue de tuiles
  // Choix et ordre enregistrés dans _commun.json (S.tuiles), communs à tous les projets.
  const TUILES = [
    { id: "avancement", brique: "planif", emoji: "⏳", nom: "Avancement calendaire", desc: "Temps écoulé, sprint en cours, prochain jalon, backlog, Go / No-Go" },
    { id: "jalons", brique: "planif", emoji: "◆", nom: "Prochains jalons", desc: "Les 5 prochains jalons et leur glissement" },
    { id: "fiche", brique: "identite", emoji: "🪪", nom: "Le projet en bref", desc: "Enjeu et objectifs mesurables" },
    { id: "interlocuteurs", brique: "identite", emoji: "👥", nom: "Interlocuteurs clés", desc: "Sponsor, chef de projet, PO…" },
    { id: "backlog", brique: "backlog", emoji: "📈", nom: "Backlog", desc: "Avancement, vélocité, fin estimée, éléments bloqués" },
    { id: "risques", brique: "risques", emoji: "🎯", nom: "Risques (matrice)", desc: "Chiffres clés et mini-matrice" },
    { id: "toprisques", brique: "risques", emoji: "⚠️", nom: "Top risques", desc: "Les 5 risques les plus critiques" },
    { id: "copil", brique: "instances", emoji: "🏛️", nom: "Prochain copil", desc: "Date, préparation et tâches à faire" },
    { id: "meteo", brique: "instances", emoji: "🌤️", nom: "Météo du projet", desc: "Dernière météo et son évolution" },
    { id: "gonogo", brique: "planif", emoji: "🚦", nom: "Go / No-Go", desc: "Recommandation et critères avant la mise en production" },
    { id: "reunions", brique: "instances", emoji: "📝", nom: "Réunions & comptes rendus", desc: "Prochaines réunions et CR à rédiger" },
    { id: "decisions", brique: "decisions", emoji: "📒", nom: "Décisions & actions", desc: "Actions ouvertes, en retard, décisions à statuer" },
    { id: "retard", brique: "decisions", emoji: "⏰", nom: "Actions en retard", desc: "La liste, à cocher directement" },
    { id: "changements", brique: "decisions", emoji: "🔄", nom: "Demandes de changement", desc: "À analyser, à arbitrer, impacts" },
    { id: "livrables", brique: "livrables", emoji: "📚", nom: "Livrables & docs", desc: "Avancement, retards et prochaines échéances" },
    { id: "budget", brique: "budget", emoji: "💶", nom: "Budget", desc: "Consommé, atterrissage et écart" },
    { id: "retex", brique: "retex", emoji: "🎓", nom: "Retex", desc: "Derniers enseignements" },
    { id: "aujourdhui", brique: "cockpit", emoji: "📌", nom: "À faire aujourd'hui", desc: "Actions en retard ou du jour, réunions, jalons et revues du jour pour ce projet" },
    { id: "echeances", brique: "cockpit", emoji: "📅", nom: "Prochaines échéances", desc: "Actions, réunions, jalons et revues à venir" },
    { id: "flash", brique: "cockpit", emoji: "📰", nom: "Flash report de la semaine", desc: "Météo de la semaine et envoi" },
    { id: "tendances", brique: "cockpit", emoji: "📈", nom: "Tendances", desc: "Évolution semaine après semaine des risques, retards et avancement" },
    { id: "etape", brique: "cockpit", emoji: "🧭", nom: "Étape du projet", desc: "Étape en cours, jour, critères pour la terminer, étape suivante" },
    { id: "problemes", brique: "risques", emoji: "💥", nom: "Problèmes", desc: "Risques avérés et problèmes ouverts, depuis combien de temps" },
    { id: "avreel", brique: "planif", emoji: "📊", nom: "Avancement réel", desc: "Réalisé comparé au prévu, phase par phase" },
    { id: "objectifs", brique: "identite", emoji: "🎯", nom: "Objectifs du projet", desc: "Cible, mesure actuelle et atteinte de chaque objectif" },
    { id: "temps", brique: "identite", emoji: "⏱️", nom: "Temps passé", desc: "Jours passés comparés au prévu (module Charge)" },
    { id: "preparation", brique: "instances", emoji: "✅", nom: "Réunions à préparer", desc: "Les réunions des 15 prochains jours : à préparer, en préparation, prêtes" },
  ];
  const TUILES_DEFAUT = ["avancement", "risques", "echeances", "meteo", "decisions", "interlocuteurs"];
  Object.assign(ui, { ckPerso: false });
  const tuileValide = id => TUILES.some(t => t.id === id);
  function dispoTuiles() {
    let T = S.tuiles;
    if (!T || Array.isArray(T)) { const L = (Array.isArray(T) ? T : TUILES_DEFAUT).filter(tuileValide); const cols = [[], [], []]; L.forEach((id, i) => cols[i % 3].push(id)); T = { n: 3, cols }; }
    const n = Math.min(4, Math.max(1, +T.n || 3)); const cols = Array.from({ length: n }, (_, i) => (T.cols?.[i] || []).filter(tuileValide));
    (T.cols || []).slice(n).forEach(c => cols[n - 1].push(...(c || []).filter(tuileValide))); // colonnes en trop : reportées dans la dernière
    return { n, cols };
  }
  const tuilesChoisies = () => dispoTuiles().cols.flat();
  const enregistrerDispo = T => { S.tuiles = T; save(); };
  const titreTuile = (emoji, nom, lien = "") => `<div class="row" style="margin-bottom:8px"><h3 style="margin:0">${emoji} ${nom}</h3><span class="spacer"></span>${lien}</div>`;
  const lienTuile = (txt, attrs) => `<span class="link" ${attrs}>${txt} →</span>`;

  function tuilesEnPlus(p) {
    const t = today(); const pl = p.planning?.methode ? p.planning : null; const nums = pl ? numerosCopil(pl) : new Map();
    const T = {};
    // ◆ Prochains jalons
    T.jalons = () => { const J = pl ? pl.jalons.filter(j => j.date && !j.atteint && j.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5) : [];
      return titreTuile("◆", "Prochains jalons", lienTuile("Planning", `data-act="pl-vue" data-id="jalons" data-module="planif"`)) + (J.length ? J.map(j => `<div class="av-ligne"><span class="av-lib">${fmtDate(j.date)}</span><span class="av-val"><b>${esc(j.nom)}</b>${glissement(j) ? `<small><span class="${glissement(j) > 0 ? "txt-danger" : "txt-ok"}">${glissement(j) > 0 ? "+" : ""}${glissement(j)} j</span> par rapport à la date initiale</small>` : ""}</span></div>`).join("") : `<p class="muted">${pl ? "Aucun jalon à venir." : "Pas encore de planning."}</p>`); };
    // 🪪 Le projet en bref
    T.fiche = () => titreTuile("🪪", "Le projet en bref", lienTuile("Fiche", `data-act="module" data-id="identite"`))
      + (p.enjeu?.trim() ? `<div class="tu-enjeu">${esc(p.enjeu)}</div>` : `<p class="muted">Enjeu non renseigné.</p>`)
      + (lignes(p.objectifs).length ? `<ul class="idl-liste idl-obj" style="margin-top:10px">${lignes(p.objectifs).slice(0, 4).map(o => `<li>${esc(o)}</li>`).join("")}</ul>` : "");
    // 📈 Backlog
    T.backlog = () => { const A = analyseBacklog(p);
      if (!A) return titreTuile("📈", "Backlog") + `<p class="muted">Aucun import. <span class="link" data-act="module" data-id="backlog">Importer un export CSV</span></p>`;
      const mep = jalonMEP(p);
      return titreTuile("📈", "Backlog", lienTuile("Analyse", `data-act="module" data-id="backlog"`))
        + `<div class="mini-kpis"><div><b>${Math.round(A.pct * 100)} %</b><span>terminé</span></div><div><b>${A.velocite ? Math.round(A.velocite * 10) / 10 : "—"}</b><span>vélocité / sprint</span></div><div class="${A.bloques.length ? "danger" : ""}"><b>${A.bloques.length}</b><span>bloqué(s)</span></div></div>`
        + `<div class="progress"><div style="width:${A.pct * 100}%"></div></div>`
        + `<p class="muted" style="font-size:.84rem;margin:8px 0 0">${A.dateFinEstimee ? `Fin estimée le <b class="${mep && A.dateFinEstimee > mep.date ? "txt-danger" : ""}">${fmtDate(A.dateFinEstimee)}</b>${mep ? ` · mise en production le ${fmtDate(mep.date)}` : ""}` : "Fin estimée : vélocité insuffisante"} · photo du ${fmtDate(A.I.date)}</p>`; };
    // ⚠️ Top risques
    T.toprisques = () => { const R = p.risques.filter(r => !CLOS.has(r.statut)).sort((a, b) => crit(b) - crit(a)).slice(0, 5);
      return titreTuile("⚠️", "Top risques", lienTuile("Registre", `data-act="vue" data-id="registre" data-module="risques"`)) + (R.length ? R.map(r => `<div class="tu-ligne clic" data-act="open" data-id="${r.id}"><span class="crit ${niveau(crit(r))}">${crit(r)}</span><span style="flex:1;min-width:0"><b>${esc(r.titre)}</b><small>${STATUT[r.statut].nom}${r.responsable ? ` · ${esc(r.responsable)}` : ""}</small></span></div>`).join("") : `<p class="muted">Aucun risque ouvert.</p>`); };
    // 🏛️ Prochain copil
    T.copil = () => { const r = pl ? pl.reunions.filter(x => x.type === "copil" && !x.annulee && x.date >= t).sort((a, b) => a.date.localeCompare(b.date))[0] : null;
      if (!r) return titreTuile("🏛️", "Prochain copil") + `<p class="muted">Aucun copil à venir.</p>`;
      const d = r.prep || {}; const taches = p.actions.filter(a => a.auto && a.source?.id === r.id);
      const ok = (b, lib) => `<li class="${b ? "fait" : ""}">${b ? "✓" : "○"} ${lib}</li>`;
      return titreTuile("🏛️", esc(titreReu(r, nums)), lienTuile("Préparer", `data-act="in-prep" data-id="${r.id}" data-module="instances"`))
        + `<div class="av-tete"><b>J-${diffJ(t, r.date)}</b><span>${fmtCourt(r.date)} à ${heureOk(r.heure).replace(":", "h")}</span></div>`
        + `<ul class="tu-check">${ok(d.meteo && Object.values(d.meteo).some(Boolean), "Météo renseignée")}${ok(lignes(d.faits).length, "Faits marquants")}${ok(lignes(d.decisions).length || p.decisions.some(x => x.statut === "attente"), "Décisions attendues")}${taches.length ? ok(taches.every(a => a.fait), `Tâches de préparation : ${taches.filter(a => a.fait).length} / ${taches.length}`) : ""}</ul>`; };
    // 🚦 Go / No-Go
    T.gonogo = () => { const j = jalonMEP(p);
      if (!j) return titreTuile("🚦", "Go / No-Go") + `<p class="muted">Aucun jalon de mise en production.</p>`;
      const E = evalGoNoGo(p); const V = p.gonogo.verdict ? VERDICTS_GNG[p.gonogo.verdict.v] : null;
      return titreTuile("🚦", "Go / No-Go", lienTuile("Évaluer", `data-act="pl-vue" data-id="gonogo" data-module="planif"`))
        + `<div class="gng-reco ${V ? V.cls : E.reco.k}" style="padding:10px 12px"><span class="muted">${V ? `Décision du ${fmtDate(p.gonogo.verdict.date)}` : "Recommandation"}</span><b style="font-size:1.05rem">${V ? `${V.emoji} ${V.nom}` : E.reco.lib}</b></div>`
        + `<p class="muted" style="font-size:.84rem;margin:8px 0 0">${esc(j.nom)} le ${fmtDate(j.date)} · ${E.ok.length}/${E.C.length} critères · ${E.anoB} bloquante(s), ${E.anoM} majeure(s)</p>`; };
    // 📝 Réunions & comptes rendus
    T.reunions = () => { if (!p.planning) return titreTuile("📝", "Réunions & comptes rendus") + `<p class="muted">Aucune réunion.</p>`;
      const R = p.planning.reunions.filter(r => !r.annulee && !TYPES_REU[r.type]?.agile);
      const avenir = R.filter(r => r.date >= t).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
      const aRediger = R.filter(r => r.date < t && r.date >= addJ(t, -60) && !r.cr?.diffuseLe);
      return titreTuile("📝", "Réunions & comptes rendus", lienTuile("Ouvrir", `data-act="module" data-id="cr"`))
        + (aRediger.length ? `<div class="kv clic" data-act="module" data-id="cr"><span class="txt-danger">✍️ ${aRediger.length} compte(s) rendu(s) à finaliser</span></div>` : "")
        + (avenir.length ? avenir.map(r => `<div class="av-ligne clic" data-act="cr-ouvrir" data-id="${r.id}" data-module="cr"><span class="av-lib">${fmtCourt(r.date)}</span><span class="av-val"><b>${(TYPES_REU[r.type] || TYPES_REU.libre).emoji} ${esc(titreReu(r, numerosCopil(p.planning)))}</b><small>${heureOk(r.heure).replace(":", "h")}${r.cr ? " · préparation commencée" : ""}</small></span></div>`).join("") : `<p class="muted">Aucune réunion à venir.</p>`); };
    // ⏰ Actions en retard
    T.retard = () => { const R = actionsToutes(p).filter(x => !x.a.fait && x.a.echeance && x.a.echeance < t).sort((a, b) => a.a.echeance.localeCompare(b.a.echeance));
      return titreTuile("⏰", `Actions en retard${R.length ? ` <span class="pill danger">${R.length}</span>` : ""}`, lienTuile("Registre", `data-act="dc-vue" data-id="actions" data-module="decisions"`))
        + (R.length ? R.slice(0, 6).map(x => `<div class="tu-ligne"><button class="check" data-act="dc-fait" data-id="${x.a.id}" aria-label="Marquer comme faite"></button><span class="clic" style="flex:1;min-width:0" data-act="dc-edit" data-id="${x.a.id}"><b>${esc(x.a.texte)}</b><small>${x.a.responsable ? esc(x.a.responsable) + " · " : ""}<span class="txt-danger">${diffJ(x.a.echeance, t)} j de retard</span></small></span></div>`).join("") + (R.length > 6 ? `<p class="muted" style="font-size:.8rem;margin:6px 0 0">… et ${R.length - 6} autre(s)</p>` : "") : `<p class="rp2-ok">Aucune action en retard 👍</p>`); };
    // 🔄 Demandes de changement
    T.changements = () => { const C = changementsDe(p); const O = chgOuverts(p);
      return titreTuile("🔄", "Demandes de changement", lienTuile("Ouvrir", `data-act="dc-vue" data-id="changements" data-module="decisions"`))
        + `<div class="mini-kpis"><div><b>${C.filter(c => c.statut === "analyse").length}</b><span>à analyser</span></div><div class="${C.some(c => c.statut === "arbitrage") ? "warn" : ""}"><b>${C.filter(c => c.statut === "arbitrage").length}</b><span>à arbitrer</span></div><div><b>${C.filter(c => c.statut === "acceptee").length}</b><span>acceptée(s)</span></div></div>`
        + (O.length ? O.slice(0, 3).map(c => `<div class="tu-ligne clic" data-act="chg-edit" data-id="${c.id}" data-module="decisions"><span class="code-pill">${numChg(p, c)}</span><span style="flex:1;min-width:0"><b>${esc(c.titre)}</b><small>${STATUTS_CHG[c.statut].nom}${nbr(c.impacts?.delai) ? ` · ${signe(nbr(c.impacts.delai))} j` : ""}${nbr(c.impacts?.cout) ? ` · ${signe(nbr(c.impacts.cout))} ${uniteBudget(p)}` : ""}</small></span></div>`).join("") : `<p class="muted" style="margin:0">Aucune demande en cours.</p>`); };
    // 📚 Livrables
    T.livrables = () => { const L = livrablesDe(p); const fini = L.filter(d => ["valide", "diffuse"].includes(d.statut));
      const ret = L.filter(d => d.echeance && d.echeance < t && !["valide", "diffuse"].includes(d.statut));
      const proch = L.filter(d => d.echeance && d.echeance >= t && !["valide", "diffuse"].includes(d.statut)).sort((a, b) => a.echeance.localeCompare(b.echeance)).slice(0, 3);
      return titreTuile("📚", "Livrables & docs", lienTuile("Ouvrir", `data-act="module" data-id="livrables"`))
        + `<div class="mini-kpis"><div><b>${L.length}</b><span>documents</span></div><div><b>${fini.length}</b><span>validés ou diffusés</span></div><div class="${ret.length ? "danger" : ""}"><b>${ret.length}</b><span>en retard</span></div></div>`
        + [...ret, ...proch].slice(0, 4).map(d => `<div class="av-ligne"><span class="av-lib ${d.echeance < t ? "txt-danger" : ""}">${fmtJM(d.echeance)}</span><span class="av-val"><b>${esc(d.titre)}</b><small>${STATUTS_DOC[d.statut]?.[0] || ""}${d.responsable ? ` · ${esc(d.responsable)}` : ""}</small></span></div>`).join(""); };
    // 💶 Budget
    T.budget = () => { const B = budgetDe(p); if (!B.lignes.length) return titreTuile("💶", "Budget") + `<p class="muted">Aucun poste budgétaire. <span class="link" data-act="module" data-id="budget">Saisir le budget</span></p>`;
      const X = totauxBudget(p);
      return titreTuile("💶", "Budget", lienTuile("Suivi", `data-act="module" data-id="budget"`))
        + `<div class="av-tete"><b>${Math.round(X.conso * 100)} %</b><span>consommé</span><span class="spacer"></span><span class="av-reste">${fmtB(p, X.consomme)} / ${fmtB(p, X.prevu)}</span></div>`
        + `<div class="progress"><div style="width:${Math.min(100, X.conso * 100)}%"></div></div>`
        + `<div class="av-ligne" style="margin-top:8px"><span class="av-lib">Atterrissage</span><span class="av-val"><b>${fmtB(p, X.atterrissage)}</b><small class="${X.ecart > 0.005 ? "txt-danger" : "txt-ok"}">${X.ecart > 0.005 ? `dépassement de ${fmtB(p, X.ecart)}` : X.ecart < -0.005 ? `économie de ${fmtB(p, -X.ecart)}` : "conforme au prévu"}</small></span></div>`; };
    // 🎓 Retex
    T.tendances = () => titreTuile("📈", "Tendances", lienTuile("Tout voir", `data-act="ck-vue" data-id="tendances"`))
      + `<div class="td-mini">${INDICATEURS.filter(i => ["reel", "critiques", "problemes", "retard"].includes(i.id)).map(i => carteTendance(p, i)).join("") || `<p class="muted">Les tendances se construisent semaine après semaine.</p>`}</div>`;
    // 🧭 Étape du projet
    T.etape = () => {
      const A = etapesActives(p);
      if (!A.length) return titreTuile("🧭", "Étape du projet") + `<p class="muted">Aucune étape choisie. <span class="link" data-act="module" data-id="identite">Les choisir dans la fiche d'identité →</span></p>`;
      const r = rangCourant(p, A); const e = etapeCourante(p); const d = datesEtape(p, e.id); const C = criteresEtape(p, e); const ok = C.filter(c => c.ok).length; const ret = r < A.length ? retardEtape(p, e) : 0;
      return titreTuile("🧭", "Étape du projet", enTimeline(p) ? `<span class="link" data-act="et-voir" data-id="${e.id}">Détail →</span>` : lienTuile("Réglages", `data-act="module" data-id="identite"`))
        + (r >= A.length ? `<p style="margin:0"><b>🏁 Projet clos</b> : toutes les étapes sont terminées.</p>` : `<div class="tu-etape"><span class="tu-etape-ic">${e.emoji}</span><div><b>${esc(e.nom)}</b><small>étape ${r + 1} sur ${A.length} · ${libDates(d)}${d.debut && d.fin && d.debut <= t && t <= d.fin ? ` · J${diffJ(d.debut, t) + 1}/${diffJ(d.debut, d.fin) + 1}` : ""}${ret ? ` · <span class="txt-danger">⏰ +${ret} j</span>` : ""}</small></div></div>`)
        + `<div class="pf-etapes" style="margin:8px 0">${A.map((x, k) => `<span class="${k < r ? "fini" : k === r ? "cours" : ""}" title="${esc(x.nom)}"></span>`).join("")}</div>`
        + (r < A.length && C.length ? `<div class="muted" style="font-size:.82rem;margin-bottom:4px">Pour la terminer : ${ok} / ${C.length} critère(s)</div>${C.map(c => `<div class="tu-crit ${c.ok ? "ok" : ""}">${c.ok ? "✅" : "⬜"} ${esc(c.lib)}</div>`).join("")}` : "")
        + (A[r + 1] ? `<div class="muted" style="font-size:.8rem;margin-top:6px">Ensuite : ${A[r + 1].emoji} ${esc(A[r + 1].nom)}</div>` : "");
    };
    // 💥 Problèmes
    T.problemes = () => { const O = problemesOuverts(p).sort((x, y) => crit(y) - crit(x)); const res = p.risques.filter(r => estProbleme(r) && r.resoluLe).length;
      return titreTuile("💥", `Problèmes${O.length ? ` <span class="pill danger">${O.length}</span>` : ""}`, lienTuile("Ouvrir", `data-act="vue" data-id="problemes" data-module="risques"`))
        + `<div class="mini-kpis" style="grid-template-columns:1fr 1fr"><div class="${O.length ? "danger" : ""}"><b>${O.length}</b><span>ouvert(s)</span></div><div><b>${res}</b><span>résolu(s)</span></div></div>`
        + (O.length ? O.slice(0, 4).map(r => `<div class="tu-ligne clic" data-act="open" data-id="${r.id}"><span>💥</span><span style="flex:1;min-width:0"><b>${esc(r.titre || "Problème")}</b><small>${r.avereLe ? `ouvert depuis ${diffJ(r.avereLe, t)} j` : ""}${r.actions.length ? ` · ${r.actions.filter(x => x.fait).length}/${r.actions.length} action(s)` : " · aucune action"}${r.responsable ? ` · 👤 ${esc(r.responsable)}` : ""}</small></span></div>`).join("")
          : `<p class="muted" style="margin:6px 0 0">🌤️ Aucun problème ouvert.</p>`);
    };
    // 📊 Avancement réel
    T.avreel = () => { const pl = p.planning; const AR = avancementReel(p);
      if (!pl?.methode) return titreTuile("📊", "Avancement réel") + `<p class="muted">Mettez d'abord en place la planification.</p>`;
      if (!AR) return titreTuile("📊", "Avancement réel") + `<p class="muted">Option désactivée. <span class="link" data-act="pl-avreel">Activer l'avancement réel →</span></p>`;
      const barre = (lib, v, cls) => `<div class="tu-av"><span>${lib}</span><span class="tu-av-b"><i class="${cls}" style="width:${Math.round(v * 100)}%"></i></span><b>${Math.round(v * 100)} %</b></div>`;
      return titreTuile("📊", "Avancement réel", lienTuile("Saisir", `data-act="pl-vue" data-id="jalons" data-module="planif"`))
        + barre("Réalisé", AR.reel, AR.reel < AR.prevu - .03 ? "retard" : "ok") + barre("Prévu", AR.prevu, "prevu")
        + `<p style="margin:6px 0 8px;font-size:.88rem">${libEcartAv(AR)}</p>`
        + (AR.source === "phases" ? pl.phases.filter(ph => ph.debut && ph.fin).map(ph => `<div class="tu-ph"><span>${esc(tronque(ph.nom, 22))}</span><span class="ph-barre"><i style="width:${Math.min(100, +ph.reel || 0)}%"></i><b style="left:${Math.round(prevuPhase(ph) * 100)}%"></b></span><small>${+ph.reel || 0} %</small></div>`).join("") : `<p class="muted" style="font-size:.8rem;margin:0">D'après le backlog importé.</p>`);
    };
    // 🎯 Objectifs du projet
    T.objectifs = () => { const O = lignes(p.objectifs).length ? objectifsSuivis(p) : []; const nOk = O.filter(o => o.statut === "ok").length;
      return titreTuile("🎯", `Objectifs${O.length ? ` <span class="pill ${nOk === O.length ? "ok" : "soft"}">${nOk}/${O.length}</span>` : ""}`, p.planning?.methode ? lienTuile("Mettre à jour", `data-act="pl-vue" data-id="gonogo" data-module="planif"`) : "")
        + (O.length ? O.map(o => `<div class="tu-ligne"><span>${o.statut ? ETATS_OBJ[o.statut][0] : "⚪"}</span><span style="flex:1;min-width:0"><b>${esc(o.texte)}</b><small>${o.cible ? `cible ${esc(o.cible)}` : "cible à définir"}${o.actuel ? ` · aujourd'hui : ${esc(o.actuel)}` : ""}</small></span></div>`).join("")
          : `<p class="muted">Aucun objectif mesurable. <span class="link" data-act="module" data-id="identite">Les ajouter dans la fiche →</span></p>`);
    };
    // ⏱️ Temps passé
    T.temps = () => {
      if (!opt(p, "charge")) return titreTuile("⏱️", "Temps passé") + `<p class="muted">Activez le module « Charge » dans la fiche d'identité pour suivre les jours prévus et passés.</p>`;
      const mois = t.slice(0, 7); const P = chargeDe(p), Rl = chargeReelDe(p); const I = p.interlocuteurs;
      const somme = (C, f) => I.reduce((n, i) => n + Object.entries(C[i.id] || {}).filter(([m]) => f(m)).reduce((k, [, v]) => k + num(v), 0), 0);
      const passe = somme(Rl, () => true); const prevuAuj = somme(P, m => m <= mois); const prevuTot = somme(P, () => true);
      const ecarts = I.map(i => { const r = Object.entries(Rl[i.id] || {}).reduce((n, [, v]) => n + num(v), 0); const pv = Object.entries(P[i.id] || {}).filter(([m]) => Rl[i.id]?.[m] != null).reduce((n, [, v]) => n + num(v), 0); return { i, ec: r - pv }; }).filter(x => Math.abs(x.ec) >= 1).sort((x, y) => y.ec - x.ec);
      const fj = v => new Intl.NumberFormat("fr-FR").format(Math.round(v * 10) / 10);
      return titreTuile("⏱️", "Temps passé", lienTuile("Saisir", `data-act="pp-chvue" data-id="reel" data-module="identite"`))
        + `<div class="mini-kpis"><div><b>${fj(passe)} j</b><span>passés</span></div><div><b>${fj(prevuAuj)} j</b><span>prévus à ce jour</span></div><div class="${passe > prevuAuj + 1 ? "danger" : ""}"><b>${prevuTot ? Math.round(passe / prevuTot * 100) : 0} %</b><span>du prévu total (${fj(prevuTot)} j)</span></div></div>`
        + (ecarts.length ? ecarts.slice(0, 4).map(x => `<div class="tu-ligne"><span>👤</span><span style="flex:1;min-width:0"><b>${esc(personne(x.i.personneId)?.nom || "?")}</b><small>${esc(x.i.role)}</small></span><span class="${x.ec > 0 ? "txt-danger" : "txt-ok"}">${x.ec > 0 ? "+" : ""}${fj(x.ec)} j</span></div>`).join("")
          : `<p class="muted" style="font-size:.84rem;margin:6px 0 0">${passe ? "Pas d'écart notable avec le prévu." : "Aucun temps saisi pour l'instant."}</p>`);
    };
    // ✅ Réunions à préparer (15 prochains jours)
    T.preparation = () => { const pl = p.planning; const nums = pl ? numerosCopil(pl) : new Map();
      const L = (pl?.reunions || []).filter(r => !r.annulee && r.date > t && r.date <= addJ(t, 15) && !(TYPES_REU[r.type]?.agile)).sort((x, y) => x.date.localeCompare(y.date));
      const pretes = L.filter(r => r.prepareeLe).length;
      return titreTuile("✅", `Réunions à préparer${L.length ? ` <span class="pill ${pretes === L.length ? "ok" : "soft"}">${pretes}/${L.length} prête(s)</span>` : ""}`, lienTuile("Toutes", `data-act="in-vue" data-id="reunions" data-module="instances"`))
        + (L.length ? L.slice(0, 6).map(r => { const [lib, cls] = statutCR(r); const T2 = TYPES_REU[r.type] || TYPES_REU.libre; return `<div class="tu-ligne clic" data-act="cr-ouvrir" data-id="${r.id}" data-module="instances"><span class="date-chip" style="font-size:.72rem;padding:3px 6px">${fmtJM(r.date)}</span><span style="flex:1;min-width:0"><b>${T2.emoji} ${esc(titreReu(r, nums))}</b></span><span class="pill ${cls}">${lib}</span></div>`; }).join("")
          : `<p class="muted">Aucune réunion dans les 15 prochains jours (hors cérémonies agiles).</p>`);
    };
    T.retex = () => { const R = retexDe(p);
      return titreTuile("🎓", "Retex", lienTuile("Ouvrir", `data-act="module" data-id="retex"`))
        + `<div class="mini-kpis" style="grid-template-columns:1fr 1fr"><div><b>${R.filter(x => x.nature === "positif").length}</b><span>bien marché</span></div><div><b>${R.filter(x => x.nature !== "positif").length}</b><span>à améliorer</span></div></div>`
        + (R.length ? R.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 3).map(x => `<div class="tu-ligne"><span>${x.nature === "positif" ? "👍" : "🔧"}</span><span style="flex:1;min-width:0"><b>${esc(x.constat)}</b><small>${esc(x.categorie)}</small></span></div>`).join("") : `<p class="muted" style="margin:0">Aucun enseignement pour l'instant.</p>`); };
    // 📌 À faire aujourd'hui (pour ce projet)
    T.aujourdhui = () => {
      const X = aFaireAujourdhui().find(x => x.p.id === p.id);
      const go = (k, id) => `data-act="aj-go" data-p="${p.id}" data-k="${k}" data-id="${id}"`;
      const ligne = (k, id, ic, txt, sous, pill = "") => `<div class="tu-ligne clic" ${go(k, id)}><span>${ic}</span><span style="flex:1;min-width:0"><b>${txt}</b>${sous ? `<small>${sous}</small>` : ""}</span>${pill}</div>`;
      const action = x => `<div class="tu-ligne"><button class="check" data-act="dc-fait" data-id="${x.a.id}" aria-label="Marquer comme faite"></button><span class="clic" style="flex:1;min-width:0" data-act="dc-edit" data-id="${x.a.id}"><b>${esc(x.a.texte)}</b><small>${x.a.responsable ? esc(x.a.responsable) + " · " : ""}${x.a.echeance < t ? `<span class="txt-danger">${diffJ(x.a.echeance, t)} j de retard</span>` : "aujourd'hui"}</small></span></div>`;
      const L = X ? [
        ...X.reunions.map(({ r, titre }) => ligne("reunion", r.id, (TYPES_REU[r.type] || TYPES_REU.libre).emoji, `${heureOk(r.heure).replace(":", "h")} · ${esc(titre)}`, "Réunion aujourd'hui")),
        ...X.jalons.map(j => ligne("jalon", j.id, "◆", esc(j.nom), "Jalon prévu aujourd'hui")),
        ...X.retard.map(action), ...X.jour.map(action),
        ...X.crs.map(({ r, titre }) => ligne("cr", r.id, "📝", `${r.cr ? "Finaliser" : "Rédiger"} le CR · ${esc(titre)}`, `Réunion du ${fmtDate(r.date)}`)),
        ...X.statuer.map(({ r, titre }) => ligne("statuer", r.id, "⚖️", `Statuer sur le ${esc(titre)}`, "")),
        ...X.gng.map(j => ligne("gonogo", j.id, "🚦", "Préparer le Go / No-Go", `Mise en production le ${fmtDate(j.date)}`)),
        ...X.flash.map(() => ligne("flash", "x", "📰", "Envoyer le flash report", "Rappel du vendredi")),
        ...X.docs.map(d => ligne("livrable", d.id, "📚", esc(d.titre), STATUTS_DOC[d.statut]?.[0] || "")),
        ...X.revues.map(r => ligne("risque", r.id, "🔁", `Revoir le risque ${esc(r.titre)}`, `Revue prévue le ${fmtDate(r.revue)}`)),
      ] : [];
      return titreTuile("📌", `À faire aujourd'hui${L.length ? ` <span class="pill danger">${L.length}</span>` : ""}`, `<span class="muted" style="font-size:.8rem">${fmtCourt(t)}</span>`)
        + (L.length ? L.slice(0, 8).join("") + (L.length > 8 ? `<p class="muted" style="font-size:.8rem;margin:6px 0 0">… et ${L.length - 8} autre(s) · <span class="link" data-act="aujourdhui">tout voir</span></p>` : "") : `<p class="rp2-ok">Rien d'urgent aujourd'hui sur ce projet 🌤️</p>`);
    };
    // 📰 Flash report
    T.flash = () => { const L = lundiDe(t); const F = p.flash?.[L]; const m = F?.meteo?.global;
      return titreTuile("📰", "Flash report", lienTuile(F?.envoyeLe ? "Voir" : "Préparer", `data-act="ck-vue" data-id="flash"`))
        + `<div class="av-tete"><b>${m ? METEO[m][0] : "—"}</b><span>${m ? METEO[m][1] : "Météo de la semaine à renseigner"}</span></div>`
        + `<p style="margin:6px 0 0;font-size:.88rem">${F?.envoyeLe ? `<span class="rp2-ok">✓ Envoyé le ${fmtDate(F.envoyeLe)}</span>` : `<span class="muted">Semaine du ${fmtDate(L)} · pas encore envoyé${p.flashRappel ? " · rappel le vendredi" : ""}</span>`}</p>`; };
    return T;
  }

  function grilleTuiles(p, existantes) {
    const plus = tuilesEnPlus(p); const D = dispoTuiles();
    const visible = id => { const d = TUILES.find(t => t.id === id); return d && moduleActif(p, d.brique); };
    const html = id => existantes[id] ?? `<div class="panel">${plus[id] ? plus[id]() : ""}</div>`;
    const ctrl = (id, ci, k, nb) => ui.ckPerso ? `<div class="tuile-ctrl"><span class="tuile-poignee" title="Glissez pour déplacer">⠿</span><span class="spacer"></span>
        <button data-act="tu-dep" data-id="${id}" data-dir="g" title="Colonne de gauche" ${ci === 0 ? "disabled" : ""}>‹</button><button data-act="tu-dep" data-id="${id}" data-dir="h" title="Monter" ${k === 0 ? "disabled" : ""}>˄</button><button data-act="tu-dep" data-id="${id}" data-dir="b" title="Descendre" ${k === nb - 1 ? "disabled" : ""}>˅</button><button data-act="tu-dep" data-id="${id}" data-dir="d" title="Colonne de droite" ${ci === D.n - 1 ? "disabled" : ""}>›</button>
        <button data-act="tu-suppr" data-id="${id}" title="Retirer cette tuile">✕</button></div>` : "";
    const tuile = (id, ci, k, nb) => html(id).replace(/^\s*<div class="panel"/, `<div class="panel tuile ${ui.ckPerso ? "tuile-edit" : ""}" data-tuile="${id}" ${ui.ckPerso ? `draggable="true"` : ""}`).replace(/^([^>]*>)/, `$1${ctrl(id, ci, k, nb)}`);
    const nbVisibles = D.cols.flat().filter(visible).length;
    return `
      <div class="row cp-tools" style="margin:-4px 0 12px;justify-content:flex-end;gap:8px;flex-wrap:wrap">
        ${ui.ckPerso ? `<span class="muted" style="font-size:.84rem;margin-right:auto">Glissez une tuile (poignée ⠿) où vous voulez, dans n'importe quelle colonne, ou utilisez ‹ ˄ ˅ ›.</span>
          <span class="row" style="gap:6px;font-size:.84rem">Colonnes <span class="seg2 tu-nbcols">${[1, 2, 3, 4].map(n => `<button class="${D.n === n ? "on" : ""}" data-act="tu-cols" data-id="${n}">${n}</button>`).join("")}</span></span>
          <button class="btn ghost small" data-act="tu-defaut">↺ Par défaut</button><button class="btn ghost small" data-act="tu-ajout">＋ Ajouter une tuile</button><button class="btn small" data-act="tu-perso">✓ Terminé</button>`
          : `<button class="btn ghost small" data-act="tu-rapport" title="Un fichier HTML en lecture seule, à envoyer au sponsor ou à déposer sur Teams">📤 Rapport à partager</button><button class="btn ghost small" data-act="tu-perso">⚙️ Personnaliser</button>`}
      </div>
      ${nbVisibles || ui.ckPerso ? `<div class="dash-cols ${ui.ckPerso ? "edit" : ""}" style="--n:${D.n}">${D.cols.map((col, ci) => { const V = col.filter(visible); return `<div class="dash-col" data-col="${ci}">${V.map((id, k) => tuile(id, ci, k, V.length)).join("")}${ui.ckPerso ? `<div class="dash-col-fin">${V.length ? "" : "Déposez une tuile ici"}</div>` : ""}</div>`; }).join("")}</div>` : ""}
      ${ui.ckPerso || !nbVisibles ? `<button class="panel tuile-plus" data-act="tu-ajout" style="width:100%;margin-top:16px"><span>＋</span>Ajouter une tuile</button>` : ""}`;
  }

  // Glisser-déposer : on attrape une tuile et on la lâche sur une autre ; elle prend sa place
  // Déplacement des tuiles : la tuile saisie se place, en direct, dans la colonne survolée et à la hauteur du pointeur ;
  // les autres glissent à leur nouvelle place (animation) ; la disposition est enregistrée au lâcher.
  let tuileGlissee = null, deposee = false;
  function animerTuiles(changer) {
    const T = $$(".dash-cols .tuile"); const avant = new Map(T.map(t => [t, t.getBoundingClientRect()]));
    changer();
    T.forEach(t => {
      const a = avant.get(t), b = t.getBoundingClientRect(); const dx = a.left - b.left, dy = a.top - b.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      t.style.transition = "none"; t.style.transform = `translate(${dx}px, ${dy}px)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { t.style.transition = "transform .28s cubic-bezier(.2, .8, .2, 1)"; t.style.transform = ""; }));
    });
  }
  // disposition lue à l'écran (les tuiles masquées, d'un module désactivé, restent dans leur colonne)
  function dispoDeLaGrille() {
    const D = dispoTuiles(); const vus = new Set($$(".dash-cols .tuile").map(t => t.dataset.tuile));
    return { n: D.n, cols: $$(".dash-cols .dash-col").map((c, i) => [...[...c.querySelectorAll(":scope > .tuile")].map(t => t.dataset.tuile), ...(D.cols[i] || []).filter(id => !vus.has(id))]) };
  }
  document.addEventListener("dragstart", e => {
    const t = e.target.closest?.(".tuile-edit"); if (!t) return;
    tuileGlissee = t.dataset.tuile; deposee = false;
    e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", tuileGlissee); } catch (_) {}
    setTimeout(() => { t.classList.add("glisse"); $(".dash-cols")?.classList.add("tri"); }, 0); // après la capture de l'image fantôme
  });
  document.addEventListener("dragover", e => {
    if (!tuileGlissee) return;
    const col = e.target.closest?.(".dash-col"); if (!col) return;
    e.preventDefault(); e.dataTransfer.dropEffect = "move";
    const g = $(`.dash-cols [data-tuile="${tuileGlissee}"]`); if (!g) return;
    // place d'insertion : avant la première tuile de la colonne dont le milieu est sous le pointeur
    const autres = [...col.querySelectorAll(":scope > .tuile")].filter(t => t !== g);
    const avant = autres.find(t => { const r = t.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; }) || col.querySelector(":scope > .dash-col-fin");
    if (g.parentElement === col && (g.nextElementSibling === avant || (!avant && !g.nextElementSibling))) return; // déjà à cette place
    animerTuiles(() => { if (avant) col.insertBefore(g, avant); else col.appendChild(g); });
  });
  document.addEventListener("drop", e => {
    if (!tuileGlissee || !e.target.closest?.(".dash-cols")) return;
    e.preventDefault(); deposee = true; enregistrerDispo(dispoDeLaGrille());
  });
  document.addEventListener("dragend", () => {
    if (!tuileGlissee) return;
    const ok = deposee; tuileGlissee = null;
    $$(".tuile.glisse").forEach(x => x.classList.remove("glisse")); $(".dash-cols")?.classList.remove("tri");
    setTimeout(render, ok ? 300 : 0); // lâché hors de la grille : retour à la disposition enregistrée
  });

  function ouvrirCatalogueTuiles() {
    const p = proj(); const choisies = tuilesChoisies();
    const groupes = MODULES.filter(m => TUILES.some(t => t.brique === m.id)).map(m => ({ m, L: TUILES.filter(t => t.brique === m.id) }));
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">＋ Ajouter une tuile</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <p class="muted" style="margin:0">Au moins une tuile par brique du cockpit. Les tuiles s'ajoutent à la fin ; déplacez-les ensuite avec ‹ ›.</p>
        ${groupes.map(({ m, L }) => `<div><h4 class="tu-cat">${m.emoji} ${m.nom}${moduleActif(p, m.id) ? "" : ` <span class="muted" style="font-weight:400">· module désactivé pour ce projet</span>`}</h4>
          ${L.map(t => { const on = choisies.includes(t.id); return `<div class="tu-choix ${on ? "on" : ""}"><span class="tu-ic">${t.emoji}</span><div style="flex:1;min-width:0"><b>${t.nom}</b><div class="muted" style="font-size:.8rem">${t.desc}</div></div>
            ${on ? `<button class="btn ghost small" data-act="tu-suppr" data-id="${t.id}" data-modal="1">✓ Affichée · retirer</button>` : `<button class="btn small" data-act="tu-plus" data-id="${t.id}">＋ Ajouter</button>`}</div>`; }).join("")}</div>`).join("")}
      </div>
      <div class="modal-foot"><span class="muted" style="font-size:.82rem">Votre sélection vaut pour tous vos projets.</span><button class="btn" data-act="close-modal">Fermer</button></div>`);
  }

  document.addEventListener("click", e => {
    const el = e.target.closest?.("[data-act]"); if (!el || !/^tu-/.test(el.dataset.act)) return;
    e.stopPropagation();
    const { act, id } = el.dataset; let L = tuilesChoisies().slice();
    switch (act) {
      case "tu-rapport": ouvrirRapportPartage(proj()); return;
      case "tu-perso": ui.ckPerso = !ui.ckPerso; render(); return;
      case "tu-ajout": ouvrirCatalogueTuiles(); return;
      case "tu-plus": { const D = dispoTuiles(); if (!D.cols.flat().includes(id)) { const c = D.cols.reduce((m, x, i) => x.length < D.cols[m].length ? i : m, 0); D.cols[c].push(id); } enregistrerDispo(D); render(); ouvrirCatalogueTuiles(); toast("＋ Tuile ajoutée en bas de la colonne la plus courte"); return; }
      case "tu-suppr": { const D = dispoTuiles(); D.cols = D.cols.map(c => c.filter(x => x !== id)); enregistrerDispo(D); render(); if (el.dataset.modal) ouvrirCatalogueTuiles(); return; }
      case "tu-cols": { const D = dispoTuiles(); const n = +id; const cols = Array.from({ length: n }, (_, i) => D.cols[i] ? D.cols[i].slice() : []); D.cols.slice(n).forEach(c => cols[n - 1].push(...c)); enregistrerDispo({ n, cols }); render(); return; }
      case "tu-dep": {
        const t = $(`.dash-cols [data-tuile="${id}"]`); if (!t) return; const dir = el.dataset.dir; const col = t.parentElement;
        animerTuiles(() => {
          if (dir === "h") { const v = t.previousElementSibling; if (v?.classList.contains("tuile")) v.before(t); }
          else if (dir === "b") { const v = t.nextElementSibling; if (v?.classList.contains("tuile")) v.after(t); }
          else { const cible = dir === "g" ? col.previousElementSibling : col.nextElementSibling; if (!cible) return; const k = [...col.querySelectorAll(":scope > .tuile")].indexOf(t); const L = cible.querySelectorAll(":scope > .tuile"); cible.insertBefore(t, L[k] || cible.querySelector(":scope > .dash-col-fin")); }
        });
        enregistrerDispo(dispoDeLaGrille()); setTimeout(render, 300); return;
      }
      case "tu-defaut": if (!confirm("Revenir aux 6 tuiles par défaut, sur 3 colonnes ?")) return; S.tuiles = null; enregistrerDispo(dispoTuiles()); render(); return;
    }
  }, true);

  // ═══════════════ Vue : Tableau de bord
  function vueDashboard() {
    const p = proj(); const rs = p.risques;
    const ouverts = rs.filter(r => !CLOS.has(r.statut));
    const critiques = ouverts.filter(r => crit(r) >= 6);
    const actions = rs.flatMap(r => r.actions.map(a => ({ a, r })));
    const faites = actions.filter(x => x.a.fait).length;
    const retard = actions.filter(x => !x.a.fait && x.a.echeance && x.a.echeance < today());
    const leves = rs.filter(r => r.statut === "leve").length;

    const parCat = CATS.map(c => ({ c, n: ouverts.filter(r => r.cat === c.id).length })).filter(x => x.n).sort((a, b) => b.n - a.n);
    const maxCat = Math.max(1, ...parCat.map(x => x.n));
    const top = [...ouverts].sort((a, b) => crit(b) - crit(a)).slice(0, 6);
    const niveaux = ["critique", "eleve", "modere", "faible"].map(n => ({ n, nb: ouverts.filter(r => niveau(crit(r)) === n).length }));

    return `
      <div class="project-header">
        <div class="project-emoji" style="background:${p.couleur}22" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div>
        <div><h2 style="margin:0">${esc(p.nom)}</h2><div class="muted">${esc(p.description) || "Projet créé le " + fmtDate(p.creeLe)}</div></div>
      </div>
      <div class="kpis">
        <div class="kpi" role="button" tabindex="0" data-act="kpi" data-id="ouverts" title="Voir ces risques dans la matrice" style="--k:#7466c4"><div class="kpi-num">${ouverts.length}</div><div class="kpi-lbl">risques ouverts</div></div>
        <div class="kpi" role="button" tabindex="0" data-act="kpi" data-id="critiques" title="Voir ces risques dans la matrice" style="--k:#c9665f"><div class="kpi-num">${critiques.length}</div><div class="kpi-lbl">élevés ou critiques</div></div>
        <div class="kpi" role="button" tabindex="0" data-act="kpi" data-id="retard" title="Voir ces risques dans la matrice" style="--k:#b9789a"><div class="kpi-num">${retard.length}</div><div class="kpi-lbl">actions en retard</div></div>
        <div class="kpi" role="button" tabindex="0" data-act="kpi" data-id="faites" title="Voir ces risques dans la matrice" style="--k:#5f9e76"><div class="kpi-num">${actions.length ? Math.round(faites / actions.length * 100) : 0}%</div><div class="kpi-lbl">actions réalisées (${faites}/${actions.length})</div></div>
        <div class="kpi" role="button" tabindex="0" data-act="kpi" data-id="leves" title="Voir ces risques dans la matrice" style="--k:#5a9fc9"><div class="kpi-num">${leves}</div><div class="kpi-lbl">risques levés</div></div>
      </div>
      ${rs.length === 0 ? `<div class="empty"><span class="big">🧺</span>Ton projet est vide. Va dans le <span class="link" data-act="vue" data-id="catalogue">catalogue</span> pour y glisser des risques !</div>` : `
      <div class="dash-grid">
        <div class="panel">
          <div class="row" style="margin-bottom:8px"><h3 style="margin:0">🎯 Matrice des risques ouverts</h3><span class="spacer"></span><span class="link" data-act="vue" data-id="matrice">Ouvrir la matrice →</span></div>
          ${miniMatrice(ouverts)}
        </div>
        <div class="panel">
          <h3>🔥 Top risques à surveiller</h3>
          ${top.length ? top.map(r => `
            <div class="top-item" data-act="open" data-id="${r.id}">
              <div class="crit ${niveau(crit(r))}">${crit(r)}</div>
              <div style="flex:1"><b>${esc(r.titre) || "<i>Sans titre</i>"}</b><div class="row" style="margin-top:3px">${catTag(r.cat)} ${statutTag(r.statut)}</div></div>
            </div>`).join("") : `<p class="muted">Aucun risque ouvert 🎉</p>`}
        </div>
        <div class="panel">
          <h3>🌡️ Niveaux de criticité (risques ouverts)</h3>
          ${niveaux.map(x => `<div class="bar-row"><span>${NIV_NOM[x.n]}</span><div class="bar-track"><div class="bar-fill" style="width:${ouverts.length ? x.nb / ouverts.length * 100 : 0}%;background:var(--${x.n})"></div></div><b>${x.nb}</b></div>`).join("")}
          <h3 style="margin-top:20px">🧩 Par catégorie</h3>
          ${parCat.map(x => `<div class="bar-row"><span>${x.c.emoji} ${esc(x.c.nom)}</span><div class="bar-track"><div class="bar-fill" style="width:${x.n / maxCat * 100}%;background:${x.c.couleur}"></div></div><b>${x.n}</b></div>`).join("") || `<p class="muted">—</p>`}
        </div>
        <div class="panel">
          <h3>⏰ Actions en retard</h3>
          ${retard.length ? retard.slice(0, 8).map(({ a, r }) => `
            <div class="top-item" data-act="open" data-id="${r.id}">
              <span style="font-size:1.4rem">⏰</span>
              <div style="flex:1"><b>${esc(a.texte)}</b><div class="muted" style="font-size:.85rem">${esc(r.titre)} · échéance ${fmtDate(a.echeance)}${a.responsable ? " · " + esc(a.responsable) : ""}</div></div>
            </div>`).join("") : `<p class="muted">Rien en retard, bravo ! 🌈</p>`}
        </div>
      </div>`}`;
  }

  function miniMatrice(rs) {
    let h = "";
    for (let pr = 3; pr >= 1; pr--) {
      h += `<div class="mm-axis" title="Probabilité ${PROBA[pr][0]}">P${pr}</div>`;
      for (let g = 1; g <= 3; g++) {
        const inCell = rs.filter(r => r.p === pr && r.g === g);
        h += `<div class="mm-cell cell ${niveau(pr * g)}">
          ${inCell.length ? `<span class="mm-count">${inCell.length}</span>` : ""}
          <div class="mm-dots">${inCell.map(r => `<span class="mm-dot" style="--c:${CAT[r.cat].couleur}" data-act="open" data-id="${r.id}" title="R${numero(r)} · ${esc(r.titre)}">${numero(r)}</span>`).join("")}</div>
        </div>`;
      }
    }
    h += `<div></div>` + [1, 2, 3].map(g => `<div class="mm-axis" title="Gravité ${GRAV[g][0]}">G${g}</div>`).join("");
    return `<div class="mini-matrix">${h}</div>
      <div class="muted" style="font-size:.78rem;margin-top:6px">Probabilité ↑ × Gravité → · clique sur une pastille pour ouvrir le risque</div>`;
  }

  // ═══════════════ Vue : Catalogue
  function vueCatalogue() {
    const p = proj();
    const chips = [`<button class="chip ${ui.cat === "all" ? "on" : ""}" data-act="cat" data-id="all" title="Toutes les catégories">🌈 Toutes <span class="n">${window.CATALOGUE.length}</span></button>`]
      .concat(CATS.map(c => `<button class="chip ${ui.cat === c.id ? "on" : ""}" style="--c:${c.couleur}" data-act="cat" data-id="${c.id}" title="${esc(c.nom)}">${c.emoji} ${esc(c.court || c.nom)} <span class="n">${window.CATALOGUE.filter(r => r.cat === c.id).length}</span></button>`)).join("");
    return `
      <div class="cat-layout">
        <section>
          <div class="toolbar">
            <input class="search" id="search" type="search" placeholder="🔎 Rechercher un risque (mot-clé, ex : RGPD, migration, départ…)" value="${esc(ui.q)}">
          </div>
          <div class="chips-scroll">
            <button class="chips-arrow left" data-act="chips-scroll" data-id="-1" aria-label="Catégories précédentes">‹</button>
            <div class="chips-track" id="catChips">${chips}</div>
            <button class="chips-arrow right" data-act="chips-scroll" data-id="1" aria-label="Catégories suivantes">›</button>
          </div>
          <div id="catList"></div>
        </section>
        <aside class="dropzone" id="dropzone">
          <div class="dz-head">
            <div class="project-emoji" style="width:44px;height:44px;font-size:1.6rem;background:${p.couleur}22" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div>
            <div style="flex:1"><b>${esc(p.nom)}</b><div class="muted" style="font-size:.85rem">${p.risques.length} risque(s) sélectionné(s)</div></div>
          </div>
          <div class="dz-hint"><span class="big">🧺</span>Glisse-dépose des risques ici</div>
          <div class="dz-list">
            ${[...p.risques].reverse().map(r => `
              <div class="dz-item" style="--c:${CAT[r.cat].couleur}">
                <span>${CAT[r.cat].emoji}</span><span class="t" data-act="open" data-id="${r.id}">${esc(r.titre) || "<i>Sans titre</i>"}</span>
                <button data-act="remove" data-id="${r.id}" title="Retirer du projet">✕</button>
              </div>`).join("")}
          </div>
          <div class="row" style="margin-top:12px">
            <button class="btn small ghost" data-act="perso">✍️ Risque personnalisé</button>
            <span class="spacer"></span>
            <button class="btn small" data-act="vue" data-id="registre">Voir le registre →</button>
          </div>
        </aside>
      </div>`;
  }

  function renderCatList() {
    const box = $("#catList"); if (!box) return;
    const p = proj();
    const dejaRefs = new Map();
    p.risques.forEach(r => r.refId && dejaRefs.set(r.refId, (dejaRefs.get(r.refId) || 0) + 1));
    const q = ui.q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const match = r => !q || (r.titre + " " + r.description + " " + r.impact + " " + CAT[r.cat].nom).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q);
    const groups = CATS.filter(c => ui.cat === "all" || ui.cat === c.id).map(c => ({ c, items: window.CATALOGUE.filter(r => r.cat === c.id && match(r)) })).filter(g => g.items.length);
    box.innerHTML = groups.length ? groups.map(({ c, items }) => `
      <div class="cat-group">
        <div class="cat-group-title"><span class="em" style="--c:${c.couleur}">${c.emoji}</span><h3 style="margin:0">${esc(c.nom)}</h3><span class="pill count-pill">${items.length}</span></div>
        <div class="cards">
          ${items.map(r => {
            const n = dejaRefs.get(r.id) || 0;
            return `<div class="rcard ${n ? "added" : ""}" draggable="true" data-ref="${r.id}" style="--c:${c.couleur}">
              <div class="rcard-title">${esc(r.titre)}</div>
              <div class="rcard-desc">${esc(r.description)}</div>
              <div class="rcard-foot">
                <span class="mini-score" title="Probabilité suggérée">P${r.p}</span>
                <span class="mini-score" title="Gravité suggérée">G${r.g}</span>
                <span class="crit ${niveau(r.p * r.g)}" style="width:26px;height:26px;font-size:.85rem;border-radius:8px">${r.p * r.g}</span>
                <span class="spacer"></span>
                ${n ? `<span class="pill" style="background:#dcfce7;color:#166534">✓ ${n > 1 ? n + "×" : "ajouté"}</span>` : ""}
                <button class="btn small" data-act="add" data-id="${r.id}" title="Ajouter au projet">＋</button>
              </div>
            </div>`;
          }).join("")}
        </div>
      </div>`).join("") : `<div class="empty"><span class="big">🕵️</span>Aucun risque ne correspond à ta recherche.</div>`;
  }

  // Ligne de catégories défilante : flèches visibles seulement s'il reste des catégories à voir
  function initChips() {
    const t = $("#catChips"); if (!t) return;
    const maj = () => {
      const box = t.parentElement;
      box.classList.toggle("can-left", t.scrollLeft > 2);
      box.classList.toggle("can-right", t.scrollLeft + t.clientWidth < t.scrollWidth - 2);
    };
    t.addEventListener("scroll", maj, { passive: true });
    t.addEventListener("wheel", e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { t.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    window.addEventListener("resize", maj);
    $(".chip.on", t)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    maj();
  }

  // ═══════════════ Vue : Registre
  function vueRegistre() {
    const p = proj();
    let rs = [...p.risques];
    if (ui.statutFiltre === "ouverts") rs = rs.filter(r => !CLOS.has(r.statut));
    else if (ui.statutFiltre !== "tous") rs = rs.filter(r => r.statut === ui.statutFiltre);
    if (ui.catReg !== "all") rs = rs.filter(r => r.cat === ui.catReg);
    const tri = {
      crit: (a, b) => crit(b) - crit(a),
      cat: (a, b) => CATS.findIndex(c => c.id === a.cat) - CATS.findIndex(c => c.id === b.cat) || crit(b) - crit(a),
      num: (a, b) => numero(a) - numero(b),
      avancement: (a, b) => progression(a) - progression(b),
    }[ui.tri];
    rs.sort(tri);

    const filtres = [{ id: "ouverts", nom: "Ouverts", emoji: "🔓", c: "#7466c4" }, { id: "tous", nom: "Tous", emoji: "🌈", c: "#334155" }, ...STATUTS];
    const catsPresentes = CATS.filter(c => p.risques.some(r => r.cat === c.id));
    return `
      <div class="toolbar">
        <h2 style="margin:0">📋 Registre des risques</h2>
        <span class="spacer"></span>
        <select class="btn ghost" id="triSel" aria-label="Trier">
          <option value="crit" ${ui.tri === "crit" ? "selected" : ""}>Trier : criticité ↓</option>
          <option value="cat" ${ui.tri === "cat" ? "selected" : ""}>Trier : catégorie</option>
          <option value="num" ${ui.tri === "num" ? "selected" : ""}>Trier : numéro</option>
          <option value="avancement" ${ui.tri === "avancement" ? "selected" : ""}>Trier : avancement actions</option>
        </select>
        <button class="btn ghost" data-act="csv">📊 Export CSV</button>
        <button class="btn" data-act="perso">✍️ Risque personnalisé</button>
      </div>
      <div class="chips">${filtres.map(s => `<button class="chip ${ui.statutFiltre === s.id ? "on" : ""}" style="--c:${s.c}" data-act="statutF" data-id="${s.id}">${s.emoji} ${s.nom}</button>`).join("")}</div>
      ${catsPresentes.length > 1 ? `<div class="chips"><button class="chip ${ui.catReg === "all" ? "on" : ""}" data-act="catReg" data-id="all">Toutes catégories</button>${catsPresentes.map(c => `<button class="chip ${ui.catReg === c.id ? "on" : ""}" style="--c:${c.couleur}" data-act="catReg" data-id="${c.id}">${c.emoji} ${esc(c.nom)}</button>`).join("")}</div>` : ""}
      ${p.risques.length === 0 ? `<div class="empty"><span class="big">🧺</span>Aucun risque dans ce projet. <span class="link" data-act="vue" data-id="catalogue">Ouvrir le catalogue</span></div>`
        : rs.length === 0 ? `<div class="empty"><span class="big">🔍</span>Aucun risque pour ce filtre.</div>`
        : `<div class="reg-grid">${rs.map(regCard).join("")}</div>`}`;
  }

  function progression(r) { return r.actions.length ? r.actions.filter(a => a.fait).length / r.actions.length : 0; }

  function tendance(r) {
    const d = crit(r) - (r.initial?.c ?? crit(r));
    if (d < 0) return `<span class="trend down" title="Criticité initiale : ${r.initial.c}">▼ ${-d}</span>`;
    if (d > 0) return `<span class="trend up" title="Criticité initiale : ${r.initial.c}">▲ ${d}</span>`;
    return "";
  }

  function regCard(r) {
    const c = CAT[r.cat]; const pr = progression(r); const done = r.actions.filter(a => a.fait).length;
    return `<div class="reg-card ${CLOS.has(r.statut) ? "closed" : ""}" style="--c:${c.couleur}" data-act="open" data-id="${r.id}">
      <div class="reg-top">
        <div class="crit ${niveau(crit(r))} ${r.critForce ? "forced" : ""}" title="Criticité ${NIV_NOM[niveau(crit(r))]}">${crit(r)}</div>
        <div style="flex:1">
          <div class="muted" style="font-size:.75rem;font-weight:800">R${numero(r)} ${tendance(r)}</div>
          <div class="reg-title">${esc(r.titre) || "<i>Sans titre</i>"}</div>
        </div>
      </div>
      <div class="row">${catTag(r.cat)} ${statutTag(r.statut)}</div>
      <div class="row muted" style="font-size:.82rem">
        <span>${PROBA[r.p][1]} P : ${PROBA[r.p][0]}</span><span>${GRAV[r.g][1]} G : ${GRAV[r.g][0]}</span>
        ${r.responsable ? `<span>👤 ${esc(r.responsable)}</span>` : ""}
      </div>
      <div>
        <div class="row" style="font-size:.8rem;font-weight:700;margin-bottom:4px"><span>Actions</span><span class="spacer"></span><span>${done}/${r.actions.length}</span></div>
        <div class="progress"><div style="width:${pr * 100}%"></div></div>
      </div>
    </div>`;
  }

  const catTag = id => `<span class="pill cat-tag" style="--c:${CAT[id].couleur}"><span class="dot"></span>${esc(CAT[id].nom)}</span>`;
  const statutTag = id => `<span class="pill" style="background:${STATUT[id].c}22;color:${STATUT[id].c}">${STATUT[id].emoji} ${STATUT[id].nom}</span>`;

  // ═══════════════ Vue : Matrice
  const SURLIGNAGES = {
    ouverts:   { label: "risques ouverts", test: r => !CLOS.has(r.statut) },
    critiques: { label: "risques ouverts élevés ou critiques", test: r => !CLOS.has(r.statut) && crit(r) >= 6 },
    retard:    { label: "risques ayant au moins une action en retard", test: r => r.actions.some(a => !a.fait && a.echeance && a.echeance < today()) },
    faites:    { label: "risques ayant au moins une action réalisée", test: r => r.actions.some(a => a.fait) },
    leves:     { label: "risques levés", test: r => r.statut === "leve" },
  };

  function vueMatrice() {
    const p = proj();
    const sl = ui.surligne && SURLIGNAGES[ui.surligne];
    const hl = r => !sl || sl.test(r);
    const rs = p.risques.filter(r => !(ui.masquerClos && CLOS.has(r.statut) && !(sl && sl.test(r))));
    const nbHl = sl ? p.risques.filter(sl.test).length : 0;
    let cells = "";
    for (let pr = 3; pr >= 1; pr--) {
      cells += `<div class="axis-y">${PROBA[pr][1]} ${PROBA[pr][0]}<small>P${pr}</small></div>`;
      for (let g = 1; g <= 3; g++) {
        const inCell = rs.filter(r => r.p === pr && r.g === g);
        cells += `<div class="cell ${niveau(pr * g)}" data-p="${pr}" data-g="${g}">
          <span class="cell-score">${pr * g}</span>
          ${inCell.map(r => `<span class="mchip ${CLOS.has(r.statut) ? "closed" : ""} ${sl ? (hl(r) ? "hl" : "dim") : ""}" draggable="true" data-risk="${r.id}" data-act="open" data-id="${r.id}" style="--c:${CAT[r.cat].couleur}" title="${esc(r.titre)} — ${STATUT[r.statut].nom}">
            <span class="num">${numero(r)}</span><span class="t">${esc(r.titre) || "Sans titre"}</span></span>`).join("")}
        </div>`;
      }
    }
    cells += `<div></div>` + [1, 2, 3].map(g => `<div class="axis-x">${GRAV[g][1]} ${GRAV[g][0]}<small>G${g}</small></div>`).join("");

    const legende = [...rs].sort((a, b) => numero(a) - numero(b));
    return `
      <div class="toolbar">
        <h2 style="margin:0">🎯 Matrice des risques</h2>
        <span class="muted">Probabilité ↑ × Gravité → · glisse une pastille pour la ré-évaluer</span>
        <span class="spacer"></span>
        <label class="row" style="font-weight:700;cursor:pointer"><input type="checkbox" id="masquerClos" ${ui.masquerClos ? "checked" : ""}> Masquer levés / acceptés</label>
      </div>
      ${sl ? `<div class="hl-banner" style="--k:${{ ouverts: "#7466c4", critiques: "#c9665f", retard: "#b9789a", faites: "#5f9e76", leves: "#5a9fc9" }[ui.surligne]}">
        <span><b>${nbHl}</b> ${sl.label} mis en évidence${nbHl ? "" : " (aucun pour l'instant)"}</span>
        <span class="spacer"></span><button class="btn small ghost" data-act="clear-hl">✕ Tout afficher</button></div>` : ""}
      ${p.risques.length === 0 ? `<div class="empty"><span class="big">🎯</span>Ajoute des risques depuis le <span class="link" data-act="vue" data-id="catalogue">catalogue</span> pour remplir la matrice.</div>` : `
      <div class="matrix-wrap">
        <div class="matrix">${cells}</div>
        <div class="panel">
          <h3>📌 Légende</h3>
          <div class="row" style="margin-bottom:10px;font-size:.8rem">
            ${["faible", "modere", "eleve", "critique"].map(n => `<span class="pill" style="background:var(--${n});color:${n === "modere" ? "#5c4813" : "white"}">${NIV_NOM[n]}</span>`).join("")}
          </div>
          ${legende.map(r => `<div class="legend-item ${sl ? (hl(r) ? "hl" : "dim") : ""}" data-act="open" data-id="${r.id}" style="--c:${CAT[r.cat].couleur}">
            <span class="num">${numero(r)}</span><span style="flex:1">${esc(r.titre) || "<i>Sans titre</i>"}</span><span class="crit ${niveau(crit(r))}" style="width:26px;height:26px;font-size:.8rem;border-radius:8px">${crit(r)}</span></div>`).join("")}
        </div>
      </div>`}`;
  }

  // ═══════════════ Vue : Synthèse COPIL (vue « diapo » à capturer)
  // le bouton reste visible 4 s, puis s'efface (il réapparaît au survol, en haut à droite) pour ne pas gêner la capture
  let minuteurSortie = null;
  function montrerSortieCapture() { const b = $("#sortieCapture"); if (!b) return; b.classList.remove("hide"); clearTimeout(minuteurSortie); minuteurSortie = setTimeout(() => b.classList.add("hide"), 4000); }
  function quitterCapture() { if (!document.body.classList.contains("capture")) return; document.body.classList.remove("capture"); render(); }

  // ─── Rapport à partager : un seul fichier HTML, lisible dans n'importe quel navigateur, sans l'appli
  function ouvrirRapportPartage(p) {
    const parties = [["fiche", "🪪 Fiche d'identité et étapes", true], ["planning", "🗓️ Planning (frise)", !!p.planning?.methode], ["tendances", "📈 Tendances", Object.keys(p.tendances || {}).length > 0],
      ["risques", "🎯 Risques", p.risques.length > 0], ["problemes", "💥 Problèmes", p.risques.some(estProbleme)], ["decisions", "⚖️ Décisions", p.decisions.length > 0],
      ["actions", "✅ Actions ouvertes", actionsToutes(p).some(x => !x.a.fait)], ["livrables", "📚 Livrables", (p.livrables || []).length > 0], ["gonogo", "🚦 Go / No-Go", !!p.gonogo && !!p.planning?.methode]];
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">📤 Rapport à partager</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <p style="margin-top:0">Un fichier <b>HTML en lecture seule</b> : il s'ouvre dans n'importe quel navigateur, sans l'appli. Idéal pour le sponsor ou l'équipe (pièce jointe, Teams, SharePoint).</p>
        <div class="field"><label>Contenu</label>${parties.map(([k, lib, ok]) => `<label class="type-row"><input type="checkbox" data-rp="${k}" ${ok ? "checked" : "disabled"}><span>${lib}${ok ? "" : ` <span class="muted">(vide)</span>`}</span></label>`).join("")}</div>
        <div class="aide">C'est une photo à la date d'aujourd'hui : refaites le rapport pour le mettre à jour. Les captures d'écran collées et les fichiers joints ne sont pas inclus.</div>
      </div>
      <div class="modal-foot"><span></span><div class="row"><button class="btn ghost" data-act="close-modal">Annuler</button><button class="btn" id="rpOk">📤 Créer le rapport</button></div></div>`);
    $("#rpOk").onclick = async () => {
      const choix = new Set($$("#modal [data-rp]").filter(c => c.checked).map(c => c.dataset.rp)); const t = today(); const nums = p.planning ? numerosCopil(p.planning) : new Map();
      let css = ""; try { css = await (await fetch("style.css", { cache: "no-store" })).text(); } catch (e) { /* mise en forme minimale */ }
      const sec = (titre, html) => `<section class="rp-sec"><h2 class="rp-h">${titre}</h2>${html}</section>`;
      const tableau = (tete, L) => `<table class="rp-tab"><thead><tr>${tete.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${L.map(l => `<tr>${l.map(c => `<td>${c ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
      const S2 = [];
      if (choix.has("fiche")) S2.push(sec("🪪 Le projet", vueIdentiteLecture(p)));
      if (choix.has("planning")) S2.push(sec("🗓️ Planning", `<div class="hf-wrap">${friseHorizontale(p, 1100, { periode: "projet", sprints: true, risques: true, autres: false, initial: true, reel: !!p.planning.avReel })}</div>`));
      if (choix.has("tendances")) S2.push(sec("📈 Tendances", vueTendances(p)));
      if (choix.has("risques")) S2.push(sec("🎯 Risques", vueCopil()));
      if (choix.has("problemes")) S2.push(sec("💥 Problèmes", vueProblemes()));
      if (choix.has("decisions")) S2.push(sec("⚖️ Décisions", tableau(["Date", "Décision", "Statut", "Décideur"], p.decisions.slice().sort((x, y) => (y.date || "").localeCompare(x.date || "")).map(d => [d.date ? fmtDate(d.date) : "—", `<b>${esc(d.titre)}</b>${d.description ? `<div class="muted">${esc(d.description)}</div>` : ""}`, `${STATUTS_DEC[d.statut]?.emoji || ""} ${STATUTS_DEC[d.statut]?.nom || ""}`, esc(d.decideur || "")]))));
      if (choix.has("actions")) S2.push(sec("✅ Actions ouvertes", tableau(["Action", "Origine", "Responsable", "Échéance"], actionsToutes(p).filter(x => !x.a.fait).sort((x, y) => (x.a.echeance || "9").localeCompare(y.a.echeance || "9")).map(x => [esc(x.a.texte), esc(x.lib || ""), esc(x.a.responsable || ""), x.a.echeance ? `<span class="${x.a.echeance < t ? "txt-danger" : ""}">${fmtDate(x.a.echeance)}</span>` : "—"]))));
      if (choix.has("livrables")) S2.push(sec("📚 Livrables", tableau(["Livrable", "Catégorie", "Statut", "Responsable", "Échéance"], (p.livrables || []).map(d => [`<b>${esc(d.titre)}</b>${d.version ? ` v${esc(d.version)}` : ""}`, CATS_DOC[d.cat] || "", (STATUTS_DOC[d.statut] || STATUTS_DOC.afaire)[0], esc(d.responsable || ""), d.echeance ? fmtDate(d.echeance) : "—"]))));
      if (choix.has("gonogo")) S2.push(sec("🚦 Go / No-Go", vueGoNoGo(p, p.planning)));
      const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(p.nom)} · rapport du ${fmtDate(t)}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet"><style>${css}
body{background:#f4f6f9;margin:0} .rp{max-width:1180px;margin:0 auto;padding:24px}
.rp-entete{display:flex;align-items:center;gap:14px;background:#1f4e79;color:#fff;border-radius:16px;padding:18px 22px;margin-bottom:18px}
.rp-entete h1{margin:0;font-size:1.5rem} .rp-entete small{opacity:.85}
.rp-sec{margin:0 0 22px} .rp-h{font-size:1.15rem;color:#1f4e79;border-bottom:2px solid #1f4e79;padding-bottom:4px;margin:0 0 12px}
.rp-tab{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden} .rp-tab th,.rp-tab td{border-bottom:1px solid #e6e9ef;padding:8px 10px;text-align:left;vertical-align:top;font-size:.88rem} .rp-tab th{background:#eef2f7;color:#1f4e79}
.cp-tools,.cp-exit,button,.x-btn,.lock,.tab-toutes,[data-act=capture]{display:none!important} .link{color:inherit;text-decoration:none;pointer-events:none}
input,select,textarea{pointer-events:none;border:none!important;background:transparent!important;box-shadow:none!important;color:inherit} .clic,.hf-click,[data-act]{cursor:default}
.rp-pied{color:#667085;font-size:.8rem;text-align:center;margin-top:24px}
@media print{body{background:#fff}.rp-sec{break-inside:avoid-page}}</style></head>
<body><div class="rp"><div class="rp-entete"><span style="font-size:2rem">${esc(p.emoji)}</span><div><h1>${esc(p.nom)}${p.code ? ` · ${esc(p.code)}` : ""}</h1><small>Rapport du ${fmtDate(t)} · document en lecture seule, généré par Cockpit Projet</small></div></div>
${S2.join("\n")}
<div class="rp-pied">Photo du projet au ${fmtDate(t)}. Pour une version à jour, demandez un nouveau rapport au chef de projet.</div></div></body></html>`;
      telecharger(`Rapport - ${(p.code || p.nom).replace(/[\\/:*?"<>|]+/g, "-")} - ${t}.html`, html, "text/html;charset=utf-8");
      closeModal(); toast("📤 Rapport téléchargé : envoyez le fichier ou déposez-le sur Teams");
    };
  }
  function vueCopil() {
    const p = proj();
    const rs = p.risques
      .filter(r => ui.copilClos || !CLOS.has(r.statut))
      .sort((a, b) => crit(b) - crit(a) || b.p - a.p || numero(a) - numero(b));
    const NIV_TXT = { faible: "#2f6b45", modere: "#7a5c12", eleve: "#9a4f1c", critique: "#9b2f2a" };

    let cells = "";
    for (let pr = 3; pr >= 1; pr--) {
      cells += `<div class="cp-axis-y">${PROBA[pr][0]}</div>`;
      for (let g = 1; g <= 3; g++) {
        const inCell = rs.filter(r => r.p === pr && r.g === g);
        cells += `<div class="cp-cell cell ${niveau(pr * g)}">${inCell.map(r =>
          `<span class="cp-tag ${niveau(crit(r))}" data-act="open" data-id="${r.id}" title="${esc(r.titre)}">R${numero(r)}</span>`).join("")}</div>`;
      }
    }
    cells += `<div></div>` + [1, 2, 3].map(g => `<div class="cp-axis-x">${GRAV[g][0]}</div>`).join("");

    const carte = r => {
      const n = niveau(crit(r)); const fait = r.actions.filter(a => a.fait).length;
      return `<div class="cp-card" style="--n:var(--${n})" data-act="open" data-id="${r.id}">
        <span class="cp-badge ${n}" style="color:${NIV_TXT[n]}">R${numero(r)} · ${NIV_NOM[n]}</span>
        <div class="cp-body">
          <div class="cp-title">${esc(r.titre) || "<i>Sans titre</i>"}</div>
          <div class="cp-desc">${esc(r.description)}</div>
          ${ui.copilDetails ? `<div class="cp-meta">
            ${catTag(r.cat)} ${statutTag(r.statut)}
            ${r.responsable ? `<span>👤 ${esc(r.responsable)}</span>` : ""}
            <span>🛠️ ${fait}/${r.actions.length} action(s)</span>
            ${r.actions.filter(a => !a.fait).slice(0, 2).map(a => `<span class="cp-next">→ ${esc(a.texte)}${a.echeance ? " (" + fmtDate(a.echeance) + ")" : ""}</span>`).join("")}
          </div>` : ""}
        </div>
      </div>`;
    };

    return `
      <div class="toolbar cp-tools">
        <h2 style="margin:0">📸 Synthèse COPIL</h2>
        <span class="muted">Vue prête à capturer pour une présentation</span>
        <span class="spacer"></span>
        <label class="row" style="cursor:pointer"><input type="checkbox" id="copilDetails" ${ui.copilDetails ? "checked" : ""}> Afficher statut, propriétaire et actions</label>
        <label class="row" style="cursor:pointer"><input type="checkbox" id="copilClos" ${ui.copilClos ? "checked" : ""}> Inclure levés / acceptés</label>
        <button class="btn" data-act="capture">⛶ Mode capture</button>
      </div>
      <button class="btn ghost small cp-exit" data-act="quit-capture">✕ Quitter le mode capture (Échap)</button>
      ${rs.length === 0 ? `<div class="empty"><span class="big">📸</span>Aucun risque ouvert à présenter.</div>` : `
      <div class="copil">
        <div class="cp-head">
          <div class="project-emoji" style="width:44px;height:44px;font-size:1.5rem" data-mono="${esc(monoProjet(p))}">${esc(p.emoji)}</div>
          <div><div class="cp-proj">${esc(p.nom)} — Risques projet</div><div class="muted">Situation au ${fmtDate(today())} · ${rs.length} risque(s)${ui.copilClos ? "" : " ouvert(s)"}</div></div>
        </div>
        <div class="cp-grid">
          <div class="cp-left">
            <div class="cp-matrix">
              <div class="cp-label-y">Probabilité</div>
              <div class="cp-mx">${cells}</div>
              <div class="cp-label-x">Gravité</div>
            </div>
            <div class="cp-legend">
              <b>Criticité :</b>
              ${["critique", "eleve", "modere", "faible"].map(n => `<span><i style="background:var(--${n})"></i>${NIV_NOM[n]}</span>`).join("")}
            </div>
          </div>
          <div class="cp-list">${rs.map(carte).join("")}</div>
        </div>
      </div>`}`;
  }

  // ═══════════════ Vue : Actions
  function vueActions() {
    const p = proj();
    const all = p.risques.flatMap(r => r.actions.map(a => ({ a, r })));
    const t = today();
    const parEch = (x, y) => (x.a.echeance || "9999").localeCompare(y.a.echeance || "9999");
    const retard = all.filter(x => !x.a.fait && x.a.echeance && x.a.echeance < t).sort(parEch);
    const venir = all.filter(x => !x.a.fait && x.a.echeance && x.a.echeance >= t).sort(parEch);
    const sans = all.filter(x => !x.a.fait && !x.a.echeance);
    const faites = all.filter(x => x.a.fait);

    const row = ({ a, r }) => `
      <div class="act-row ${a.fait ? "done" : ""} ${!a.fait && a.echeance && a.echeance < t ? "late" : ""}" style="--c:${CAT[r.cat].couleur}">
        <button class="check ${a.fait ? "on" : ""}" data-act="toggle-action" data-id="${r.id}" data-aid="${a.id}" aria-label="Marquer comme faite">${a.fait ? "✓" : ""}</button>
        <div><div class="act-text"><b>${esc(a.texte) || "<i>Action sans libellé</i>"}</b></div><span class="link" data-act="open" data-id="${r.id}">R${numero(r)} · ${esc(r.titre)}</span></div>
        <span class="muted">${a.responsable ? "👤 " + esc(a.responsable) : ""}</span>
        <span class="pill" style="background:${a.echeance && a.echeance < t && !a.fait ? "#fecaca" : "#f3f4f6"}">${a.echeance ? "📅 " + fmtDate(a.echeance) : "📅 —"}</span>
        <div class="crit ${niveau(crit(r))}" style="width:30px;height:30px;font-size:.9rem;border-radius:9px">${crit(r)}</div>
      </div>`;
    const section = (titre, items, open = true) => items.length ? `<div class="act-section"><h3>${titre} <span class="pill" style="background:#eeecf7">${items.length}</span></h3>${open ? items.map(row).join("") : `<details><summary class="link">Afficher</summary>${items.map(row).join("")}</details>`}</div>` : "";

    const ouverts = p.risques.filter(r => !CLOS.has(r.statut));
    return `
      <div class="toolbar"><h2 style="margin:0">✅ Plan d'actions</h2><span class="spacer"></span></div>
      ${ouverts.length ? `<div class="panel" style="margin-bottom:20px">
        <div class="row">
          <b>⚡ Ajout rapide</b>
          <select id="qaRisk" class="btn ghost" style="max-width:320px">${ouverts.map(r => `<option value="${r.id}">R${numero(r)} · ${esc(r.titre).slice(0, 60)}</option>`).join("")}</select>
          <input id="qaText" class="search" style="min-width:200px" placeholder="Nouvelle action…">
          <input id="qaDate" type="date" class="btn ghost">
          <button class="btn green" data-act="quick-action">＋ Ajouter</button>
        </div></div>` : ""}
      ${all.length === 0 ? `<div class="empty"><span class="big">🛠️</span>Aucune action pour l'instant. Ouvre un risque pour lui associer des actions de traitement.</div>` : ""}
      ${section("⏰ En retard", retard)}
      ${section("📅 À venir", venir)}
      ${section("🗂️ Sans échéance", sans)}
      ${section("🏆 Terminées", faites, false)}`;
  }

  // ═══════════════ Modale générique
  function openModal(html, onClose) {
    const back = $("#modalBack"); const m = $("#modal");
    m.innerHTML = html; back.hidden = false;
    back._onClose = onClose;
  }
  function closeModal() {
    const back = $("#modalBack");
    if (back.hidden) return;
    back.hidden = true; $("#modal").innerHTML = "";
    const cb = back._onClose; back._onClose = null;
    if (cb) cb();
    render();
  }

  // ═══════════════ Modale : assistant de création de projet (3 étapes)
  function assistantProjet() {
    const d = { nom: "", code: "", description: "", enjeu: "", emoji: EMOJIS[0], couleur: COLORS[0], dateDebut: today(), dateFin: "", finFerme: false, budget: { montant: "", unite: "keur" }, options: { budget: false, charge: false } };
    let etape = 1; let cree = null;
    const garder = () => $$("#modal [data-w]").forEach(el => {
      const k = el.dataset.w;
      if (k === "montant" || k === "unite") d.budget[k] = el.value; else d[k] = el.value;
    });
    const etapes = ["L'essentiel", "Dates et budget", "Interlocuteurs"];
    const draw = () => {
      const corps = {
        1: `<div class="two"><div class="field"><label>Nom du projet *</label><input type="text" data-w="nom" value="${esc(d.nom)}" placeholder="Ex : Refonte du portail client"></div>
              <div class="field"><label>Code projet</label><input type="text" data-w="code" value="${esc(d.code)}" placeholder="Facultatif"></div></div>
            <div class="field"><label>Description / contexte</label><textarea data-w="description" placeholder="De quoi s'agit-il ? Pour qui ?">${esc(d.description)}</textarea></div>
            <div class="field"><label>Enjeu</label><textarea data-w="enjeu" placeholder="Pourquoi ce projet existe">${esc(d.enjeu)}</textarea></div>
            <div class="field"><label>Emoji</label><div class="emoji-pick">${EMOJIS.map(e => `<button data-emoji="${e}" class="${e === d.emoji ? "on" : ""}">${e}</button>`).join("")}</div></div>
            <div class="field"><label>Couleur</label><div class="color-pick">${COLORS.map(c => `<button data-color="${c}" class="${c === d.couleur ? "on" : ""}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join("")}</div></div>`,
        2: `<div class="two"><div class="field"><label>Date de début *</label><input type="date" data-w="dateDebut" value="${esc(d.dateDebut)}"></div>
              <div class="field"><label>Date de fin (facultative)</label><input type="date" data-w="dateFin" value="${esc(d.dateFin)}"></div></div>
            <div class="seg2" role="group" aria-label="Nature de la date de fin"><button class="${!d.finFerme ? "on" : ""}" data-ferme="0">Date estimée</button><button class="${d.finFerme ? "on" : ""}" data-ferme="1">Date ferme (engagement)</button></div>
            <label class="type-row"><input type="checkbox" data-opt="budget" ${d.options.budget ? "checked" : ""}><span>💶 Suivre le budget de ce projet</span></label>
            ${d.options.budget ? `<div class="field"><label>Budget</label><div class="row" style="flex-wrap:nowrap"><input class="inp" type="number" min="0" step="any" data-w="montant" value="${esc(d.budget.montant)}" placeholder="Montant (facultatif)" style="flex:1">
              <select class="inp" data-w="unite">${Object.entries(UNITES).map(([k, v]) => `<option value="${k}" ${k === d.budget.unite ? "selected" : ""}>${v}</option>`).join("")}</select></div></div>` : ""}
            <label class="type-row"><input type="checkbox" data-opt="charge" ${d.options.charge ? "checked" : ""}><span>📊 Suivre la charge des parties prenantes</span></label>
            <div class="aide">Tout reste modifiable ensuite dans la fiche d'identité.</div>`,
        3: cree ? `<p class="muted" style="margin:0">Le projet est créé ✅. Ajoute maintenant les personnes impliquées (tu peux aussi le faire plus tard).</p>${blocInterlocuteurs(cree)}` : "",
      }[etape];
      openModal(`
        <div class="modal-head" style="--c:${d.couleur}">
          <div class="row"><h2 style="margin:0">🚀 Nouveau projet</h2><span class="spacer"></span><button class="btn light icon" data-act="close-modal" aria-label="Fermer">✕</button></div>
          <div class="wizard-steps">${etapes.map((e, i) => `<span class="${i + 1 === etape ? "on" : i + 1 < etape ? "done" : ""}">${i + 1 < etape ? "✓" : i + 1}. ${e}</span>`).join("")}</div>
        </div>
        <div class="modal-body">${corps}</div>
        <div class="modal-foot">
          <div>${etape === 2 ? `<button class="btn ghost" id="wPrev">← Retour</button>` : ""}</div>
          <div class="row">${etape < 3 ? `<button class="btn ghost" data-act="close-modal">Annuler</button>` : ""}
            <button class="btn" id="wNext">${etape === 1 ? "Suivant →" : etape === 2 ? "Créer le projet →" : "Terminer"}</button></div>
        </div>`, () => { modalRedraw = null; });
      const m = $("#modal");
      $$("[data-emoji]", m).forEach(b => b.onclick = () => { garder(); d.emoji = b.dataset.emoji; draw(); });
      $$("[data-color]", m).forEach(b => b.onclick = () => { garder(); d.couleur = b.dataset.color; draw(); });
      $$("[data-ferme]", m).forEach(b => b.onclick = () => { garder(); d.finFerme = b.dataset.ferme === "1"; draw(); });
      $$("[data-opt]", m).forEach(c => c.onchange = () => { garder(); d.options[c.dataset.opt] = c.checked; draw(); });
      $("#wPrev")?.addEventListener("click", () => { garder(); etape = 1; draw(); });
      $("#wNext").onclick = () => {
        garder();
        if (etape === 1) {
          if (!d.nom.trim()) { $("[data-w=nom]", m).focus(); toast("✋ Donne un nom au projet"); return; }
          etape = 2; draw();
        } else if (etape === 2) {
          if (!d.dateDebut) { $("[data-w=dateDebut]", m).focus(); toast("✋ Indique la date de début"); return; }
          if (d.dateFin && d.dateFin < d.dateDebut) { toast("✋ La date de fin doit être après le début"); return; }
          cree = creerProjet({ ...d, nom: d.nom.trim(), code: d.code.trim() });
          ui.ecran = "projet"; ui.module = "cockpit";
          etape = 3; modalRedraw = draw; draw(); render();
          toast("🎉 Projet créé");
        } else { closeModal(); }
      };
      if (etape === 1) setTimeout(() => $("[data-w=nom]")?.focus(), 30);
    };
    draw();
  }

  // ═══════════════ Modale : personne de l'annuaire
  // retour : fonction appelée après enregistrement / annulation (sinon simple fermeture)
  function ouvrirPersonne(id, { retour, apresCreation } = {}) {
    const x = id ? personne(id) : null;
    const fermer = () => retour ? retour() : closeModal();
    openModal(`
      <div class="modal-head" style="--c:var(--primary)"><div class="row"><h2 style="margin:0">${x ? "👤 Modifier la personne" : "👤 Nouvelle personne"}</h2><span class="spacer"></span><button class="btn light icon" id="peX" aria-label="Fermer">✕</button></div></div>
      <div class="modal-body">
        <div class="field"><label>Prénom et nom *</label><input type="text" id="peNom" value="${esc(x?.nom || "")}" placeholder="Ex : Camille Martin"></div>
        <div class="two">
          <div class="field"><label>Fonction</label><input type="text" id="peFonction" value="${esc(x?.fonction || "")}" placeholder="Ex : Responsable SI"></div>
          <div class="field"><label>Entité / service</label><input type="text" id="peEntite" value="${esc(x?.entite || "")}" placeholder="Ex : DSI, Qualité, prestataire…"></div>
        </div>
        <div class="two">
          <div class="field"><label>E-mail</label><input type="text" id="peEmail" value="${esc(x?.email || "")}" placeholder="prenom.nom@entreprise.com"></div>
          <div class="field"><label>Téléphone</label><input type="text" id="peTel" value="${esc(x?.tel || "")}"></div>
        </div>
        <div class="two">
          <div class="field"><label>Disponibilité (jours par mois)</label><input type="text" id="peCap" value="${esc(x?.capacite ?? "")}" placeholder="18" inputmode="decimal"></div>
          <div></div>
        </div>
        <div class="aide">Cette fiche est partagée par tous tes projets : une modification ici s'applique partout.</div>
      </div>
      <div class="modal-foot"><span></span><div class="row"><button class="btn ghost" id="peCancel">Annuler</button><button class="btn" id="peOk">${x ? "Enregistrer" : "Ajouter"}</button></div></div>`);
    $("#peX").onclick = fermer; $("#peCancel").onclick = fermer;
    $("#peOk").onclick = () => {
      const nom = $("#peNom").value.trim();
      if (!nom) { $("#peNom").focus(); toast("✋ Indique le nom de la personne"); return; }
      const v = { nom, fonction: $("#peFonction").value.trim(), entite: $("#peEntite").value.trim(), email: $("#peEmail").value.trim(), tel: $("#peTel").value.trim(), capacite: $("#peCap").value.trim() === "" ? "" : String(num($("#peCap").value)) };
      if (x) { Object.assign(x, v); toast("✅ Fiche mise à jour"); }
      else { const n = { id: uid(), ...v }; S.annuaire.push(n); apresCreation?.(n); toast(`👤 ${nom} ajouté(e) à l'annuaire`); }
      save(); fermer();
    };
    setTimeout(() => $("#peNom")?.focus(), 30);
  }

  // Après une modification d'interlocuteurs : redessine la page et, si besoin, l'assistant
  function rafraichir() { if (modalRedraw && !$("#modalBack").hidden) modalRedraw(); render(); }

  // ═══════════════ Modale : risque (instance)
  function ouvrirRisque(id) {
    const r = findRisk(id); if (!r) return;
    const draw = () => {
      const c = CAT[r.cat]; const ref = r.refId ? REF[r.refId] : null; const cv = crit(r);
      openModal(`
        <div class="modal-head" style="--c:${c.couleur}">
          <div class="row" style="margin-bottom:10px">
            <span class="pill" style="background:rgba(255,255,255,.25)">R${numero(r)}</span>
            <select class="head-select" id="rCat">${CATS.map(x => `<option value="${x.id}" ${x.id === r.cat ? "selected" : ""}>${x.emoji} ${esc(x.nom)}</option>`).join("")}</select>
            <span class="spacer"></span>
            <button class="btn light icon" id="rClose" aria-label="Fermer">✕</button>
          </div>
          <input class="title-input" id="rTitre" value="${esc(r.titre)}" placeholder="Intitulé du risque">
        </div>
        <div class="modal-body">
          <div class="two">
            <div class="field"><label>📝 Description / cause</label><textarea id="rDesc" data-capt="${r.id}">${esc(r.description)}</textarea></div>
            <div class="field"><label>💥 Impact (conséquences si le risque survient)</label><textarea id="rImpact" data-capt="${r.id}">${esc(r.impact)}</textarea></div>
          </div>
          <div class="eval">
            <div class="eval-rows">
              <div class="eval-row">
                <div class="eval-lbl">🎲 Probabilité</div>
                <div class="seg">${[1, 2, 3].map(v => `<button class="${r.p === v ? "on" : ""}" data-p="${v}"><span class="d">${PROBA[v][1]}</span>${PROBA[v][0]}</button>`).join("")}</div>
              </div>
              <div class="eval-row">
                <div class="eval-lbl">⚡ Gravité</div>
                <div class="seg">${[1, 2, 3].map(v => `<button class="${r.g === v ? "on" : ""}" data-g="${v}"><span class="d">${GRAV[v][1]}</span>${GRAV[v][0]}</button>`).join("")}</div>
              </div>
            </div>
            <div class="eval-res">
              <div class="eval-lbl">🌡️ Criticité</div>
              <div class="eval-score">
                <div class="crit ${niveau(cv)} ${r.critForce ? "forced" : ""}">${cv}</div>
                <div>
                  <div class="eval-niv">${NIV_NOM[niveau(cv)]} ${tendance(r)}</div>
                  <div class="muted">${r.critForce ? "valeur forcée" : `P${r.p} × G${r.g}`}</div>
                </div>
              </div>
              <label class="eval-force"><input type="checkbox" id="rForce" ${r.critForce ? "checked" : ""}> Forcer la criticité
                ${r.critForce ? `<select id="rCritVal">${[1, 2, 3, 4, 6, 9].map(v => `<option ${v === r.critForce ? "selected" : ""}>${v}</option>`).join("")}</select>` : ""}</label>
            </div>
          </div>
          <div class="avere ${estProbleme(r) ? "on" : ""}">
            <label class="row" style="gap:8px;cursor:pointer"><input type="checkbox" id="rAvere" ${estProbleme(r) ? "checked" : ""}><b>💥 Risque avéré : c'est devenu un problème</b></label>
            ${estProbleme(r) ? `<div class="row" style="gap:14px;margin-top:8px;flex-wrap:wrap"><span class="muted" style="font-size:.85rem">Avéré le <input type="date" class="inp mini-sel" id="rAvereLe" value="${esc(r.avereLe || "")}"></span>
              <label class="row" style="gap:6px;cursor:pointer;font-size:.88rem"><input type="checkbox" id="rResolu" ${r.resoluLe ? "checked" : ""}> ✅ Problème résolu${r.resoluLe ? ` le <input type="date" class="inp mini-sel" id="rResoluLe" value="${esc(r.resoluLe)}">` : ""}</label></div>
              <div class="aide">Il n'apparaît plus dans la matrice ni dans le registre des risques, mais dans <b>Risques › ⚠️ Problèmes</b>. Ses actions deviennent le plan de résolution.</div>`
              : `<div class="aide">Cochez quand le risque se produit : il passe en problème, avec ses actions.</div>`}
          </div>
          ${estProbleme(r) ? "" : `<div class="field"><label>🚦 Statut</label><div class="statuts">${STATUTS.filter(s => s.id !== "survenu").map(s => `<button class="statut-btn ${r.statut === s.id ? "on" : ""}" style="--sc:${s.c}" data-statut="${s.id}">${s.emoji} ${s.nom}</button>`).join("")}</div></div>`}
          <div class="two">
            <div class="field"><label>👤 Propriétaire du risque</label><input type="text" id="rResp" list="dlPersonnes" value="${esc(r.responsable)}" placeholder="Qui suit ce risque ?"></div>
            <div class="field"><label>📅 Prochaine revue</label><input type="date" id="rRevue" value="${esc(r.revue)}"></div>
          </div>
          <div class="field">
            <label>🛠️ Actions de traitement (${r.actions.filter(a => a.fait).length}/${r.actions.length})</label>
            ${r.actions.length ? `<div class="progress" style="margin-bottom:10px"><div style="width:${progression(r) * 100}%"></div></div>` : ""}
            <div id="actList">${r.actions.map(a => `
              <div class="act-edit" data-aid="${a.id}">
                <button class="check ${a.fait ? "on" : ""}" data-x="fait">${a.fait ? "✓" : ""}</button>
                <input data-x="texte" value="${esc(a.texte)}" placeholder="Action…" style="${a.fait ? "text-decoration:line-through;color:#9ca3af" : ""}">
                <input class="opt" data-x="responsable" list="dlPersonnes" value="${esc(a.responsable)}" placeholder="👤 Qui ?">
                <input class="opt" data-x="echeance" type="date" value="${esc(a.echeance)}">
                <button class="x-btn" data-x="del" title="Supprimer">✕</button>
              </div>`).join("")}</div>
            <button class="btn small green" id="addAct">＋ Ajouter une action</button>
            ${ref && ref.actions.length ? `<div class="suggest"><span class="muted" style="font-size:.8rem;font-weight:700">💡 Suggestions :</span>${ref.actions.filter(s => !r.actions.some(a => a.texte === s)).map(s => `<button data-sugg="${esc(s)}">＋ ${esc(s)}</button>`).join("")}</div>` : ""}
          </div>
          <div class="field"><label>🗒️ Notes / journal</label><textarea id="rNotes" data-capt="${r.id}" placeholder="Décisions, contexte, historique…">${esc(r.notes)}</textarea>${zoneCaptures(r)}</div>
          <div class="muted" style="font-size:.8rem">
            ${ref ? `📚 Instance issue du catalogue : « ${esc(ref.titre)} » (modifier ici ne change pas le catalogue)` : "✍️ Risque personnalisé"}
            · ajouté le ${fmtDate(r.creeLe)} · criticité initiale ${r.initial.c}
            ${(r.historique || []).length > 1 ? `<br>📈 Historique : ${r.historique.map(h => `${fmtDate(h.date)} → ${h.p * h.g}`).join(" · ")}` : ""}
          </div>
        </div>
        <div class="modal-foot">
          <button class="btn danger" id="rDel">🗑️ Retirer du projet</button>
          <button class="btn" id="rOk">✔ Terminé</button>
        </div>`);

      const m = $("#modal");
      const bindText = (sel, key) => { const el = $(sel, m); el.oninput = () => { r[key] = el.value; save(); }; };
      bindText("#rTitre", "titre"); bindText("#rDesc", "description"); bindText("#rImpact", "impact");
      bindText("#rResp", "responsable"); bindText("#rNotes", "notes");
      $("#rRevue").onchange = e => { r.revue = e.target.value; save(); };
      $("#rCat").onchange = e => { r.cat = e.target.value; save(); redraw(); };
      $$("[data-p]", m).forEach(b => b.onclick = () => { setPG(r, +b.dataset.p, r.g); redraw(); });
      $$("[data-g]", m).forEach(b => b.onclick = () => { setPG(r, r.p, +b.dataset.g); redraw(); });
      $("#rForce").onchange = e => { r.critForce = e.target.checked ? r.p * r.g : null; save(); redraw(); };
      $("#rAvere").onchange = e => {
        if (e.target.checked) { r.statutAvant = r.statut; r.statut = "survenu"; r.avereLe = r.avereLe || today(); delete r.resoluLe; toast("💥 Risque avéré : il passe dans Risques › Problèmes"); }
        else { r.statut = r.statutAvant && r.statutAvant !== "survenu" ? r.statutAvant : "traitement"; delete r.avereLe; delete r.resoluLe; toast("↩︎ Redevenu un risque"); }
        save(); redraw();
      };
      $("#rAvereLe")?.addEventListener("change", e => { r.avereLe = e.target.value; save(); });
      $("#rResolu")?.addEventListener("change", e => { if (e.target.checked) { r.resoluLe = today(); toast("✅ Problème résolu"); } else delete r.resoluLe; save(); redraw(); });
      $("#rResoluLe")?.addEventListener("change", e => { r.resoluLe = e.target.value || today(); save(); });
      $("#rCritVal")?.addEventListener("change", e => { r.critForce = +e.target.value; save(); redraw(); });
      $$("[data-statut]", m).forEach(b => b.onclick = () => {
        const prev = r.statut; r.statut = b.dataset.statut; save();
        if (r.statut === "leve" && prev !== "leve") { toast("✅ Risque levé"); }
        redraw();
      });
      $$(".act-edit", m).forEach(row => {
        const a = r.actions.find(x => x.id === row.dataset.aid);
        $$("[data-x]", row).forEach(el => {
          const x = el.dataset.x;
          if (x === "fait") el.onclick = () => { a.fait = !a.fait; save(); if (a.fait) toast("💪 Action réalisée"); redraw(); };
          else if (x === "del") el.onclick = () => { r.actions = r.actions.filter(y => y.id !== a.id); save(); redraw(); };
          else el.oninput = () => { a[x] = el.value; save(); };
        });
      });
      const addAction = (texte = "") => {
        r.actions.push({ id: uid(), texte, responsable: "", echeance: "", fait: false, creeLe: today() });
        if (r.statut === "identifie") r.statut = "traitement";
        save(); redraw();
        if (!texte) { const ins = $$(".act-edit input[data-x=texte]", $("#modal")); ins[ins.length - 1]?.focus(); }
      };
      $("#addAct").onclick = () => addAction();
      $$("[data-sugg]", m).forEach(b => b.onclick = () => addAction(b.dataset.sugg));
      $("#rClose").onclick = closeModal; $("#rOk").onclick = closeModal;
      $("#rDel").onclick = () => { if (supprimerRisque(r.id) !== false) closeModal(); };
    };
    const redraw = () => { const sc = $("#modal").scrollTop; draw(); $("#modal").scrollTop = sc; };
    draw();
    if (!r.titre) setTimeout(() => $("#rTitre")?.focus(), 30);
  }

  // ═══════════════ Import / export
  function telecharger(nom, contenu, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([contenu], { type }));
    a.download = nom; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exporter() {
    telecharger(`cockpit-projet-${today()}.json`, JSON.stringify(S, null, 2), "application/json");
    toast("💾 Sauvegarde exportée");
  }
  function exporterCSV() {
    const p = proj();
    const cols = ["N°", "Catégorie", "Risque", "Description", "Impact", "Probabilité", "Gravité", "Criticité", "Niveau", "Statut", "Propriétaire", "Prochaine revue", "Actions faites", "Actions totales", "Actions"];
    const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lignes = p.risques.map(r => [numero(r), CAT[r.cat].nom, r.titre, r.description, r.impact, r.p, r.g, crit(r), NIV_NOM[niveau(crit(r))], STATUT[r.statut].nom, r.responsable, r.revue,
      r.actions.filter(a => a.fait).length, r.actions.length, r.actions.map(a => `${a.fait ? "[x]" : "[ ]"} ${a.texte}${a.echeance ? " (" + a.echeance + ")" : ""}`).join(" | ")].map(q).join(";"));
    telecharger(`registre-${p.nom.replace(/[^\w-]+/g, "_")}-${today()}.csv`, "﻿" + [cols.map(q).join(";"), ...lignes].join("\n"), "text/csv;charset=utf-8");
    toast("📊 Registre exporté en CSV");
  }
  $("#importFile").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const data = JSON.parse(rd.result);
        if (data?.type === "projet" || ui.importAjout) { ui.importAjout = false; const n = importerDonnees(data); save(); closeModal(); ui.ecran = "projet"; render(); toast(`📥 ${n} projet(s) ajouté(s)`); e.target.value = ""; return; }
        if (!data || !Array.isArray(data.projets)) throw new Error("format");
        if (S.projets.length && !confirm(`Remplacer tes ${S.projets.length} projet(s) actuel(s) par les ${data.projets.length} projet(s) du fichier ?`)) return;
        S = normaliser({ projets: data.projets, actif: data.actif, annuaire: data.annuaire, calendrier: data.calendrier, theme: data.theme, tuiles: data.tuiles, modeles: data.modeles }); if (!proj()) S.actif = S.projets[0]?.id || null; save(); closeModal(); render();
        toast("📂 Sauvegarde importée");
      } catch (err) { toast("❌ Fichier invalide"); }
      e.target.value = "";
    };
    rd.readAsText(f);
  });

  // ═══════════════ Effets
  function toast(msg) {
    const t = document.createElement("div"); t.className = "toast"; t.textContent = msg;
    $("#toasts").appendChild(t); setTimeout(() => t.remove(), 2600);
  }
  function confetti() {
    const cols = ["#7466c4", "#c27a9b", "#d4925f", "#d9bd5f", "#5f9e76", "#5a9fc9"];
    for (let i = 0; i < 90; i++) {
      const d = document.createElement("div"); d.className = "confetti";
      d.style.left = Math.random() * 100 + "vw";
      d.style.background = cols[i % cols.length];
      d.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
      d.style.animationDelay = Math.random() * .4 + "s";
      d.style.borderRadius = Math.random() > .5 ? "50%" : "2px";
      document.body.appendChild(d); setTimeout(() => d.remove(), 4200);
    }
  }

  // ═══════════════ Événements (délégation)
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-act]"); if (!el) return;
    const { act, id } = el.dataset;
    switch (act) {
      case "kpi": ui.surligne = id; ui.vue = "matrice"; render(); window.scrollTo(0, 0); break;
      case "clear-hl": ui.surligne = null; render(); break;
      case "vue": case "vue-risques":
        ui.surligne = null; ui.vue = id; ui.ecran = "projet"; ui.module = "risques";
        if (!DEMO_MODE) try { localStorage.setItem(KEY + "-vue", id); localStorage.setItem(KEY + "-module", "risques"); } catch (_) {}
        render(); window.scrollTo(0, 0); break;
      case "new-projet": assistantProjet(); break;
      case "edit-projet": allerA("projet", "identite"); break;
      case "portefeuille": allerA("portefeuille"); break;
      case "annuaire": allerA("annuaire"); break;
      case "module": allerA("projet", id); break;
      case "ouvrir-projet": S.actif = id; save(); allerA("projet", "cockpit"); break;
      case "set-emoji": proj().emoji = id; save(); render(); break;
      case "set-couleur": proj().couleur = id; save(); render(); break;
      case "fin-ferme": proj().finFerme = id === "1"; save(); render(); break;
      case "ajout-int": {
        const root = el.closest("#modal") || $("#main");
        const pid = $("#intPers", root)?.value;
        if (!pid) { toast("✋ Choisis une personne dans la liste"); return; }
        proj().interlocuteurs.push({ id: uid(), personneId: pid, role: $("#intRole", root).value, copil: false });
        save(); rafraichir(); break;
      }
      case "retirer-int": { const p = proj(); p.interlocuteurs = p.interlocuteurs.filter(i => i.id !== id); save(); rafraichir(); break; }
      case "nouvelle-personne-int": {
        const p = proj();
        ouvrirPersonne(null, { retour: modalRedraw ? rafraichir : null, apresCreation: n => p.interlocuteurs.push({ id: uid(), personneId: n.id, role: "Équipe projet", copil: false }) });
        break;
      }
      case "edit-personne": ouvrirPersonne(id, { retour: modalRedraw ? rafraichir : null }); break;
      case "nouvelle-personne": ouvrirPersonne(null); break;
      case "suppr-personne": {
        const x = personne(id); const nb = S.projets.filter(p => p.interlocuteurs.some(i => i.personneId === id)).length;
        if (!confirm(`Supprimer ${x.nom} de l'annuaire ?${nb ? ` Cette personne sera aussi retirée de ${nb} projet(s).` : ""}`)) return;
        S.annuaire = S.annuaire.filter(y => y.id !== id);
        S.projets.forEach(p => { p.interlocuteurs = p.interlocuteurs.filter(i => i.personneId !== id); });
        save(); render(); toast("🗑️ Personne supprimée"); break;
      }
      case "ajout-lien": proj().liens.push({ id: uid(), libelle: "", url: "" }); save(); render(); break;
      case "suppr-lien": { const p = proj(); p.liens = p.liens.filter(l => l.id !== id); save(); render(); break; }
      case "suppr-projet": {
        const p = proj();
        if (!confirm(`Supprimer définitivement le projet « ${p.nom} » et ses ${p.risques.length} risque(s) ? Pense à exporter une copie avant.`)) return;
        S.projets = S.projets.filter(x => x.id !== p.id); S.actif = S.projets[0]?.id || null; save();
        toast("🗑️ Projet supprimé"); allerA("portefeuille"); break;
      }
      case "export": exporter(); break;
      case "import": $("#importFile").click(); break;
      case "stockage": ouvrirStockage(); break;
      case "capture": { document.body.classList.add("capture"); render(); window.scrollTo(0, 0); montrerSortieCapture(); } toast("📸 Mode capture : fais ta capture d'écran, puis Échap pour revenir"); break;
      case "quit-capture": quitterCapture(); break;
      case "close-modal": closeModal(); break;
      case "fs-create": creerFichier(); break;
      case "fs-dossier": choisirDossier(); break;
      case "fs-serveur": (async () => {
        if (S.projets.length && fichier.dir && !fichier.dir.serveur && !confirm("Utiliser le dossier de l'appli à la place du dossier actuel ? Les projets de ce dossier-là y seront affichés (ceux affichés maintenant y seront rangés s'il est vide).")) return;
        if (await brancherServeur(true)) { closeModal(); render(); toast(`🖥️ Données dans le dossier de l'appli « ${fichier.dir.name} »`); }
        else toast("❌ Le petit serveur ne répond pas : lance l'appli avec « Lancer Cockpit Projet »");
      })(); break;
      case "fs-ajout-projet": ajouterFichiersProjet(); break;
      case "fs-export-projet": if (proj()) exporterProjet(proj()); break;
      case "fs-open": ouvrirFichier(); break;
      case "fs-reconnect": reconnecterFichier(); break;

      case "csv": exporterCSV(); break;
      case "cat":
        ui.cat = id;
        $$("#catChips .chip").forEach(b => b.classList.toggle("on", b.dataset.id === id));
        renderCatList(); break;
      case "chips-scroll": { const t = $("#catChips"); t?.scrollBy({ left: +id * t.clientWidth * 0.7, behavior: "smooth" }); break; }
      case "catReg": ui.catReg = id; render(); break;
      case "statutF": ui.statutFiltre = id; render(); break;
      case "add": e.stopPropagation(); ajouterDepuisRef(id); render(); break;
      case "remove": if (supprimerRisque(id) !== false) render(); break;
      case "open": ouvrirRisque(id); break;
      case "perso": ajouterPerso(); break;
      case "pb-nouveau": ajouterProbleme(); break;
      case "toggle-action": {
        const r = findRisk(id); const a = r?.actions.find(x => x.id === el.dataset.aid);
        if (a) { a.fait = !a.fait; save(); if (a.fait) toast("💪 Action réalisée"); render(); }
        break;
      }
      case "quick-action": {
        const r = findRisk($("#qaRisk").value); const texte = $("#qaText").value.trim();
        if (!r || !texte) { toast("✋ Saisis le libellé de l'action"); return; }
        r.actions.push({ id: uid(), texte, responsable: "", echeance: $("#qaDate").value, fait: false, creeLe: today() });
        if (r.statut === "identifie") r.statut = "traitement";
        save(); render(); toast("✅ Action ajoutée");
        break;
      }
    }
  });

  document.addEventListener("change", e => {
    if (e.target.id === "projSel") { if (!e.target.value) return; S.actif = e.target.value; save(); allerA("projet"); }
    const p = proj(); const d = e.target.dataset || {};
    if (p && d.intRole) { const i = p.interlocuteurs.find(x => x.id === d.intRole); if (i) { i.role = e.target.value; save(); rafraichir(); } }
    if (p && d.intCopil) { const i = p.interlocuteurs.find(x => x.id === d.intCopil); if (i) { i.copil = e.target.checked; save(); rafraichir(); } }
    if (p && d.budget === "unite") { p.budget.unite = e.target.value; save(); }
    if (p && (d.f === "dateDebut" || d.f === "dateFin")) { p[d.f] = e.target.value; save(); render(); }
    if (p && d.f === "nom" && !e.target.value.trim()) { toast("✋ Le projet doit garder un nom"); p.nom = "Projet sans nom"; save(); render(); }
    if (e.target.id === "triSel") { ui.tri = e.target.value; render(); }
    if (e.target.id === "masquerClos") { ui.masquerClos = e.target.checked; render(); }
    if (e.target.id === "copilClos") { ui.copilClos = e.target.checked; render(); }
    if (e.target.id === "copilDetails") { ui.copilDetails = e.target.checked; render(); }
  });
  document.addEventListener("input", e => {
    if (e.target.id === "search") { ui.q = e.target.value; renderCatList(); }
    if (e.target.id === "searchAnnuaire") {
      ui.qAnnuaire = e.target.value; const pos = e.target.selectionStart; render();
      const el = $("#searchAnnuaire"); el.focus(); el.setSelectionRange(pos, pos);
    }
    const p = proj(); const d = e.target.dataset || {};
    if (!p || e.target.closest("#modal")) return;
    if (d.f && e.target.type !== "date") { p[d.f] = e.target.value; save(); if (d.f === "nom") renderProjectBar(); }
    if (d.budget === "montant") { p.budget.montant = e.target.value; save(); }
    if (d.lien) { const l = p.liens.find(x => x.id === d.lien); if (l) { l[d.k] = e.target.value; save(); } }
  });
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { if (document.body.classList.contains("capture")) quitterCapture(); else closeModal(); }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches?.(".kpi[data-act], .pf-card[data-act], .brand[data-act]")) { e.preventDefault(); e.target.click(); }
    if (e.key === "Enter" && e.target.id === "qaText") $("[data-act=quick-action]")?.click();
  });
  $("#modalBack").addEventListener("mousedown", e => { if (e.target.id === "modalBack") closeModal(); });

  // ═══════════════ Glisser-déposer
  let drag = null; // { type: "ref"|"risk", id }
  document.addEventListener("dragstart", e => {
    const card = e.target.closest?.("[data-ref]"); const chip = e.target.closest?.("[data-risk]");
    if (card) { drag = { type: "ref", id: card.dataset.ref }; card.classList.add("dragging"); }
    else if (chip) { drag = { type: "risk", id: chip.dataset.risk }; }
    else return;
    e.dataTransfer.effectAllowed = drag.type === "ref" ? "copy" : "move";
    e.dataTransfer.setData("text/plain", drag.id);
  });
  document.addEventListener("dragend", () => {
    drag = null;
    $$(".dragging").forEach(x => x.classList.remove("dragging"));
    $$(".over").forEach(x => x.classList.remove("over"));
  });
  document.addEventListener("dragover", e => {
    if (!drag) return;
    const dz = drag.type === "ref" ? e.target.closest("#dropzone") : e.target.closest(".cell");
    $$(".over").forEach(x => x !== dz && x.classList.remove("over"));
    if (dz) { e.preventDefault(); e.dataTransfer.dropEffect = drag.type === "ref" ? "copy" : "move"; dz.classList.add("over"); }
  });
  document.addEventListener("drop", e => {
    if (!drag) return;
    if (drag.type === "ref" && e.target.closest("#dropzone")) {
      e.preventDefault(); ajouterDepuisRef(drag.id); render();
    } else if (drag.type === "risk") {
      const cell = e.target.closest(".cell"); const r = findRisk(drag.id);
      if (cell && r) {
        e.preventDefault();
        const p = +cell.dataset.p, g = +cell.dataset.g;
        if (r.p !== p || r.g !== g) { setPG(r, p, g); toast(`🎯 R${numero(r)} → P${p} × G${g} = ${p * g}`); }
        render();
      }
    }
    drag = null;
  });

  // Le logo et le nom ramènent au portefeuille (accueil)
  { const b = $(".brand"); if (b) { b.dataset.act = "portefeuille"; b.setAttribute("role", "button"); b.tabIndex = 0; b.title = "Retour à l'accueil : tous mes projets"; } }
  function appliquerVerrouDemo() {
    if (!DEMO_MODE) return;
    document.body.classList.add("demo-mode");
    document.querySelectorAll("button, [data-act]").forEach(el => {
      const safe = DEMO_NAV_ACTIONS.has(el.dataset.act) || ["rClose", "rOk"].includes(el.id) || el.matches(".nav-fleche");
      if (safe) return;
      if (el.tagName === "BUTTON") el.hidden = true;
      else el.classList.add("demo-inert");
    });
    document.querySelectorAll("input, textarea, select").forEach(el => {
      const safeInput = DEMO_FILTER_IDS.has(el.id);
      const safeSelect = DEMO_CHANGE_IDS.has(el.id);
      if (!safeInput && !safeSelect) el.disabled = true;
    });
    document.querySelectorAll('[contenteditable="true"]').forEach(el => { el.setAttribute("contenteditable", "false"); });
  }
  if (DEMO_MODE) {
    document.title = "Cockpit Projet — vitrine en lecture seule";
    const sousTitre = $(".brand-sub"); if (sousTitre) sousTitre.textContent = "Vitrine en lecture seule";
    new MutationObserver(appliquerVerrouDemo).observe(document.body, { childList: true, subtree: true });
    appliquerVerrouDemo();
    async function initDemo() {
      try {
        const [communR, demoR, signR] = await Promise.all([
          fetch("_commun.json"),
          fetch("DEMO%20-%20Portail%20RH%20en%20ligne.json"),
          fetch("SIGN%20-%20Signature%20%C3%A9lectronique%20des%20contrats.json")
        ]);
        if (![communR, demoR, signR].every(r => r.ok)) throw new Error("Fichiers de démonstration introuvables");
        const [commun, demo, sign] = await Promise.all([communR.json(), demoR.json(), signR.json()]);
        const projets = [demo, sign].filter(d => d.type === "projet" && d.projet?.id).map(d => ({ p: d.projet, nom: `${d.projet.code} - ${d.projet.nom}.json` }));
        const personnes = [demo, sign].flatMap(d => Array.isArray(d.personnes) ? d.personnes : []);
        if (projets.length !== 2) throw new Error("Les deux projets de démonstration ne sont pas disponibles");
        chargerDepuisDossier({ projets, personnes, commun });
        fichier.etat = "ok";
        ui.ecran = "portefeuille";
        ui.module = "cockpit";
        ui.vue = "dashboard";
        render();
        appliquerVerrouDemo();
      } catch (e) {
        console.error(e);
        $("#main").innerHTML = `<div class="connexion"><span class="hero">🧭</span><h1>Vitrine momentanément indisponible</h1><p class="muted">Les fichiers des projets de démonstration n'ont pas pu être chargés.</p></div>`;
      }
    }
    initDemo();
  } else {
    render();
    initFichier();
  }
})();
