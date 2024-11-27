const canvas = document.getElementById("renderCanvas"); // Get the canvas element
const engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine

//IMPORT WAM BATTERIE : https://www.webaudiomodules.com/community/plugins/burns-audio/drumsampler/index.js
const AudioContext = window.AudioContext // Default
	|| window.webkitAudioContext 
	|| false;
const audioContext = new AudioContext();
const mediaElementSource = audioContext.createMediaElementSource(player);

// Very simple function to connect the plugin audionode to the host
const connectPlugin = (audioNode) => {
	mediaElementSource.connect(audioNode);
	audioNode.connect(audioContext.destination);
};
const mountPlugin = (domNode) => {
	mount.innerHtml = '';
	mount.appendChild(domNode);
};
(async () => {
	// Init WamEnv
	const { default: initializeWamHost } = await import("https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js");
	const [hostGroupId] = await initializeWamHost(audioContext);
  // Import WAM
	const { default: WAM } = await import('https://www.webaudiomodules.com/community/plugins/burns-audio/drumsampler/index.js');
	// Create a new instance of the plugin
	const instance = await WAM.createInstance(hostGroupId, audioContext);
	window.instance = instance;
  // Connect the audionode to the host
	connectPlugin(instance.audioNode);
  const pluginDomNode = await instance.createGui();

	mountPlugin(pluginDomNode);
  player.onplay = () => {
		audioContext.resume(); // audio context must be resumed because browser restrictions
	};
})();


const createScene = async function () {
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    
    // Créer le cylindre (élément de la batterie)
    const cylinder = BABYLON.MeshBuilder.CreateCylinder("cylinder", { diameter: 1, height: 0.5 }, scene);
    cylinder.position = new BABYLON.Vector3(0, 1, 0); // Ajuster la hauteur selon besoin

    // Charger le son pour le coup
    const drumSound = new BABYLON.Sound("drumSound", "sons/drum-hit.mp3", scene);

    const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 6, height: 6}, scene);
    const env = scene.createDefaultEnvironment();
    // Ajouter le support XR
    const xr = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [env.ground],
    });

    // Détection de collision avec les contrôleurs
    xr.input.onControllerAddedObservable.add((controller) => {
        const controllerMesh = BABYLON.MeshBuilder.CreateBox("controllerMesh", { size: 0.1 }, scene);
        controllerMesh.parent = controller.grip;

        // Vérifie la collision à chaque image
        scene.registerBeforeRender(() => {
            if (controllerMesh.intersectsMesh(cylinder, false)) {
                console.log("Collision détectée avec le cylindre !");
                drumSound.play(); // Jouer le son de batterie
            }
        });
    });


    return scene;
};

(async () => {
    const scene = await createScene(); // Appel asynchrone de createScene
    engine.runRenderLoop(function () {
        scene.render();
    });
})();

window.addEventListener("resize", function () {
    engine.resize();
});
