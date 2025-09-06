const canvas = document.getElementById("renderCanvas"); // Get the canvas element
const engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine
const player = document.querySelector('#player');
const AudioContext = window.AudioContext // Default
	|| window.webkitAudioContext 
	|| false;
const audioContext = new AudioContext();
const mediaElementSource = audioContext.createMediaElementSource(player);


var delay = 0;
let wam;
var scene;


(async () => {
    // Wait for user interaction to initialize the audio context
    await new Promise(resolve => {
        document.addEventListener('click', resolve, { once: true });
    });

    
    // Import WAM
	const { default: WAM } = await import('https://www.webaudiomodules.com/community/plugins/burns-audio/drumsampler/index.js');
    // Init WamEnv
    //const { default: initializeWamHost } = await import("https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js");
    const { default: initializeWamHost } = await import("https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js");
    const [hostGroupId] = await initializeWamHost(audioContext);
    // Create a new instance of the plugin
	const instance = await WAM.createInstance(hostGroupId, audioContext);
	window.instance = instance;
    // Connect the audionode to the host
	connectPlugin(instance.audioNode);
    //const pluginDomNode = await instance.createGui(); OSEF ?

    })();

    const initHost = async (audioContext) => {
        const { default: initializeWamHost } = await import("https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js");
        const [, key] = await initializeWamHost(audioContext, "example");
        hostKey = key;
      };

      
    // Load a WebAudioModule, and return an instance.
    async function loadWAM(path) {
        const initialState = {};
        const {default: WAM} = await import(path);
        
        if (typeof WAM !== 'function' || !WAM.isWebAudioModuleConstructor) {
        throw new Error(`Path ${path} is not a WebAudioModule.`)
        };
        
        const instance = new WAM("example", audioContext)
        await instance.initialize(initialState)
        
        return instance;
    }

    async function run(wamUrl) {
  
        await initHost(audioContext);

        wam = await loadWAM(wamUrl)
        
        /*
        // create the UI and add it to the container
        const ui = await wam.createGui()
        const container = document.getElementById("wam-container")
        container.appendChild(ui)
        */  
        
        wam.audioNode.connect(audioContext.destination); 
    }

   // Very simple function to connect the plugin audionode to the host
const connectPlugin = (audioNode) => {
	mediaElementSource.connect(audioNode);
	audioNode.connect(audioContext.destination);
}; 

const createScene = async function () {
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    
    const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 6, height: 6}, scene);
    const env = scene.createDefaultEnvironment();
    // Ajouter le support XR
    const xr = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [env.ground],
    });
/*
    var controllerImpostor1 = new WebXRControllerPhysics();
    controllerImpostor1.init(xr.input.controllers[0], scene);
    var controllerImpostor2 = new WebXRControllerPhysics();
    controllerImpostor2.init(xr.input.controllers[1], scene);
*/
    // Détection de collision avec les contrôleurs
    xr.input.onControllerAddedObservable.add((controller) => {

        controller.onMeshLoadedObservable.add((mesh) => {
            mesh.showBoundingBox = true;
            mesh.material = new BABYLON.StandardMaterial("wireframeMaterial", scene);
            mesh.material.wireframe = true;

        });

        const controllerMesh = BABYLON.MeshBuilder.CreateBox("controllerMesh", { size: 0.1 }, scene);
        controllerMesh.parent = controller.grip;

        
        // Ajouter un corps physique aux manettes
        var controllerBody = new BABYLON.PhysicsBody(controllerMesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
        var controllerShape = new BABYLON.PhysicsShapeSphere(controllerMesh.position, 0.1, scene);
        controllerBody.shape = controllerShape;
    
        });

/*
        // Vérifie la collision à chaque image (max 1 fois par seconde)
        scene.registerBeforeRender(() => {
            if (controllerMesh.intersectsMesh(cylinder, true)) { //True pour que la bounding box ressemble au mesh
                    if(delay%60 === 0){
                    console.log("Collision détectée avec le cylindre !");
                    snare.play(); // Jouer le son de batterie
                    //wam.audioNode.scheduleEvents({ type: 'wam-midi', time: wam.audioNode.context.currentTime, data: { bytes: new Uint8Array([0x90, 74, 100]) } });
                    //wam.audioNode.scheduleEvents({ type: 'wam-midi', time: wam.audioNode.context.currentTime + 0.25, data: { bytes: new Uint8Array([0x80, 74, 100]) } });        
                    }
                    delay++;
            }
        }); */

        
        // Créer le cylindre (élément de la batterie)
        const cylinder = BABYLON.MeshBuilder.CreateCylinder("cylinder", { diameter: 1, height: 0.5}, scene);
        cylinder.position = new BABYLON.Vector3(0, 1, 0); // Ajuster la hauteur selon besoin
        cylinder.showBoundingBox = true;
        cylinder.showBoundingSphere = true;
        
        cylinder.material = new BABYLON.StandardMaterial("wireframeMaterial", scene);
        cylinder.material.wireframe = true;
    
        // Charger le son pour le coup
        const drumSound = new BABYLON.Sound("drumSound", "sons/drum-hit.mp3", scene);
        const snare = new BABYLON.Sound("snare", "https://burns.ca/static/909/snare.wav", scene);
        
        /*
        cylinder.isTrigger(true); //Activer les triggers sur collision
    
        const observable = controllerMesh.onTriggerCollisionObservable;
        const observer = observable.add((collisionEvent) => {
            if (collisionEvent.type === "TRIGGER_ENTERED") {
                if(delay%60 === 0){
                    console.log("Collision détectée avec le cylindre !");
                    snare.play(); // Jouer le son de batterie
                    //wam.audioNode.scheduleEvents({ type: 'wam-midi', time: wam.audioNode.context.currentTime, data: { bytes: new Uint8Array([0x90, 74, 100]) } });
                    //wam.audioNode.scheduleEvents({ type: 'wam-midi', time: wam.audioNode.context.currentTime + 0.25, data: { bytes: new Uint8Array([0x80, 74, 100]) } });        
                    }
                    delay++;
                }
        });*/

        globalThis.HK = await HavokPhysics();
        //var hk = getInitializedHavok();
        var hk = new BABYLON.HavokPlugin();
        scene.enablePhysics(undefined, hk);

    
        var triggerShapeRadius = 0.5;
        var triggerShape = new BABYLON.PhysicsShapeSphere(new BABYLON.Vector3(0,0,0), triggerShapeRadius, scene);
        const triggerShapeRepr = BABYLON.MeshBuilder.CreateSphere("triggerShapeRepr", {diameter: triggerShapeRadius*2});
        triggerShapeRepr.material = new BABYLON.StandardMaterial("mat");
        triggerShapeRepr.material.alpha = 0.7;
        triggerShapeRepr.material.diffuseColor = BABYLON.Color3.Red();
        triggerShape.isTrigger = true;
        var triggerTransform = new BABYLON.TransformNode("triggerTransform");
        var triggerBody = new BABYLON.PhysicsBody(triggerTransform, BABYLON.PhysicsMotionType.STATIC, false, scene);
        triggerBody.shape = triggerShape;
    
        hk.onTriggerCollisionObservable.add((ev) => {
            // console.log(ev);
            console.log(ev.type, ':', ev.collider.transformNode.name, '-', ev.collidedAgainst.transformNode.name);
        });
     

    return scene;
};



(async () => {
    scene = await createScene(); // Appel asynchrone de createScene
    engine.runRenderLoop(function () {
        scene.render();
    });
})();
window.onload = (event) => {
    window.addEventListener("resize", function () {
        engine.resize();
    });
    // Ensure the audio context is created on user interaction (sinon erreur pour raisons de sécurité)
    document.addEventListener('click', () => {
        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume().then(() => {
                console.log("Audio context resumed.");
            });
        }
    });
};