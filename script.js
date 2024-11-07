const canvas = document.getElementById("renderCanvas"); // Get the canvas element
const engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine

var contexteAudio;
document.addEventListener("click", () => {
    if (!contexteAudio) {
        contexteAudio = new AudioContext();
    }
});

const createScene = async function () {
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
    camera.setTarget(BABYLON.Vector3.Zero());
    camera.attachControl(canvas, true);
    const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.7;
    const sphere = BABYLON.MeshBuilder.CreateSphere("sphere", {diameter: 2, segments: 32}, scene);
    sphere.position.y = 1;
    const ground = BABYLON.MeshBuilder.CreateGround("ground", {width: 6, height: 6}, scene);

    const env = scene.createDefaultEnvironment();
    const xr = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [env.ground],
    });
    
    return scene;
};

(async () => {
    const scene = await createScene(); // Appel asynchrone de createScene
    engine.runRenderLoop(function () {
        scene.render();
    });
})();

window.addEventListener("resize", function () {
    engine.resize();
});