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

//Preparer code pour demo
//Preparer diapos oral

class XRDrum{
    constructor(audioContext, scene, eventMask, xr, hk){ //Retirer eventMask ?
        this.audioContext = audioContext;
        this.hk = hk;
        this.scene = scene;
        this.eventMask = eventMask;
        this.wamInstance = null;
        this.drumComponents = [];
        this.drumContainer = new BABYLON.TransformNode("drumContainer", this.scene);
        this.initializePlugin().then((wamInstance) => {
            this.wamInstance = wamInstance;
            this.snareKey = 38;
            this.snare = this.createSnare();
            this.floorTomKey = 41;
            this.floorTom = this.createFloorTom();
            this.midTomKey = 47;
            this.midTom = this.createMidTom();
            this.highTomKey = 43;
            this.highTom = this.createHighTom();
            this.crashCymbalKey = 49;
            this.crashCymbal = this.createCrashCymbal();
            this.rideCymbalKey = 51;
            this.rideCymbal = this.createRideCymbal();
            this.closedHiHatKey = 42;
            this.openHiHatKey = 46;
            this.hiHat = this.createHiHat();
            this.move(new BABYLON.Vector3(0, 0, 4))//NEW POSITION
        });
        this.add6dofBehavior(this.drumContainer);//Make the drumkit movable in the VR space on selection
        this.xr = xr;
        this.drumSticks = this.createSticks(xr);
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
        this.createDrumComponent("snare", 0.5, 0.3, new BABYLON.Vector3(0, 0.3, 0), this.snareKey);
        this.playSoundOnTrigger("snare", this.snareKey, 0.25);
    }
    createFloorTom() {
        this.createDrumComponent("floorTom", 0.6, 0.3, new BABYLON.Vector3(0.8, 0.3, 0), this.floorTomKey);
        this.playSoundOnTrigger("floorTom", this.floorTomKey, 0.25);
    }
    createMidTom() {
        this.createDrumComponent("midTom", 0.5, 0.25, new BABYLON.Vector3(0.6, 0.8, 0.3), this.midTomKey);
        this.playSoundOnTrigger("midTom", this.midTomKey, 0.25);
    }
    createHighTom() {
        this.createDrumComponent("highTom", 0.4, 0.2, new BABYLON.Vector3(0.1, 0.7, 0.3), this.highTomKey);
        this.playSoundOnTrigger("highTom", this.highTomKey, 0.25);
    }
    createCrashCymbal(){
        this.createCymbalComponent("crashCymbal", 1.0, 0.07, new BABYLON.Vector3(-0.4, 1.2, 0.5));
        this.playSoundOnTrigger("crashCymbal", this.crashCymbalKey, 3);
    }
    createRideCymbal(){
        this.createCymbalComponent("rideCymbal", 1.0, 0.07, new BABYLON.Vector3(1.2, 1.2, 0.5));
        this.playSoundOnTrigger("rideCymbal", this.rideCymbalKey, 3);
    }
    createHiHat(){ 
        this.createCymbalComponent("hiHat", 0.4, 0.07, new BABYLON.Vector3(-0.5, 0.8, 0.2));
        this.playSoundOnTrigger("hiHat", this.closedHiHatKey, 1);
    }



     move(displacementVector) {
        this.drumContainer.position.addInPlace(displacementVector);
    }

    createDrumComponentBody(name, diameter, height, drumComponentContainer){//Créer les percussions à peau (snare, kick, tom, etc.)
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
        let triggerHeight = 0.07;
        const trigger = BABYLON.MeshBuilder.CreateCylinder(name + "Trigger", { diameter: diameter, height: triggerHeight }, this.scene);
        trigger.position = new BABYLON.Vector3(0, height-(triggerHeight/2), 0); //0.05 = trigger height / 2 pour aligner parfaitement avec le body
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
        drumComponentContainer.parent = this.drumContainer;
        
        this.createDrumComponentBody(name, diameter, height, drumComponentContainer);

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
        this.drumComponents.push(drumComponentContainer);
        return drumComponentContainer;
    }

    playSoundOnTrigger(name, midiKey, duration){ //duration in seconds
        this.hk.onTriggerCollisionObservable.add((collision) => {
            if (collision.type === "TRIGGER_ENTERED" && collision.collidedAgainst.transformNode.id === name +"Trigger") {
                console.log(name + " trigger entered", collision);
                console.log("Collider : ");
                console.log(collision.collider);
                console.log("Collided against : ");
                console.log(collision.collidedAgainst);
                
                const currentVelocity = new BABYLON.Vector3();
                /* We already know collided against is a trigger so we should calculate its velocity (currently 0 but if the drum starts moving for a reason we should)
                if(collision.collidedAgainst.transformNode.physicsBody.controllerPhysicsImpostor){
                    console.log("Collision avec une baguette !");
                    const controllerPhysics = collision.collidedAgainst.controllerPhysicsImpostor;
                    currentVelocity.copyFrom(controllerPhysics.getLinearVelocity());
                    console.log("Vitesse de la baguette : " + currentVelocity);
                }
                    */
                        
                const otherVelocity = new BABYLON.Vector3();
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

    createCymbalComponent(name, diameter, height, coordinates){//Créer les cymbales (hi-hat, crash, ride, etc.)
        const drumComponentContainer = new BABYLON.TransformNode(name + "Container", this.scene);
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

    add6dofBehavior(drumContainer){
        // Add 6-DoF behavior to the drum container
        const sixDofBehavior = new BABYLON.SixDofDragBehavior();
        drumContainer.addBehavior(sixDofBehavior);

        // Highlight the drum container in green when selected
        sixDofBehavior.onDragStartObservable.add(() => {
            drumContainer.getChildMeshes().forEach(mesh => {
                mesh.material.emissiveColor = new BABYLON.Color3(0, 1, 0); // Green color
            });
        });

        sixDofBehavior.onDragEndObservable.add(() => {
            drumContainer.getChildMeshes().forEach(mesh => {
                mesh.material.emissiveColor = BABYLON.Color3.Black(); // Reset to default color
            });
        });
    }
    createSticks(xr) {
        // Create two drumsticks
        const stickLength = 0.4; // Length of the drumstick
        const stickDiameter = 0.02; // Diameter of the drumstick
        const ballDiameter = 0.03; // Diameter of the ball at the tip

        var stick = BABYLON.MeshBuilder.CreateCylinder("stick1", { height: stickLength, diameter: stickDiameter }, this.scene);

        var ball = BABYLON.MeshBuilder.CreateSphere("ball1", { diameter: ballDiameter }, this.scene);

        
        ball.parent = stick;
        

        ball.position = new BABYLON.Vector3(0, stickLength / 2, 0);

        stick.position = new BABYLON.Vector3(0, 5, 4);

        stick.material = new BABYLON.StandardMaterial("stickMaterial", this.scene);
        ball.material = new BABYLON.StandardMaterial("ballMaterial", this.scene);

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
        var stick1Aggregate = new BABYLON.PhysicsAggregate(stick, BABYLON.PhysicsShapeType.CONVEX_HULL, { mass: 1 }, this.scene);
        var stick2Aggregate = new BABYLON.PhysicsAggregate(stick2, BABYLON.PhysicsShapeType.CONVEX_HULL, { mass: 1 }, this.scene);
        stick1Aggregate.body.setCollisionCallbackEnabled(true);
        stick2Aggregate.body.setCollisionCallbackEnabled(true);
        stick1Aggregate.body.setEventMask(this.eventMask);
        stick2Aggregate.body.setEventMask(this.eventMask);

        xr.input.onControllerAddedObservable.add((controller) => {
            controller.onMotionControllerInitObservable.add((motionController) => {
                let pickedStick = null;

                motionController.getComponent("xr-standard-trigger").onButtonStateChangedObservable.add((button) => {
                    if (button.pressed) {
                        pickedStick = this.pickStick(controller, stick1Aggregate, stickLength) || this.pickStick(controller, stick2Aggregate, stickLength);
                    } else {
                        this.releaseStick(pickedStick);
                        pickedStick = null;
                    }
                });
            });
        });

        return { stick1Aggregate, stick2Aggregate };
    }

    pickStick(controller, stickAggregate, stickLength) {
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
            stickAggregate.transformNode.setParent(controller.grip);
            stickAggregate.transformNode.position = new BABYLON.Vector3(0, 0, stickLength/4); // Adjust position to remove offset
            stickAggregate.transformNode.rotationQuaternion = new BABYLON.Quaternion.RotationAxis(BABYLON.Axis.X, Math.PI / 2); // Align with the hand
            
            //DOES NOT WORK, RETURNS NULL, BUT SEEMS TO FIND THE FUNCTION ? FIND WHY
            /*
            var impostor = controller.physics.getImpostorForController(controller); //To be able to calculate velocity when hitting
            console.log("Impostor : ");
            console.log(impostor);
            */
            return stickAggregate;
        }
        return null;
    };

    
    releaseStick(stickAggregate){
        if (stickAggregate) {
            stickAggregate.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
            stickAggregate.transformNode.setParent(null); // Ensure the stick is released from the controller
            stickAggregate.controllerPhysicsImpostor = null;
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