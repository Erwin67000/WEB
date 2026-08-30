@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Photo + meuble 3D
echo.
python --version >nul 2>&1
if errorlevel 1 (
  echo Python n'est pas dans le PATH.
  echo Installez Python 3.10+ depuis https://www.python.org/downloads/
  echo et cochez "Add python.exe to PATH".
  pause
  exit /b 1
)
if not exist "poids\hub" (
  echo Premier lancement : installation des dependances et des poids...
  python installer.py
  if errorlevel 1 (
    echo Installation echouee.
    pause
    exit /b 1
  )
)
python lancer.py
if errorlevel 1 pause
