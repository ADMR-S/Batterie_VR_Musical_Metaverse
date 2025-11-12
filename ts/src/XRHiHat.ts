import XRDrumComponent from "./XRDrumComponent";
import { TransformNode } from "@babylonjs/core";
import { PhysicsAggregate, PhysicsMotionType, PhysicsPrestepType, PhysicsShapeType } from "@babylonjs/core/Physics";
import { AbstractMesh } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Animation } from "@babylonjs/core/Animations/animation";
import { CubicEase, EasingFunction } from "@babylonjs/core/Animations/easing";

import XRDrumKit from "./XRDrumKit";

class XRHiHat implements XRDrumComponent {

    //@ts-ignore
    name: String;
    drumComponentContainer: TransformNode;
    xrDrumKit: XRDrumKit;
    log: boolean = true; // Set to true for debugging, false for production
    showBoundingBox: boolean = true; // Display collision bounding boxes for debugging
    private lastHitTime: Map<string, number> = new Map(); // Track last hit time per drumstick
    private readonly HIT_DEBOUNCE_MS = 50; // Minimum time between hits (50ms = 20 hits/second max)
    private hiHatMesh: AbstractMesh | undefined; // Reference to the Hi-Hat mesh for animation
    private originalPosition: Vector3 | undefined; // Store original position
    hiHatAggregate: PhysicsAggregate | undefined; // Store physics aggregate reference

    //@ts-ignore
    constructor(name: string, midiKey: number, xrDrumKit: XRDrumKit, drum3Dmodel: AbstractMesh[]) {
        this.name = name;
        this.xrDrumKit = xrDrumKit;

        this.drumComponentContainer = new TransformNode(name + "Container");
        this.drumComponentContainer.parent = xrDrumKit.drumContainer;
        xrDrumKit.drumComponents.push(this);

        const hiHat3DMesh = drum3Dmodel.find(mesh => mesh.name === name);
        if (hiHat3DMesh === undefined) {
            console.error(`Failed to find the Hi-Hat mesh with name '${name}'`);
            console.log("Available meshes:", drum3Dmodel.map(mesh => mesh.name));
            return;
        }
        
        // Store reference to Hi-Hat mesh for animation
        this.hiHatMesh = hiHat3DMesh;
        this.originalPosition = hiHat3DMesh.position.clone();
        
        this.drumComponentContainer.addChild(hiHat3DMesh);

        this.createDrumComponentBody(this.drumComponentContainer);

        this.drumComponentContainer.addChild(hiHat3DMesh);

        this.createDrumComponentTrigger(hiHat3DMesh);

        this.playSoundOnTrigger(midiKey, 5) // Duration for Hi-Hat
    }

    createDrumComponentBody(body: TransformNode | TransformNode[]) {
        if (Array.isArray(body)) {
            body.forEach(primitive => {
                this.createDrumComponentBody(primitive);
            });
            return;
        }
        // PERFORMANCE OPTIMIZATION:
        // Physics bodies for Hi-Hat meshes are disabled as they're purely visual
        // and don't need collision detection (only triggers do)
        if (this.log) {
            body.getChildMeshes().forEach(mesh => {
                console.log("Creating body for mesh/submesh: ", mesh.name);
            });
        }
        // Visual mesh only - no physics aggregate needed
    }

    refreshPhysicsAggregate(): void {
        this.hiHatAggregate?.dispose();
        this.createDrumComponentTrigger(this.drumComponentContainer.getChildMeshes()[0]);
    }
    createDrumComponentTrigger(trigger: AbstractMesh) {
        if (trigger) {

            // IMPORTANT: Store original scale before creating physics aggregate
            const originalScale = trigger.scaling.clone();
            
            // Temporarily scale the mesh down to create a smaller physics shape
            trigger.scaling.scaleInPlace(this.xrDrumKit.scaleFactor);
            
            // Create STATIC physics - Hi-Hat doesn't move via physics, only via animation
            // The physics shape will be created based on the CURRENT (scaled) mesh geometry
            const triggerAggregate = new PhysicsAggregate(trigger, PhysicsShapeType.MESH, { mass: 0 }, this.xrDrumKit.scene);
            triggerAggregate.transformNode.id = this.name + "Trigger";
            triggerAggregate.body.setMotionType(PhysicsMotionType.STATIC);
            triggerAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
            
            // CRITICAL: Restore the visual mesh to its original scale
            // This keeps the visual at full size while the physics shape remains at scaled size
            trigger.scaling.copyFrom(originalScale);
            
            this.hiHatAggregate = triggerAggregate;
                      
            // Show bounding box for debugging collision shapes
            if (this.showBoundingBox) {
                trigger.showBoundingBox = true;
                console.log(`[${this.name}] Bounding box enabled. Mesh shape: ${trigger.getTotalVertices()} vertices`);
            }
            
            // Set collision filter: Hi-Hat is group 2 (like cymbals), collide with drumsticks only
            if (triggerAggregate.body.shape) {
                triggerAggregate.body.shape.isTrigger = true;
                triggerAggregate.body.shape.filterMembershipMask = 2; // Group 2 (cymbals/Hi-Hat)
                triggerAggregate.body.shape.filterCollideMask = 1; // Only collide with group 1 (drumsticks)
            }
            
            if (this.log) {
                console.log(`${this.name} - Created static Hi-Hat trigger with tremble animation support`);
            }
        }
    }

    playSoundOnTrigger(midiKey: number, duration: number) {
        this.xrDrumKit.hk.onTriggerCollisionObservable.add((collision: any) => {
            const triggerName = this.name + "Trigger";
            const isThisHiHatTrigger = 
                collision.collidedAgainst.transformNode.id === triggerName ||
                collision.collider.transformNode.id === triggerName;
            
            if (collision.type === "TRIGGER_ENTERED" && isThisHiHatTrigger) {
                if (this.log) {
                    console.log(this.name + " trigger entered", collision);
                    console.log("Collider ID: " + collision.collider.transformNode.id);
                    console.log("Collided against ID: " + collision.collidedAgainst.transformNode.id);
                }
                if (!this.xrDrumKit.drumSoundsEnabled) {
                    return;
                }

                var currentVelocity = 64; // Default is 64 (median)
                for (let i = 0; i < this.xrDrumKit.drumsticks.length; i++) {
                    const drumstickId = this.xrDrumKit.drumsticks[i].drumstickAggregate.transformNode.id;
                    const isThisDrumstick = 
                        collision.collider.transformNode.id === drumstickId ||
                        collision.collidedAgainst.transformNode.id === drumstickId;
                    
                    if (isThisDrumstick) {
                        // DEBOUNCE
                        const now = performance.now();
                        const lastHit = this.lastHitTime.get(drumstickId) || 0;
                        
                        if (now - lastHit < this.HIT_DEBOUNCE_MS) {
                            if(this.log){
                                console.log("DEBOUNCED - Too soon after last hit");
                            }
                            return;
                        }
                        
                        this.lastHitTime.set(drumstickId, now);
                        
                        const { linear, angular } = this.xrDrumKit.drumsticks[i].getVelocity();
                        if(this.log){
                            console.log("Collision avec " + collision.collider.transformNode.id);
                            console.log("Linear Velocity length: ", linear.length());
                            console.log("Angular Velocity length: ", angular.length());
                            console.log("Angular X: ", angular.x, "Angular Y: ", angular.y, "Angular Z: ", angular.z);
                        }

                        // Hi-Hat can be hit from any direction (like cymbals)
                        
                        const controller = this.xrDrumKit.drumsticks.find(stick =>
                            stick.drumstickAggregate.transformNode.id === collision.collider.transformNode.id
                        )?.controllerAttached;

                        // Calculate velocity
                        const linearSpeed = linear.length();
                        const angularSpeed = angular.length();
                        
                        const MIN_VELOCITY = 0.05;
                        const MAX_VELOCITY = 3.0;
                        
                        const combinedSpeed = linearSpeed + (angularSpeed * 0.25);
                        
                        const normalizedSpeed = Math.max(0, Math.min(1, 
                            (combinedSpeed - MIN_VELOCITY) / (MAX_VELOCITY - MIN_VELOCITY)
                        ));
                        
                        const curvedSpeed = Math.pow(normalizedSpeed, 0.85);
                        
                        currentVelocity = Math.max(1, Math.min(127, Math.round(curvedSpeed * 127)));

                        // Animate Hi-Hat with tremble effect (like drums)
                        this.animateOnHit(currentVelocity);

                        if (controller?.motionController?.gamepadObject?.hapticActuators?.[0]) {
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

                if (this.xrDrumKit.wamInstance) {
                    if(this.log){
                        console.log("On joue une note au volume : " + currentVelocity);
                    }
                    this.xrDrumKit.wamInstance.audioNode.scheduleEvents({
                        type: 'wam-midi',
                        time: this.xrDrumKit.audioContext.currentTime,
                        data: { bytes: new Uint8Array([0x90, midiKey, currentVelocity]) }
                    });
                    this.xrDrumKit.wamInstance.audioNode.scheduleEvents({
                        type: 'wam-midi',
                        time: this.xrDrumKit.audioContext.currentTime + duration,
                        data: { bytes: new Uint8Array([0x80, midiKey, currentVelocity]) }
                    });
                }
            } else if (isThisHiHatTrigger) {
                if(this.log){
                    const otherName = collision.collider.transformNode.name;
                    const collisionType = collision.type || "UNKNOWN";
                    console.log(`[${performance.now().toFixed(2)}ms] ${this.name} trigger collision (${collisionType}): with ${otherName}`);
                }
            }
        });
    }

    animateOnHit(velocity: number): void {
        if (!this.hiHatMesh || !this.originalPosition) {
            return;
        }

        // Hi-Hat trembles with position animation (like drums)
        const maxDisplacement = 0.01; // 1cm maximum displacement
        const displacement = (velocity / 127) * maxDisplacement;
        
        const basePosition = this.originalPosition;
        
        const animationPosition = new Animation(
            "hiHatTrembleAnimation_" + Date.now(),
            "position.y",
            60,
            Animation.ANIMATIONTYPE_FLOAT,
            Animation.ANIMATIONLOOPMODE_CONSTANT
        );

        const numOscillations = 3;
        const totalDuration = 0.3;
        const keys = [];
        
        keys.push({ frame: 0, value: this.hiHatMesh.position.y });
        
        for (let i = 1; i <= numOscillations; i++) {
            const frame = (i * 2 - 1) * (totalDuration * 60 / (numOscillations * 2));
            const nextFrame = i * 2 * (totalDuration * 60 / (numOscillations * 2));
            const damping = Math.pow(0.6, i - 1);
            
            // Downward displacement
            keys.push({ 
                frame: frame, 
                value: basePosition.y - displacement * damping
            });
            
            // Upward bounce
            keys.push({ 
                frame: nextFrame, 
                value: basePosition.y + displacement * damping * 0.2
            });
        }
        
        // Return to base position
        keys.push({ frame: totalDuration * 60, value: basePosition.y });

        animationPosition.setKeys(keys);
        
        const easingFunction = new CubicEase();
        easingFunction.setEasingMode(EasingFunction.EASINGMODE_EASEINOUT);
        animationPosition.setEasingFunction(easingFunction);

        this.hiHatMesh.animations = [];
        this.hiHatMesh.animations.push(animationPosition);
        
        const animatable = this.xrDrumKit.scene.beginAnimation(
            this.hiHatMesh, 
            0, 
            totalDuration * 60, 
            false,
            1.0
        );
        
        // Ensure mesh returns to exact base position
        animatable.onAnimationEnd = () => {
            if (this.hiHatMesh && this.originalPosition) {
                this.hiHatMesh.position.y = this.originalPosition.y;
            }
        };
    }

}
export default XRHiHat;
