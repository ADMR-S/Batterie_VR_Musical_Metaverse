import { Scene } from "@babylonjs/core/scene";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { WebXRAbstractMotionController } from "@babylonjs/core/XR/motionController/webXRAbstractMotionController";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export class XRHandler {
    xr: WebXRDefaultExperience;
    leftController: WebXRAbstractMotionController | null;
    rightController: WebXRAbstractMotionController | null;
    scene: Scene;
    private setupControllers: Set<string>;
    private controllerSetupCallbacks: Array<(controller: WebXRInputSource, motionController: WebXRAbstractMotionController) => void>;
    
    // Movement state
    private xPositionInput: number = 0;
    private yPositionInput: number = 0;
    private rotationInput: number = 0;

    constructor(
        scene: Scene,
        xr: WebXRDefaultExperience
    ) {
        this.scene = scene;
        this.xr = xr;
        this.leftController = null;
        this.rightController = null;
        this.setupControllers = new Set<string>();
        this.controllerSetupCallbacks = [];
        
        this.initializeControllerDetection();
        this.setupDefaultMovementControls();
        this.monitorXRState();
    }

    /**
     * Initialize robust controller detection with multiple fallback strategies
     */
    private initializeControllerDetection() {
        const setupController = (controller: WebXRInputSource) => {
            const controllerId = controller.uniqueId;
            
            // Prevent duplicate setup
            if (this.setupControllers.has(controllerId)) {
                console.log(`[XR Handler] Controller ${controllerId} already set up, skipping`);
                return;
            }
            
            console.log(`[XR Handler] Controller added - handedness: ${controller.inputSource.handedness}, uniqueId: ${controllerId}`);
            
            const setupMotionController = (motionController: WebXRAbstractMotionController) => {
                console.log(`[XR Handler] Motion controller initialized for ${controller.inputSource.handedness} controller`);
                
                // Store controller references
                if (motionController.handedness === 'left') {
                    this.leftController = motionController;
                    console.log("[XR Handler] Left controller stored");
                } else if (motionController.handedness === 'right') {
                    this.rightController = motionController;
                    console.log("[XR Handler] Right controller stored");
                }
                
                // Execute all registered setup callbacks
                this.controllerSetupCallbacks.forEach(callback => {
                    try {
                        callback(controller, motionController);
                    } catch (error) {
                        console.error("[XR Handler] Error in controller setup callback:", error);
                    }
                });
                
                this.setupControllers.add(controllerId);
            };
            
            // Check if motion controller is already initialized
            if (controller.motionController) {
                console.log(`[XR Handler] Motion controller already initialized for ${controller.inputSource.handedness}`);
                setupMotionController(controller.motionController);
            } else {
                console.log(`[XR Handler] Waiting for motion controller initialization for ${controller.inputSource.handedness}`);
                controller.onMotionControllerInitObservable.add(setupMotionController);
            }
        };
        
        // Listen for new controllers
        this.xr.input.onControllerAddedObservable.add(setupController);
        
        // Handle controller removal for cleanup
        this.xr.input.onControllerRemovedObservable.add((controller: WebXRInputSource) => {
            const controllerId = controller.uniqueId;
            console.log(`[XR Handler] Controller removed - handedness: ${controller.inputSource.handedness}, uniqueId: ${controllerId}`);
            this.setupControllers.delete(controllerId);
            
            // Clear controller references
            if (this.leftController && controller.inputSource.handedness === 'left') {
                this.leftController = null;
            }
            if (this.rightController && controller.inputSource.handedness === 'right') {
                this.rightController = null;
            }
        });
        
        // CRITICAL FIX: Check for existing controllers that might have been added before this observable was set up
        setTimeout(() => {
            const existingControllers = this.xr.input.controllers;
            console.log(`[XR Handler] Checking for existing controllers: found ${existingControllers.length}`);
            
            if (existingControllers.length > 0) {
                existingControllers.forEach((controller: WebXRInputSource) => {
                    if (!this.setupControllers.has(controller.uniqueId)) {
                        console.log(`[XR Handler] Setting up existing controller: ${controller.inputSource.handedness}`);
                        setupController(controller);
                    }
                });
            }
        }, 100);
        
        // ADDITIONAL SAFETY: Periodic check for controllers in case they're added late
        let periodicCheckCount = 0;
        const maxPeriodicChecks = 10;
        const periodicCheck = setInterval(() => {
            periodicCheckCount++;
            
            const currentControllers = this.xr.input.controllers;
            if (currentControllers.length > this.setupControllers.size) {
                console.log(`[XR Handler] Periodic check found new controllers: ${currentControllers.length} total, ${this.setupControllers.size} set up`);
                currentControllers.forEach((controller: WebXRInputSource) => {
                    if (!this.setupControllers.has(controller.uniqueId)) {
                        console.log(`[XR Handler] Setting up late-detected controller: ${controller.inputSource.handedness}`);
                        setupController(controller);
                    }
                });
            }
            
            if (periodicCheckCount >= maxPeriodicChecks || this.setupControllers.size >= 2) {
                clearInterval(periodicCheck);
                console.log(`[XR Handler] Periodic controller check stopped. Total controllers set up: ${this.setupControllers.size}`);
            }
        }, 500);
    }

    /**
     * Monitor XR session state changes for debugging
     */
    private monitorXRState() {
        this.xr.baseExperience.onStateChangedObservable.add((state) => {
            console.log("[XR Handler] XR State changed to:", state);
            
            if (state === 2) { // IN_XR
                console.log("[XR Handler] Entered XR immersive mode, checking for controllers...");
                setTimeout(() => {
                    const controllers = this.xr.input.controllers;
                    console.log(`[XR Handler] Found ${controllers.length} controller(s) in immersive mode`);
                    
                    if (controllers.length === 0) {
                        console.warn("[XR Handler] WARNING: No controllers detected after entering XR!");
                        console.log("[XR Handler] Will wait for onControllerAddedObservable events");
                    } else {
                        controllers.forEach((controller, index) => {
                            console.log(`[XR Handler] Controller ${index}: handedness=${controller.inputSource.handedness}, motionController=${controller.motionController ? 'initialized' : 'not initialized'}`);
                        });
                    }
                }, 500);
            }
        });
    }

    /**
     * Setup default movement controls with left and right thumbsticks
     */
    private setupDefaultMovementControls() {
        this.onControllerSetup((_controller, motionController) => {
            if (motionController.handedness === 'left') {
                const leftStick = motionController.getComponent("xr-standard-thumbstick");
                if (leftStick) {
                    console.log("[XR Handler] Left thumbstick component found");
                    leftStick.onAxisValueChangedObservable.add((axisValues: any) => {
                        this.xPositionInput = axisValues.x;
                        this.yPositionInput = axisValues.y;
                    });
                } else {
                    console.warn("[XR Handler] WARNING: Left thumbstick component not found!");
                }
            }
            
            if (motionController.handedness === 'right') {
                const rightStick = motionController.getComponent("xr-standard-thumbstick");
                if (rightStick) {
                    console.log("[XR Handler] Right thumbstick component found");
                    rightStick.onAxisValueChangedObservable.add((axisValues: any) => {
                        this.rotationInput = axisValues.x;
                    });
                } else {
                    console.warn("[XR Handler] WARNING: Right thumbstick component not found!");
                }
            }
        });
    }

    /**
     * Register a callback to be executed when a controller is set up
     * This allows external code to add custom controller functionality
     */
    onControllerSetup(callback: (controller: WebXRInputSource, motionController: WebXRAbstractMotionController) => void) {
        this.controllerSetupCallbacks.push(callback);
        
        // If controllers are already set up, execute callback immediately
        this.xr.input.controllers.forEach((controller: WebXRInputSource) => {
            if (this.setupControllers.has(controller.uniqueId) && controller.motionController) {
                try {
                    callback(controller, controller.motionController);
                } catch (error) {
                    console.error("[XR Handler] Error executing immediate callback:", error);
                }
            }
        });
    }

    /**
     * Setup camera movement based on thumbstick inputs
     * Call this in your render loop if you want basic movement
     */
    updateCameraMovement(moveSpeed: number = 0.05, rotationSpeed: number = 0.02) {
        const camera = this.xr.baseExperience.camera;
        
        
        const rotationValue = this.rotationInput;
        const xValue = this.xPositionInput;
        const yValue = this.yPositionInput;
        
        // Rotation continue proportionnelle à l'input du stick (instantanée, pas de lissage)
        camera.cameraRotation.y += rotationValue * rotationSpeed;
        
        // Forward/backward and strafe movement relative to camera direction
        if (xValue !== 0 || yValue !== 0) {
            const forward = camera.getDirection(new Vector3(0, 0, 1));
            const right = camera.getDirection(new Vector3(1, 0, 0));
            
            // Projection sur le plan horizontal (y = 0)
            forward.y = 0;
            right.y = 0;
            forward.normalize();
            right.normalize();
            
            // Appliquer le mouvement
            const movement = forward.scale(-yValue * moveSpeed)
                .add(right.scale(xValue * moveSpeed));
            
            camera.position.addInPlace(movement);
        }
    }

    /**
     * Get current thumbstick input values
     */
    getMovementInput(): { x: number, y: number, rotation: number } {
        return {
            x: this.xPositionInput,
            y: this.yPositionInput,
            rotation: this.rotationInput
        };
    }

    /**
     * Check if both controllers are initialized
     */
    areBothControllersReady(): boolean {
        return this.leftController !== null && this.rightController !== null;
    }

    /**
     * Get the number of controllers currently set up
     */
    getControllerCount(): number {
        return this.setupControllers.size;
    }
}

export default XRHandler;
