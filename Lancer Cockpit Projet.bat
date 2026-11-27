@echo off
rem ============================================================================
rem  Lance Cockpit Projet sous Windows : demarre le petit serveur local (port 8765)
rem  puis ouvre l'appli dans Chrome (ou Edge).
rem  Double-cliquez sur ce fichier. Laissez la fenetre ouverte pendant que vous
rem  utilisez l'appli : la fermer arrete Cockpit Projet.
rem ============================================================================
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Cockpit Projet
set "PORT=8765"
set "URL=http://localhost:%PORT%"

rem --- Navigateur : Chrome, sinon Edge ---------------------------------------
set "NAV="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "NAV=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "NAV=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined NAV if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "NAV=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined NAV (
  echo Chrome ou Edge est nécessaire pour enregistrer les données dans des fichiers.
  echo Installez Google Chrome, puis relancez ce fichier.
  pause
  exit /b 1
)

rem --- Déjà lancé ? On ouvre simplement le navigateur ------------------------
curl -s -o nul "%URL%" >nul 2>nul
if not errorlevel 1 (
  echo Cockpit Projet tourne déjà sur %URL%
  start "" "%NAV%" "%URL%"
  exit /b 0
)

rem --- Python 3 : lanceur « py », sinon « python » ---------------------------
set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY (
  where python >nul 2>nul && set "PY=python"
)
if not defined PY (
  echo Python 3 est nécessaire pour faire tourner Cockpit Projet.
  echo Installez-le depuis https://www.python.org ou le Microsoft Store, puis relancez ce fichier.
  pause
  exit /b 1
)

rem --- Ouvre le navigateur 2 secondes après le démarrage du serveur ----------
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process -FilePath '%NAV%' -ArgumentList '%URL%'"

echo.
echo   Cockpit Projet est lancé sur %URL%
echo   Laissez cette fenêtre ouverte. Pour arrêter l'appli : fermez-la (ou Ctrl + C).
echo.
%PY% serveur.py %PORT%
if errorlevel 1 (
  echo.
  echo Le serveur s'est arrêté avec une erreur ^(port %PORT% déjà utilisé par un autre programme ?^).
  pause
)
endlocal
