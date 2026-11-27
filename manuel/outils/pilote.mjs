// Pilote Chrome sans interface (CDP) : reçoit des commandes HTTP sur le port 9400
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const OUT = "/Users/ophelie.caquelin/Cockpit_Projet/manuel/images";
fs.mkdirSync(OUT, { recursive: true });
const profil = path.join(DIR, "profil-chrome");
let dejaLa = false; try { await fetch("http://127.0.0.1:9333/json/version"); dejaLa = true; } catch (e) {}
const chrome = dejaLa ? { kill() {} } : spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new", "--remote-debugging-port=9333", `--user-data-dir=${profil}`, "--no-first-run", "--no-default-browser-check",
  "--window-size=1440,900", "--lang=fr-FR", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });
process.on("exit", () => chrome.kill());

const attendre = ms => new Promise(r => setTimeout(r, ms));
let ws, seq = 0; const enAttente = new Map();
for (let i = 0; i < 120; i++) {
  try {
    const L = await (await fetch("http://127.0.0.1:9333/json/list")).json();
    let t = L.find(x => x.type === "page"); if (!t && i > 4) t = await (await fetch("http://127.0.0.1:9333/json/new?about:blank", { method: "PUT" })).json(); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; }
  } catch (e) {}
  await attendre(250);
}
await new Promise(r => ws.addEventListener("open", r));
ws.addEventListener("message", m => { const d = JSON.parse(m.data); if (d.id && enAttente.has(d.id)) { enAttente.get(d.id)(d); enAttente.delete(d.id); } });
const cdp = (method, params = {}) => new Promise(r => { const id = ++seq; enAttente.set(id, r); ws.send(JSON.stringify({ id, method, params })); });

let largeur = 1440, hauteur = 900;
const viewport = async (w, h) => { largeur = w; hauteur = h; await cdp("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile: false }); };
await cdp("Page.enable"); await cdp("Runtime.enable"); await viewport(1440, 900);
await cdp("Emulation.setTimezoneOverride", { timezoneId: "Europe/Paris" });
await cdp("Emulation.setLocaleOverride", { locale: "fr-FR" });

async function evaluer(expr) {
  const r = await cdp("Runtime.evaluate", { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) return { erreur: r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text };
  return { valeur: r.result?.result?.value };
}
async function capture({ nom, selecteur, marge = 0, x, y, w, h }) {
  let clip;
  if (selecteur) {
    const r = await evaluer(`const e = document.querySelector(${JSON.stringify(selecteur)}); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.x + scrollX, y: b.y + scrollY, w: b.width, h: b.height };`);
    const b = r.valeur; if (!b) return { erreur: "sélecteur introuvable" };
    clip = { x: Math.max(0, b.x - marge), y: Math.max(0, b.y - marge), width: b.w + 2 * marge, height: b.h + 2 * marge, scale: 1 };
  } else if (w) clip = { x, y, width: w, height: h, scale: 1 };
  const r = await cdp("Page.captureScreenshot", { format: "png", ...(clip ? { clip, captureBeyondViewport: true } : {}) });
  if (!r.result?.data) return { erreur: JSON.stringify(r.error || r) };
  const f = path.join(OUT, nom + ".png"); fs.writeFileSync(f, Buffer.from(r.result.data, "base64"));
  return { ok: f };
}

http.createServer(async (req, res) => {
  let corps = ""; for await (const c of req) corps += c;
  const q = corps ? JSON.parse(corps) : {};
  let out;
  try {
    if (req.url === "/eval") out = await evaluer(q.expr);
    else if (req.url === "/aller") { await cdp("Page.navigate", { url: q.url }); await attendre(q.attente || 1500); out = { ok: true }; }
    else if (req.url === "/shot") out = await capture(q);
    else if (req.url === "/preload") { out = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: q.source }); }
    else if (req.url === "/viewport") { await viewport(q.w, q.h); out = { ok: true }; }
    else if (req.url === "/stop") { res.end("{}"); chrome.kill(); process.exit(0); }
    else out = { erreur: "commande inconnue" };
  } catch (e) { out = { erreur: String(e) }; }
  res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(out));
}).listen(9400, "127.0.0.1", () => console.log("pilote prêt"));
