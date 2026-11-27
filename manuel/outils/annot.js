// Repères numérotés façon tuto, posés par-dessus l'appli avant la capture
if (!document.getElementById("ann-style")) {
  const st = document.createElement("style"); st.id = "ann-style";
  st.textContent = `
    ::-webkit-scrollbar { display: none; } html { scrollbar-width: none; }
    .toast, #toast, .maj-bandeau { display: none !important; }
    .ann-box { position: absolute; z-index: 99990; border: 3px solid #e8590c; border-radius: 12px; box-shadow: 0 0 0 4px rgba(232,89,12,.18); pointer-events: none; }
    .ann-num { position: absolute; z-index: 99991; width: 34px; height: 34px; border-radius: 50%; background: #e8590c; color: #fff; font: 700 18px/34px Inter, Arial, sans-serif; text-align: center; box-shadow: 0 3px 10px rgba(0,0,0,.25); border: 2px solid #fff; pointer-events: none; }
  `;
  document.head.appendChild(st);
}
window.trouver = (s) => {
  if (typeof s !== "string") return s;
  const m = s.match(/^(.*?)::(.+)$/);   // "sélecteur::texte"
  if (m) return [...document.querySelectorAll(m[1] || "*")].filter(e => e.textContent.includes(m[2])).sort((a, b) => a.textContent.length - b.textContent.length)[0];
  return document.querySelector(s);
};
window.nettoyer = () => document.querySelectorAll(".ann-box, .ann-num").forEach(e => e.remove());
window.marquer = (items) => {
  nettoyer(); const manquants = [];
  for (const [sel, n, pos = "tl", pad = 4] of items) {
    const e = trouver(sel); if (!e) { manquants.push(sel); continue; }
    const r = e.getBoundingClientRect(); const x = r.left + scrollX - pad, y = r.top + scrollY - pad, W = r.width + 2 * pad, H = r.height + 2 * pad;
    const b = document.createElement("div"); b.className = "ann-box"; Object.assign(b.style, { left: x + "px", top: y + "px", width: W + "px", height: H + "px" }); document.body.appendChild(b);
    if (n == null) continue;
    const c = document.createElement("div"); c.className = "ann-num"; c.textContent = n;
    const P = { tl: [x - 17, y - 17], tr: [x + W - 17, y - 17], l: [x - 42, y + H / 2 - 17], r: [x + W + 8, y + H / 2 - 17], bl: [x - 17, y + H - 17], br: [x + W - 17, y + H - 17], t: [x + W / 2 - 17, y - 40] }[pos];
    c.style.left = Math.max(2, P[0]) + "px"; c.style.top = Math.max(2, P[1]) + "px"; document.body.appendChild(c);
  }
  return manquants;
};
return "annot ok";
