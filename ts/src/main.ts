import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { WebGPUEngine } from "@babylonjs/core/Engines/webgpuEngine";
import { getSceneModule } from "./createScene";
import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Utility } from "./Utility";

// ----- AUDIO INIT ------
const audioContext: AudioContext = new AudioContext();
// ----- END OF AUDIO INIT ------


let scene: Scene | null = null; //Utile ?
let sceneToRender: Scene | null = null; //Utile ?


export const babylonInit = async (): Promise<void> => {
  try {
    const createSceneModule = getSceneModule();
    // Execute the pretasks, if defined
    await Promise.all(createSceneModule.preTasks || []);
    // Get the canvas element
    const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
    
    if (!canvas) {
      throw new Error("Canvas element 'renderCanvas' not found");
    }
    
    // Generate the BABYLON 3D engine
    const engine = await createEngine(canvas);

    console.log("Engine created successfully:", engine);

    // Create the scene
    const scene = await createSceneModule.createScene(engine, canvas, audioContext);

    // JUST FOR TESTING. Not needed for anything else
    (window as any).scene = scene;

    // Watch for browser/canvas resize events
    window.addEventListener("resize", function () {
        engine.resize();
    });
  } catch (error) {
    console.error("Fatal error during Babylon initialization:", error);
    alert("Failed to initialize 3D scene. Please refresh the page.\n\nError: " + (error as Error).message);
    throw error;
  }
};

window.onload = () => {
  babylonInit().then(() => {
    sceneToRender = scene;
    Utility.setupInspectorControl(sceneToRender!);
  });
}

// @ts-ignore
const startRenderLoop = (engine: AbstractEngine, canvas: HTMLCanvasElement) => { //canvas inutile ?
  engine.runRenderLoop(() => {
      if (sceneToRender && sceneToRender.activeCamera) {
          sceneToRender.render();
      }
  });
}

const createEngine = async (canvas : HTMLCanvasElement): Promise<AbstractEngine> => {
  const engineType =
  location.search.split("engine=")[1]?.split("&")[0] || "webgl";
  let engine: AbstractEngine;
  //On peut sûrement se contenter du defaultEngine, toute la partie webgpu vient du code original, à voir
  if (engineType === "webgpu") {
      const webGPUSupported = await WebGPUEngine.IsSupportedAsync;
      if (webGPUSupported) {
          // You can decide which WebGPU extensions to load when creating the engine. I am loading all of them
          await import("@babylonjs/core/Engines/WebGPU/Extensions/");
          const webgpu = engine = new WebGPUEngine(canvas, {
              adaptToDeviceRatio: true,
              antialias: true,
          });
          await webgpu.initAsync();
          engine = webgpu;
      } else {
          engine = createDefaultEngine(canvas);
      }
  } else {
      engine = createDefaultEngine(canvas);
  }
  return engine;
};

const createDefaultEngine = function (canvas : HTMLCanvasElement) { 
  // Check WebGL support before attempting to create engine
  const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  
  if (!gl) {
    console.error("WebGL Diagnostics:");
    console.error("- WebGL2 supported:", !!canvas.getContext('webgl2'));
    console.error("- WebGL1 supported:", !!canvas.getContext('webgl'));
    console.error("- Experimental WebGL:", !!canvas.getContext('experimental-webgl'));
    console.error("- User agent:", navigator.userAgent);
    
    alert("WebGL is not available in your browser. Please:\n" +
          "1. Try refreshing the page\n" +
          "2. Ensure hardware acceleration is enabled\n" +
          "3. Update your graphics drivers\n" +
          "4. Try a different browser (Chrome/Edge recommended for WebXR)");
    
    throw new Error("WebGL not supported - see console for diagnostics");
  }
  
  try {
    return new Engine(canvas, true, { 
      preserveDrawingBuffer: true, 
      stencil: true, 
      disableWebGL2Support: false 
    });
  } catch (error) {
    console.error("Engine creation failed:", error);
    alert("Failed to create 3D engine. Please refresh the page and try again.");
    throw error;
  }
};

window.onclick = () => {
    audioContext.resume();
};