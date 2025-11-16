import { Vector3 } from "@babylonjs/core/Maths/math";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import XRDrumKit from "./XRDrumKit";
import { Scene } from "@babylonjs/core/scene";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";

/**
 * ThroneController - Manages sitting/standing at the drum throne
 * 
 * Features:
 * - Press X button when near throne to sit down
 * - Hold B button to stand up (with visual indicator)
 * - Automatic drumstick placement in hands when sitting
 * - Drumsticks released when standing up
 * - Saves/restores user position and height
 */
export class ThroneController {
    private xr: WebXRDefaultExperience;
    private xrDrumKit: XRDrumKit;
    private scene: Scene;
    private throneNode: TransformNode;
    
    // State tracking
    private isSitting: boolean = false;
    private savedCameraPosition: Vector3 | null = null;
    private savedCameraRotation: number | null = null;
    
    // Proximity detection
    private proximityDistance: number = 1.5; // meters - distance to activate "sit" prompt
    private isNearThrone: boolean = false;
    
    // Stand-up button hold tracking
    private standUpButtonHoldStart: number = 0;
    private standUpButtonRequiredHoldTime: number = 1000; // 1 second hold
    private isHoldingStandUpButton: boolean = false;
    
    // Sitting configuration
    private sittingHeightOffset: number = 1.4; // Height above throne position when sitting
    private sittingForwardOffset: number = -0.1; // Distance forward from throne center (meters) - positive = toward drums
    
    private log: boolean = true;
    
    constructor(xr: WebXRDefaultExperience, xrDrumKit: XRDrumKit, throneNode: TransformNode, scene: Scene) {
        this.xr = xr;
        this.xrDrumKit = xrDrumKit;
        this.throneNode = throneNode;
        this.scene = scene;
        
        // Don't calculate position here - do it when sitting (after drum kit is positioned)
        
        // Setup button listeners
        this.setupControllers();
        
        // Monitor proximity to throne
        this.scene.onBeforeRenderObservable.add(() => this.checkProximity());
        
        if (this.log) {
            console.log("[ThroneController] Initialized. Press X near throne to sit.");
        }
    }
    
    /**
     * Calculate where the player should be positioned when sitting
     * Called each time before sitting to get the latest throne position
     */
    private calculateSittingPosition(): Vector3 {
        if (!this.throneNode) {
            console.warn("[ThroneController] No throne node provided!");
            return Vector3.Zero();
        }
        
        // The throne meshes are children of throneNode (throneContainer)
        // We need to find the actual throne mesh center, not just the container's position
        const throneMeshes = this.throneNode.getChildMeshes();
        
        if (throneMeshes.length === 0) {
            console.warn("[ThroneController] No throne meshes found!");
            return Vector3.Zero();
        }
        
        // Calculate the center of all throne meshes in world space
        let totalPosition = Vector3.Zero();
        throneMeshes.forEach(mesh => {
            totalPosition.addInPlace(mesh.getAbsolutePosition());
        });
        const throneMeshCenter = totalPosition.scale(1 / throneMeshes.length);
        
        // Get drum kit rotation to apply forward offset correctly
        const drumContainer = this.xrDrumKit.drumContainer;
        let drumKitRotation = 0;
        
        if (drumContainer.rotationQuaternion) {
            // 6DOF uses quaternion rotation - convert to Euler Y angle
            drumKitRotation = drumContainer.rotationQuaternion.toEulerAngles().y;
        } else {
            // Fall back to regular rotation
            drumKitRotation = drumContainer.rotation.y;
        }
        
        // Calculate forward offset in world space (toward drums)
        // In Babylon.js with Y-up, negative Z is typically forward when rotation is 0
        const forwardOffsetX = -this.sittingForwardOffset * Math.sin(drumKitRotation);
        const forwardOffsetZ = -this.sittingForwardOffset * Math.cos(drumKitRotation);
        
        // Position player at the throne mesh center plus forward offset
        const sittingPos = new Vector3(
            throneMeshCenter.x + forwardOffsetX,
            throneMeshCenter.y + this.sittingHeightOffset,
            throneMeshCenter.z + forwardOffsetZ
        );
        
        if (this.log) {
            console.log(`[ThroneController] Sitting position calculated: ${sittingPos.toString()}`);
            console.log(`[ThroneController] Throne mesh center (world): ${throneMeshCenter.toString()}`);
            console.log(`[ThroneController] Number of throne meshes: ${throneMeshes.length}`);
            console.log(`[ThroneController] Forward offset applied: ${this.sittingForwardOffset}m toward drums`);
        }
        
        return sittingPos;
    }
    
    /**
     * Setup controller button listeners
     */
    private setupControllers(): void {
        this.xr.input.onControllerAddedObservable.add((controller: WebXRInputSource) => {
            controller.onMotionControllerInitObservable.add((motionController: any) => {
                if (this.log) {
                    console.log(`[ThroneController] Controller added: ${motionController.handedness}`);
                }
                
                // X button (or A button on right controller) - Sit down
                const xButton = motionController.getComponent("x-button") || 
                               motionController.getComponent("a-button");
                
                if (xButton) {
                    xButton.onButtonStateChangedObservable.add((component: any) => {
                        if (component.pressed && !this.isSitting && this.isNearThrone) {
                            this.sitDown();
                        }
                    });
                }
                
                // B button (or Y button) - Stand up (hold)
                const bButton = motionController.getComponent("b-button") ||
                               motionController.getComponent("y-button");
                
                if (bButton) {
                    bButton.onButtonStateChangedObservable.add((component: any) => {
                        if (component.pressed && this.isSitting) {
                            this.onStandUpButtonPressed();
                        } else if (!component.pressed && this.isSitting) {
                            this.onStandUpButtonReleased();
                        }
                    });
                }
            });
        });
    }
    
    /**
     * Check if player is near the throne
     */
    private checkProximity(): void {
        if (this.isSitting) return;
        
        const camera = this.xr.baseExperience.camera;
        const cameraPos = camera.position;
        
        // Calculate sitting position on the fly to get latest throne position
        const thronePos = this.throneNode.getAbsolutePosition();
        const distance = Vector3.Distance(cameraPos, thronePos);
        
        const wasNear = this.isNearThrone;
        this.isNearThrone = distance <= this.proximityDistance;
        
        // Log when entering/exiting proximity
        if (this.isNearThrone && !wasNear && this.log) {
            console.log("[ThroneController] Near throne - Press X to sit");
        } else if (!this.isNearThrone && wasNear && this.log) {
            console.log("[ThroneController] Left throne proximity");
        }
    }
    
    /**
     * Sit down at the drums
     */
    private sitDown(): void {
        if (this.isSitting) return;
        
        const camera = this.xr.baseExperience.camera;
        
        // Save current XR rig base position and rotation
        this.savedCameraPosition = camera.position.clone();
        
        // Save current camera Y rotation (before teleporting)
        let currentCameraYaw = 0;
        if (camera.rotationQuaternion) {
            const camQuat = camera.rotationQuaternion;
            currentCameraYaw = Math.atan2(
                2 * (camQuat._w * camQuat._y + camQuat._x * camQuat._z),
                1 - 2 * (camQuat._y * camQuat._y + camQuat._z * camQuat._z)
            );
        } else {
            currentCameraYaw = camera.cameraRotation.y;
        }
        this.savedCameraRotation = currentCameraYaw;
        
        // Calculate target sitting position (where we want the XR rig base to be)
        const targetSittingPos = this.calculateSittingPosition();
        
        // Get drum kit rotation - use quaternion directly if available (used by 6DOF)
        const drumContainer = this.xrDrumKit.drumContainer;
        
        if (drumContainer.rotationQuaternion) {
            // Extract Y-axis rotation from drum kit (yaw only)
            const drumQuat = drumContainer.rotationQuaternion;
            
            // Calculate drum yaw
            const drumYaw = Math.atan2(
                2 * (drumQuat._w * drumQuat._y + drumQuat._x * drumQuat._z),
                1 - 2 * (drumQuat._y * drumQuat._y + drumQuat._z * drumQuat._z)
            );
            
            // Calculate the Y rotation to add (difference between drum and current camera)
            const yawDifference = drumYaw - currentCameraYaw;
            
            // Create a Y-only rotation quaternion for the difference
            const halfDiff = yawDifference * 0.5;
            const yRotationToAdd = new Quaternion(0, Math.sin(halfDiff), 0, Math.cos(halfDiff));
            
            // Ensure camera has a quaternion
            if (!camera.rotationQuaternion) {
                camera.rotationQuaternion = new Quaternion(0, 0, 0, 1);
            }
            
            // Multiply: new rotation = Y difference * current camera rotation
            // This adds the Y rotation while preserving pitch and roll
            camera.rotationQuaternion.copyFrom(yRotationToAdd.multiply(camera.rotationQuaternion));
        } else {
            // Fall back to regular Euler rotation
            const rotationToAdd = drumContainer.rotation.y - currentCameraYaw;
            camera.cameraRotation.y = currentCameraYaw + rotationToAdd;
        }
        
        // Then set camera position to the throne location
        camera.position.copyFrom(targetSittingPos);
        
        this.isSitting = true;
        
        // Automatically pick up drumsticks
        this.pickupDrumsticks();
        
        if (this.log) {
            const drumContainer = this.xrDrumKit.drumContainer;
            console.log("[ThroneController] Sitting down. Hold B to stand up.");
            console.log(`[ThroneController] Target sitting pos: ${targetSittingPos.toString()}`);
            console.log(`[ThroneController] XR rig base moved to: ${camera.position.toString()}`);
            console.log(`[ThroneController] Camera uses quaternion: ${!!camera.rotationQuaternion}`);
            if (camera.rotationQuaternion) {
                console.log(`[ThroneController] Camera rotation quaternion: ${camera.rotationQuaternion.toString()}`);
            } else {
                console.log(`[ThroneController] Camera rotation (Euler Y): ${camera.cameraRotation.y.toFixed(2)} rad`);
            }
            console.log(`[ThroneController] Drum kit uses quaternion: ${!!drumContainer.rotationQuaternion}`);
            if (drumContainer.rotationQuaternion) {
                console.log(`[ThroneController] Drum kit quaternion: ${drumContainer.rotationQuaternion.toString()}`);
            }
            console.log(`[ThroneController] Drum kit rotation (Euler): ${drumContainer.rotation.toString()}`);
            console.log(`[ThroneController] Drum kit position: ${drumContainer.position.toString()}`);
            
            // Log actual position after a delay
            setTimeout(() => {
                console.log(`[ThroneController] Player head actually at: ${camera.globalPosition.toString()}`);
                if (camera.rotationQuaternion) {
                    console.log(`[ThroneController] Camera quaternion after delay: ${camera.rotationQuaternion.toString()}`);
                } else {
                    console.log(`[ThroneController] Camera rotation after delay: ${camera.cameraRotation.y.toFixed(2)} rad`);
                }
            }, 100);
        }
    }
    
    /**
     * Automatically place drumsticks in player's hands
     */
    private pickupDrumsticks(): void {
        // Get controllers
        const controllers = this.xr.input.controllers;
        
        controllers.forEach((controller, index) => {
            if (controller.grip && index < this.xrDrumKit.drumsticks.length) {
                const drumstick = this.xrDrumKit.drumsticks[index];
                
                // Force-attach the drumstick to controller without pointer selection
                drumstick.forceAttachToController(controller, 0.4); // 0.4 is the stick length
                
                if (this.log) {
                    console.log(`[ThroneController] Placed ${drumstick.name} in ${controller.inputSource.handedness} hand`);
                }
            }
        });
    }
    
    /**
     * Handle stand-up button being pressed
     */
    private onStandUpButtonPressed(): void {
        if (!this.isHoldingStandUpButton) {
            this.isHoldingStandUpButton = true;
            this.standUpButtonHoldStart = performance.now();
            
            if (this.log) {
                console.log("[ThroneController] Hold B to stand up...");
            }
            
            // Start monitoring hold duration
            this.monitorStandUpButton();
        }
    }
    
    /**
     * Handle stand-up button being released
     */
    private onStandUpButtonReleased(): void {
        this.isHoldingStandUpButton = false;
        
        if (this.log) {
            console.log("[ThroneController] Stand-up cancelled");
        }
    }
    
    /**
     * Monitor how long the stand-up button is held
     */
    private monitorStandUpButton(): void {
        const checkInterval = setInterval(() => {
            if (!this.isHoldingStandUpButton) {
                clearInterval(checkInterval);
                return;
            }
            
            const holdDuration = performance.now() - this.standUpButtonHoldStart;
            const progress = Math.min(1.0, holdDuration / this.standUpButtonRequiredHoldTime);
            
            // TODO: Show visual indicator of progress (0.0 to 1.0)
            // This could be a circular progress bar or fill indicator
            
            if (progress >= 1.0) {
                clearInterval(checkInterval);
                this.standUp();
            }
        }, 50); // Check every 50ms
    }
    
    /**
     * Stand up from the drums
     */
    private standUp(): void {
        if (!this.isSitting) return;
        
        const camera = this.xr.baseExperience.camera;
        
        // Release drumsticks
        this.releaseDrumsticks();
        
        // Calculate current physical offset (might have changed while sitting)
        const currentPhysicalOffset = camera.globalPosition.subtract(camera.position);
        
        // Restore XR rig base position (player's head will be at savedPosition + currentPhysicalOffset)
        if (this.savedCameraPosition) {
            // To restore player's physical head position to where it was,
            // account for current physical offset
            const rigTargetPosition = this.savedCameraPosition.subtract(currentPhysicalOffset);
            camera.position.copyFrom(rigTargetPosition);
        }
        
        // Restore rotation
        if (this.savedCameraRotation !== null) {
            // Restore as quaternion to avoid interpolation
            if (camera.rotationQuaternion) {
                const halfYaw = this.savedCameraRotation * 0.5;
                const restoredQuat = new Quaternion(0, Math.sin(halfYaw), 0, Math.cos(halfYaw));
                camera.rotationQuaternion.copyFrom(restoredQuat);
            } else {
                camera.cameraRotation.y = this.savedCameraRotation;
            }
        }
        
        this.isSitting = false;
        this.isHoldingStandUpButton = false;
        
        if (this.log) {
            console.log("[ThroneController] Standing up. Position restored.");
            console.log(`[ThroneController] XR rig base: ${camera.position.toString()}`);
            console.log(`[ThroneController] Player head at: ${camera.globalPosition.toString()}`);
        }
    }
    
    /**
     * Release drumsticks (they fall to the floor)
     */
    private releaseDrumsticks(): void {
        this.xrDrumKit.drumsticks.forEach(drumstick => {
            if (drumstick.controllerAttached) {
                drumstick.releaseStick(drumstick.drumstickAggregate);
                
                if (this.log) {
                    console.log(`[ThroneController] Released ${drumstick.name}`);
                }
            }
        });
    }
    
    /**
     * Get current sitting state
     */
    public getIsSitting(): boolean {
        return this.isSitting;
    }
    
    /**
     * Get whether player is near the throne
     */
    public getIsNearThrone(): boolean {
        return this.isNearThrone;
    }
    
    /**
     * Get stand-up progress (0.0 to 1.0)
     * For rendering progress indicator
     */
    public getStandUpProgress(): number {
        if (!this.isHoldingStandUpButton) return 0.0;
        
        const holdDuration = performance.now() - this.standUpButtonHoldStart;
        return Math.min(1.0, holdDuration / this.standUpButtonRequiredHoldTime);
    }
    
    /**
     * Get throne position in world space
     * Used for UI positioning
     */
    public getThronePosition(): Vector3 | null {
        if (!this.throneNode) return null;
        return this.throneNode.getAbsolutePosition();
    }
    
    /**
     * Get drum kit container position in world space
     * Used for UI positioning
     */
    public getDrumKitPosition(): Vector3 | null {
        return this.xrDrumKit.drumContainer.getAbsolutePosition();
    }
    
    /**
     * Get drum kit rotation (as quaternion if available)
     * Used for calculating UI forward offset
     */
    public getDrumKitRotation(): { y: number } | null {
        const drumContainer = this.xrDrumKit.drumContainer;
        if (drumContainer.rotationQuaternion) {
            return { y: drumContainer.rotationQuaternion.toEulerAngles().y };
        }
        return { y: drumContainer.rotation.y };
    }
    
    /**
     * Update proximity distance threshold
     */
    public setProximityDistance(distance: number): void {
        this.proximityDistance = distance;
    }
    
    /**
     * Update sitting height offset
     */
    public setSittingHeight(height: number): void {
        this.sittingHeightOffset = height;
    }
}

export default ThroneController;
