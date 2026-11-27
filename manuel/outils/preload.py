import json, urllib.request
# Fait « oublier » au Chrome de test les fonctions de dossier qu'il a et que Safari n'a pas
src = ("delete window.showDirectoryPicker; delete window.showOpenFilePicker; delete window.showSaveFilePicker;"
       "delete Window.prototype.showDirectoryPicker; delete Window.prototype.showOpenFilePicker; delete Window.prototype.showSaveFilePicker;")
r = urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:9400/preload", data=json.dumps({"source": src}).encode(), method="POST"), timeout=20)
print(r.read()[:200])
