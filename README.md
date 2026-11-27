# Cockpit Projet

Application web légère de pilotage de projet : portefeuille, planning, risques, décisions, livrables et suivi.

## Vitrine en ligne

Après activation de GitHub Pages, la vitrine sera disponible à l'adresse :

<https://opheliecaquelin.github.io/cockpit-projet/>

Elle charge automatiquement les deux projets de démonstration et permet de naviguer dans les vues en lecture seule. Les contrôles de modification sont désactivés et aucune donnée n'est enregistrée. Les fichiers d'exemple sont publiés avec les sources.

Cette vitrine ne remplace pas l'application locale : elle ne partage aucune donnée entre visiteurs et n'est pas un service de stockage en ligne.

## Utiliser l'application locale

Les lanceurs macOS `.command` et Windows `.bat` restent le moyen normal d'utiliser l'application avec ses propres projets. Les données restent dans un dossier choisi sur l'appareil de la personne qui l'utilise. Elles ne sont pas envoyées au site et ne sont pas synchronisées entre utilisateurs.

Pour utiliser un projet sur plusieurs appareils, exporter son fichier JSON depuis l'application puis l'importer sur l'autre appareil. Éviter de publier des fichiers de données contenant des informations personnelles ou confidentielles.

## Lancer une copie locale

Python 3 est nécessaire pour le serveur local. Depuis ce dossier :

```bash
python3 serveur.py 8765
```

Puis ouvrir <http://localhost:8765>. Les lanceurs macOS et Windows sont également fournis.

## Contenu

- `index.html`, `app.js`, `style.css`, `data.js` : application web.
- `DEMO - Portail RH en ligne.json` et `SIGN - Signature électronique des contrats.json` : exemples de démonstration décrits comme fictifs dans la documentation technique.
- `manuel/` : manuel utilisateur et ressources associées.
- `DOCUMENTATION_TECHNIQUE.md` : architecture, installation et stockage des données.

Les données locales de l'application, captures privées et fichiers de corbeille sont exclus du dépôt par `.gitignore`.

## Hébergement

Le site statique est prévu pour GitHub Pages, à partir de la racine de ce dépôt. L'application ne nécessite ni compilation ni dépendance npm.

## Licence

Aucune licence de réutilisation n'est fournie. Le dépôt public permet de consulter et de récupérer les sources; il ne confère pas, à lui seul, de droits de modification ou de redistribution.
