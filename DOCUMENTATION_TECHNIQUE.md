# Cockpit Projet — Documentation technique

*Version du 18 novembre 2026 (mise à jour : demandes de changement, Go / No-Go, rapport de portefeuille, thèmes, vue d'ensemble personnalisable, Safari et Firefox)*

Ce document s'adresse à la personne qui installe, maintient ou fait évoluer l'application, ainsi qu'au service informatique qui doit la valider. Pour l'utilisation au quotidien, voir le manuel utilisateur (`manuel/index.html`, ou bouton **❓** dans l'appli).

---

## 1. En résumé

| Question | Réponse |
|---|---|
| **Type d'application** | Application web **100 % locale** : une page HTML + JavaScript, ouverte dans Chrome ou Edge. |
| **Serveur / hébergement** | **Aucun.** Un mini-serveur Python tourne sur le poste de l'utilisateur : il sert l'appli à l'adresse `http://localhost:8765` et, pour Safari et Firefox, lit et écrit les fichiers de données. |
| **Base de données** | **Aucune.** Les données sont des fichiers **JSON** dans un dossier choisi par l'utilisateur sur son poste. |
| **Langages** | JavaScript (ES2020+), HTML5, CSS3. Python 3 (serveur local, une quinzaine de lignes). Bash (lanceur macOS) et Batch (lanceur Windows). |
| **Framework / librairies** | **Aucun.** Pas de React, pas de jQuery, pas de npm, pas de compilation. Seule ressource externe : la police *Inter* (Google Fonts), facultative. |
| **Navigateurs compatibles** | **Chrome**, **Edge**, **Safari**, **Firefox** récents. Chrome et Edge peuvent écrire dans n'importe quel dossier choisi par l'utilisateur ; Safari et Firefox passent par le serveur local (voir §4.6). |
| **Réseau** | Aucun appel réseau sortant, en dehors du chargement de la police. Aucune donnée ne quitte le poste. |
| **Multi-utilisateur** | Non : une installation = un utilisateur. Le partage se fait par envoi du fichier d'un projet. |

---

## 2. Pré-requis (infrastructure)

### Poste de travail

| Élément | Exigence | Remarque |
|---|---|---|
| Système | macOS (testé), Windows 10 / 11, Linux | Un lanceur est fourni pour macOS (`.command`) et pour Windows (`.bat`). Voir §3.2 et §3.3. |
| Navigateur | **Chrome ≥ 86**, **Edge ≥ 86**, **Safari ≥ 16** ou **Firefox** récent | Chrome / Edge : écriture directe dans un dossier (API *File System Access*). Safari / Firefox : écriture par le serveur local. |
| Python | **Python 3.7 ou plus** | Uniquement pour le serveur local. Sur macOS, `python3` est fourni avec les *Command Line Tools* d'Apple. Sous Windows : python.org ou Microsoft Store. |
| Disque | Quelques Mo pour l'appli (+ 16 Mo pour le manuel illustré) | Les données pèsent quelques dizaines de Ko par projet, plus les captures d'écran collées par l'utilisateur. |
| Port réseau local | **8765** libre sur `localhost` | Le serveur n'écoute que sur `127.0.0.1` : il est **injoignable depuis un autre poste**, et le pare-feu Windows ne pose pas de question. |
| Droits | Aucun droit administrateur | Ni installation logicielle, ni service système. |

### Ce qu'il n'y a **pas** besoin de prévoir

- Pas de serveur web, pas de machine virtuelle, pas de conteneur.
- Pas de base de données.
- Pas de compte, d'annuaire LDAP ou d'authentification.
- Pas de certificat HTTPS : `localhost` est considéré comme sûr par les navigateurs.
- Pas de flux réseau à ouvrir.

---

## 3. Installation

### 3.1 Contenu à copier

Copiez le dossier de l'application (par exemple `Cockpit_Projet`) sur le poste. Les fichiers indispensables sont :

```
Cockpit_Projet/
├── index.html                    page unique de l'application
├── app.js                        toute la logique (≈ 5 800 lignes)
├── style.css                     toute la mise en forme et les 3 thèmes (≈ 1 550 lignes)
├── data.js                       catalogue de 86 risques types
├── serveur.py                    mini-serveur local (Python 3) : sert l'appli et, pour Safari/Firefox, les fichiers de données
├── config.json                   (facultatif) dossier des données du serveur, voir §4.6
├── Lancer Cockpit Projet.command lanceur macOS (double-clic)
├── Lancer Cockpit Projet.bat     lanceur Windows (double-clic)
├── DOCUMENTATION_TECHNIQUE.md    ce document
└── manuel/                       documentation (facultatif)
    ├── index.html                manuel utilisateur illustré (bouton ❓ de l'appli)
    ├── doc-technique.html        affichage de ce document (⚙️ Réglages › Documentation)
    ├── images/                   ≈ 50 captures d'écran annotées
    └── outils/                   scripts de génération des captures (facultatif)
```

### 3.2 macOS

1. Copiez le dossier, par exemple dans `Documents/Cockpit_Projet`.
2. Vérifiez que le lanceur est exécutable (normalement déjà le cas) :
   ```bash
   chmod +x "Lancer Cockpit Projet.command"
   ```
3. Double-cliquez sur **Lancer Cockpit Projet.command**.
   - Au premier lancement, macOS peut bloquer un script téléchargé : faites **clic droit › Ouvrir**, puis confirmez.
   - Si `python3` n'est pas installé, macOS propose d'installer les *Command Line Tools* : acceptez.
4. Chrome (ou, à défaut, Edge) s'ouvre sur `http://localhost:8765`.
5. Au premier écran, cliquez sur **Choisir un dossier** et désignez le **dossier des données** (voir §4).

Le lanceur :
- vérifie si l'appli tourne déjà sur le port 8765 ; sinon il démarre `serveur.py` ;
- ouvre Chrome, ou Edge s'il n'y a pas Chrome ;
- reste ouvert dans le Terminal : **fermer la fenêtre arrête le serveur**.

### 3.3 Windows

1. Copiez le dossier, par exemple dans `Documents\Cockpit_Projet`.
2. Installez **Python 3** si besoin, depuis python.org ou le Microsoft Store. Avec l'installeur python.org, cochez **« Add python.exe to PATH »**.
3. Double-cliquez sur **Lancer Cockpit Projet.bat**.
   - Au premier lancement, Windows SmartScreen peut afficher « Windows a protégé votre ordinateur » : cliquez sur **Informations complémentaires › Exécuter quand même**.
4. Chrome (ou, à défaut, Edge) s'ouvre sur `http://localhost:8765`.
5. Au premier écran, cliquez sur **Choisir un dossier** et désignez le **dossier des données** (voir §4).

Le lanceur `.bat` fait la même chose que celui de macOS :
- il cherche **Chrome**, puis **Edge**, dans leurs dossiers d'installation habituels (`Program Files`, `Program Files (x86)`, `AppData\Local`) ;
- si l'appli tourne déjà (test avec `curl`, présent depuis Windows 10), il ouvre seulement le navigateur ;
- il cherche Python via le lanceur `py -3`, sinon `python`, et affiche un message clair s'il est absent ;
- il démarre `serveur.py` et ouvre le navigateur 2 secondes plus tard ;
- il reste ouvert dans une fenêtre d'invite de commandes : **fermer la fenêtre arrête le serveur**.

> Le lanceur Windows n'a pas encore été essayé sur un vrai poste Windows : il a été écrit et relu, mais pas testé. Au premier déploiement, vérifiez les étapes ci-dessus.

**Équivalent manuel (Windows ou Linux)**, depuis le dossier de l'appli :

```bash
python serveur.py 8765
```

puis ouvrez `http://localhost:8765` dans Chrome ou Edge.

### 3.4 Pourquoi un serveur local plutôt qu'un double-clic sur `index.html` ?

- L'API d'accès aux fichiers et la mémorisation du dossier choisi (IndexedDB) ont besoin d'une **origine stable** (`http://localhost:8765`). En `file://`, chaque ouverture peut être traitée comme une origine différente : le dossier serait redemandé et le cache perdu.
- `serveur.py` envoie l'en-tête `Cache-Control: no-cache` : le navigateur prend toujours la dernière version des fichiers après une mise à jour.
- Pour Safari et Firefox, c'est aussi `serveur.py` qui lit et écrit les fichiers de données (§4.6).

---

## 4. Stockage des données

### 4.1 Principe

L'application n'a **ni serveur de données ni base** : elle lit et écrit des fichiers JSON dans un dossier du poste. Deux façons d'y accéder, avec exactement le même format de fichiers :

| Mode | Navigateurs | Dossier | Comment |
|---|---|---|---|
| **Dossier choisi** | Chrome, Edge | n'importe quel dossier choisi par l'utilisateur | API navigateur *File System Access* (`showDirectoryPicker`). Chrome demande l'accord la première fois, puis une confirmation à chaque nouvelle session. |
| **Dossier de l'appli** (via le serveur) | tous (Safari, Firefox, Chrome…) | le dossier configuré dans `serveur.py` (par défaut : le dossier de l'appli) | Le navigateur demande au serveur local de lire et d'écrire (routes `/api/…`, §4.6). Activé automatiquement dans Safari et Firefox ; au choix dans Chrome (« 🖥️ Utiliser le dossier de l'appli »). |

Chaque modification est **enregistrée automatiquement** environ 0,4 s après la dernière saisie. Seuls les fichiers dont le contenu a changé sont réécrits.

### 4.2 Organisation du dossier de données

```
<dossier de données>/
├── DEMO - Portail RH en ligne.json   un fichier par projet : "<code> - <nom>.json"
├── SIGN - Signature électronique des contrats.json
├── _commun.json                      annuaire des personnes, jours fériés et fermetures, thème, tuiles, templates personnels
├── corbeille/                        projets supprimés : "<date> - <nom>.json"
└── documents/
    ├── <code> - <nom>/               fichiers joints aux livrables (et templates Word générés)
    ├── captures/                     captures d'écran collées dans les textes (.webp / .png)
    └── templates/                    vos propres templates de documents (communs à tous les projets)
```

> **Projets de démonstration :** `DEMO - Portail RH en ligne.json` (Agile, 6 mois, avec budget) et `SIGN - Signature électronique des contrats.json` (Hybride, 4 semaines, sans budget, backlog Jira fictif). Données fictives ; on peut les supprimer depuis Réglages › Mes projets.

> **Recommandation :** utilisez un dossier de données **séparé** du dossier de l'application (par exemple `Documents/Cockpit Projet – données`). Les mises à jour de l'appli se font alors en remplaçant ses fichiers sans risque de toucher aux données.
> *Situation actuelle : le dossier de données est le dossier de l'application lui-même. Cela fonctionne, mais demande de la prudence lors d'une mise à jour.*

### 4.3 Format des fichiers

**Fichier projet :**

```json
{
  "app": "cockpit-projet",
  "type": "projet",
  "version": 3,
  "projet": { "id": "…", "nom": "…", "code": "…", "dateDebut": "2026-09-07", "risques": [], "planning": {}, "actions": [], "decisions": [], "changements": [], "gonogo": {}, "livrables": [], "retex": [], "budget": {}, "backlog": {}, "flash": {}, "etapes": {} },
  "personnes": [ { "id": "…", "nom": "…", "fonction": "…" } ]
}
```

- `personnes` contient une copie des fiches de l'annuaire utilisées par le projet. Le fichier peut ainsi être envoyé seul à un collègue.
- Les dates sont des chaînes `AAAA-MM-JJ`.
- Principales rubriques : `planning` (méthode, phases, sprints, jalons, réunions avec leur préparation `prep`, leur compte rendu `cr`, la date `prepareeLe` quand elle est marquée prête et `cr.diffuseLe` quand elle est réalisée), `etapes` (cycle de vie : `mode`, `actives`, `dates`, `courante`, `terminees`), `tendances` (une photo des indicateurs par semaine, clé = lundi), `chargeReel` (temps passé, même forme que `charge`). Dans `planning` : `avReel` (option avancement réel) et `phases[].reel` (% réalisé). Dans `gonogo` : `objectifs` (par texte d'objectif : `cible`, `actuel`, `statut`, `majLe`). Un risque avéré a le statut `survenu`, avec `avereLe`, `resoluLe` et `imprevu` (problème créé directement), `risques` (avec leurs actions de traitement), `actions` et `decisions`, `changements` (demandes de changement : impacts, statut, arbitrage), `gonogo` (critères de mise en production, anomalies, décision), `livrables`, `retex`, `budget`, `backlog` (imports CSV datés), `flash` (flash reports par semaine), `raci`, `charge`.
- Les captures d'écran sont rattachées à l'élément qui les contient (`captures: [{ id, fichier, nom, date }]`) ; les images sont dans `documents/captures/`.

**Fichier commun (`_commun.json`) :**

```json
{ "app": "cockpit-projet", "type": "commun", "version": 3, "actif": "<id du projet ouvert>", "annuaire": [],
  "calendrier": { "alsace": false, "pentecoteTravaillee": false, "fermetures": [] },
  "theme": "inter", "tuiles": { "n": 3, "cols": [["avancement", "meteo"], ["risques", "decisions"], ["echeances", "interlocuteurs"]] },
  "modeles": [ { "id": "…", "nom": "…", "phase": "cadrage", "cat": "doc", "desc": "…", "fichier": { "nom": "…docx", "taille": 0 } } ] }
```

**Compatibilité :** à l'ouverture, la fonction `normaliser()` complète les données anciennes avec les nouvelles rubriques, sans rien perdre. Un ancien mode « un seul fichier » (tous les projets dans un JSON unique, `version: 2`) reste lisible.

### 4.4 Données conservées dans le navigateur

| Emplacement | Contenu | Rôle |
|---|---|---|
| `localStorage` · clé `radar-risques-v1` | Copie de toutes les données | **Cache uniquement**. La référence reste le dossier. |
| IndexedDB · base `radar-risques`, magasin `kv` | Le « handle » du dossier choisi (clé `dir`) | Chrome / Edge : retrouver le dossier à la prochaine ouverture. |
| `localStorage` · clé `cockpit-stockage` | `serveur` si l'utilisateur a choisi « dossier de l'appli » | Repartir dans ce mode à la prochaine ouverture. |
| `localStorage` · clé `cockpit-theme` | Le thème choisi | L'appliquer dès l'écran d'accueil (la référence reste `_commun.json`). |

Vider les données du site dans Chrome oblige simplement à re-sélectionner le dossier : **aucune perte**.

### 4.5 Sauvegarde, partage, confidentialité

- **Sauvegarde :** il suffit de sauvegarder le dossier de données (Time Machine, copie, outil de l'entreprise). Il peut aussi se trouver dans un dossier synchronisé (OneDrive…) pour bénéficier de la sauvegarde.
- **Pas d'édition simultanée :** deux personnes, ou deux navigateurs ouverts en même temps sur le même dossier (Chrome et Safari par exemple), ne doivent pas modifier les mêmes données en même temps. Il n'y a ni verrou ni fusion : la dernière écriture l'emporte.
- **Partage d'un projet :** Réglages › Mes projets › *Fichier du projet* télécharge le JSON du projet. Le destinataire l'ouvre avec *Ajouter un projet*. Les pièces jointes et les captures (`documents/`) ne sont pas incluses.
- **Confidentialité :** les données sont en JSON non chiffré, protégées par les droits du compte utilisateur sur le poste. Rien n'est transmis à un tiers. Les e-mails passent par des liens `mailto:` (rien n'est envoyé sans l'utilisateur) et les invitations sont des fichiers `.ics` téléchargés.

### 4.6 Mode « dossier de l'appli » : le serveur local écrit les fichiers (Safari, Firefox)

Safari et Firefox ne savent pas écrire dans un dossier du poste. Dans ce cas, l'appli confie les lectures et écritures à `serveur.py` :

| Route | Rôle |
|---|---|
| `GET /api/info` | Nom et chemin du dossier de données |
| `GET /api/liste?chemin=…` | Contenu d'un dossier (hors fichiers cachés) |
| `GET /api/fichier?chemin=…` | Lire un fichier |
| `PUT /api/fichier?chemin=…` | Écrire un fichier (écriture atomique : fichier temporaire puis remplacement) |
| `DELETE /api/fichier?chemin=…` | Supprimer un fichier (projet envoyé à la corbeille, capture retirée) |
| `POST /api/dossier?chemin=…` | Créer un sous-dossier (`documents/…`, `corbeille`) |

Côté appli, deux petites classes (`DossierServeur`, `FichierServeur`) imitent les « poignées » de fichier de Chrome : le reste du code est identique dans les deux modes.

**Dossier des données du serveur**, par ordre de priorité :
1. la variable d'environnement `COCKPIT_DONNEES` ;
2. la clé `"dossier_donnees"` d'un fichier `config.json` placé à côté de `serveur.py`, par exemple `{ "dossier_donnees": "~/Documents/Cockpit Projet - données" }` ;
3. sinon, le dossier de l'appli lui-même.

**Sécurité :**
- le serveur n'écoute que sur `127.0.0.1` : injoignable depuis un autre poste ;
- il refuse toute requête dont l'en-tête `Host` n'est pas `localhost` / `127.0.0.1` (protection contre le *DNS rebinding*) ;
- toute modification exige l'en-tête `X-Cockpit: 1`, qu'une page d'un autre site ne peut pas envoyer (protection CSRF) ;
- les écritures sont limitées aux fichiers `.json` à la racine du dossier de données et aux sous-dossiers `documents/` et `corbeille/`. Les fichiers de l'appli (`app.js`, `index.html`…), les chemins avec `..` et les fichiers cachés sont refusés.

---

## 5. Architecture logicielle

### 5.1 Vue d'ensemble

```
 Navigateur                                                 Poste de l'utilisateur
┌───────────────────────────────────────────┐            ┌──────────────────────────────┐
│ index.html                                │  HTTP      │ serveur.py (127.0.0.1:8765)  │
│  ├─ data.js   catalogue des risques       │◀───────────│ · sert l'appli               │
│  ├─ app.js    état + rendu + événements   │  /api/…    │ · lit / écrit les données    │
│  └─ style.css thèmes                      │◀──────────▶│   (Safari, Firefox)          │
│                                           │            └──────────────┬───────────────┘
│  État en mémoire  S                       │                           │
│   · Chrome / Edge ── File System Access ──┼──────────▶ Dossier de données (JSON,
│   · Safari / Firefox ─── via le serveur ──┼───────────────────────────┘  documents/, corbeille/)
│  Cache            localStorage            │
│  Handle dossier   IndexedDB (Chrome)      │
└───────────────────────────────────────────┘
```

### 5.2 Organisation du code (`app.js`)

Tout le code est dans **une seule fonction auto-exécutée** (IIFE), sans module ni dépendance.

| Élément | Rôle |
|---|---|
| `S` | L'état : `{ projets, actif, annuaire, calendrier, theme, tuiles }`. C'est ce qui est enregistré. |
| `ui` | L'état d'affichage (onglet ouvert, filtres…). Il n'est pas enregistré. |
| `render()` | Redessine l'écran courant à partir de `S` et `ui`, en générant du HTML (*template strings*). |
| `save()` | Met à jour le cache, puis programme l'écriture dans le dossier (`planifierEcriture`). |
| `MODULES` | La liste des onglets du projet : `cockpit`, `identite`, `planif` (dont le Go / No-Go et les tâches de préparation), `backlog`, `risques`, `instances` (« Réunions & copils » : réunions et comptes rendus, préparation du copil, diapos), `decisions`, `livrables`, `budget`, `retex`. L'ancien onglet `cr` est redirigé vers `instances`. |
| Écouteurs délégués | Un écouteur `click` / `input` / `change` sur le document par domaine. Chaque bouton porte un attribut `data-act` préfixé : `pl-` planning, `in-` instances, `cr-` comptes rendus, `dc-` décisions, `bl-` backlog, `bu-` budget, `rx-` retex, `fl-` flash report, `cap-` captures, `chg-` demandes de changement, `gn-` Go / No-Go, `tu-` tuiles de la vue d'ensemble, `fiche-` fiche d'identité, `et-` étapes du projet, `lv-` livrables, `tpl-` templates fournis, `mo-` templates personnels, `pb-` problèmes, `rg-` réglages… |
| Fenêtres | `openModal(html)` / `closeModal()`. |
| Navigation | `renderTabs()` : ligne d'onglets du projet et ligne de sous-onglets (y compris portefeuille, annuaire, retex), toujours sur une ligne, flèches de défilement (`flechesNav`) si elle déborde. |
| Thèmes | Classe `theme-sobre` ou `theme-fun` sur `<html>` (`syncTheme`) ; le thème Sobre retire les emojis décoratifs à l'affichage (`MutationObserver`). |

### 5.3 Fonctions métier notables

- **Planning :** `genererPlanning()` crée phases, sprints (toujours un lundi), jalons, cérémonies et copils selon la méthode (Agile / Hybride / Cycle en V). Il ne recalcule que les éléments **non verrouillés** (🔒). `diffPlanning()` produit l'aperçu de « Recalculer ».
- **Calendrier :** `ouvre`, `ouvreAvant`, `addOuvres` sautent les week-ends, les **jours fériés français** (Pâques calculé par l'algorithme de Meeus, option Alsace-Moselle, Pentecôte) et les fermetures de l'entreprise.
- **Types de réunion :** `TYPES_REU` ; réglages par planning dans `pl.types` (complétés par `typesComplets()` pour les plannings anciens). Cadrage (1er jour), entretiens utilisateurs (un par semaine, `nombre`), points d'avancement métier (`tousLes` semaines, `jourSemaine`). Un type activé en cours de projet part de sa date d'activation (`depuis`). Ordres du jour types dans `ordreDuJour()`.
- **Tâches de préparation :** `syncTaches()` crée et déplace les actions automatiques liées aux réunions (fenêtre de 45 jours).
- **Risques :** criticité = probabilité × gravité (1 à 3 chacune).
- **Backlog :** import CSV avec détection du séparateur et des colonnes, classement des statuts, vélocité calculée sur les 3 derniers sprints terminés.
- **Demandes de changement :** registre `changements` ; l'arbitrage crée la décision dans le journal et peut décaler les jalons impactés et ajouter un poste au budget.
- **Go / No-Go :** 14 critères par défaut (5 bloquants), anomalies de recette, recommandation calculée (`evalGoNoGo`) ; la décision est enregistrée dans le journal.
- **Rapport de portefeuille :** synthèse tous projets (`vueRapportPortefeuille`) : météo, avancement, prochain jalon, points de vigilance, arbitrages, mise en production.
- **Vue d'ensemble :** 27 tuiles au choix (`TUILES`), dont étape du projet, problèmes, avancement réel, objectifs, temps passé, réunions à préparer et tendances, disposées en colonnes libres : `S.tuiles = { n, cols }` (1 à 4 colonnes, une liste de tuiles par colonne ; l'ancienne liste simple est convertie par `dispoTuiles`). Glisser-déposer en direct dans n'importe quelle colonne (`dispoDeLaGrille` relit la disposition à l'écran), animé (`animerTuiles`, technique FLIP).
- **Fiche d'identité :** mode lecture (`vueIdentiteLecture`) et mode saisie.
- **Étapes du projet :** 10 étapes types (`ETAPES` : opportunité, besoins, cadrage, consultation & contractualisation, conception, réalisation, recette, déploiement, accompagnement, clôture), chacune avec ses pages, ses templates et ses critères de sortie calculés sur les données (`criteresEtape`). Réglage par projet dans `etapes` : `mode` (`timeline` ou `libre`), `actives`, `dates` (sinon reprises des phases du planning, `datesProposees`), `courante`, `terminees`. Bandeau `#etapes` (`renderEtapes`) et onglets filtrés par étape dans `renderTabs`. Nouveaux projets en timeline ; projets existants sans réglage en libre.
- **Templates de documents :** 17 modèles (`TEMPLATES`, sous-onglet de Livrables & docs), pré-remplis par `ctxTpl()` avec les données du projet. Un même HTML (`htmlTemplate`) sert à l'aperçu, à l'impression et au téléchargement Word : un fichier HTML enregistré en `.doc` (`docWord`), que Word ouvre directement. « ＋ Livrable » crée le livrable et range ce fichier dans `documents/<code> - <nom>/`. Aucune bibliothèque externe.
- **Templates personnels :** fichiers de l'entreprise (tout format) rangés dans `documents/templates/`, décrits dans `_commun.json` (`modeles` : `id`, `nom`, `phase`, `cat`, `desc`, `fichier`). Communs à tous les projets. « ＋ Livrable » copie le fichier dans les documents du projet ; « Retirer » déplace le fichier dans `corbeille/`.
- **Balises des templates personnels :** `{{projet}}`, `{{chef_de_projet}}`, etc. (`BALISES`, valeurs par `valeursBalises`). `remplirFichier()` lit l'archive OOXML (.docx, .xlsx, .pptx et variantes) avec un lecteur zip minimal (`lireZip`, décompression par `DecompressionStream("deflate-raw")`), remplace les balises dans les parties de texte (document, en-têtes, pieds, sharedStrings, feuilles, diapos, notes), puis réécrit l'archive sans compression (`ecrireZip`, CRC32). Une balise découpée par Word en plusieurs « runs » est reconnue (`RX_BALISE_XML`) et les balises XML intermédiaires sont conservées. Fichiers .txt, .md, .csv et .html : remplacement direct. Les balises trouvées à l'ajout du modèle sont mémorisées (`modeles[].balises`).
- **Problèmes :** un risque au statut `survenu` est un problème (`estProbleme`, `problemesOuverts`) ; `CLOS` inclut `survenu`, il sort donc des risques ouverts, de la matrice et des compteurs. Vue `vueProblemes` (sous-onglet Risques › Problèmes).
- **Tendances :** `INDICATEURS` (météo, avancement réel, temps écoulé, backlog, risques, critiques, problèmes, actions en retard, glissement, budget) ; `photoSemaine()` met à jour la photo de la semaine à chaque affichage ; courbes SVG dans `vueTendances` (Vue d'ensemble › Tendances) et la tuile `tendances`.
- **Avancement réel :** `avancementReel()` = moyenne des `% réalisé` des phases pondérée par leur durée, comparée au prévu (part du temps écoulé de chaque phase, `prevuPhase`) ; sans phase, l'avancement du backlog.
- **Rapport à partager :** `ouvrirRapportPartage()` assemble des vues existantes (fiche, frise, tendances, risques, problèmes, Go / No-Go) et des tableaux (décisions, actions, livrables) dans un HTML autonome, avec `style.css` intégré et les boutons masqués.
- **Export en tâches :** `ouvrirExportTaches()` : CSV pour l'import de tâches d'Outlook (Windows) ou `.ics` contenant des `VTODO`.
- **État d'une réunion :** `statutCR()` (À préparer, Préparation en cours, Prête, CR à rédiger / à finaliser, Réalisée) ; barre d'état en 3 étapes dans la fiche de réunion (`barreEtatReu`). « Marquer comme prête » renseigne `prepareeLe` et coche les tâches de préparation automatiques de la réunion (marquées `faitParPrep`, décochées si l'on revient en arrière).
- **Mode capture :** classe `capture` sur `<body>` (barres et boutons masqués) ; un seul bouton de sortie commun (`#sortieCapture`, réduit après 4 s en une pastille « ✕ » toujours visible, complet au survol), touche Échap, et sortie automatique à chaque changement de page (`allerA`).
- **Captures et liens :** images collées converties en WebP et rangées dans `documents/captures/` ; liens web rendus cliquables partout.
- **Exports :** CSV, `.ics` (calendrier, fuseau Europe/Paris), impression / PDF via une fenêtre du navigateur.

### 5.4 API du navigateur utilisées

| API | Usage |
|---|---|
| File System Access (`showDirectoryPicker`, `showOpenFilePicker`, `showSaveFilePicker`) | Chrome / Edge : lire et écrire les fichiers de données dans le dossier choisi. |
| `fetch` vers `/api/…` | Safari / Firefox (ou choix « dossier de l'appli ») : lecture et écriture des fichiers par le serveur local. |
| `<input type="file">` | Choisir un fichier à joindre ou à importer, dans tous les navigateurs. |
| IndexedDB | Mémoriser le dossier choisi. |
| localStorage | Cache des données. |
| Événements `paste`, glisser-déposer, `canvas.toBlob` | Captures d'écran collées, converties en WebP (2 000 px max). |
| `MutationObserver` | Affichage des vignettes et liens cliquables dans tous les écrans. |
| `fetch` (requête `HEAD` sur `app.js`, toutes les 30 s) | Détecter une nouvelle version et afficher le bandeau « Recharger ». |
| `Intl` | Formats de dates et de montants en français. |

---

## 6. Mises à jour de l'application

1. Remplacez `index.html`, `app.js`, `style.css`, `data.js` (et `manuel/` si besoin) par les nouvelles versions. **Ne touchez pas au dossier de données.**
2. Dans `index.html`, les fichiers sont appelés avec un paramètre de version (`app.js?v=AAAAMMJJHHMMSS`). Changez-le à chaque livraison pour forcer le rechargement.
3. Les utilisateurs dont l'appli est ouverte voient, dans les 30 secondes, le bandeau **« ✨ Une nouvelle version est disponible · 🔄 Recharger »**.
4. Les données existantes sont reprises automatiquement (`normaliser()`).
5. **Si `serveur.py` a changé**, le bandeau ne suffit pas : fermez la fenêtre Terminal (ou d'invite de commandes) et relancez « Lancer Cockpit Projet » pour démarrer la nouvelle version du serveur.

**Avant une mise à jour importante :** faites une copie du dossier de données.

---

## 7. Développement et tests

- **Aucun outil de compilation.** On modifie directement `app.js` / `style.css`, puis on recharge la page.
- **Vérifier la syntaxe** du JavaScript (si Node.js est installé) :
  ```bash
  node --check app.js
  ```
- **Serveur de test séparé** sur le port **8766** (configuration `.claude/launch.json`) : c'est une autre origine, donc un cache et un dossier distincts. Les tests n'affectent pas les données réelles.
- **Tests :** il n'y a pas de tests automatisés. Les vérifications se font à la main, dans le navigateur, avec un dossier de test.
- **Tester le mode Safari dans Chrome :** lancer un second serveur sur un dossier de test (`COCKPIT_DONNEES=/chemin/test python3 serveur.py 8798`) et retirer à la page les fonctions de dossier de Chrome (`showDirectoryPicker`…) avant son chargement : l'appli passe alors par le serveur, exactement comme dans Safari.
- **Manuel utilisateur :** les captures sont générées avec Chrome sans interface, piloté par le protocole DevTools. Les scripts sont dans `manuel/outils/` (Node.js 18+ requis) :
  1. servir le dossier de l'appli sur le port 8766 (`python3 -m http.server 8766`) ;
  2. `lancer.sh` démarre le pilote (`pilote.mjs`) ;
  3. `remplir_opfs.js` (via `c.py evalf`) recrée le dossier de démo dans l'espace privé du navigateur de test : les deux projets de démonstration du dossier, plus deux petits projets tirés de `seed.js` (Migration, Réservation) ;
  4. `tout.sh` enchaîne tous les lots de captures (`lot*.py` → `shots.py`) ; `planches2.py` produit des planches-contact pour vérifier les images.

  Ce n'est utile que pour régénérer les images.

---

## 8. Limites connues

| Limite | Conséquence | Piste |
|---|---|---|
| Safari / Firefox : dossier fixe | Ces navigateurs ne peuvent pas choisir un dossier : ils utilisent celui configuré dans `serveur.py`. | `config.json` (§4.6). |
| Mono-utilisateur | Pas de travail à plusieurs en temps réel sur un même projet. | Hébergement + base de données (refonte importante). |
| Serveur à lancer | Si la fenêtre Terminal (Mac) ou d'invite de commandes (Windows) est fermée, la page affiche une erreur. | Relancer le lanceur. |
| Accès au dossier redemandé | Chrome demande une confirmation à chaque nouvelle session. | Comportement de sécurité du navigateur. |
| Pièces jointes hors du fichier projet | Le partage d'un projet n'emporte pas ses fichiers joints ni ses captures. | Envoyer aussi le dossier `documents/`. |
| Données non chiffrées | La protection repose sur la session de l'utilisateur. | Chiffrement du disque (FileVault / BitLocker), recommandé de toute façon. |

---

## 9. Dépannage technique

| Symptôme | Cause probable | Solution |
|---|---|---|
| `Error response 404` sur `localhost:8765` | Le serveur sert un ancien chemin (dossier renommé ou déplacé). | Fermer la fenêtre Terminal et relancer le lanceur. |
| `Ce site est inaccessible` | Serveur arrêté. | Relancer le lanceur. |
| « Ouverture de tes données… » sans fin (Chrome) | L'accès direct au dossier (File System Access) ne répond pas : lecture d'IndexedDB, `queryPermission` ou lecture du dossier. | Automatique : chaque étape du démarrage a un délai de 6 s (`avecDelai`) ; au-delà, l'appli bascule sur le petit serveur si celui-ci sert le même dossier (même nom) et mémorise ce mode. L'écriture qui suit l'ouverture ne bloque plus l'affichage. |
| Port 8765 déjà utilisé par un autre programme | Conflit de port. | `python3 serveur.py 8770` (Windows : `py -3 serveur.py 8770`), puis ouvrir `http://localhost:8770`. Attention : nouvelle origine, le dossier sera redemandé. |
| Windows : « Python 3 est nécessaire » alors qu'il est installé | Python absent du PATH. | Réinstaller Python en cochant « Add python.exe to PATH », ou installer la version du Microsoft Store. |
| Windows : la fenêtre s'ouvre puis se ferme aussitôt | Erreur au démarrage. | Ouvrir une invite de commandes dans le dossier et lancer le `.bat` à la main pour lire le message. |
| « Le petit serveur de Cockpit Projet ne répond pas » (Safari, Firefox) | L'appli a été ouverte sans le lanceur, ou le serveur est arrêté. | Relancer « Lancer Cockpit Projet », puis recharger la page. |
| « Impossible d'écrire dans le dossier de données » | Dossier supprimé, déplacé, en lecture seule, ou disque plein. | Vérifier le dossier, puis Réglages › Mes données › changer de dossier. |
| Nouveauté non visible | Ancienne version en cache. | Bandeau « Recharger » ou `Cmd + Maj + R` (`Ctrl + Maj + R` sous Windows). |
| Inspecter une erreur | — | Chrome › Afficher › Options pour les développeurs › Console JavaScript. |
