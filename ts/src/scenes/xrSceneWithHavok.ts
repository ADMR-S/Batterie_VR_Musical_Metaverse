// IMPLEMENTATION D'ADAM INSPIREE DES EXEMPLES DE BABYLONJS

import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
//import "@babylonjs/core/Physics/physicsEngineComponent";

// If you don't need the standard material you will still need to import it since the scene requires it.
//import "@babylonjs/core/Materials/standardMaterial";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import { havokModule } from "../externals/havok";
import { CreateSceneClass } from "../createScene";


import "@babylonjs/core/Debug/debugLayer";
import "@babylonjs/inspector";
import "@babylonjs/loaders/glTF";
//@ts-ignore
import { Mesh, MeshBuilder, PhysicsAggregate, PhysicsShapeType, WebXRNearInteraction} from "@babylonjs/core";
import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import HavokPhysics from "@babylonjs/havok";

import XRDrumKit from "../XRDrumKit";

import { AssetsManager } from "@babylonjs/core";


export class XRSceneWithHavok implements CreateSceneClass {
    preTasks = [havokModule];

    // @ts-ignore
    createScene = async (engine: AbstractEngine, canvas : HTMLCanvasElement, audioContext : AudioContext): Promise<Scene> => {
    
    const scene: Scene = new Scene(engine);

    //scene.collisionsEnabled = false; // Désactive TOUTES les collisions Babylon natives

    const light: HemisphericLight = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Our built-in 'ground' shape.
    const ground: Mesh = MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);

    const xr = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [ground],
        // Optimize XR rendering
        uiOptions: {
            sessionMode: 'immersive-vr',
        },
        optionalFeatures: true,
        // Fix GL_INVALID_OPERATION error with multisampling
        disableDefaultUI: false,
        disableTeleportation: true
    });
    
    console.log("[XR DEBUG] XR experience created");
    
    // PERFORMANCE OPTIMIZATION: Disable near interactions to prevent controller issues
    // Must be done early to avoid race conditions with controller initialization
    if (xr.baseExperience.featuresManager) {
        try {
            // Small delay to ensure feature manager is fully initialized
            setTimeout(() => {
                try {
                    xr.baseExperience.featuresManager.disableFeature(WebXRNearInteraction.Name);
                    console.log("[XR DEBUG] Near interactions disabled for better performance");
                } catch (e) {
                    console.log("[XR DEBUG] Could not disable near interactions:", e);
                }
            }, 100);
        } catch (e) {
            console.log("[XR DEBUG] Feature manager not ready:", e);
        }
    }
    
    // Monitor XR session state for debugging
    xr.baseExperience.onStateChangedObservable.add((state) => {
        console.log("[XR DEBUG] XR State changed to:", state);
    });
  
    //Good way of initializing Havok
    // initialize plugin
    const havokInstance = await HavokPhysics();
    // pass the engine to the plugin
    const hk = new HavokPlugin(true, havokInstance);
    // enable physics in the scene with a gravity
    scene.enablePhysics(new Vector3(0, -9.8, 0), hk);

    var groundAggregate = new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);
  
    const started = hk._hknp.EventType.COLLISION_STARTED.value;
    const continued = hk._hknp.EventType.COLLISION_CONTINUED.value;
    const finished = hk._hknp.EventType.COLLISION_FINISHED.value;

    const eventMask = started | continued | finished;
    
    //SCENE OPTIMIZER - Disabled to prevent mesh merge errors with incompatible vertex attributes
    // The drum models have primitives with different vertex data structures
    // Manual optimizations are applied instead:
    // 1. Static physics bodies for drums (no dynamic simulation needed)
    // 2. Reduced polygon count in 3D models
    // 3. Near interaction disabled for controllers (see below)
    // 4. Culling handled automatically by Babylon for objects outside view
    
    // SceneOptimizer.OptimizeAsync(scene) //causes "Cannot merge vertex data" errors
    // because drum primitives have inconsistent vertex attributes (some have UVs, some don't)
    
    const assetsManager = new AssetsManager(scene);

    assetsManager.onTaskErrorObservable.add(function (task) {
    console.log("task failed", task.errorObject.message, task.errorObject.exception);
    });

    //@ts-ignore
    assetsManager.onProgress = function (remainingCount, totalCount, lastFinishedTask) {
        engine.loadingUIText = "We are loading the scene. " + remainingCount + " out of " + totalCount + " items still need to be loaded.";
    };
        
    // @ts-ignore
    const drum = new XRDrumKit(audioContext, scene, eventMask, xr, hk, assetsManager);
    
    //addScaleRoutineToSphere(sphereObservable);

    addXRControllersRoutine(scene, xr, eventMask); //eventMask est-il indispensable ?

    // Add collision detection for the ground to prevent objects from falling through
    groundAggregate.body.getCollisionObservable().add((collisionEvent: any) => {
      if (collisionEvent.type === "COLLISION_STARTED") {
            var collidedBody = null;
            if(collisionEvent.collider != groundAggregate.body){
                collidedBody = collisionEvent.collider;
            }
            else{
                collidedBody = collisionEvent.collidedAgainst;
            }
            const position = collidedBody.transformNode.position;
            // Reset object position slightly above ground to prevent clipping
            collidedBody.transformNode.position = new Vector3(position.x, ground.position.y + 1, position.z);
            collidedBody.setLinearVelocity(Vector3.Zero());
            collidedBody.setAngularVelocity(Vector3.Zero());
        }
    });

    //@ts-ignore
    assetsManager.onFinish = function (tasks) {
        // Register a render loop to repeatedly render the scene
        engine.runRenderLoop(function () {
            if(scene.activeCamera){
                scene.render();
            }
        });
    };

    // Add keyboard controls for movement (for testing outside VR)
    const moveSpeed = 0.1;
    addKeyboardControls(xr, moveSpeed);

    return scene;
    };
}

export default new XRSceneWithHavok();


function addKeyboardControls(xr: any, moveSpeed: number) {
    window.addEventListener("keydown", (event: KeyboardEvent) => {
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

    // Add movement with left joystick
function addXRControllersRoutine(scene: Scene, xr: any, eventMask: number) {
  xr.input.onControllerAddedObservable.add((controller: any) => {
        console.log(`[XR DEBUG] Controller added - handedness: ${controller.inputSource.handedness}`);
        
        if (controller.inputSource.handedness === "left") {
            controller.onMotionControllerInitObservable.add((motionController: any) => {
                console.log("[XR DEBUG] Left controller motion controller initialized");
                const xrInput = motionController.getComponent("xr-standard-thumbstick");
                if (xrInput) {
                    console.log("[XR DEBUG] Left thumbstick component found");
                    xrInput.onAxisValueChangedObservable.add((axisValues: any) => {
                        const speed = 0.05;
                        xr.baseExperience.camera.position.x += axisValues.x * speed;
                        xr.baseExperience.camera.position.z -= axisValues.y * speed;
                    });
                }
            });
        }
    });

    /*
    // Add physics to controllers when the mesh is loaded
    xr.input.onControllerAddedObservable.add((controller: any) => {
      controller.onMotionControllerInitObservable.add((motionController: any) => {
        // @ts-ignore  
        motionController.onModelLoadedObservable.add((mc: any) => {
                
                console.log("Ajout d'un mesh au controller");
                
                const controllerMesh = MeshBuilder.CreateBox("controllerMesh", { size: 0.1 }, scene);
                controllerMesh.parent = controller.grip;
                controllerMesh.position = Vector3.ZeroReadOnly;
                controllerMesh.rotationQuaternion = Quaternion.Identity();

                const controllerAggregate = new PhysicsAggregate(controllerMesh, PhysicsShapeType.BOX, { mass: 1 }, scene);
                controllerAggregate.body.setMotionType(PhysicsMotionType.ANIMATED); // Set motion type to ANIMATED
                controllerAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
                controllerAggregate.body.setCollisionCallbackEnabled(true);
                controllerAggregate.body.setEventMask(eventMask);
                


                // Make the controller mesh invisible and non-pickable
                controllerMesh.isVisible = false;
                controllerMesh.isPickable = false;
                
                // Attach WebXRControllerPhysics to the controller
                console.log("CONTROLLER")
                console.log(controller)
                
                //const controllerPhysics = xr.baseExperience.featuresManager.enableFeature(WebXRControllerPhysics.Name, 'latest')
                //controller.physics = controllerPhysics
                //    console.log("ICI")
                //    console.log(controllerPhysics)
                //    console.log("Imposteur : ")
                //    console.log(controllerPhysics.getImpostorForController(controller))
                    
            });
        });
    });
    */
   console.log(scene);
   console.log(eventMask)
}

