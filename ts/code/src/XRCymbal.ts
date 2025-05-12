import XRDrumComponent from "./XRDrumComponent";
import { TransformNode } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsMotionType, PhysicsPrestepType, PhysicsShapeType } from "@babylonjs/core/Physics";
import { AbstractMesh } from "@babylonjs/core";

import XRDrumKit from "./XRDrumKit";

class XRCymbal implements XRDrumComponent {

    //@ts-ignore
    private name: String;
    private drumComponentContainer: TransformNode;
    private xrDrumKit: XRDrumKit;
    log: boolean = true;

    constructor(name: string, midiKey: number, xrDrumKit: XRDrumKit, drum3Dmodel: AbstractMesh[]) { //diameter in meters, height in meters, midiKey is the MIDI key to play when the trigger is hit
        this.name = name;
        this.xrDrumKit = xrDrumKit;

        this.drumComponentContainer = new TransformNode(name + "Container");
        this.drumComponentContainer.parent = xrDrumKit.drumContainer;
        xrDrumKit.drumComponents.push(this.drumComponentContainer);

        const cymbal3DMesh = drum3Dmodel.find(mesh => mesh.name === name); // Find all primitives
        if (cymbal3DMesh === undefined) {
            console.error(`Failed to find the main body mesh with name '${name}'`);
            console.log("Available meshes:", drum3Dmodel.map(mesh => mesh.name)); // Log available meshes for debugging
            return;
        }
        
        this.drumComponentContainer.addChild(cymbal3DMesh); // Attach primitives to the parent node

        this.createDrumComponentBody(this.drumComponentContainer); // Create the body of the drum component

        this.createDrumComponentTrigger(cymbal3DMesh);

        this.playSoundOnTrigger(name, midiKey, 0.25) //0.25s duration for drums (needs refining)
    }

    createDrumComponentBody(body: TransformNode | TransformNode[]) {
        if (Array.isArray(body)) {
            body.forEach(primitive => {
                this.createDrumComponentBody(primitive);
            });
            return;
        }
        body.getChildMeshes().forEach(mesh => {
            console.log("Creating body for mesh/submesh: ", mesh.name);
            const bodyAggregate = new PhysicsAggregate(mesh, PhysicsShapeType.MESH, { mass: 0 }, this.xrDrumKit.scene);
            bodyAggregate.body.setMotionType(PhysicsMotionType.STATIC);
            bodyAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
            //bodyAggregate.body.setCollisionCallbackEnabled(true);
            //bodyAggregate.body.setEventMask(this.xrDrumKit.eventMask);
        });
    }

    createDrumComponentTrigger(trigger: AbstractMesh) {
        if (trigger) {
            this.drumComponentContainer.addChild(trigger); // Attach the trigger to the drum component container

            const triggerAggregate = new PhysicsAggregate(trigger, PhysicsShapeType.MESH, { mass: 0 }, this.xrDrumKit.scene);
            triggerAggregate.body.setMotionType(PhysicsMotionType.STATIC);
            triggerAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
            if (triggerAggregate.body.shape) {
                triggerAggregate.body.shape.isTrigger = true;
            }
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

                /*
                // Vibrate the controller
                const controller = this.xrDrumKit.drumsticks.find(stick =>
                    stick.drumstickAggregate.transformNode.id === collision.collider.transformNode.id
                )?.controllerAttached;

                if (controller?.motionController?.gamepadObject?.hapticActuators?.[0]) {
                    console.log("On fait vibrer la manette !");
                    controller.motionController.gamepadObject.hapticActuators[0].pulse(1.0, 100); // Vibrate at full intensity for 100ms
                }
                    */

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
/*

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