import { Scene } from "@babylonjs/core/scene";
//import { Inspector } from "@babylonjs/inspector";

export class Utility {
    static setupInspectorControl(scene : Scene){
        window.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "i") {
             //Inspector.Show(scene, {});
                scene.debugLayer.show({ embedMode: false }).then(function () {
                    const sceneExplorerHost = document.getElementById("scene-explorer-host");
                    const inspectorHost = document.getElementById("inspector-host");

                    if (sceneExplorerHost) {
                        sceneExplorerHost.style.zIndex = "1000";
                        sceneExplorerHost.style.position = "fixed";
                    }

                    if (inspectorHost) {
                         inspectorHost.style.zIndex = "1000";
                        inspectorHost.style.position = "fixed";
                    }
                });
            }
        });
    }
}
         