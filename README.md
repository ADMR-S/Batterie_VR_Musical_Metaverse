# Batterie VR basée sur un Web Audio Module

## Version JS (depuis js_old):
Lancer index.html depuis Live Server (VSCode)

Saisir dans le terminal (pour servir en https, sinon WebXR ne fonctionne pas) : 
  ngrok http 5500

## Version TS (à jour)
  
### Hébergée sur render :
https://batterie-vr-musical-metaverse.onrender.com/

### Ou build local avec vite (depuis dossier ts/) :
  
Installer les dépendances :
  npm i

Générer clés SSL pour servir en https : 
  openssl req -x509 -newkey rsa:4096 -keyout localhost.key -out localhost.crt -days 365 -nodes -subj "/CN=localhost"

Déployer localement :
  npm run dev

Accéder à l'URL depuis un casque connecté au même réseau Wi-Fi

Debug : 

  (Via adb) Check connection casque : 
    adb devices

  Devtools : 
    chrome://inspect/#devices


## Base Modèle 3D drumkit :
  https://free3d.com/3d-model/drum-set-41081.html

---------------------------------------------------------------

Outils de dev : 

BabylonJS Sandbox :
  https://sandbox.babylonjs.com/

+ extension Spector.js