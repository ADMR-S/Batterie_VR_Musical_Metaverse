// Création d'un contexte audio
const audioContext = new AudioContext();
let physicsBodies = [];

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

    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 1.6, 0), scene); // Adjust camera height

    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Our built-in 'ground' shape.
    var ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);

  
    //Good way of initializing Havok
    // initialize plugin
    const havokInstance = await HavokPhysics();
    // pass the engine to the plugin
    const hk = new BABYLON.HavokPlugin(true, havokInstance);
    // enable physics in the scene with a gravity
    scene.enablePhysics(new BABYLON.Vector3(0, -9.8, 0), hk);

    var groundAggregate = new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, { mass: 0 }, scene);

  
    const started = hk._hknp.EventType.COLLISION_STARTED.value;
    const continued = hk._hknp.EventType.COLLISION_CONTINUED.value;
    const finished = hk._hknp.EventType.COLLISION_FINISHED.value;

    const eventMask = started | continued | finished;
      
    const drum = new XRDrum(audioContext, scene, eventMask, xr, hk);

    //addScaleRoutineToSphere(sphereObservable);

    addXRControllersRoutine(scene, xr, eventMask); //eventMask est-il indispensable ?

    // Add keyboard controls for movement
    const moveSpeed = 0.1;
    addKeyboardControls(xr, moveSpeed);

    return scene;
};

function addKeyboardControls(xr, moveSpeed){
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
}

function addXRControllersRoutine(scene, xr, eventMask){
    // Add movement with left joystick
    xr.input.onControllerAddedObservable.add((controller) => {
        console.log("Ajout d'un controller")
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

    // Add physics to controllers when the mesh is loaded
    xr.input.onControllerAddedObservable.add((controller) => {
        controller.onMotionControllerInitObservable.add((motionController) => {
            motionController.onModelLoadedObservable.add(mc => {
                
                console.log("Ajout d'un mesh au controller");
                
                const controllerMesh = BABYLON.MeshBuilder.CreateBox("controllerMesh", { size: 0.1 }, scene);
                controllerMesh.parent = controller.grip;
                controllerMesh.position = BABYLON.Vector3.ZeroReadOnly;
                controllerMesh.rotationQuaternion = BABYLON.Quaternion.Identity();

                const controllerAggregate = new BABYLON.PhysicsAggregate(controllerMesh, BABYLON.PhysicsShapeType.BOX, { mass: 1 }, scene);
                controllerAggregate.body.setMotionType(BABYLON.PhysicsMotionType.ANIMATED); // Set motion type to ANIMATED
                controllerAggregate.body.setPrestepType(BABYLON.PhysicsPrestepType.TELEPORT);
                controllerAggregate.body.setCollisionCallbackEnabled(true);
                controllerAggregate.body.setEventMask(eventMask);
                


                // Make the controller mesh invisible and non-pickable
                controllerMesh.isVisible = false;
                controllerMesh.isPickable = false;
            });
        });
    });
}
function createRayFromController(controller){
    const origin = controller.pointer.position;
    const direction = controller.pointer.forward;
    return new BABYLON.Ray(origin, direction, length = 100);
}

window.initFunction = async function () {
    // Initialiser le plugin audio
    //initializePlugin();
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