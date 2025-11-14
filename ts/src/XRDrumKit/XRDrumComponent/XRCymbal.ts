import XRDrumComponent from "./XRDrumComponent";
import { TransformNode } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsMotionType, PhysicsPrestepType, PhysicsShapeType } from "@babylonjs/core/Physics";
import { AbstractMesh } from "@babylonjs/core";
import { Vector3, Quaternion } from "@babylonjs/core/Maths/math.vector";

import XRDrumKit from "../XRDrumKit";
import { DRUMKIT_CONFIG } from "../XRDrumKitConfig";
import { CollisionUtils } from "../CollisionUtils";
import { DrumComponentLogger } from "./XRDrumComponentLogger";

class XRCymbal implements XRDrumComponent {

    //@ts-ignore
    name: String;
    drumComponentContainer: TransformNode;
    xrDrumKit: XRDrumKit;
    private logger: DrumComponentLogger;
    private lastHitTime: Map<string, number> = new Map(); // Track last hit time per drumstick
    private cymbalAggregate: PhysicsAggregate | null = null; // Store reference to apply impulses

    //@ts-ignore
    constructor(name: string, midiKey: number, xrDrumKit: XRDrumKit, drum3Dmodel: AbstractMesh[]) { //diameter in meters, height in meters, midiKey is the MIDI key to play when the trigger is hit
        this.name = name;
        this.xrDrumKit = xrDrumKit;
        this.logger = new DrumComponentLogger(name);

        this.drumComponentContainer = new TransformNode(name + "Container");
        this.drumComponentContainer.parent = xrDrumKit.drumContainer;
        xrDrumKit.drumComponents.push(this);

        const cymbal3DMesh = drum3Dmodel.find(mesh => mesh.name === name); // Find all primitives
        if (cymbal3DMesh === undefined) {
            this.logger.logError(`Failed to find the main body mesh with name '${name}'`);
            this.logger.logAvailableMeshes(drum3Dmodel);
            return;
        }
        
        this.drumComponentContainer.addChild(cymbal3DMesh); // Attach primitives to the parent node

        this.createDrumComponentBody(this.drumComponentContainer); // Create the body of the drum component

        this.createDrumComponentTrigger(cymbal3DMesh);

        this.playSoundOnTrigger(midiKey, DRUMKIT_CONFIG.midi.durations.cymbals);
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
        body.getChildMeshes().forEach(mesh => {
            this.logger.logPhysicsSetup(mesh.name);
        });
        // Visual mesh only - no physics aggregate needed
        // Cymbals are stationary, only triggers need physics
    }

    createDrumComponentTrigger(trigger: AbstractMesh) {
        if (trigger) {
            // Important: trigger will be parented to container, and cymbal mesh will be child of trigger
            // This way the visual mesh follows the physics-limited rotation of the trigger
            this.drumComponentContainer.addChild(trigger); // Attach the trigger to the drum component container

            // IMPORTANT: Store original scale before creating physics aggregate
            const originalScale = trigger.scaling.clone();
            
            // Temporarily scale the mesh down to create a smaller physics shape
            trigger.scaling.scaleInPlace(this.xrDrumKit.scaleFactor);
            
            // Cymbals need mass to swing properly when hit - light enough to move easily
            // The physics shape will be created based on the CURRENT (scaled) mesh geometry
            const triggerAggregate = new PhysicsAggregate(trigger, PhysicsShapeType.MESH, { mass: DRUMKIT_CONFIG.physics.cymbal.mass }, this.xrDrumKit.scene);
            triggerAggregate.transformNode.id = this.name + "Trigger"; // Add trigger to aggregate name for cymbals
            
            // CRITICAL: Restore the visual mesh to its original scale
            // This keeps the visual at full size while the physics shape remains at 0.7x
            trigger.scaling.copyFrom(originalScale);
            
            // Store reference for applying impulses on hit
            this.cymbalAggregate = triggerAggregate;
            
            // Show bounding box for debugging collision shapes
            if (DRUMKIT_CONFIG.debug.showBoundingBoxes) {
                trigger.showBoundingBox = true;
                this.logger.logBoundingBox(trigger.name);
            }
            
            // Use regular collisions (NOT triggers) so the cymbal can physically move
            triggerAggregate.body.setCollisionCallbackEnabled(true);
            triggerAggregate.body.setEventMask(this.xrDrumKit.eventMask);
            
            triggerAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
            // TELEPORT prestep keeps cymbal following the drum kit when it moves
            // This is necessary for when the entire drum kit position is changed
            triggerAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
            
            // Disable gravity so cymbal doesn't fall
            triggerAggregate.body.setGravityFactor(0);
            
            // Store the original position and rotation for limiting
            const originalPosition = trigger.position.clone();
            const maxRotationXY = DRUMKIT_CONFIG.physics.cymbal.maxRotationXY; // 35 degrees on X and Y
            
            // Get the initial rotation quaternion from the physics body
            const originalBodyRotation = triggerAggregate.body.transformNode.rotationQuaternion!.clone();
            
            triggerAggregate.body.setAngularDamping(DRUMKIT_CONFIG.physics.cymbal.angularDamping);
            
            // Store reference to the visual mesh to sync its rotation
            const visualMesh = trigger;
            
            //LIMIT THE MOVEMENT ON X AND Z AXES (TILT), ALLOW FREE ROTATION ON Y AXIS (SPIN):
            this.xrDrumKit.scene.onBeforeRenderObservable.add(() => {
                // Lock position to prevent any linear movement (no falling)
                triggerAggregate.transformNode.position.copyFrom(originalPosition);
                triggerAggregate.body.setLinearVelocity(Vector3.Zero());
                
                // Get the PHYSICS BODY rotation (not the transformNode!)
                const bodyQuat = triggerAggregate.body.transformNode.rotationQuaternion!;
                
                // Calculate the relative rotation from original
                const relativeQuat = originalBodyRotation.conjugate().multiply(bodyQuat);
                const relativeEuler = relativeQuat.toEulerAngles();
                
                // Normalize angles to [-PI, PI] range
                let offsetX = relativeEuler.x;
                let offsetY = relativeEuler.y; // Y is free to spin (vertical axis)
                let offsetZ = relativeEuler.z;
                
                while (offsetX > Math.PI) offsetX -= 2 * Math.PI;
                while (offsetX < -Math.PI) offsetX += 2 * Math.PI;
                while (offsetZ > Math.PI) offsetZ -= 2 * Math.PI;
                while (offsetZ < -Math.PI) offsetZ += 2 * Math.PI;
                
                // Get current angular velocity
                const angularVelocity = triggerAggregate.body.getAngularVelocity();
                
                // Debug logging
                if (Math.abs(offsetX) > 0.01 || Math.abs(offsetZ) > 0.01) {
                    this.logger.logCymbalPhysics(
                        `Rotation: X=${(offsetX * 180/Math.PI).toFixed(1)}°, Y=${(offsetY * 180/Math.PI).toFixed(1)}° (free), Z=${(offsetZ * 180/Math.PI).toFixed(1)}°`
                    );
                }
                
                // Check limits for X and Z axes (tilt axes)
                const isXAtLimit = Math.abs(offsetX) >= maxRotationXY;
                const isZAtLimit = Math.abs(offsetZ) >= maxRotationXY;
                
                let newAngularVelocity = angularVelocity.clone();
                let needsRotationClamp = false;
                let clampedX = offsetX;
                let clampedZ = offsetZ;
                
                // Handle X-axis limiting (tilt forward/backward)
                if (isXAtLimit) {
                    this.logger.logCymbalPhysics(`X-AXIS LIMIT HIT: ${(offsetX * 180/Math.PI).toFixed(1)}°`);
                    clampedX = Math.sign(offsetX) * maxRotationXY;
                    // Bounce back with energy loss
                    newAngularVelocity.x = -angularVelocity.x * DRUMKIT_CONFIG.physics.cymbal.bounceEnergyLoss;
                    needsRotationClamp = true;
                } else if (Math.abs(offsetX) > maxRotationXY * 0.90) {
                    // Near limit: apply resistance
                    if (Math.sign(offsetX) === Math.sign(angularVelocity.x)) {
                        // Moving away from center - stop X motion
                        newAngularVelocity.x = 0;
                    } else {
                        // Apply spring force on X
                        const springForce = -offsetX * DRUMKIT_CONFIG.physics.cymbal.springStrength;
                        const dampingForce = -angularVelocity.x * DRUMKIT_CONFIG.physics.cymbal.springDamping;
                        const totalTorque = springForce + dampingForce;
                        triggerAggregate.body.applyAngularImpulse(new Vector3(totalTorque * 0.016, 0, 0));
                    }
                } else {
                    // Normal operation: apply spring force to return X to center
                    const springForce = -offsetX * DRUMKIT_CONFIG.physics.cymbal.springStrength;
                    const dampingForce = -angularVelocity.x * DRUMKIT_CONFIG.physics.cymbal.springDamping;
                    const totalTorque = springForce + dampingForce;
                    triggerAggregate.body.applyAngularImpulse(new Vector3(totalTorque * 0.016, 0, 0));
                }
                
                // Handle Z-axis limiting (tilt left/right)
                if (isZAtLimit) {
                    this.logger.logCymbalPhysics(`Z-AXIS LIMIT HIT: ${(offsetZ * 180/Math.PI).toFixed(1)}°`);
                    clampedZ = Math.sign(offsetZ) * maxRotationXY;
                    // Bounce back with energy loss
                    newAngularVelocity.z = -angularVelocity.z * DRUMKIT_CONFIG.physics.cymbal.bounceEnergyLoss;
                    needsRotationClamp = true;
                } else if (Math.abs(offsetZ) > maxRotationXY * 0.90) {
                    // Near limit: apply resistance
                    if (Math.sign(offsetZ) === Math.sign(angularVelocity.z)) {
                        // Moving away from center - stop Z motion
                        newAngularVelocity.z = 0;
                    } else {
                        // Apply spring force on Z
                        const springForce = -offsetZ * DRUMKIT_CONFIG.physics.cymbal.springStrength;
                        const dampingForce = -angularVelocity.z * DRUMKIT_CONFIG.physics.cymbal.springDamping;
                        const totalTorque = springForce + dampingForce;
                        triggerAggregate.body.applyAngularImpulse(new Vector3(0, 0, totalTorque * 0.016));
                    }
                } else {
                    // Normal operation: apply spring force to return Z to center
                    const springForce = -offsetZ * DRUMKIT_CONFIG.physics.cymbal.springStrength;
                    const dampingForce = -angularVelocity.z * DRUMKIT_CONFIG.physics.cymbal.springDamping;
                    const totalTorque = springForce + dampingForce;
                    triggerAggregate.body.applyAngularImpulse(new Vector3(0, 0, totalTorque * 0.016));
                }
                
                // If we hit a limit, clamp the rotation
                if (needsRotationClamp) {
                    const clampedRelativeQuat = Quaternion.FromEulerAngles(clampedX, offsetY, clampedZ);
                    const clampedWorldQuat = originalBodyRotation.multiply(clampedRelativeQuat);
                    triggerAggregate.body.transformNode.rotationQuaternion = clampedWorldQuat;
                }
                
                // Update angular velocity (Y-axis remains unchanged for free spin)
                triggerAggregate.body.setAngularVelocity(newAngularVelocity);
                
                // CRITICAL: Sync visual mesh rotation with physics body rotation
                // This ensures the visual cymbal ALWAYS matches the physics-limited rotation
                if (!visualMesh.rotationQuaternion) {
                    visualMesh.rotationQuaternion = Quaternion.Identity();
                }
                visualMesh.rotationQuaternion.copyFrom(triggerAggregate.body.transformNode.rotationQuaternion!);
            });
        }
    }

    playSoundOnTrigger(midiKey: number, duration: number) { //duration in seconds
        this.xrDrumKit.hk.onCollisionObservable.add((collision: any) => {
            // Check if this collision involves THIS cymbal (could be either collider or collidedAgainst)
            const cymbalName = this.name + "Trigger";
            const isThisCymbal = CollisionUtils.isCollisionWithTrigger(collision, cymbalName);
            
            // CRITICAL: Only respond to COLLISION_STARTED, not COLLISION_CONTINUED
            // COLLISION_CONTINUED fires every physics frame while objects are touching
            // This would create sound spam - we only want ONE sound per hit
            if (collision.type === "COLLISION_STARTED" && isThisCymbal) {
                this.logger.logCollision(collision);
                
                if (!this.xrDrumKit.drumSoundsEnabled) {
                    return; // Do not play sounds if drum sounds are disabled
                }

                // Find which drumstick hit the cymbal
                const drumstickIndex = CollisionUtils.findDrumstickIndex(collision, this.xrDrumKit.drumsticks);
                if (drumstickIndex === -1) {
                    return; // Not hit by a drumstick
                }

                const drumstick = this.xrDrumKit.drumsticks[drumstickIndex];
                const drumstickId = drumstick.drumstickAggregate.transformNode.id;

                // DEBOUNCE: Prevent multiple triggers from same hit
                if (!CollisionUtils.checkDebounce(drumstickId, this.lastHitTime)) {
                    this.logger.logDebounce();
                    return;
                }
                
                const { linear, angular } = drumstick.getVelocity();
                
                // Cymbals can be hit from any direction (top, edge, bottom)
                // Unlike drums, we don't filter by movement direction
                
                // Calculate velocity using utility
                const currentVelocity = CollisionUtils.calculateHitVelocity(drumstick);
                const combinedSpeed = linear.length() + (angular.length() * DRUMKIT_CONFIG.velocity.angularWeight);

                // Log velocity calculations
                this.logger.logVelocity(linear, angular, currentVelocity, combinedSpeed);

                // MANUAL IMPULSE APPLICATION:
                // Since drumsticks use TELEPORT prestep, they don't transfer momentum naturally
                // We need to manually apply an angular impulse to the cymbal based on the stick velocity
                if (this.cymbalAggregate) {
                    // Calculate impulse strength based on combined velocity
                    const impulseScale = DRUMKIT_CONFIG.physics.cymbal.impulseScale;
                    
                    // Calculate impulse components based on hit direction
                    // Linear velocity components determine the direction of rotation
                    const hitVector = linear.clone();
                    
                    // Convert linear hit direction to rotational impulse
                    // For a cymbal lying flat (parallel to ground):
                    // - Y-axis is vertical (perpendicular to cymbal) - free spin
                    // - X-axis: hit from front/back creates rotation
                    // - Z-axis: hit from left/right creates rotation
                    
                    // X-axis rotation: determined by Z component of hit (front/back hits)
                    const torqueX = -hitVector.z * impulseScale * 0.8;
                    
                    // Y-axis rotation: determined by tangential component (free to spin)
                    // Edge hits and angular momentum create spin
                    const torqueY = (hitVector.x * 0.4 + hitVector.z * 0.4) * impulseScale;
                    
                    // Z-axis rotation: determined by X component of hit (left/right hits)
                    const torqueZ = hitVector.x * impulseScale * 0.8;
                    
                    const torque = new Vector3(torqueX, torqueY, torqueZ);
                    
                    // Apply the angular impulse on all axes
                    this.cymbalAggregate.body.applyAngularImpulse(torque);
                    
                    this.logger.logCymbalPhysics(
                        `Applied impulse: X=${torque.x.toFixed(3)}, Y=${torque.y.toFixed(3)} (spin), Z=${torque.z.toFixed(3)}`
                    );
                }

                // Vibrate the controller
                CollisionUtils.triggerHapticFeedback(drumstick.controllerAttached, currentVelocity);

                // Play the sound
                CollisionUtils.scheduleSound(
                    this.xrDrumKit.wamInstance,
                    this.xrDrumKit.audioContext,
                    midiKey,
                    currentVelocity,
                    duration
                );
                
                this.logger.logSound(midiKey, currentVelocity);
            }
            // Ignore all other collision types (COLLISION_CONTINUED, COLLISION_ENDED, etc.)
            // and all collisions that don't involve this cymbal
        });
    }

    animateOnHit(): void {
        
    }

}
export default XRCymbal;

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