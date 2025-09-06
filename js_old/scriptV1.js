// Création d'un contexte audio
const audioContext = new AudioContext();
let synthInstance;
let physicsBodies = [];

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

    // Exemple de selection d'un autre son
    let state = await synthInstance.audioNode.getState();
    state.values.patchName = "Sync Harmonic";
    await synthInstance.audioNode.setState(state);

    synthInstance.audioNode.connect(audioContext.destination);
}

// Initialiser le plugin
initializePlugin();

// ----- END OF AUDIO INIT ------

var canvas = document.getElementById("renderCanvas");

var startRenderLoop = function (engine, canvas) {
    engine.runRenderLoop(function () {
        if (sceneToRender && sceneToRender.activeCamera) {
            sceneToRender.render();
        }
    });
}

var engine = null;
var scene = null;
var sceneToRender = null;
var createDefaultEngine = function () { return new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false }); };
var createScene = async function () {
    const scene = new BABYLON.Scene(engine);

    const xr = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [ground],
    });

    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 0, 0), scene);

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Our built-in 'sphere' shape.
    var sphere = BABYLON.MeshBuilder.CreateSphere("sphere", { diameter: 2, segments: 32 }, scene);
    physicsBodies.push(sphere);
    // Move the sphere upward at 4 units
    sphere.position.y = 4;
    sphere.position.z = 10;

    // Our built-in 'ground' shape.
    var ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);

    //Good way of initializing Havok
    // initialize plugin
    const havokInstance = await HavokPhysics();
    // pass the engine to the plugin
    const hk = new BABYLON.HavokPlugin(true, havokInstance);
    // enable physics in the scene with a gravity
    scene.enablePhysics(new BABYLON.Vector3(0, -9.8, 0), hk);

 
    // Create a sphere shape and the associated body. Size will be determined automatically.
    var sphereAggregate = new BABYLON.PhysicsAggregate(sphere, BABYLON.PhysicsShapeType.SPHERE, { mass: 1, restitution: 0.2 }, scene);

    // Create a static box shape.
    var groundAggregate = new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, scene);

    sphereAggregate.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC); // Set motion type to DYNAMIC
    sphereAggregate.body.setCollisionCallbackEnabled(true);


    const started = hk._hknp.EventType.COLLISION_STARTED.value;
    const continued = hk._hknp.EventType.COLLISION_CONTINUED.value;
    const finished = hk._hknp.EventType.COLLISION_FINISHED.value;

    const eventMask = started | continued | finished;
    sphereAggregate.body.setEventMask(eventMask);

    const observable = sphereAggregate.body.getCollisionObservable();

    const scaleTextExample = majorScale(nameToMidi("C4"));
    const scaleMidi = arpeggiator(scaleToMidi(scaleTextExample), "alternate");

    console.log(scaleMidi); // [60, 64, 67, 69, 78]

    let currentNote = 0;

    const observer = observable.add((collisionEvent) => {
        //console.log("Collision détectée :", collisionEvent);
       if(collisionEvent.type !== "COLLISION_STARTED") return;

       console.log("ON JOUE")

        const noteMdiToPlay = scaleMidi[currentNote++];

        if (synthInstance) {
            // Joue une note lors de la collision
            synthInstance.audioNode.scheduleEvents({
                type: 'wam-midi',
                time: audioContext.currentTime,
                data: { bytes: new Uint8Array([0x90, noteMdiToPlay, 100]) } // Note ON
            });
            synthInstance.audioNode.scheduleEvents({
                type: 'wam-midi',
                time: audioContext.currentTime + 0.25,
                data: { bytes: new Uint8Array([0x80, noteMdiToPlay, 100]) } // Note OFF
            });

            currentNote %= scaleMidi.length;
            //console.log("current Note = " + currentNote)
        }
    });

    // Add movement with left joystick
    xr.input.onControllerAddedObservable.add((controller) => {
        console.log("Coucou")
        if (controller.inputSource.handedness === "left") {
            controller.onMotionControllerInitObservable.add((motionController) => {
                const xrInput = motionController.getComponent("xr-standard-thumbstick");
                if (xrInput) {
                    xrInput.onAxisValueChangedObservable.add((axisValues) => {
                        const speed = 0.05;
                        xr.baseExperience.camera.position.x += axisValues.x * speed;
                        xr.baseExperience.camera.position.z += axisValues.y * speed;
                    });
                }
            });
        }
    });

    // Add keyboard controls for movement
    const moveSpeed = 0.1;
    window.addEventListener("keydown", (event) => {
        switch (event.key) {
            case "z":
                console.log("w pressé !");
                 xr.baseExperience.camera.position.z += moveSpeed;
                break;
            case "s":
                xr.baseExperience.camera.position.z -= moveSpeed;
                break;
            case "q":
                xr.baseExperience.camera.position.x -= moveSpeed;
                break;
            case "d":
                xr.baseExperience.camera.position.x += moveSpeed;
                break;
            case "f":
                xr.baseExperience.camera.position.y -= moveSpeed;
                break;
            case "r":
                xr.baseExperience.camera.position.y += moveSpeed;
                break;
        }
    });

    // Add physics to controllers when the mesh is loaded
    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            motionController.onModelLoadedObservable.add(mc => {
                
                console.log("Coucou2");
                const controllerMesh = BABYLON.MeshBuilder.CreateBox("controllerMesh", { size: 0.1 }, scene);
                controllerMesh.parent = controller.grip;


                const controllerAggregate = new BABYLON.PhysicsAggregate(controllerMesh, BABYLON.PhysicsShapeType.BOX, { mass: 0.1 }, scene);
                controllerAggregate.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC); // Set motion type to KINEMATIC
                controllerAggregate.body.setCollisionCallbackEnabled(true);
                controllerAggregate.body.setEventMask(eventMask);

                controllerMesh.position = BABYLON.Vector3.ZeroReadOnly;
                controllerMesh.rotationQuaternion = BABYLON.Quaternion.Identity();

                const controllerObservable = controllerAggregate.body.getCollisionObservable();
                controllerObservable.add((collisionEvent) => {
                    if (collisionEvent.type === "COLLISION_STARTED" ) {
                        console.log("Collision avec la manette ! ")
                        const impulse = controller.grip.forward.scale(10); // Apply impulse in the direction the controller is facing
                        sphereAggregate.body.applyImpulse(impulse, sphere.getAbsolutePosition());
                    }
                });

            });
        });
    });

    return scene;
};

window.initFunction = async function () {
    globalThis.HK = await HavokPhysics();

    var asyncEngineCreation = async function () {
        try {
            return createDefaultEngine();
        } catch (e) {
            console.log("the available createEngine function failed. Creating the default engine instead");
            return createDefaultEngine();
        }
    }

    window.engine = await asyncEngineCreation();
    if (!engine) throw 'engine should not be null.';
    startRenderLoop(engine, canvas);
    window.scene = await createScene();
};

initFunction().then(() => {
    sceneToRender = scene;
});

// Resize
window.addEventListener("resize", function () {
    engine.resize();
});

window.onclick = () => {
    audioContext.resume();
};