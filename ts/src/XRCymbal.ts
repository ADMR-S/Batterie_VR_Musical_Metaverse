import XRDrumComponent from "./XRDrumComponent";
import { TransformNode } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsMotionType, PhysicsPrestepType, PhysicsShapeType } from "@babylonjs/core/Physics";
import { AbstractMesh } from "@babylonjs/core";

import XRDrumKit from "./XRDrumKit";

class XRCymbal implements XRDrumComponent {

    //@ts-ignore
    name: String;
    drumComponentContainer: TransformNode;
    xrDrumKit: XRDrumKit;
    log: boolean = true; // Set to true for debugging, false for production
    private lastHitTime: Map<string, number> = new Map(); // Track last hit time per drumstick
    private readonly HIT_DEBOUNCE_MS = 50; // Minimum time between hits (50ms = 20 hits/second max)

    //@ts-ignore
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

        this.playSoundOnTrigger(name, midiKey, 5) //0.25s duration for drums (needs refining)
    }

    createDrumComponentBody(body: TransformNode | TransformNode[]) {
        if (Array.isArray(body)) {
            body.forEach(primitive => {
                this.createDrumComponentBody(primitive);
            });
            return;
        }
        // PERFORMANCE OPTIMIZATION:
        // Physics bodies for cymbal meshes are disabled as they're purely visual
        // and don't need collision detection (only triggers do)
        // This significantly reduces physics calculations
        if (this.log) {
            body.getChildMeshes().forEach(mesh => {
                console.log("Creating body for mesh/submesh: ", mesh.name);
            });
        }
        // Visual mesh only - no physics aggregate needed
        // Cymbals are stationary, only triggers need physics
    }

    createDrumComponentTrigger(trigger: AbstractMesh) {
        if (trigger) {
            this.drumComponentContainer.addChild(trigger); // Attach the trigger to the drum component container

            const triggerAggregate = new PhysicsAggregate(trigger, PhysicsShapeType.MESH, { mass: 0 }, this.xrDrumKit.scene);
            triggerAggregate.transformNode.id = this.name + "Trigger"; // Add trigger to aggregate name for cymbals
            triggerAggregate.body.setMotionType(PhysicsMotionType.STATIC);
            triggerAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
            if (triggerAggregate.body.shape) {
                triggerAggregate.body.shape.isTrigger = true;
            }
        }
    }

    playSoundOnTrigger(name: string, midiKey: number, duration: number) { //duration in seconds
        this.xrDrumKit.hk.onTriggerCollisionObservable.add((collision: any) => {
            // Check if this collision involves THIS cymbal's trigger (could be either collider or collidedAgainst)
            const triggerName = name + "Trigger";
            const isThisCymbalTrigger = 
                collision.collidedAgainst.transformNode.id === triggerName ||
                collision.collider.transformNode.id === triggerName;
            
            if (collision.type === "TRIGGER_ENTERED" && isThisCymbalTrigger) {
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

                
                

                var currentVelocity = 64;//Default is 64 (median)
                for (let i = 0; i < this.xrDrumKit.drumsticks.length; i++) {
                    if (collision.collider.transformNode.id === this.xrDrumKit.drumsticks[i].drumstickAggregate.transformNode.id) {
                        // DEBOUNCE: Prevent multiple triggers from same hit
                        const stickId = collision.collider.transformNode.id;
                        const now = performance.now();
                        const lastHit = this.lastHitTime.get(stickId) || 0;
                        
                        if (now - lastHit < this.HIT_DEBOUNCE_MS) {
                            if(this.log){
                                console.log("DEBOUNCED - Too soon after last hit");
                            }
                            return; // Ignore this collision, it's part of the same hit
                        }
                        
                        this.lastHitTime.set(stickId, now);
                        
                        const { linear, angular } = this.xrDrumKit.drumsticks[i].getVelocity();
                        if(this.log){
                            console.log("Collision avec " + collision.collider.transformNode.id);
                            console.log("Linear Velocity length: ", linear.length());
                            console.log("Angular Velocity length: ", angular.length());
                            console.log("Angular X: ", angular.x, "Angular Y: ", angular.y, "Angular Z: ", angular.z);
                        }

                        // Cymbals can be hit from any direction (top, edge, bottom)
                        // Unlike drums, we don't filter by movement direction
                        
                        // Vibrate the controller
                        const controller = this.xrDrumKit.drumsticks.find(stick =>
                            stick.drumstickAggregate.transformNode.id === collision.collider.transformNode.id
                        )?.controllerAttached;

                        // Calculate velocity using improved formula
                        // Same calculation as drums for consistency
                        const linearSpeed = linear.length();
                        const angularSpeed = angular.length();
                        
                        // Weighted combination: linear is primary, angular is secondary
                        const MIN_VELOCITY = 0.05; // Minimum detectable hit (m/s)
                        const MAX_VELOCITY = 3.0;  // Maximum expected hit speed (m/s)
                        
                        // Combined speed with 80% linear, 20% angular contribution
                        const combinedSpeed = linearSpeed + (angularSpeed * 0.25);
                        
                        // Clamp and normalize to 0-1 range
                        const normalizedSpeed = Math.max(0, Math.min(1, 
                            (combinedSpeed - MIN_VELOCITY) / (MAX_VELOCITY - MIN_VELOCITY)
                        ));
                        
                        // Apply a power curve for better feel (lower = more sensitive to soft hits)
                        // 0.5 = very sensitive, 1.0 = linear, we use 0.85 for balanced response
                        const curvedSpeed = Math.pow(normalizedSpeed, 0.85);
                        
                        // Scale to MIDI velocity range (1-127, never 0 for a detected hit)
                        currentVelocity = Math.max(1, Math.min(127, Math.round(curvedSpeed * 127)));

                        if (controller?.motionController?.gamepadObject?.hapticActuators?.[0]) {
                            // Scale haptic feedback with velocity (0.3-1.0 intensity)
                            const hapticIntensity = 0.3 + (currentVelocity / 127) * 0.7;
                            controller.motionController.gamepadObject.hapticActuators[0].pulse(hapticIntensity, 100);
                        }

                        if(this.log){
                            console.log(linear.y < 0 ? "MOUVEMENT DESCENDANT" : "MOUVEMENT MONTANT");
                            console.log("Vitesse calculée de la baguette (MIDI 0-127): " + currentVelocity);
                            console.log("Combined speed (m/s): " + combinedSpeed.toFixed(3));
                        }
                    }
                }
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
                    if(this.log){
                        console.log("On joue une note au volume : " + currentVelocity);
                    }
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
            } else if (isThisCymbalTrigger) {
                // Only log collisions that involve THIS cymbal's trigger (for debugging)
                if(this.log){
                    const otherName = collision.collider.transformNode.name;
                    const collisionType = collision.type || "UNKNOWN";
                    console.log(`[${performance.now().toFixed(2)}ms] ${this.name} trigger collision (${collisionType}): with ${otherName}`);
                }
            }
            // Ignore all collisions that don't involve this cymbal's trigger
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