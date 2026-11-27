# Petit serveur local de Cockpit Projet (lancé par « Lancer Cockpit Projet.command » sur Mac ou « Lancer Cockpit Projet.bat » sous Windows).
# 1. Il sert les fichiers de l'appli, en demandant au navigateur de toujours vérifier qu'il a la dernière version.
# 2. Il lit et écrit les fichiers de données (un fichier par projet, _commun.json, corbeille/, documents/) pour les
#    navigateurs qui ne savent pas le faire eux-mêmes (Safari, Firefox) : routes /api/…
#
# Dossier des données : variable d'environnement COCKPIT_DONNEES, sinon « dossier_donnees » dans config.json,
# sinon le dossier de l'appli lui-même.
import functools, http.server, json, mimetypes, os, sys, tempfile, urllib.parse

APPLI = os.path.dirname(os.path.abspath(__file__))


def dossier_donnees():
    d = os.environ.get("COCKPIT_DONNEES")
    if not d:
        try:
            with open(os.path.join(APPLI, "config.json"), encoding="utf-8") as f:
                d = json.load(f).get("dossier_donnees")
        except (OSError, ValueError):
            d = None
    d = os.path.abspath(os.path.expanduser(d)) if d else APPLI
    os.makedirs(d, exist_ok=True)
    return d


DONNEES = dossier_donnees()
PROTEGES = {"index.html", "app.js", "style.css", "data.js", "serveur.py", "config.json"}


class Gestionnaire(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, *args):
        pass

    # ── Sécurité : uniquement depuis ce poste, et jamais en dehors du dossier des données
    def hote_ok(self):
        port = self.server.server_address[1]
        return (self.headers.get("Host") or "") in {f"localhost:{port}", f"127.0.0.1:{port}", f"[::1]:{port}"}

    def chemin(self, ecriture=False, dossier=False):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        rel = (q.get("chemin") or [""])[0].replace("\\", "/").strip("/")
        parts = [x for x in rel.split("/") if x]
        if any(x in (".", "..") or x.startswith(".") for x in parts):
            return None
        if ecriture:
            # écriture : fichiers .json à la racine (projets, _commun.json), ou dans corbeille/ et documents/
            if not parts:
                return None
            if len(parts) == 1 and dossier and parts[0] in ("corbeille", "documents"):
                pass
            elif len(parts) == 1 and (not parts[0].lower().endswith(".json") or parts[0] in PROTEGES):
                return None
            if len(parts) > 1 and parts[0] not in ("corbeille", "documents"):
                return None
        absolu = os.path.abspath(os.path.join(DONNEES, *parts))
        if absolu != DONNEES and not absolu.startswith(DONNEES + os.sep):
            return None
        return absolu

    def repondre(self, code, corps=b"", type_="application/json; charset=utf-8"):
        if isinstance(corps, (dict, list)):
            corps = json.dumps(corps, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", type_)
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(corps)

    def api(self):
        return urllib.parse.urlparse(self.path).path.startswith("/api/")

    def route(self):
        return urllib.parse.urlparse(self.path).path[len("/api/"):]

    def garde(self, modification):
        if not self.hote_ok():
            self.repondre(403, {"erreur": "hôte refusé"}); return False
        # une page d'un autre site ne peut pas envoyer cet en-tête sans autorisation (CORS) : protège les écritures
        if modification and self.headers.get("X-Cockpit") != "1":
            self.repondre(403, {"erreur": "en-tête manquant"}); return False
        return True

    def do_GET(self):
        if not self.api():
            return super().do_GET()
        if not self.garde(False):
            return
        r = self.route()
        if r == "info":
            return self.repondre(200, {"nom": os.path.basename(DONNEES) or DONNEES, "chemin": DONNEES, "appli": DONNEES == APPLI})
        c = self.chemin()
        if c is None:
            return self.repondre(400, {"erreur": "chemin refusé"})
        if r == "liste":
            if not os.path.isdir(c):
                return self.repondre(404, {"erreur": "dossier introuvable"})
            L = [{"nom": e.name, "type": "directory" if e.is_dir() else "file"} for e in os.scandir(c) if not e.name.startswith(".")]
            return self.repondre(200, L)
        if r == "fichier":
            if not os.path.isfile(c):
                return self.repondre(404, {"erreur": "fichier introuvable"})
            with open(c, "rb") as f:
                data = f.read()
            return self.repondre(200, data, mimetypes.guess_type(c)[0] or "application/octet-stream")
        return self.repondre(404, {"erreur": "route inconnue"})

    def do_HEAD(self):
        if not self.api():
            return super().do_HEAD()
        return self.do_GET()

    def do_PUT(self):
        if not self.api() or not self.garde(True):
            return self.repondre(404, {}) if not self.api() else None
        c = self.chemin(ecriture=True)
        if c is None or self.route() != "fichier":
            return self.repondre(400, {"erreur": "chemin refusé"})
        n = int(self.headers.get("Content-Length") or 0)
        data = self.rfile.read(n) if n else b""
        os.makedirs(os.path.dirname(c), exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=os.path.dirname(c), prefix=".ecriture-")
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        os.replace(tmp, c)  # écriture atomique : jamais de fichier à moitié écrit
        return self.repondre(200, {"ok": True})

    def do_POST(self):
        if not self.api() or not self.garde(True):
            return self.repondre(404, {}) if not self.api() else None
        if self.route() == "dossier":
            c = self.chemin(ecriture=True, dossier=True)
            if c is None:
                return self.repondre(400, {"erreur": "chemin refusé"})
            os.makedirs(c, exist_ok=True)
            return self.repondre(200, {"ok": True})
        return self.repondre(404, {"erreur": "route inconnue"})

    def do_DELETE(self):
        if not self.api() or not self.garde(True):
            return self.repondre(404, {}) if not self.api() else None
        c = self.chemin(ecriture=True)
        if c is None or self.route() != "fichier":
            return self.repondre(400, {"erreur": "chemin refusé"})
        if os.path.isfile(c):
            os.remove(c)
        return self.repondre(200, {"ok": True})


port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
# 127.0.0.1 : le serveur n'est joignable que depuis ce poste (pas d'alerte du pare-feu Windows)
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(Gestionnaire, directory=APPLI)).serve_forever()
