import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Mesh, TransformNode, StandardMaterial, SixDofDragBehavior } from "@babylonjs/core";
import { WebXRDefaultExperience } from "@babylonjs/core";
import { Quaternion } from "@babylonjs/core";
//import { WebXRControllerPhysics } from "@babylonjs/core/XR/features/WebXRControllerPhysics";
//import { Observable } from "@babylonjs/core/Misc/observable";
import { AdvancedDynamicTexture, Rectangle, TextBlock } from "@babylonjs/gui";

//@ts-ignore
import XRDrumstick from "./XRDrumstick";
//@ts-ignore
import XRDrum from "./XRDrum";
import XRCymbal from "./XRCymbal"

//TODO : 
//Retour haptique et visuel collision baguettes (vibrations, tremblement du tambour...)
//Intégration avec Musical Metaverse (interface PedalNode3D)
//Ajouter texture
//Ajuster vélocité (voir prototype scheduleEvent)
//Commande pour reset l'emplacement des drumSticks
//Cleaner
//Empêcher de taper par dessous pour les tambours, autoriser pour cymbales
//Empêcher les objets de passer à travers le sol
//Sons différents en bordure / au centre de la peau ? (+ bordure métallique)
//Grosse caisse / Hi-Hat ? Besoin d'une pédale (appuyer sur un bouton ?)
//Tenir les baguettes avec la gachette interne plutôt ? (permet d'avoir une autre position de main plus adaptée)
//Replace invisible cube meshes for controllers by physicsImpostors
//Use a 0 distance constraint to snap drumsticks to hands ? 
//Test interactions projet Ismail
//Test si 200 volume fonctionne (faire attention à velocité à ce moment là)

//EventBus Emitter
//Ajouter signature de la batterie

class XRDrumKit {
    audioContext: AudioContext;
    hk: any;
    scene: Scene;
    eventMask: number; //retirer ?
    wamInstance: any;
    drumComponents: TransformNode[];
    drumContainer: TransformNode;
    xr: WebXRDefaultExperience;
    drumsticks: XRDrumstick[] = [];
    drumSoundsEnabled: boolean;
    snare: XRDrum;
    snareKey: number = 38;
    floorTom: XRDrum;
    floorTomKey: number = 41;
    midTom: XRDrum;
    midTomKey: number = 47;
    highTom: XRDrum;
    highTomKey: number = 43;
    crashCymbal: XRCymbal;
    crashCymbalKey: number = 49;
    rideCymbal: XRCymbal;
    rideCymbalKey: number = 51;
    hiHat: XRCymbal;
    closedHiHatKey: number = 42;
    openHiHatKey: number = 46;
    log = false;
    xrUI: AdvancedDynamicTexture;
    consoleText: TextBlock;
    controllerPositionText: TextBlock; // New text block for controller positions
    private controllerPositions: { [handedness: string]: string } = {}; // Store positions for both controllers

    constructor(audioContext: AudioContext, scene: Scene, eventMask: number, xr: WebXRDefaultExperience, hk: any) {
        this.audioContext = audioContext;
        this.hk = hk;
        this.scene = scene;
        this.eventMask = eventMask;
        this.wamInstance = null;
        this.drumComponents = [];
        this.drumContainer = new TransformNode("drumContainer", this.scene);
        this.initializePlugin().then((wamInstance) => {
            this.wamInstance = wamInstance;
            this.move(new Vector3(0, 0, 4)); // NEW POSITION
        });
        this.snare = new XRDrum("snare", 0.5, 0.3, this.snareKey, this, new Vector3(0, 0.3, 0)); // Create snare drum
        this.floorTom = new XRDrum("floorTom", 0.6, 0.3, this.floorTomKey, this, new Vector3(0.8, 0.3, 0)); // Create floor tom
        this.midTom = new XRDrum("midTom", 0.5, 0.25, this.midTomKey, this, new Vector3(0.6, 0.8, 0.3)); // Create mid tom
        this.highTom = new XRDrum("highTom", 0.4, 0.2, this.highTomKey, this, new Vector3(0.1, 0.7, 0.3)); // Create high tom
        this.crashCymbal = new XRCymbal("crashCymbal", 1.0, 0.07, this.crashCymbalKey, this, new Vector3(-0.4, 1.2, 0.5)); // Create crash cymbal
        this.rideCymbal = new XRCymbal("rideCymbal", 1.0, 0.07, this.rideCymbalKey, this, new Vector3(1.2, 1.2, 0.5)); // Create ride cymbal
        this.hiHat = new XRCymbal("hiHat", 0.4, 0.07, this.closedHiHatKey, this, new Vector3(-0.5, 0.8, 0.2)); // Create hi-hat cymbal
        this.add6dofBehavior(this.drumContainer); // Make the drumkit movable in the VR space on selection
        this.xr = xr;
        this.drumSoundsEnabled = false; // Initialize to false and set to true only when controllers are added
        for (var i = 0; i < 2; i++) {
            this.drumsticks[i] = new XRDrumstick(this.xr, this, this.scene, this.eventMask, i-1);
        }

        // Initialize XR console
        this.xrUI = AdvancedDynamicTexture.CreateFullscreenUI("UI");

        // Center section for controller positions
        const controllerPositionContainer = new Rectangle();
        controllerPositionContainer.width = "40%"; 
        controllerPositionContainer.height = "35%"; // Increase height
        controllerPositionContainer.background = "rgba(0, 0, 0, 0.5)";
        controllerPositionContainer.color = "white";
        controllerPositionContainer.thickness = 0;
        controllerPositionContainer.verticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP;
        controllerPositionContainer.horizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER; // Move to the left
        controllerPositionContainer.isVisible = false; // Initially hidden
        this.xrUI.addControl(controllerPositionContainer);

        this.controllerPositionText = new TextBlock();
        this.controllerPositionText.color = "white";
        this.controllerPositionText.fontSize = 18;
        this.controllerPositionText.textWrapping = true;
        this.controllerPositionText.resizeToFit = false; // Disable resizing to fit the text
        this.controllerPositionText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_LEFT; // Align text to the left
        this.controllerPositionText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP; // Align text to the top
        controllerPositionContainer.addControl(this.controllerPositionText);

        // Center section for general console messages
        const consoleContainer = new Rectangle();
        consoleContainer.width = "40%"; 
        consoleContainer.height = "50%"; // Increase height
        consoleContainer.background = "rgba(0, 0, 0, 0.5)";
        consoleContainer.color = "white";
        consoleContainer.thickness = 0;
        consoleContainer.verticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP;
        consoleContainer.horizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_CENTER; // Move to the left
        consoleContainer.top = "40%"; // Slightly below the controller position container
        consoleContainer.isVisible = false; // Initially hidden
        this.xrUI.addControl(consoleContainer);

        this.consoleText = new TextBlock();
        this.consoleText.color = "white";
        this.consoleText.fontSize = 18;
        this.consoleText.textWrapping = true;
        this.consoleText.resizeToFit = false; // Disable resizing to fit the text
        this.consoleText.textHorizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_LEFT; // Align text to the left
        this.consoleText.textVerticalAlignment = TextBlock.VERTICAL_ALIGNMENT_TOP; // Align text to the top
        this.consoleText.clipChildren = true; // Ensure text is clipped to the container
        this.consoleText.clipContent = true; // Clip overflowing content
        consoleContainer.addControl(this.consoleText);

        // Link the console parts to the XR headset
        const headsetNode = xr.baseExperience.camera.parent; // Get the headset's parent node
        const controllerPositionTransformNode = new TransformNode("controllerPositionTransformNode", this.scene);
        controllerPositionTransformNode.parent = headsetNode; // Attach to the headset
        controllerPositionTransformNode.position = new Vector3(0, 1.5, 1); // Position in front of the headset
        controllerPositionTransformNode.billboardMode = Mesh.BILLBOARDMODE_ALL; // Make it always face the camera
        controllerPositionContainer.linkWithMesh(controllerPositionTransformNode);

        const consoleTransformNode = new TransformNode("consoleTransformNode", this.scene);
        consoleTransformNode.parent = headsetNode; // Attach to the headset
        consoleTransformNode.position = new Vector3(0, 0.5, 1); // Position below the controller positions
        consoleTransformNode.billboardMode = Mesh.BILLBOARDMODE_ALL; // Make it always face the camera
        consoleContainer.linkWithMesh(consoleTransformNode);

        // Monitor the right controller's internal trigger
        xr.input.onControllerAddedObservable.add((controller) => {
            if (controller.inputSource.handedness === "right") {
                controller.onMotionControllerInitObservable.add((motionController) => {
                    const trigger = motionController.getComponent("xr-standard-squeeze");
                    trigger.onButtonStateChangedObservable.add((button) => {
                        const isPressed = button.pressed;

                        // Reposition the containers dynamically in front of the camera
                        const camera = xr.baseExperience.camera;
                        if (isPressed) {
                            const forward = camera.getForwardRay(1).direction; // Get the forward direction of the camera
                            const offset = new Vector3(forward.x, forward.y, forward.z).scale(1); // Scale to desired distance
                            const cameraPosition = camera.position;

                            controllerPositionTransformNode.position = cameraPosition.add(offset).add(new Vector3(0, 0.5, 0)); // Slightly above
                            consoleTransformNode.position = cameraPosition.add(offset).add(new Vector3(0, -0.5, 0)); // Slightly below
                        }

                        // Toggle visibility
                        controllerPositionContainer.isVisible = isPressed;
                        consoleContainer.isVisible = isPressed;
                    });
                });
            }
        });

        this.initializeSimpleConsoleLogger(); // Replace the old logging redirection with the new method
    }

    private initializeSimpleConsoleLogger() {
        const maxLines = 20;
        const maxLineLength = 100; // Maximum characters per line
        const logBuffer: string[] = [];
        const originalConsoleLog = console.log; // Preserve the original console.log

        console.log = (...args: any[]) => {
            // Log to the browser console
            originalConsoleLog(...args);

            // Format and log to the XR UI console
            const newText = args
                .map(arg => {
                    if (typeof arg === "object") {
                        return arg ? ("Objet : " + arg.constructor.name) : "unnamed Object"; // Print object name or null
                    }
                    const str = String(arg);
                    return str.length > maxLineLength ? str.slice(0, maxLineLength) + "..." : str;
                })
                .join(" ");
            
            logBuffer.unshift(newText); // Add new log at the top
            if (logBuffer.length > maxLines) {
                logBuffer.pop(); // Remove the oldest log if buffer exceeds maxLines
            }

            this.consoleText.text = logBuffer.join("\n"); // Update the XR UI console
        };
    }

    updateControllerPositionText(positionText: string) {
        this.controllerPositionText.text = positionText;
    }

    updateControllerPositions(controllerPos: Vector3, controllerRot: Quaternion, handedness: string) {
        //get controller angular rotation :


        this.controllerPositions[handedness] = `Controller ${handedness}:\nLinear position: ${controllerPos.toString()}\nAngular position : ${controllerRot}`;
        const combinedText = Object.values(this.controllerPositions).join("\n"); // Combine positions for both controllers
        this.updateControllerPositionText(combinedText);
    }

    async initializePlugin() {
        const hostGroupId = await setupWamHost(this.audioContext);
        const wamURIDrumSampler = 'https://www.webaudiomodules.com/community/plugins/burns-audio/drumsampler/index.js';
        const wamInstance = await loadDynamicComponent(wamURIDrumSampler, hostGroupId, this.audioContext);

        // Exemple de selection d'un autre son
        let state = await wamInstance.audioNode.getState();
        //state.values.patchName = "Drum Sampler WAM";
        await wamInstance.audioNode.setState(state);

        wamInstance.audioNode.connect(this.audioContext.destination);

        return wamInstance;
    }

    move(displacementVector: Vector3) {
        this.drumContainer.position.addInPlace(displacementVector);
    }

    add6dofBehavior(drumContainer: TransformNode) {
        // Add 6-DoF behavior to the drum container
        const sixDofBehavior = new SixDofDragBehavior();
        drumContainer.addBehavior(sixDofBehavior);

        // Highlight the drum container in green when selected
        sixDofBehavior.onDragStartObservable.add(() => {
            drumContainer.getChildMeshes().forEach(mesh => {
                (mesh.material as StandardMaterial).emissiveColor = new Color3(0, 1, 0); // Green color
            });
            this.drumSoundsEnabled = false; // Disable drum sounds when moving
        });

        sixDofBehavior.onDragEndObservable.add(() => {
            drumContainer.getChildMeshes().forEach(mesh => {
                (mesh.material as StandardMaterial).emissiveColor = Color3.Black(); // Reset to default color
            });
            this.drumSoundsEnabled = true; // Enable drum sounds after moving
        });
    }
}

export default XRDrumKit;

async function setupWamHost(audioContext: AudioContext): Promise<string> {
    const { default: initializeWamHost } = await import("https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js");
    const [hostGroupId] = await initializeWamHost(audioContext);
    return hostGroupId;
}

async function loadDynamicComponent(wamURI: string, hostGroupId: string, audioContext: AudioContext) {
    try {
        const { default: WAM } = await import(wamURI);
        const wamInstance = await WAM.createInstance(hostGroupId, audioContext);
        return wamInstance;
    } catch (error) {
        console.error('Erreur lors du chargement du Web Component :', error);
    }
}