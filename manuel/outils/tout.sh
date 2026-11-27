#!/bin/bash
# Refait toutes les captures du manuel, dans l'ordre (la capture de l'écran de connexion en dernier)
cd "$(dirname "$0")"
bash lancer.sh
python3 c.py eval 'document.querySelectorAll(".maj-bandeau").forEach(e => e.remove()); return 1' > /dev/null
python3 c.py eval 'await w(1500); return 1' > /dev/null
python3 lot2.py lot2.json && python3 shots.py lot2.json
python3 lot4.py && python3 shots.py lot4.json
python3 lot_lect2.py && python3 shots.py lot_lect2.json
python3 lot_b3e.py && python3 shots.py lot_b3e.json
python3 lot_r2.py && python3 shots.py lot_r2.json
python3 shots.py lot_tu2.json
python3 lot_tpl.py && python3 shots.py lot_tpl.json
python3 lot_mo.py && python3 shots.py lot_mo.json
python3 lot_etapes.py && python3 shots.py lot_etapes.json
python3 c.py evalf connexion.js > /dev/null
python3 c.py aller http://127.0.0.1:8766/ > /dev/null
python3 c.py vp 1280 800 > /dev/null
python3 shots.py lotc.json
# remet le dossier de démo pour les prochaines fois
python3 c.py eval "window.confirm = () => true; const root = await navigator.storage.getDirectory(); const d = await root.getDirectoryHandle('Cockpit Projet'); window.showDirectoryPicker = async () => d; await clic(btn('Choisir un dossier'), 1500); return 1" > /dev/null
curl -s -X POST localhost:9400/stop > /dev/null
pkill -f "remote-debugging-port=9333"
cd /Users/ophelie.caquelin/Cockpit_Projet/manuel/images
for f in [0-9]*.png; do
  w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}')
  if [ "$w" -gt 1920 ]; then sips --resampleWidth 1920 "$f" > /dev/null; fi
done
echo "terminé"
