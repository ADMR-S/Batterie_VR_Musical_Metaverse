import XRDrumComponent from "./XRDrumComponent";
import { MeshBuilder, StandardMaterial, TransformNode, Vector3, AssetsManager } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsMotionType, PhysicsPrestepType, PhysicsShapeType } from "@babylonjs/core/Physics";
import XRDrumKit from "./XRDrumKit";

class XRCymbal implements XRDrumComponent {

    //@ts-ignore
    private name: String;
    private drumComponentContainer: TransformNode;
    private xrDrumKit: XRDrumKit;
    log: boolean = true;

    constructor(name: string, diameter: number, height: number, midiKey: number, xrDrumKit: XRDrumKit, position: Vector3) { //diameter in meters, height in meters, midiKey is the MIDI key to play when the trigger is hit
        this.name = name;
        this.xrDrumKit = xrDrumKit;

        this.drumComponentContainer = new TransformNode(name + "Container");
        this.drumComponentContainer.parent = xrDrumKit.drumContainer;
        this.drumComponentContainer.position = position;
        xrDrumKit.drumComponents.push(this.drumComponentContainer);

        this.createDrumComponentBody(name, diameter, height);
        this.createDrumComponentTrigger(name, diameter, height);
        this.playSoundOnTrigger(name, midiKey, 5) //5s duration for cymbals (needs refining)

    }

    createDrumComponentBody(name: string, diameter: number, height: number) {
        const assetsManager = new AssetsManager(this.xrDrumKit.scene);
        const meshTask = assetsManager.addMeshTask(name, "", "/drum_3D_model/", `${name}.glb`);

        meshTask.onSuccess = (task) => {
            const body = task.loadedMeshes[0];
            body.scaling = new Vector3(diameter, height, diameter); // Scale to match desired size
            body.parent = this.drumComponentContainer;

            const bodyAggregate = new PhysicsAggregate(body, PhysicsShapeType.MESH, { mass: 0 }, this.xrDrumKit.scene);
            bodyAggregate.body.setMotionType(PhysicsMotionType.STATIC);
            bodyAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
            bodyAggregate.body.setCollisionCallbackEnabled(true);
            bodyAggregate.body.setEventMask(this.xrDrumKit.eventMask);
        };

        //@ts-ignore
        meshTask.onError = (task, message, exception) => {
            console.error(`Failed to load mesh for ${name}:`, message, exception);
        };

        assetsManager.load();
    }

    createDrumComponentTrigger(name: string, diameter: number, height: number) { //Créer les peaux des percussions à peau (snare, tom, etc...)
        let triggerHeight = 0.07;
        const trigger = MeshBuilder.CreateCylinder(name + "Trigger", { diameter: diameter, height: triggerHeight }, this.xrDrumKit.scene);
        trigger.position = new Vector3(0, height - (triggerHeight / 2), 0);
        trigger.material = new StandardMaterial("wireframeMaterial", this.xrDrumKit.scene);
        trigger.material.wireframe = true;
        trigger.parent = this.drumComponentContainer;

        const triggerAggregate = new PhysicsAggregate(trigger, PhysicsShapeType.CYLINDER, { mass: 0 }, this.xrDrumKit.scene);
        triggerAggregate.body.setMotionType(PhysicsMotionType.STATIC);
        triggerAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
        if (triggerAggregate.body.shape) {
            triggerAggregate.body.shape.isTrigger = true;
        }
    }

    playSoundOnTrigger(name: string, midiKey: number, duration: number) { //duration in seconds
        this.xrDrumKit.hk.onTriggerCollisionObservable.add((collision: any) => {
            if (collision.type === "TRIGGER_ENTERED" && collision.collidedAgainst.transformNode.id === name + "Trigger") {
                if (this.log) {
                    console.log(name + " trigger entered", collision);
                    console.log("Collider : ");
                    console.log(collision.collider);
                    console.log("Collided against : ");
                    console.log(collision.collidedAgainst);
                }
                if (!this.xrDrumKit.drumSoundsEnabled) {
                    return; // Do not play sounds if drum sounds are disabled
                }
                var currentVelocity = 0;//Default is 64 (median)
                for (let i = 0; i < this.xrDrumKit.drumsticks.length; i++) {
                    if (collision.collider.transformNode.id === this.xrDrumKit.drumsticks[i].drumstickAggregate.transformNode.id) {
                        console.log("Collision avec " + collision.collider.transformNode.id)
                        const { linear, angular } = this.xrDrumKit.drumsticks[i].getVelocity();
                        console.log("Linear Velocity: ", linear.length());
                        console.log("Angular Velocity: ", angular.length());

                        if (linear.y > 0 || angular.y > 0) {
                            console.log("MOUVEMENT MONTANT");
                            currentVelocity = 0; // Ignore upward movement
                        } else {
                            console.log("MOUVEMENT DESCENDANT");
                            currentVelocity = Math.round(10 * (linear.length() + angular.length()));
                        }
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
                if (this.xrDrumKit.wamInstance) {
                    console.log("On joue une note au volume : " + currentVelocity)
                    // Joue une note lors de la collision
                    this.xrDrumKit.wamInstance.audioNode.scheduleEvents({
                        type: 'wam-midi',
                        time: this.xrDrumKit.audioContext.currentTime,
                        data: { bytes: new Uint8Array([0x90, midiKey, currentVelocity]) } // Note ON, third parameter is velocity from 0 to 127 (0 is equivalent to note OFF)
                        //http://midi.teragonaudio.com/tech/midispec/noteon.htm
                        //Considering wamMidiEvent follow the MIDI spec and full audio chain is compatible (it is said that each MIDI device might treat these values differently)
                    });
                    this.xrDrumKit.wamInstance.audioNode.scheduleEvents({
                        type: 'wam-midi',
                        time: this.xrDrumKit.audioContext.currentTime + duration,
                        data: { bytes: new Uint8Array([0x80, midiKey, currentVelocity]) } // Note OFF, third parameter is velocity (how quickly the note should be released)
                    });
                }
            } else {
                if (this.log) {
                    console.log('trigger exited', collision);
                }
            }
        });
    }

}
export default XRCymbal;