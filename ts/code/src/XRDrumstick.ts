import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
//import { WebXRControllerPhysics } from "@babylonjs/core/XR/features/WebXRControllerPhysics";
//import { Observable } from "@babylonjs/core/Misc/observable";
import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder, StandardMaterial, PhysicsAggregate, PhysicsShapeType, PhysicsMotionType, PhysicsPrestepType } from "@babylonjs/core";
import { Vector3, Quaternion, Axis } from "@babylonjs/core/Maths/math";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
//import { PhysicsImpostor } from "@babylonjs/core/Physics/physicsImpostor";
import XRDrumKit from "./XRDrumKit";

class XRDrumstick {

    xrDrumKit: XRDrumKit; // Reference to XRDrumKit for shared console and to deactivate sounds if needed
    drumstickAggregate: PhysicsAggregate;
    scene: Scene;
    eventMask: number;
    controllerAttached: WebXRInputSource | null = null;
    private previousPosition: Vector3 = new Vector3();
    private velocity: Vector3 = new Vector3();
    private lastUpdateTime: number = performance.now();
    private previousRotation: Quaternion = new Quaternion();
    private angularVelocity: Vector3 = new Vector3();
    log = true;

    constructor(xr: WebXRDefaultExperience, xrDrumKit: XRDrumKit, scene: Scene, eventMask: number, stickNumber : Number) {
        this.eventMask = eventMask;
        this.scene = scene;
        this.drumstickAggregate = this.createDrumstick(xr, stickNumber);
        this.xrDrumKit = xrDrumKit;
        scene.onBeforeRenderObservable.add(() => this.updateVelocity());
    }

    private logToConsole(...args: any[]) {
        try {
            const seen = new WeakSet();
            const sanitizedArgs = args.map(arg => {
                if (typeof arg === "object") {
                    //@ts-ignore
                    return JSON.stringify(arg, (key, value) => {
                        if (value && typeof value === "object" && seen.has(value)) {
                            return "[Circular]";
                        }
                        seen.add(value);
                        return value;
                    });
                }
                return arg;
            });
            console.log(...sanitizedArgs); // Logs to the shared XR console in XRDrumKit
        } catch (error) {
            console.error("Error logging to console:", error);
        }
    }

    createDrumstick(xr: WebXRDefaultExperience, stickNumber : Number) {
        const stickLength = 0.4;
        const stickDiameter = 0.02;
        const ballDiameter = 0.03;

        const stick = MeshBuilder.CreateCylinder("stick" + stickNumber, { height: stickLength, diameter: stickDiameter }, this.scene);
        const ball = MeshBuilder.CreateSphere("ball" + stickNumber, { diameter: ballDiameter }, this.scene);

        ball.parent = stick;
        ball.position = new Vector3(0, stickLength / 2, 0);

        stick.position = new Vector3(0, 5, 4);
        stick.material = new StandardMaterial("stickMaterial", this.scene);
        ball.material = new StandardMaterial("ballMaterial", this.scene);

        /*
        
        TRY TO USE MERGED MESHES INSTEAD OF CONVEX_HULL to not distinguish between ball or stick
        
        const avgPosition = stick.position.add(ball.position).scale(0.5);

        var mergeArray = [stick, ball];
        const mergedStick1 = BABYLON.Mesh.MergeMeshes(mergeArray, false, false, false, false, true);
        const mergedStick2 = mergedStick1.clone("stick2_merged");
        mergedStick1.setPivotMatrix(BABYLON.Matrix.Translation(-avgPosition.x, -avgPosition.y, -avgPosition.z), false);
        mergedStick2.setPivotMatrix(BABYLON.Matrix.Translation(-avgPosition.x, -avgPosition.y, -avgPosition.z), false);
        
        console.log("Merged stick 1 : " + mergedStick1.name);
        console.log("Merged stick 2 : " + mergedStick2.name);
        */
        var drumstickAggregate = new PhysicsAggregate(stick, PhysicsShapeType.CONVEX_HULL, { mass: 1 }, this.scene);
        drumstickAggregate.body.setCollisionCallbackEnabled(true);
        drumstickAggregate.body.setEventMask(this.eventMask);

        xr.input.onControllerAddedObservable.add((controller: WebXRInputSource) => {
            controller.onMotionControllerInitObservable.add((motionController: any) => {
                this.xrDrumKit.drumSoundsEnabled = true;
                // @ts-ignore
                let pickedStick: PhysicsAggregate | null = null;

                motionController.getComponent("xr-standard-trigger").onButtonStateChangedObservable.add((button: any) => {
                    if (button.pressed) {
                        pickedStick = this.pickStick(controller, stickLength, xr);
                    } else {
                        this.releaseStick(motionController.heldStick);
                    }
                });
            });
            
            this.scene.onBeforeRenderObservable.add(() => {
                if (controller.grip) {
                    const controllerPos = controller.grip.position;
                    const controllerRot = controller.grip.rotationQuaternion || Quaternion.Identity();
                    this.xrDrumKit.updateControllerPositions(controllerPos, controllerRot, controller.inputSource.handedness);
                }
            });
        });

        return drumstickAggregate;
    }

    pickStick(controller: WebXRInputSource, stickLength: number, xr: WebXRDefaultExperience) {
        this.logToConsole("Déclenchement de pickStick");
        const meshUnderPointer = xr.pointerSelection.getMeshUnderPointer(controller.uniqueId);
        if (meshUnderPointer) {
            this.logToConsole("Mesh under pointer : " + meshUnderPointer.name);
        } else {
            this.logToConsole("Aucun mesh sous le pointeur");
        }
        if (meshUnderPointer === this.drumstickAggregate.transformNode) {
            if (controller.grip) {
                this.drumstickAggregate.body.setMotionType(PhysicsMotionType.ANIMATED);
                this.drumstickAggregate.body.setPrestepType(PhysicsPrestepType.TELEPORT);
                this.drumstickAggregate.body.setCollisionCallbackEnabled(true);
                this.drumstickAggregate.body.setEventMask(this.eventMask);
                this.drumstickAggregate.transformNode.setParent(controller.grip);
                this.controllerAttached = controller;

                this.drumstickAggregate.transformNode.position = new Vector3(0, 0, stickLength / 4); // Adjust position to remove offset
                this.drumstickAggregate.transformNode.rotationQuaternion = Quaternion.RotationAxis(Axis.X, Math.PI / 2); // Align with the hand
            }
            /*
            const linearVelocity = Vector3.Zero();
                const angularVelocity = Vector3.Zero();
                
                xr.baseExperience.sessionManager.onXRFrameObservable.add((xrFrame) => {
                    const pose = xrFrame.getPose(
                        controller.inputSource.targetRaySpace,
                        xr.baseExperience.sessionManager.referenceSpace
                    );
                    if(pose){
                        const lv = pose.linearVelocity;
                        if(lv){
                            const newLinearVelocity = new Vector3(-lv.x, lv.y, -lv.z);
                            const smoothing = 0;
                            // Exponential smoothing
                            linearVelocity.addInPlace(newLinearVelocity.subtract(linearVelocity).scale(1 - smoothing));

                            // text1.text = vector3toString(newLinearVelocity);
                            // text2.text = vector3toString(linearVelocity);

                            const av = pose.angularVelocity;
                            if(av){
                                const newAngularVelocity = new Vector3(-av.x, av.y, -av.z);
                                angularVelocity.addInPlace(newAngularVelocity.subtract(angularVelocity).scale(1 - smoothing));
                                console.log("Angular velocity : " + angularVelocity);
                            }
                        }    
                    }
                });*/

            // Set velocity to a null vector to stop movement if any
            this.drumstickAggregate.body.setLinearVelocity(Vector3.Zero());
            this.drumstickAggregate.body.setAngularVelocity(Vector3.Zero());

            return this.drumstickAggregate;
        }
        return null;
    }

    releaseStick(drumstickAggregate: PhysicsAggregate) {
        if (drumstickAggregate) {
            drumstickAggregate.body.setMotionType(PhysicsMotionType.DYNAMIC);
            drumstickAggregate.body.setPrestepType(PhysicsPrestepType.DISABLED);
            drumstickAggregate.transformNode.setParent(null);
            this.controllerAttached = null;
            //stickAggregate.controllerPhysicsImpostor = null;
        }
    }

    /*
    getControllerVelocity(xr: WebXRDefaultExperience) {
        
        const xrFrame = xr.baseExperience.sessionManager.currentFrame;
        console.log(xrFrame);
        if (xrFrame) {
            if(this.controllerAttached){
                const pose = xrFrame.getPose(this.controllerAttached.inputSource.targetRaySpace, xr.baseExperience.sessionManager.referenceSpace);
                console.log("POSE")
                console.log(pose)
                console.log(pose?.linearVelocity)
                if (pose && pose.linearVelocity && pose.angularVelocity) {
                    const linearVelocity = new Vector3(pose.linearVelocity.x, pose.linearVelocity.y, -pose.linearVelocity.z);
                    const angularVelocity = new Vector3(pose.angularVelocity.x, pose.angularVelocity.y, -pose.angularVelocity.z);
                    console.log("Linear Velocity: ", linearVelocity);
                    console.log("Angular Velocity: ", angularVelocity);
                    return linearVelocity;
                }
            }
        }
    }
    */

    private updateVelocity() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
        this.lastUpdateTime = currentTime;

        // Update linear velocity
        const currentPosition = this.drumstickAggregate.transformNode.getAbsolutePosition();
        this.velocity = currentPosition.subtract(this.previousPosition).scale(1 / deltaTime);
        this.previousPosition.copyFrom(currentPosition);

        // Update angular velocity and position
        const currentRotation = this.drumstickAggregate.transformNode.rotationQuaternion || Quaternion.Identity();
        const deltaRotation = currentRotation.multiply(Quaternion.Inverse(this.previousRotation));
        deltaRotation.toEulerAnglesToRef(this.angularVelocity);
        this.angularVelocity.scaleInPlace(1 / deltaTime);
        this.previousRotation.copyFrom(currentRotation);
        
    }

    getVelocity(): { linear: Vector3; angular: Vector3 } {
        return { linear: this.velocity, angular: this.angularVelocity };
    }
}
export default XRDrumstick;