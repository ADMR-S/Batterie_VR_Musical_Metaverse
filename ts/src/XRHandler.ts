import { Scene } from "@babylonjs/core/scene";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { WebXRAbstractMotionController } from "@babylonjs/core/XR/motionController/webXRAbstractMotionController";
import { WebXRInputSource } from "@babylonjs/core/XR/webXRInputSource";
import { WebXRFeatureName } from "@babylonjs/core/XR/webXRFeaturesManager";
import { WebXRControllerComponent } from "@babylonjs/core/XR/motionController/webXRControllerComponent";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

export class XRHandler {
    xr: WebXRDefaultExperience;
    leftController: WebXRAbstractMotionController | null;
    rightController: WebXRAbstractMotionController | null;
    scene: Scene;
    private setupControllers: Set<string>;
    private controllerSetupCallbacks: Array<(controller: WebXRInputSource, motionController: WebXRAbstractMotionController) => void>;

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
        
        this.initializeCameraPhysics();
        this.initializeControllerDetection();
        this.initializeMovementFeature();
        this.monitorXRState();
    }
    
    /**
     * Initialize camera physics (gravity and collisions)
     */
    private initializeCameraPhysics() {
        const camera = this.xr.baseExperience.camera;
        
        // Enable collisions and gravity
        camera.checkCollisions = true;
        camera.applyGravity = true;
        camera.ellipsoid = new Vector3(1, 1, 1);
        
        console.log("[XR Handler] Camera physics initialized (gravity + collisions)");
    }
    
    /**
     * Initialize Babylon's WebXR MOVEMENT feature with custom configuration
     */
    private initializeMovementFeature() {
        const featuresManager = this.xr.baseExperience.featuresManager;
        
        // Disable teleportation
        try {
            featuresManager.disableFeature(WebXRFeatureName.TELEPORTATION);
        } catch (e) {
            // Feature might not be enabled
        }
        
        // Enable the MOVEMENT feature with our configuration
        featuresManager.enableFeature(WebXRFeatureName.MOVEMENT, "latest", this.getMovementConfiguration());
        
        console.log("[XR Handler] Movement feature initialized");
    }
    
    /**
     * Get the MOVEMENT feature configuration
     * This can be used to re-enable the feature with the same settings
     */
    public getMovementConfiguration() {
        // Custom configuration: left stick = movement, right stick = rotation
        const swappedHandednessConfiguration = [
            {
                // Right stick (right hand) -> rotation
                allowedComponentTypes: [WebXRControllerComponent.THUMBSTICK_TYPE, WebXRControllerComponent.TOUCHPAD_TYPE],
                forceHandedness: "right" as XRHandedness,
                axisChangedHandler: (axes: any, movementState: any, featureContext: any, _xrInput: any) => {
                    movementState.rotateX = Math.abs(axes.x) > featureContext.rotationThreshold ? axes.x : 0;
                    movementState.rotateY = Math.abs(axes.y) > featureContext.rotationThreshold ? axes.y : 0;
                },
            },
            {
                // Left stick (left hand) -> movement
                allowedComponentTypes: [WebXRControllerComponent.THUMBSTICK_TYPE, WebXRControllerComponent.TOUCHPAD_TYPE],
                forceHandedness: "left" as XRHandedness,
                axisChangedHandler: (axes: any, movementState: any, featureContext: any, _xrInput: any) => {
                    movementState.moveX = Math.abs(axes.x) > featureContext.movementThreshold ? axes.x : 0;
                    movementState.moveY = Math.abs(axes.y) > featureContext.movementThreshold ? axes.y : 0;
                },
            },
        ];
        
        return {
            xrInput: this.xr.input,
            movementEnabled: true,
            rotationEnabled: true,
            movementSpeed: 0.2,
            rotationSpeed: 0.3,
            movementOrientationFollowsViewerPose: true,
            movementOrientationFollowsController: false,
            customRegistrationConfigurations: swappedHandednessConfiguration
        };
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
                
                // Set initial camera height well above collision boundary
                // With ellipsoid (1,1,1), the bottom of the ellipsoid is at camera.y - 1
                // So camera at y=2.0 means ellipsoid bottom at y=1.0 (safely above ground)
                const cam = this.xr.baseExperience.camera;
                if (cam.position.y < 2.0) {
                    cam.position.y = 2.0;
                }
                
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
