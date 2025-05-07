import { Scene } from "@babylonjs/core/scene";
import { Color3 } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder, TransformNode, StandardMaterial, SixDofDragBehavior, PhysicsAggregate, PhysicsShapeType, PhysicsMotionType, PhysicsPrestepType } from "@babylonjs/core";
import { WebXRDefaultExperience } from "@babylonjs/core";
//import { WebXRControllerPhysics } from "@babylonjs/core/XR/features/WebXRControllerPhysics";
//import { Observable } from "@babylonjs/core/Misc/observable";
import { AdvancedDynamicTexture, Rectangle, TextBlock } from "@babylonjs/gui";

import XRDrumstick from "./xrDrumstick";

//TODO : 
//Intégration avec Musical Metaverse (interface PedalNode3D)
//Ajouter texture
//Ajuster vélocité (voir prototype scheduleEvent)
//Commande pour reset l'emplacement des drumSticks
//Cleaner
//Empêcher de taper par dessous pour les tambours, autoriser pour cymbales
//Retour haptique et visuel collision baguettes (vibrations, tremblement du tambour...)
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
    snare: TransformNode;
    snareKey: number = 38;
    floorTom: TransformNode;
    floorTomKey: number = 41;
    midTom: TransformNode;
    midTomKey: number = 47;
    highTom: TransformNode;
    highTomKey: number = 43;
    crashCymbal: TransformNode;
    crashCymbalKey: number = 49;
    rideCymbal: TransformNode;
    rideCymbalKey: number = 51;
    hiHat: TransformNode;
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
        this.snare = this.createSnare();
        this.floorTom = this.createFloorTom();
        this.midTom = this.createMidTom();
        this.highTom = this.createHighTom();
        this.crashCymbal = this.createCrashCymbal();
        this.rideCymbal = this.createRideCymbal();
        this.hiHat = this.createHiHat();
        this.add6dofBehavior(this.drumContainer); // Make the drumkit movable in the VR space on selection
        this.xr = xr;
        this.drumSoundsEnabled = false; // Initialize to false and set to true only when controllers are added
        for (var i = 0; i < 2; i++) {
            this.drumsticks[i] = new XRDrumstick(this.xr, this, this.scene, this.eventMask);
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
        controllerPositionContainer.horizontalAlignment = TextBlock.HORIZONTAL_ALIGNMENT_LEFT; // Move to the left
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

        // Monitor the right controller's internal trigger
        xr.input.onControllerAddedObservable.add((controller) => {
            if (controller.inputSource.handedness === "right") {
                controller.onMotionControllerInitObservable.add((motionController) => {
                    const trigger = motionController.getComponent("xr-standard-trigger");
                    trigger.onButtonStateChangedObservable.add((button) => {
                        const isPressed = button.pressed;
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

    updateControllerPositions(controllerPos: Vector3, handedness: string) {
        this.controllerPositions[handedness] = `Controller ${handedness}:\nPosition: ${controllerPos.toString()}\n`;
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

    createSnare() {
        const snare = this.createDrumComponent("snare", 0.5, 0.3, new Vector3(0, 0.3, 0));
        this.playSoundOnTrigger("snare", this.snareKey, 0.25);
        return snare;
    }

    createFloorTom() {
        const floorTom = this.createDrumComponent("floorTom", 0.6, 0.3, new Vector3(0.8, 0.3, 0));
        this.playSoundOnTrigger("floorTom", this.floorTomKey, 0.25);
        return floorTom;
    }

    createMidTom() {
        const floorTom = this.createDrumComponent("midTom", 0.5, 0.25, new Vector3(0.6, 0.8, 0.3));
        this.playSoundOnTrigger("midTom", this.midTomKey, 0.25);
        return floorTom;
    }

    createHighTom() {
        const midTom = this.createDrumComponent("highTom", 0.4, 0.2, new Vector3(0.1, 0.7, 0.3));
        this.playSoundOnTrigger("highTom", this.highTomKey, 0.25);
        return midTom;
    }

    createCrashCymbal() {
        const crashCymbal = this.createCymbalComponent("crashCymbal", 1.0, 0.07, new Vector3(-0.4, 1.2, 0.5));
        this.playSoundOnTrigger("crashCymbal", this.crashCymbalKey, 5);
        return crashCymbal;
    }

    createRideCymbal() {
        const rideCymbal = this.createCymbalComponent("rideCymbal", 1.0, 0.07, new Vector3(1.2, 1.2, 0.5));
        this.playSoundOnTrigger("rideCymbal", this.rideCymbalKey, 5);
        return rideCymbal;
    }

    createHiHat() {
        const hiHat = this.createCymbalComponent("hiHat", 0.4, 0.07, new Vector3(-0.5, 0.8, 0.2));
        this.playSoundOnTrigger("hiHat", this.closedHiHatKey, 2);
        return hiHat;
    }

    move(displacementVector: Vector3) {
        this.drumContainer.position.addInPlace(displacementVector);
    }

    createDrumComponentBody(name: string, diameter: number, height: number, drumComponentContainer: TransformNode) {
        const body = MeshBuilder.CreateCylinder(name + "Body", { diameter: diameter, height: height }, this.scene);
        body.position = new Vector3(0, height / 2, 0);
        body.material = new StandardMaterial("wireframeMaterial", this.scene);
        body.material.wireframe = true;
        body.parent = drumComponentContainer;

        const bodyAggregate = new PhysicsAggregate(body, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
        bodyAggregate.body.setMotionType(PhysicsMotionType.STATIC);
        bodyAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
        bodyAggregate.body.setCollisionCallbackEnabled(true);
        bodyAggregate.body.setEventMask(this.eventMask);
    }

    createDrumComponentTrigger(name: string, diameter: number, height: number, drumComponentContainer: TransformNode) { //Créer les peaux des percussions à peau (snare, tom, etc...)
        let triggerHeight = 0.07;
        const trigger = MeshBuilder.CreateCylinder(name + "Trigger", { diameter: diameter, height: triggerHeight }, this.scene);
        trigger.position = new Vector3(0, height - (triggerHeight / 2), 0);
        trigger.material = new StandardMaterial("wireframeMaterial", this.scene);
        trigger.material.wireframe = true;
        trigger.parent = drumComponentContainer;

        const triggerAggregate = new PhysicsAggregate(trigger, PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
        triggerAggregate.body.setMotionType(PhysicsMotionType.STATIC);
        triggerAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
        if (triggerAggregate.body.shape) {
            triggerAggregate.body.shape.isTrigger = true;
        }
    }

    createDrumComponent(name: string, diameter: number, height: number, coordinates: Vector3) {
        const drumComponentContainer = new TransformNode(name + "Container", this.scene);
        drumComponentContainer.parent = this.drumContainer;

        this.createDrumComponentBody(name, diameter, height, drumComponentContainer);
        this.createDrumComponentTrigger(name, diameter, height, drumComponentContainer);

/*
        // Add three legs to the drum container
        const leg1 = this.createLeg(new BABYLON.Vector3(-diameter / 2, -height / 2, 0), drumContainer);
        const leg2 = this.createLeg(new BABYLON.Vector3(diameter / 2, -height / 2, 0), drumContainer);
        const leg3 = this.createLeg(new BABYLON.Vector3(0, -height / 2, diameter / 2), drumContainer);
        */

        /* VERSION COLLISION ENTRE OBJETS (Pas de trigger) - Abandonné (difficile d'empêcher la batterie de bouger)
        const cylinderObservable = cylinderAggregate.body.getCollisionObservable();

        cylinderObservable.add((collisionEvent) => {
            //console.log("Collision détectée :", collisionEvent);
            if(collisionEvent.type !== "COLLISION_STARTED") return;
    
            console.log("ON JOUE : " + name);
    
            const noteMdiToPlay = midiKey;
    
            if (this.wamInstance) {
                // Joue une note lors de la collision
                this.wamInstance.audioNode.scheduleEvents({
                    type: 'wam-midi',
                    time: this.audioContext.currentTime,
                    data: { bytes: new Uint8Array([0x90, noteMdiToPlay, 100]) } // Note ON
                });
                this.wamInstance.audioNode.scheduleEvents({
                    type: 'wam-midi',
                    time: this.audioContext.currentTime + 0.25,
                    data: { bytes: new Uint8Array([0x80, noteMdiToPlay, 100]) } // Note OFF
                });
            }
        });
        */

        drumComponentContainer.position = coordinates;
        this.drumComponents.push(drumComponentContainer);
        return drumComponentContainer;
    }

    playSoundOnTrigger(name: string, midiKey: number, duration: number) { //duration in seconds
        this.hk.onTriggerCollisionObservable.add((collision: any) => {
            if (collision.type === "TRIGGER_ENTERED" && collision.collidedAgainst.transformNode.id === name + "Trigger") {
                if (this.log) {
                    console.log(name + " trigger entered", collision);
                    console.log("Collider : ");
                    console.log(collision.collider);
                    console.log("Collided against : ");
                    console.log(collision.collidedAgainst);
                }
                if (!this.drumSoundsEnabled) {
                    return; // Do not play sounds if drum sounds are disabled
                }
                var currentVelocity = 100;
                for (var i = 0; i < this.drumsticks.length; i++) {
//Attention en cas de collision avec la balle ? (velocité = 100 ?)
                    if (collision.collider.transformNode.id === this.drumsticks[i].drumstickAggregate.transformNode.id) {
                        console.log("Collision avec le drumstick : " + this.drumsticks[i].drumstickAggregate.transformNode.id);
                        console.log("Vitesse linéaire de la baguette : ", this.drumsticks[i].getVelocity().length());
                        console.log("Vitesse angulaire de la baguette : ", this.drumsticks[i].getAngularVelocity().length());
                        currentVelocity = Math.round(10 * (this.drumsticks[i].getVelocity().length() + this.drumsticks[i].getAngularVelocity().length()));
                        console.log("Vitesse de la baguette : " + currentVelocity);
                    }
                }
                console.log("Vitesse de la baguette hors boucle : " + currentVelocity);
//const currentVelocity = new Vector3();
                /* We already know collided against is a trigger so we should calculate its velocity (currently 0 but if the drum starts moving for a reason we should)
                if(collision.collidedAgainst.transformNode.physicsBody.controllerPhysicsImpostor){
                    console.log("Collision avec une baguette !");
                    const controllerPhysics = collision.collidedAgainst.controllerPhysicsImpostor;
                    currentVelocity.copyFrom(controllerPhysics.getLinearVelocity());
                    console.log("Vitesse de la baguette : " + currentVelocity);
                }
                    */
                        
                //const otherVelocity = new Vector3();
                /*
                if(collision.collider.transformNode.physicsBody.controllerPhysicsImpostor){
                    const controllerPhysics = collision.collider.transformNode.controllerPhysicsImpostor;
                    otherVelocity.copyFrom(controllerPhysics.getLinearVelocity());
                    if(this.log){
                        console.log("Collision avec une baguette !"); 
                        console.log("Vitesse de la baguette : " + otherVelocity);
                    }
                }
                    */
                
                //const relativeVelocity = currentVelocity.subtract(otherVelocity);
                //const speed = Math.abs(relativeVelocity.length());
                /*
                if(this.log){
                    console.log('Speed:', speed);
                }
                    
                const intensity = Math.min(Math.max(speed * 10, 0), 127); // Scale speed to MIDI velocity range (0-127)

                if (currentVelocity.y > 0) {
                    if(this.log){
                        console.log('Upward movement detected, ignoring collision');
                    }
                    return;
                }
                */
                if (this.wamInstance) {
                    // Joue une note lors de la collision
                    this.wamInstance.audioNode.scheduleEvents({
                        type: 'wam-midi',
                        time: this.audioContext.currentTime,
                        data: { bytes: new Uint8Array([0x90, midiKey, currentVelocity]) } // Note ON with intensity
                    });
                    this.wamInstance.audioNode.scheduleEvents({
                        type: 'wam-midi',
                        time: this.audioContext.currentTime + duration,
                        data: { bytes: new Uint8Array([0x80, midiKey, currentVelocity]) } // Note OFF
                    });
                }
            } else {
                if (this.log) {
                    console.log('trigger exited', collision);
                }
            }
        });
    }

    /*
    createLeg(position, parent) {
        const leg = BABYLON.MeshBuilder.CreateCylinder("leg", { diameter: 0.1, height: 1 }, this.scene);
        leg.position = position;
        leg.material = new BABYLON.StandardMaterial("wireframeMaterial", this.scene);
        leg.material.wireframe = true;
        leg.parent = parent;

        var legAggregate = new BABYLON.PhysicsAggregate(leg, BABYLON.PhysicsShapeType.CYLINDER, { mass: 1000 }, this.scene);

        legAggregate.body.setMotionType(BABYLON.PhysicsMotionType.STATIC);
        legAggregate.body.setCollisionCallbackEnabled(true);
        legAggregate.body.setEventMask(this.eventMask);

        return leg;
    }
        */

    createCymbalComponent(name : string, diameter : number, height : number, coordinates : Vector3){//Créer les cymbales (hi-hat, crash, ride, etc.)
        const drumComponentContainer = new TransformNode(name + "Container", this.scene);
        drumComponentContainer.parent = this.drumContainer;

        this.createDrumComponentBody(name, diameter, height, drumComponentContainer);
        this.createDrumComponentTrigger(name, diameter, height, drumComponentContainer);

        drumComponentContainer.position = coordinates;
        this.drumComponents.push(drumComponentContainer);
        return drumComponentContainer;
    }

/*
    createCymbalComponentBody(name, diameter, height, coordinates){
            // Create the main body of the drum
            const body = BABYLON.MeshBuilder.CreateCylinder(name + "Body", { diameter: diameter, height: height }, this.scene);
            body.position = new BABYLON.Vector3(0, height / 2, 0);
            body.material = new BABYLON.StandardMaterial("wireframeMaterial", this.scene);
            body.material.wireframe = true;
            body.parent = drumComponentContainer;
    
            var bodyAggregate = new BABYLON.PhysicsAggregate(body, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
            bodyAggregate.body.setMotionType(BABYLON.PhysicsMotionType.STATIC);
            bodyAggregate.body.setPrestepType(BABYLON.PhysicsPrestepType.TELEPORT);
            bodyAggregate.body.setCollisionCallbackEnabled(true);
            bodyAggregate.body.setEventMask(this.eventMask);
    }
            */

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