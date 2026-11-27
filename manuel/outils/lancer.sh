#!/bin/bash
# Démarre le pilote Chrome sans interface s'il ne tourne pas, puis ouvre l'appli de test
cd "$(dirname "$0")"
if ! curl -s -o /dev/null http://127.0.0.1:9400/eval; then
  nohup node pilote.mjs > pilote.log 2>&1 &
  for i in $(seq 1 15); do sleep 2; grep -q "prêt" pilote.log && break; done
fi
python3 c.py aller http://127.0.0.1:8766/ > /dev/null
echo "pilote prêt"
