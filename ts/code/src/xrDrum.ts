import { Scene } from "@babylonjs/core/scene";
import {Color3, Axis} from "@babylonjs/core";
import { Vector3, Quaternion, Matrix } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder, TransformNode, StandardMaterial, SixDofDragBehavior, PhysicsAggregate, PhysicsShapeType, PhysicsMotionType, PhysicsPrestepType } from "@babylonjs/core";
import { WebXRDefaultExperience } from "@babylonjs/core";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRControllerPhysics } from "@babylonjs/core/XR/features/WebXRControllerPhysics";
import { Observable } from "@babylonjs/core/Misc/observable";

//TODO : 
//Intégration avec Musical Metaverse
//Prendre en compte la vitesse du mouvement 
//Commande pour reset l'emplacement des drumSticks
//Cleaner
//Empêcher de taper par dessous pour les tambours, autoriser pour cymbales
//Empêcher de passer à travers un objet ? 
//Empêcher les objets de passer à travers le sol
//Sons différents en bordure / au centre de la peau ? (+ bordure métallique)
//Grosse caisse / Hi-Hat ? Besoin d'une pédale (appuyer sur un bouton ?)
//Empêcher de taper dans un trigger par dessous
//Tenir les baguettes avec la gachette interne plutôt (permet d'avoir une autre position de main plus adaptée)
//Replace invisible cube meshes for controllers by physicsImpostors
//Create classes for drumComponents, drumSticks
//Use a 0 distance constraint to snap drumsticks to hands ? 

class XRDrum {
    audioContext: AudioContext;
    hk: any;
    scene: Scene;
    eventMask: number; //retirer ?
    wamInstance: any;
    drumComponents: TransformNode[];
    drumContainer: TransformNode;
    xr: WebXRDefaultExperience;
    drumSticks: { stick1Aggregate: PhysicsAggregate, stick2Aggregate: PhysicsAggregate };
    drumSoundsEnabled: boolean;
    snare : TransformNode;
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
        this.drumSticks = this.createSticks(xr);
        this.drumSoundsEnabled = false; // Initialize to false and set to true only when controllers are added
        //Currently in pickstick, move later
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
                console.log(name + " trigger entered", collision);
                console.log("Collider : ");
                console.log(collision.collider);
                console.log("Collided against : ");
                console.log(collision.collidedAgainst);
                
                if (!this.drumSoundsEnabled) {
                    return; // Do not play sounds if drum sounds are disabled
                }

                const currentVelocity = new Vector3();
                /* We already know collided against is a trigger so we should calculate its velocity (currently 0 but if the drum starts moving for a reason we should)
                if(collision.collidedAgainst.transformNode.physicsBody.controllerPhysicsImpostor){
                    console.log("Collision avec une baguette !");
                    const controllerPhysics = collision.collidedAgainst.controllerPhysicsImpostor;
                    currentVelocity.copyFrom(controllerPhysics.getLinearVelocity());
                    console.log("Vitesse de la baguette : " + currentVelocity);
                }
                    */
                        
                const otherVelocity = new Vector3();
                /*
                if(collision.collider.transformNode.physicsBody.controllerPhysicsImpostor){
                    console.log("Collision avec une baguette !"); 
                    const controllerPhysics = collision.collider.transformNode.controllerPhysicsImpostor;
                    otherVelocity.copyFrom(controllerPhysics.getLinearVelocity());
                    console.log("Vitesse de la baguette : " + otherVelocity);
                }
                */
                const relativeVelocity = currentVelocity.subtract(otherVelocity);
                const speed = Math.abs(relativeVelocity.length());
                console.log('Speed:', speed);
                const intensity = Math.min(Math.max(speed * 10, 0), 127); // Scale speed to MIDI velocity range (0-127)

                if (currentVelocity.y > 0) {
                    console.log('Upward movement detected, ignoring collision');
                    return;
                }

                if (this.wamInstance) {
                    // Joue une note lors de la collision
                    this.wamInstance.audioNode.scheduleEvents({
                        type: 'wam-midi',
                        time: this.audioContext.currentTime,
                        data: { bytes: new Uint8Array([0x90, midiKey, 100]) } // Note ON with intensity
                    });
                    this.wamInstance.audioNode.scheduleEvents({
                        type: 'wam-midi',
                        time: this.audioContext.currentTime + duration,
                        data: { bytes: new Uint8Array([0x80, midiKey, 100]) } // Note OFF
                    });
                }
            } else {
                console.log('trigger exited', collision);
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

    createSticks(xr: WebXRDefaultExperience) {
        const stickLength = 0.4;
        const stickDiameter = 0.02;
        const ballDiameter = 0.03;

        const stick = MeshBuilder.CreateCylinder("stick1", { height: stickLength, diameter: stickDiameter }, this.scene);
        const ball = MeshBuilder.CreateSphere("ball1", { diameter: ballDiameter }, this.scene);

        ball.parent = stick;
        ball.position = new Vector3(0, stickLength / 2, 0);

        stick.position = new Vector3(0, 5, 4);
        stick.material = new StandardMaterial("stickMaterial", this.scene);
        ball.material = new StandardMaterial("ballMaterial", this.scene);

        const stick2 = stick.clone("stick2");
        const ball2 = ball.clone("ball2");

        
        const avgPosition = stick.position.add(ball.position).scale(0.5);

        //TRY TO USE MERGED MESHES INSTEAD OF CONVEX_HULL to not distinguish between ball or stick
        /*
        var mergeArray = [stick, ball];
        const mergedStick1 = BABYLON.Mesh.MergeMeshes(mergeArray, false, false, false, false, true);
        const mergedStick2 = mergedStick1.clone("stick2_merged");
        mergedStick1.setPivotMatrix(BABYLON.Matrix.Translation(-avgPosition.x, -avgPosition.y, -avgPosition.z), false);
        mergedStick2.setPivotMatrix(BABYLON.Matrix.Translation(-avgPosition.x, -avgPosition.y, -avgPosition.z), false);
        
        console.log("Merged stick 1 : " + mergedStick1.name);
        console.log("Merged stick 2 : " + mergedStick2.name);
        */
        var stick1Aggregate = new PhysicsAggregate(stick, PhysicsShapeType.CONVEX_HULL, { mass: 1 }, this.scene);
        var stick2Aggregate = new PhysicsAggregate(stick2, PhysicsShapeType.CONVEX_HULL, { mass: 1 }, this.scene);
        stick1Aggregate.body.setCollisionCallbackEnabled(true);
        stick2Aggregate.body.setCollisionCallbackEnabled(true);
        stick1Aggregate.body.setEventMask(this.eventMask);
        stick2Aggregate.body.setEventMask(this.eventMask);

        xr.input.onControllerAddedObservable.add((controller: WebXRInputSource) => {
            controller.onMotionControllerInitObservable.add((motionController: any) => {
                this.drumSoundsEnabled = true; // Enable drum sounds when controllers are added
                let pickedStick: PhysicsAggregate | null = null;

                motionController.getComponent("xr-standard-trigger").onButtonStateChangedObservable.add((button: any) => {
                    if (button.pressed) {
                        pickedStick = this.pickStick(controller, stick1Aggregate, stickLength) || this.pickStick(controller, stick2Aggregate, stickLength);
                        motionController.heldStick = pickedStick;
                    } else {
                        this.releaseStick(motionController.heldStick);
                        motionController.heldStick = null;
                    }
                });
            });
        });

        return { stick1Aggregate, stick2Aggregate };
    }

    pickStick(controller: WebXRInputSource, stickAggregate: PhysicsAggregate, stickLength: number) {
        console.log("Déclenchement de pickStick");
        const meshUnderPointer = this.xr.pointerSelection.getMeshUnderPointer(controller.uniqueId);
        if(meshUnderPointer){
            console.log("Mesh under pointer : " + meshUnderPointer.name);
        }
        else{
            console.log("Aucun mesh sous le pointeur");
        }
        if (meshUnderPointer === stickAggregate.transformNode) {
            stickAggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
            stickAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
            stickAggregate.body.setCollisionCallbackEnabled(true);
            stickAggregate.body.setEventMask(this.eventMask);
            if(controller.grip){
                stickAggregate.transformNode.setParent(controller.grip);
            }
            stickAggregate.transformNode.position = new Vector3(0, 0, stickLength/4); // Adjust position to remove offset
            stickAggregate.transformNode.rotationQuaternion = Quaternion.RotationAxis(Axis.X, Math.PI / 2); // Align with the hand
            
            //DOES NOT WORK, RETURNS NULL, BUT SEEMS TO FIND THE FUNCTION ? FIND WHY
            /*
            var impostor = controller.physics.getImpostorForController(controller); //To be able to calculate velocity when hitting
            console.log("Impostor : ");
            console.log(impostor);
            */

            // Set velocity to a null vector to stop movement if any
            stickAggregate.body.setLinearVelocity(Vector3.Zero());
            stickAggregate.body.setAngularVelocity(Vector3.Zero());
         
            return stickAggregate;
        }
        return null;
    }

    releaseStick(stickAggregate: PhysicsAggregate | null) {
        if (stickAggregate) {
            stickAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
            stickAggregate.body.setPrestepType(PhysicsPrestepType.DISABLED);
            stickAggregate.transformNode.setParent(null);
            //stickAggregate.controllerPhysicsImpostor = null;
        }
    }
}

export default XRDrum;

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