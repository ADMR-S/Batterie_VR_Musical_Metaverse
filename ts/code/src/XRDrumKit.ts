import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { TransformNode, StandardMaterial, SixDofDragBehavior } from "@babylonjs/core";
import { WebXRDefaultExperience } from "@babylonjs/core";
//import { WebXRControllerPhysics } from "@babylonjs/core/XR/features/WebXRControllerPhysics";
//import { Observable } from "@babylonjs/core/Misc/observable";

import { AssetsManager } from "@babylonjs/core";

import XRDrumstick from "./XRDrumstick";
import XRDrum from "./XRDrum";
import XRCymbal from "./XRCymbal"

import XRLogger from "./XRLogger";

//TODO : 
    //Rapport
    //Tester vibrations collision controllers
    //Ajuster échelle de la batterie (trop grande)
    //Optimiser scène et modèle 3D pour éviter les ralentissements
    //Remplacer les triggers havok par de réelles collisions avec les meshs appropriés ? (utile si les cymbales doivent bouger) -> Voir pour collision entre baguettes et objets statiques
    //Pourquoi le paramètre de vélocité sur scheduleEvent ne fonctionne pas ? (même avec valeurs manuelles)
    //Retour haptique et visuel collision baguettes (vibrations, tremblement du tambour, oscillation des cymbales...)
    //Ajouter option pour sortir un enregistrement sous forme de piano roll / liste d'évènements MIDI
    //Ajuster vélocité IHM
    //Commande pour reset l'emplacement des drumSticks
    //Cleaner
    //Bien vérifier qu'on ne peut pas taper par dessous pour les tambours mais ok pour cymbales
    //Empêcher les objets de passer à travers le sol
    //Sons différents en bordure / au centre de la peau ? (+ bordure métallique)
    //Pédale Grosse caisse / Hi-Hat ? (appuyer sur un bouton en attendant d'ajouter des pédales midi ?)
    //Tenir les baguettes avec la gachette interne plutôt ? (permet d'avoir une autre position de main, plus adaptée ?)
    //Replace invisible cube meshes for controllers by physicsImpostors ?
    //Use a 0 distance constraint to snap drumsticks to hands ? 
    //Test interactions projet Ismail

//Intégration avec Musical Metaverse (interface PedalNode3D) :
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
    kick : XRDrum | undefined;
    kickKey: number = 36;
    snare: XRDrum | undefined;
    snareKey: number = 38;
    rimshotKey: number = 37;
    floorTom: XRDrum | undefined;
    floorTomKey: number = 41;
    midTom: XRDrum | undefined;
    midTomKey: number = 47;
    highTom: XRDrum | undefined;
    highTomKey: number = 43;
    crashCymbal1: XRCymbal | undefined;
    crashCymbal2: XRCymbal | undefined;
    crashCymbalKey: number = 49;
    rideCymbal: XRCymbal | undefined;
    rideCymbalKey: number = 51;
    hiHat: XRCymbal | undefined;
    closedHiHatKey: number = 42;
    openHiHatKey: number = 46;
    throne : TransformNode | undefined;
    path = "/drum_3D_model/"; // Path to the 3D model folder
    log = false;

    constructor(audioContext: AudioContext, scene: Scene, eventMask: number, xr: WebXRDefaultExperience, hk: any, assetsManager: AssetsManager) {
        this.audioContext = audioContext;
        this.hk = hk;
        this.xr = xr;
        this.scene = scene;
        this.eventMask = eventMask;
        this.wamInstance = null;
        this.drumComponents = [];
        this.drumContainer = new TransformNode("drumContainer", this.scene);
        this.initializePlugin().then((wamInstance) => {
            this.wamInstance = wamInstance;
            this.move(new Vector3(0, 0, 4)); // NEW POSITION
        });

        const meshTask = assetsManager.addMeshTask("drum3DModel", "", this.path, `drum3DModel.glb`);
        
                //@ts-ignore
        meshTask.onError = (task, message, exception) => {
            console.error(`Failed to load mesh for ${name}:`, message, exception);
        };

        assetsManager.load();
        
        meshTask.onSuccess = (task) => {
            const drumMeshes = task.loadedMeshes
            console.log("Available meshes:", drumMeshes.map(mesh => mesh.name)); // Log available meshes for debugging
            this.kick = new XRDrum("kick", this.kickKey, this, drumMeshes); //Create kick
            this.snare = new XRDrum("snare", this.snareKey, this, drumMeshes); // Create snare drum
            this.floorTom = new XRDrum("floorTom", this.floorTomKey, this, drumMeshes); // Create floor tom
            this.midTom = new XRDrum("midTom", this.midTomKey, this, drumMeshes); // Create mid tom
            this.highTom = new XRDrum("highTom", this.highTomKey, this, drumMeshes); // Create high tom
            this.crashCymbal1 = new XRCymbal("crashCymbal1", this.crashCymbalKey, this, drumMeshes); // Create crash cymbal
            this.crashCymbal2 = new XRCymbal("crashCymbal2", this.crashCymbalKey, this, drumMeshes); // Create crash cymbal
            this.rideCymbal = new XRCymbal("rideCymbal", this.rideCymbalKey, this, drumMeshes); // Create ride cymbal
            this.hiHat = new XRCymbal("hiHat", this.closedHiHatKey, this, drumMeshes); // Create hi-hat cymbal
        
            //Stands
            const stands = drumMeshes.filter(mesh => mesh.name.startsWith("stand") || mesh.name.startsWith("kickPedal") || mesh.name.startsWith("hiHatPedal")); // Find all primitives
            if (stands.length === 0) {
                console.error(`Failed to find a mesh with name starting with 'stand'`);
                console.log("Available meshes:", drumMeshes.map(mesh => mesh.name)); // Log available meshes for debugging
                return;
            }
        
            stands.forEach(stand => this.drumContainer.addChild(stand)); // Attach primitives to the parent node

            //Throne
            const thronePrimitives = drumMeshes.filter(mesh => (mesh.name === "throne" || mesh.name.startsWith("throne_primitive"))); // Find all primitives
            if (thronePrimitives.length === 0) {
                console.error(`Failed to find the main body mesh with name 'throne' or its primitives in the provided drum3Dmodel.`);
                console.log("Available meshes:", drumMeshes.map(mesh => mesh.name)); // Log available meshes for debugging
                return;
            }
            const throneContainer = new TransformNode("throneContainer", this.scene);
            thronePrimitives.forEach(primitive => throneContainer.addChild(primitive)); // Attach primitives to the parent node
            
            this.drumContainer.addChild(throneContainer); // Attach the throne container to the drum container
            this.throne = throneContainer; // Store the throne container
        }


        this.add6dofBehavior(this.drumContainer); // Make the drumkit movable in the VR space on selection
        this.drumSoundsEnabled = false; // Initialize to false and set to true only when controllers are added
        let xrLogger = new XRLogger(xr, scene);
        for (var i = 0; i < 2; i++) {
            this.drumsticks[i] = new XRDrumstick(this.xr, this, this.scene, this.eventMask, i-1, xrLogger);
        }

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