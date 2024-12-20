//TODO : Commande pour reset l'emplacement des drumSticks
//Cleaner
//Faire cymbales
//Prendre en compte la vitesse du mouvement 
//Grosse caisse ? Besoin d'une pédale (appuyer sur un bouton ?)

class XRDrum{
    constructor(audioContext, scene, eventMask, xr, hk){ //Retirer eventMask ?
        this.audioContext = audioContext;
        this.hk = hk;
        this.scene = scene;
        this.eventMask = eventMask;
        this.wamInstance = null;
        this.initializePlugin().then((wamInstance) => {
            this.wamInstance = wamInstance;
            this.snareKey = 38;
            this.snare = this.createSnare();
            this.floorTomKey = 41;
            this.floorTom = this.createFloorTom();
        });
        this.xr = xr;
        this.drumSticks = this.createSticks(xr);
        this.components = [];
    }

    async initializePlugin() {
        const hostGroupId = await setupWamHost(this.audioContext);
        const wamURISynth = 'https://www.webaudiomodules.com/community/plugins/burns-audio/drumsampler/index.js';
        const wamInstance = await loadDynamicComponent(wamURISynth, hostGroupId, this.audioContext);

        // Exemple de selection d'un autre son
        let state = await wamInstance.audioNode.getState();
        //state.values.patchName = "Drum Sampler WAM";
        await wamInstance.audioNode.setState(state);

        wamInstance.audioNode.connect(this.audioContext.destination);

        return wamInstance;
    }

    createSnare() {
        this.createDrumComponent("snare", 0.7, 0.5, new BABYLON.Vector3(0, 0.6, 4), this.snareKey);
        this.playSoundOnTrigger("snare", this.snareKey, 0.25);
    }
    createFloorTom() {
        this.createDrumComponent("floorTom", 0.8, 0.5, new BABYLON.Vector3(1, 0.5, 4), this.floorTomKey);
        this.playSoundOnTrigger("floorTom", this.floorTomKey, 0.25);
    }


    move(){
        //Déplacer les éléments de la batterie
    }

    createDrumComponentbody(name, diameter, height, drumComponentContainer){//Créer les percussions à peau (snare, kick, tom, etc.)
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

    createDrumComponentTrigger(name, diameter, height, drumComponentContainer){//Créer les peaux des percussions à peau (snare, kick, tom, etc.)
        // Create the trigger for the top surface
        const trigger = BABYLON.MeshBuilder.CreateCylinder(name + "Trigger", { diameter: diameter, height: 0.1 }, this.scene);
        trigger.position = new BABYLON.Vector3(0, height-0.05, 0); //0.05 = trigger height / 2 pour aligner parfaitement avec le body
        trigger.material = new BABYLON.StandardMaterial("wireframeMaterial", this.scene);
        trigger.material.wireframe = true;
        trigger.parent = drumComponentContainer;

        var triggerAggregate = new BABYLON.PhysicsAggregate(trigger, BABYLON.PhysicsShapeType.CYLINDER, { mass: 0 }, this.scene);
        triggerAggregate.body.setMotionType(BABYLON.PhysicsMotionType.STATIC);
        triggerAggregate.body.setPrestepType(BABYLON.PhysicsPrestepType.TELEPORT);
        triggerAggregate.body.shape.isTrigger = true;
    }    
    
    createDrumComponent(name, diameter, height, coordinates){//Créer les percussions à peau (snare, kick, tom, etc.)
        const drumComponentContainer = new BABYLON.TransformNode(name + "Container", this.scene);
        
        this.createDrumComponentbody(name, diameter, height, drumComponentContainer);

        //TODO Ajouter Behavior type 6DOF pour permettre de bouger les éléments de la batterie
        //addBehavior(sixDofBehavior);

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
        this.components.push(drumComponentContainer);
        return drumComponentContainer;
    }

    playSoundOnTrigger(name, midiKey, duration){ //duration in seconds
        this.hk.onTriggerCollisionObservable.add((collision) => {
            if (collision.type === "TRIGGER_ENTERED" && collision.collidedAgainst.transformNode.id === name +"Trigger") {
                console.log(name + " trigger entered", collision);
                    
                if (this.wamInstance) {
                    // Joue une note lors de la collision
                    this.wamInstance.audioNode.scheduleEvents({
                        type: 'wam-midi',
                        time: this.audioContext.currentTime,
                        data: { bytes: new Uint8Array([0x90, midiKey, 100]) } // Note ON
                    });
                    this.wamInstance.audioNode.scheduleEvents({
                        type: 'wam-midi',
                        time: this.audioContext.currentTime + duration,
                        data: { bytes: new Uint8Array([0x80, midiKey, 100]) } // Note OFF
                    });
                }
            }

            else console.log('trigger exited', collision);
        });
    }

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

    createCymbalComponent(){//Créer les cymbales (hi-hat, crash, ride, etc.)
    }

    createSticks(xr) {
        // Create two sticks
        var stick1 = BABYLON.MeshBuilder.CreateBox("stick1", { height: 1, width: 0.1, depth: 0.1 }, this.scene);
        var stick2 = BABYLON.MeshBuilder.CreateBox("stick2", { height: 1, width: 0.1, depth: 0.1 }, this.scene);
        stick1.position = new BABYLON.Vector3(0, 5, 4);
        stick2.position = new BABYLON.Vector3(0, 5, 4);

        stick1.material = new BABYLON.StandardMaterial("wireframeMaterial", this.scene);
        stick2.material = new BABYLON.StandardMaterial("wireframeMaterial", this.scene);

        var stick1Aggregate = new BABYLON.PhysicsAggregate(stick1, BABYLON.PhysicsShapeType.BOX, { mass: 1 }, this.scene);
        var stick2Aggregate = new BABYLON.PhysicsAggregate(stick2, BABYLON.PhysicsShapeType.BOX, { mass: 1 }, this.scene);
        stick1Aggregate.body.setCollisionCallbackEnabled(true);
        stick2Aggregate.body.setCollisionCallbackEnabled(true);
        stick1Aggregate.body.setEventMask(this.eventMask);
        stick2Aggregate.body.setEventMask(this.eventMask);

        const stick1Observable = stick1Aggregate.body.getCollisionObservable();
        const stick2Observable = stick2Aggregate.body.getCollisionObservable();
        
        xr.input.onControllerAddedObservable.add((controller) => {
            controller.onMotionControllerInitObservable.add((motionController) => {
                let pickedStick = null;

                motionController.getComponent("xr-standard-trigger").onButtonStateChangedObservable.add((button) => {
                    if (button.pressed) {
                        pickedStick = this.pickStick(controller, stick1Aggregate) || this.pickStick(controller, stick2Aggregate);
                    } else {
                        this.releaseStick(pickedStick);
                        pickedStick = null;
                    }
                });
            });
        });
        
        return { stick1Aggregate, stick2Aggregate };
    }

    pickStick(controller, stickAggregate){
        console.log("Déclenchement de pickStick");
        const meshUnderPointer = this.xr.pointerSelection.getMeshUnderPointer(controller.uniqueId);
        if(meshUnderPointer){
            console.log("Mesh under pointer : " + meshUnderPointer.name);
        }
        else{
            console.log("Aucun mesh sous le pointeur");
        }
        if (meshUnderPointer === stickAggregate.transformNode) {
            console.log("On a sélectionné un item : " + meshUnderPointer.name);
            stickAggregate.body.setMotionType(BABYLON.PhysicsMotionType.ANIMATED); // Set motion type to ANIMATED
            stickAggregate.body.setPrestepType(BABYLON.PhysicsPrestepType.TELEPORT);
            stickAggregate.body.setCollisionCallbackEnabled(true);
            stickAggregate.body.setEventMask(this.eventMask);
            //TODO
            //stickAggregate.transformNode.addBehavior(handConstraintBehavior);
            stickAggregate.transformNode.setParent(controller.grip); // Ensure the stick follows the controller
            stickAggregate.transformNode.position = BABYLON.Vector3.Zero(); // Teleport to the hand
            stickAggregate.transformNode.rotationQuaternion = BABYLON.Quaternion.Identity(); // Match rotation to the controller
            return stickAggregate;
        }
        return null;
    };

    
    releaseStick(stickAggregate){
        if (stickAggregate) {
            stickAggregate.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
            stickAggregate.transformNode.setParent(null); // Ensure the stick is released from the controller
        }
    };
}

// AUDIO INIT --------------------

async function setupWamHost(audioContext) {
    const { default: initializeWamHost } = await import("https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js");
    const [hostGroupId] = await initializeWamHost(audioContext);
    return hostGroupId;
}

async function loadDynamicComponent(wamURI, hostGroupId, audioContext) {
    try {
        const { default: WAM } = await import(wamURI);
        const wamInstance = await WAM.createInstance(hostGroupId, audioContext);
        return wamInstance;
    } catch (error) {
        console.error('Erreur lors du chargement du Web Component :', error);
    }
}
