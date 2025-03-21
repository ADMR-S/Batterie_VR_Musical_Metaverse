
// Création d'un contexte audio
const audioContext = new AudioContext();
let synthInstance;

async function setupWamHost() {
    const { default: initializeWamHost } = await import("https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js");
    const [hostGroupId] = await initializeWamHost(audioContext);
    return hostGroupId;
}

async function loadDynamicComponent(wamURI, hostGroupId) {
    try {
        const { default: WAM } = await import(wamURI);
        const wamInstance = await WAM.createInstance(hostGroupId, audioContext);
        return wamInstance;
    } catch (error) {
        console.error('Erreur lors du chargement du Web Component :', error);
    }
}

async function initializePlugin() {
    const hostGroupId = await setupWamHost();
    const wamURISynth = 'https://wam-4tt.pages.dev/Pro54/index.js';
    synthInstance = await loadDynamicComponent(wamURISynth, hostGroupId);
    synthInstance.audioNode.connect(audioContext.destination);

}

// Initialiser le plugin
initializePlugin();

// Création de la scène BabylonJS
var createScene = async function () {
    // Initialisation de la scène BabylonJS
    var scene = new BABYLON.Scene(engine);
    var camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    var light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    var sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: 2, segments: 32}, scene);
    sphere.position.y = 4;
    var ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 10, height: 10}, scene);

    // Initialisation du moteur physique
    var hk = new BABYLON.HavokPlugin();
    scene.enablePhysics(new BABYLON.Vector3(0, -9.8, 0), hk);
    var sphereAggregate = new BABYLON.PhysicsAggregate(sphere, BABYLON.PhysicsShapeType.SPHERE, { mass: 1, restitution: 0.75 }, scene);
    var groundAggregate = new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, scene);
    sphereAggregate.body.setCollisionCallbackEnabled(true);

    // Gestion des collisions et lecture des sons
    const started = hk._hknp.EventType.COLLISION_STARTED.value;
    const continued = hk._hknp.EventType.COLLISION_CONTINUED.value;
    const finished = hk._hknp.EventType.COLLISION_FINISHED.value;
    const eventMask = started | continued | finished;
    sphereAggregate.body.setEventMask(eventMask);

    const observable = sphereAggregate.body.getCollisionObservable();
    const observer = observable.add((collisionEvent) => {
        console.log("Collision détectée :", collisionEvent);
        if (synthInstance) {
            // Joue une note lors de la collision
            synthInstance.audioNode.scheduleEvents({
                type: 'wam-midi',
                time: audioContext.currentTime,
                data: { bytes: new Uint8Array([0x90, 74, 100]) } // Note ON
            });
            synthInstance.audioNode.scheduleEvents({
                type: 'wam-midi',
                time: audioContext.currentTime + 0.25,
                data: { bytes: new Uint8Array([0x80, 74, 100]) } // Note OFF
            });
        }
    });

    return scene;
};

// Créer la scène BabylonJS
createScene();