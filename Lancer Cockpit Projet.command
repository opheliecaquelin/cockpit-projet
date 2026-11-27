#!/bin/bash
# Lance Cockpit Projet : démarre le petit serveur local (port 8765) puis ouvre l'appli dans Chrome.
# Double-clique sur ce fichier dans le Finder. Laisse la fenêtre Terminal ouverte pendant que tu utilises l'appli.

cd "$(dirname "$0")" || exit 1
PORT=8765
URL="http://localhost:$PORT"

if curl -s -o /dev/null "$URL"; then
  echo "Cockpit Projet tourne déjà sur $URL"
else
  echo "Démarrage de Cockpit Projet sur $URL …"
  # petit serveur local qui demande au navigateur de toujours prendre la dernière version de l'appli
  python3 "serveur.py" "$PORT" >/dev/null 2>&1 &
  SERVEUR=$!
  for i in 1 2 3 4 5 6 7 8 9 10; do curl -s -o /dev/null "$URL" && break; sleep 0.5; done
fi

if [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" "$URL"
elif [ -d "/Applications/Microsoft Edge.app" ]; then
  open -a "Microsoft Edge" "$URL"
else
  echo "Chrome ou Edge est nécessaire pour enregistrer les données dans des fichiers."
  open "$URL"
fi

if [ -n "$SERVEUR" ]; then
  echo ""
  echo "✅ Cockpit Projet est ouvert dans le navigateur."
  echo "   Laisse cette fenêtre ouverte. Pour arrêter l'appli : ferme cette fenêtre (ou Ctrl + C)."
  wait "$SERVEUR"
fi
