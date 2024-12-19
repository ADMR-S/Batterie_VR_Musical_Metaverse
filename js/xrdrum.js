class XRDrum{
    constructor(audioContext, scene, eventMask){ //Retirer eventMask ?
        this.audioContext = audioContext;
        this.scene = scene  
        this.eventMask = eventMask;
        this.wamInstance = null;
        this.initializePlugin().then((wamInstance) => {
            this.wamInstance = wamInstance;
            this.snareKey = 38;
            this.snare = this.createSnare();
        });
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
        this.createDrumComponent("snare", 1, 0.5, new BABYLON.Vector3(0, 0, 4, 0), this.snareKey);
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
            
        cylinderAggregate.body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC); // Set motion type to DYNAMIC
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