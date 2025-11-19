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
import { Mesh, MeshBuilder, PhysicsAggregate, PhysicsShapeType, WebXRNearInteraction, SixDofDragBehavior, Color3, StandardMaterial, TransformNode} from "@babylonjs/core";
import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import HavokPhysics from "@babylonjs/havok";

// GUI imports
import { AdvancedDynamicTexture } from "@babylonjs/gui/2D/advancedDynamicTexture";
import { Button } from "@babylonjs/gui/2D/controls/button";
import { TextBlock } from "@babylonjs/gui/2D/controls/textBlock";
import { StackPanel } from "@babylonjs/gui/2D/controls/stackPanel";
import { Control } from "@babylonjs/gui/2D/controls/control";

import XRDrumKit from "../XRDrumKit/XRDrumKit.ts";

import { AssetsManager } from "@babylonjs/core";
import XRHandler from "../XRHandler";

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
    ground.checkCollisions = true; // Enable collision detection for camera

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

    drum.move(new Vector3(0, 0, 4)); // Position initiale du drumkit
    
    // Add 6DOF behavior to the drumkit (externalized from XRDrumKit class)
    add6DofBehaviorToDrumKit(drum);
    
    //addScaleRoutineToSphere(sphereObservable);

    //addXRControllersRoutine(scene, xr, eventMask); //eventMask est-il indispensable ?
    
    // Initialize XR Handler for controller detection and movement setup
    //@ts-ignore
    const xrHandler = new XRHandler(scene, xr);
    
    // Initialize song control GUI
    initializeSongControlGUI(scene);
    
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

// Song management
interface Song {
    title: string;
    artist: string;
    audioUrl: string;
    bpm?: number;
}

const songs: Song[] = [
    { 
        title: "Basket Case", 
        artist: "Green Day", 
        audioUrl: "https://wasabi.i3s.unice.fr/WebAudioPluginBank/BasketCaseGreendayriffDI.mp3",
        bpm: 168,
    },
    { 
        title: "Europa", 
        artist: "Santana", 
        audioUrl: "sounds/europa.mp3",
        bpm: 92
    },
    { 
        title: "Take Five", 
        artist: "Dave Brubeck", 
        audioUrl: "sounds/take_five.mp3",
        bpm: 170
    },
];

let currentSongIndex = 0;
let isPlaying = false;
let audioElement: HTMLAudioElement | null = null;

// Initialize audio element
function initializeAudio() {
    if (!audioElement) {
        audioElement = new Audio();
        audioElement.loop = true;
        audioElement.crossOrigin = "anonymous";
        audioElement.volume = 0.2;
        
        // Log when audio is ready
        audioElement.addEventListener('canplaythrough', () => {
            console.log(`[Song Control] Audio ready: ${songs[currentSongIndex].title}`);
        });
        
        // Log any errors
        audioElement.addEventListener('error', (e) => {
            console.error('[Song Control] Audio error:', e);
        });
    }
    return audioElement;
}

// Load and prepare a song
function loadSong(songIndex: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const audio = initializeAudio();
        const song = songs[songIndex];
        
        // Set up event listeners before loading
        const onCanPlay = () => {
            console.log(`[Song Control] Ready: ${song.title} by ${song.artist}`);
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.removeEventListener('error', onError);
            resolve();
        };
        
        const onError = (e: Event) => {
            console.error(`[Song Control] Load error for ${song.title}:`, e);
            audio.removeEventListener('canplaythrough', onCanPlay);
            audio.removeEventListener('error', onError);
            reject(e);
        };
        
        audio.addEventListener('canplaythrough', onCanPlay, { once: true });
        audio.addEventListener('error', onError, { once: true });
        
        audio.src = song.audioUrl;
        audio.load();
        console.log(`[Song Control] Loading: ${song.title} by ${song.artist}`);
    });
}

// Initialize the 3D GUI for song controls
function initializeSongControlGUI(scene: Scene) {
    // Initialize audio on first load (async, no need to await here)
    loadSong(currentSongIndex).catch(err => {
        console.error('[Song Control] Initial load error:', err);
    });
    
    // Create a plane for the GUI
    const guiPlane = MeshBuilder.CreatePlane("songControlGUI", { 
        width: 3, 
        height: 2 
    }, scene);
    
    // Position the GUI to the left of the user
    guiPlane.position = new Vector3(-3, 2.5, 0);
    // Rotate to face the user (90 degrees to the right)
    guiPlane.rotation.y = Math.PI / 2;
    
    // Create the advanced texture for 3D GUI
    const advancedTexture = AdvancedDynamicTexture.CreateForMesh(
        guiPlane, 
        1024, 
        1024
    );
    
    // Create a main container panel
    const mainPanel = new StackPanel();
    mainPanel.width = "100%";
    mainPanel.height = "100%";
    mainPanel.background = "rgba(0, 0, 0, 0.7)";
    mainPanel.paddingTop = "40px";
    mainPanel.paddingBottom = "40px";
    advancedTexture.addControl(mainPanel);
    
    // Title
    const titleText = new TextBlock("title", "Song Selection");
    titleText.height = "80px";
    titleText.fontSize = 48;
    titleText.color = "white";
    titleText.fontWeight = "bold";
    titleText.paddingBottom = "20px";
    mainPanel.addControl(titleText);
    
    // Current song display
    const songInfoText = new TextBlock("songInfo");
    songInfoText.height = "180px";
    songInfoText.fontSize = 36;
    songInfoText.color = "#00ff00";
    songInfoText.textWrapping = true;
    songInfoText.paddingBottom = "30px";
    updateSongDisplay(songInfoText);
    mainPanel.addControl(songInfoText);
    
    // Playback status
    const statusText = new TextBlock("status");
    statusText.height = "60px";
    statusText.fontSize = 28;
    statusText.color = "#ffaa00";
    statusText.text = "● Stopped";
    statusText.paddingBottom = "30px";
    mainPanel.addControl(statusText);
    
    // Button container with horizontal layout
    const buttonPanel = new StackPanel();
    buttonPanel.isVertical = false;
    buttonPanel.height = "120px";
    buttonPanel.width = "90%";
    buttonPanel.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
    buttonPanel.paddingBottom = "20px";
    mainPanel.addControl(buttonPanel);
    
    // Previous button
    const prevButton = Button.CreateSimpleButton("prevBtn", "◄ Previous");
    prevButton.width = "280px";
    prevButton.height = "100px";
    prevButton.color = "white";
    prevButton.background = "#2060d0";
    prevButton.fontSize = 28;
    prevButton.cornerRadius = 10;
    prevButton.thickness = 2;
    prevButton.paddingRight = "10px";
    prevButton.onPointerClickObservable.add(() => {
        currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
        updateSongDisplay(songInfoText);
        console.log(`[Song Control] Previous - Now playing: ${songs[currentSongIndex].title}`);
    });
    buttonPanel.addControl(prevButton);
    
    // Play/Stop button
    const playButton = Button.CreateSimpleButton("playBtn", "▶ Play");
    playButton.width = "280px";
    playButton.height = "100px";
    playButton.color = "white";
    playButton.background = "#20d060";
    playButton.fontSize = 32;
    playButton.fontWeight = "bold";
    playButton.cornerRadius = 10;
    playButton.thickness = 2;
    playButton.paddingLeft = "10px";
    playButton.paddingRight = "10px";
    playButton.onPointerClickObservable.add(() => {
        isPlaying = !isPlaying;
        const audio = initializeAudio();
        
        if (isPlaying) {
            playButton.textBlock!.text = "■ Stop";
            playButton.background = "#d02020";
            statusText.text = "● Playing";
            statusText.color = "#00ff00";
            console.log(`[Song Control] Started playing: ${songs[currentSongIndex].title}`);
            
            // Start audio playback
            audio.play().catch(err => {
                console.error('[Song Control] Play error:', err);
                // Revert UI if play fails
                isPlaying = false;
                playButton.textBlock!.text = "▶ Play";
                playButton.background = "#20d060";
                statusText.text = "● Stopped";
                statusText.color = "#ffaa00";
            });
        } else {
            playButton.textBlock!.text = "▶ Play";
            playButton.background = "#20d060";
            statusText.text = "● Stopped";
            statusText.color = "#ffaa00";
            console.log(`[Song Control] Stopped playback`);
            
            // Stop audio playback
            audio.pause();
            audio.currentTime = 0;
        }
    });
    buttonPanel.addControl(playButton);
    
    // Next button
    const nextButton = Button.CreateSimpleButton("nextBtn", "Next ►");
    nextButton.width = "280px";
    nextButton.height = "100px";
    nextButton.color = "white";
    nextButton.background = "#2060d0";
    nextButton.fontSize = 28;
    nextButton.cornerRadius = 10;
    nextButton.thickness = 2;
    nextButton.paddingLeft = "10px";
    nextButton.onPointerClickObservable.add(() => {
        currentSongIndex = (currentSongIndex + 1) % songs.length;
        updateSongDisplay(songInfoText);
        console.log(`[Song Control] Next - Now playing: ${songs[currentSongIndex].title}`);
    });
    buttonPanel.addControl(nextButton);
    
    // Add hover effects to all buttons
    [prevButton, playButton, nextButton].forEach(button => {
        button.onPointerEnterObservable.add(() => {
            button.alpha = 0.8;
        });
        button.onPointerOutObservable.add(() => {
            button.alpha = 1.0;
        });
    });
    
    // BPM display
    const bpmText = new TextBlock("bpm");
    bpmText.height = "60px";
    bpmText.fontSize = 24;
    bpmText.color = "#aaaaaa";
    bpmText.text = `BPM: ${songs[currentSongIndex].bpm || 'N/A'}`;
    mainPanel.addControl(bpmText);
    
    // Helper function to update both song info and BPM
    const updateAllSongInfo = (textBlock: TextBlock) => {
        updateSongDisplay(textBlock);
        bpmText.text = `BPM: ${songs[currentSongIndex].bpm || 'N/A'}`;
    };
    
    // Override the button callbacks to use the combined updater
    prevButton.onPointerClickObservable.clear();
    prevButton.onPointerClickObservable.add(async () => {
        const wasPlaying = isPlaying;
        currentSongIndex = (currentSongIndex - 1 + songs.length) % songs.length;
        updateAllSongInfo(songInfoText);
        
        // Show loading state
        statusText.text = "⟳ Loading...";
        statusText.color = "#ffaa00";
        
        // Load new song and wait for it to be ready
        try {
            await loadSong(currentSongIndex);
            
            // If was playing, restart with new song
            if (wasPlaying && audioElement) {
                await audioElement.play();
                statusText.text = "● Playing";
                statusText.color = "#00ff00";
            } else {
                statusText.text = "● Stopped";
                statusText.color = "#ffaa00";
            }
        } catch (err) {
            console.error('[Song Control] Load/play error:', err);
            statusText.text = "✗ Error";
            statusText.color = "#ff0000";
        }
        
        console.log(`[Song Control] Previous - Now on: ${songs[currentSongIndex].title}`);
    });
    
    nextButton.onPointerClickObservable.clear();
    nextButton.onPointerClickObservable.add(async () => {
        const wasPlaying = isPlaying;
        currentSongIndex = (currentSongIndex + 1) % songs.length;
        updateAllSongInfo(songInfoText);
        
        // Show loading state
        statusText.text = "⟳ Loading...";
        statusText.color = "#ffaa00";
        
        // Load new song and wait for it to be ready
        try {
            await loadSong(currentSongIndex);
            await loadSong(currentSongIndex);
            
            // If was playing, restart with new song
            if (wasPlaying && audioElement) {
                await audioElement.play();
                statusText.text = "● Playing";
                statusText.color = "#00ff00";
            } else {
                statusText.text = "● Stopped";
                statusText.color = "#ffaa00";
            }
        } catch (err) {
            console.error('[Song Control] Load/play error:', err);
            statusText.text = "✗ Error";
            statusText.color = "#ff0000";
        }
        
        console.log(`[Song Control] Next - Now on: ${songs[currentSongIndex].title}`);
    });
    
    console.log("[Song Control] GUI initialized successfully");
}

// Update the song information display
function updateSongDisplay(textBlock: TextBlock) {
    const song = songs[currentSongIndex];
    textBlock.text = `${song.title}\n${song.artist}\n(${currentSongIndex + 1}/${songs.length})`;
}

// Add 6DOF behavior to the drum kit (moved from XRDrumKit class)
function add6DofBehaviorToDrumKit(drum: XRDrumKit) {
    const drumContainer = drum.drumContainer;
    
    // Add 6-DoF behavior to the drum container
    const sixDofBehavior = new SixDofDragBehavior();
    drumContainer.addBehavior(sixDofBehavior);

    // Freeze world matrices AFTER initial setup to avoid jump on first unfreeze
    drumContainer.getChildMeshes().forEach(mesh => {
        mesh.freezeWorldMatrix();
    });

    // Highlight the drum container in green when selected
    sixDofBehavior.onDragStartObservable.add(() => {
        drumContainer.getChildMeshes().forEach(mesh => {
            // Unfreeze world matrix to allow movement
            mesh.unfreezeWorldMatrix();
            
            if (mesh.material) {
                // Unfreeze material temporarily to allow color changes
                mesh.material.unfreeze();
                (mesh.material as StandardMaterial).emissiveColor = new Color3(0, 1, 0); // Green color
            }
        });
        drum.drumSoundsEnabled = false; // Disable drum sounds when moving
    });

    sixDofBehavior.onDragEndObservable.add(() => {
        drumContainer.getChildMeshes().forEach(mesh => {
            if (mesh.material) {
                (mesh.material as StandardMaterial).emissiveColor = Color3.Black(); // Reset to default color
            }
            // Refreeze world matrix after movement
            mesh.freezeWorldMatrix();
        });
        // Small delay before refreezing materials to ensure color change applies
        setTimeout(() => {
            drumContainer.getChildMeshes().forEach(mesh => {
                if (mesh.material) {
                    mesh.material.freeze();
                }
            });
        }, 100);
        drum.drumSoundsEnabled = true; // Enable drum sounds after moving
    });
}


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


/*
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
    
   console.log(scene);
   console.log(eventMask)
}
*/
