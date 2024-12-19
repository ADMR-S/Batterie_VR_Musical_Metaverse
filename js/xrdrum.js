class XRDrum{
    constructor(audioContext, scene, eventMask, xr){ //Retirer eventMask ?
        this.audioContext = audioContext;
        this.scene = scene  
        this.eventMask = eventMask;
        this.wamInstance = null;
        this.initializePlugin().then((wamInstance) => {
            this.wamInstance = wamInstance;
            this.snareKey = 38;
            this.snare = this.createSnare();
        });
        this.xr = xr;
        this.drumSticks = this.createSticks(xr);//TODO
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
        this.createDrumComponent("snare", 1, 0.5, new BABYLON.Vector3(0, 1, 4), this.snareKey);
    }
    move(){
        //Déplacer les éléments de la batterie
    }

    createDrumComponent(name, diameter, height, coordinates, midiKey){//Créer les percussions à peau (snare, kick, tom, etc.)
        //2 parties : créer la peau sur le cylindre (zone de collision, cylindre fin) puis créer le cylindre en dessous (pour le visuel, cylindre épais)
        // Créer le cylindre (élément de la batterie)
        const cylinder = BABYLON.MeshBuilder.CreateCylinder(name, { diameter: diameter, height: height}, this.scene);
        cylinder.position = coordinates; // Ajuster la hauteur selon besoin
        /*
        cylinder.showBoundingBox = true;
        cylinder.showBoundingSphere = true;
        */
        cylinder.material = new BABYLON.StandardMaterial("wireframeMaterial", scene);
        cylinder.material.wireframe = true;

        var cylinderAggregate = new BABYLON.PhysicsAggregate(cylinder, BABYLON.PhysicsShapeType.CYLINDER, { mass: 1 }, scene);
            
        cylinderAggregate.body.setMotionType(BABYLON.PhysicsMotionType.STATIC); // Set motion type to STATIC
        cylinderAggregate.body.setCollisionCallbackEnabled(true);
    
        cylinderAggregate.body.setEventMask(this.eventMask);

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

        return cylinder;
    }

    
    createCymbalComponent(){//Créer les cymbales (hi-hat, crash, ride, etc.)
    }

    createSticks(xr) {
        // Create two sticks
        var stick1 = BABYLON.MeshBuilder.CreateBox("stick1", { height: 1, width: 0.1, depth: 0.1 }, this.scene);
        var stick2 = BABYLON.MeshBuilder.CreateBox("stick2", { height: 1, width: 0.1, depth: 0.1 }, this.scene);
        stick1.position = new BABYLON.Vector3(0, 0.5, 4);
        stick2.position = new BABYLON.Vector3(0, 0.5, 4);

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

        const pickStick = (controller, stickAggregate) => {
            const pickRay = new BABYLON.Ray(controller.pointer.position, controller.pointer.forward, 1);
            const pickInfo = this.scene.pickWithRay(pickRay, (mesh) => mesh === stickAggregate.transformNode);
            if (pickInfo.hit) {
                stickAggregate.body.setMotionType(BABYLON.PhysicsMotionType.KINEMATIC);
                stickAggregate.body.setCollisionCallbackEnabled(true);
                stickAggregate.body.setEventMask(this.eventMask);
                stickAggregate.body.setParent(controller.grip);
                return stickAggregate;
            }
            return null;
        };

        const releaseStick = (stickAggregate) => {
            if (stickAggregate) {
                stickAggregate.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
                stickAggregate.body.setParent(null);
            }
        };

        xr.input.onControllerAddedObservable.add((controller) => {
            controller.onMotionControllerInitObservable.add((motionController) => {
                let pickedStick = null;

                motionController.getComponent("xr-standard-trigger").onButtonStateChangedObservable.add((button) => {
                    if (button.pressed) {
                        pickedStick = pickStick(controller, stick1Aggregate) || pickStick(controller, stick2Aggregate);
                    } else {
                        releaseStick(pickedStick);
                        pickedStick = null;
                    }
                });
            });
        });

        return { stick1Aggregate, stick2Aggregate };
    }
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