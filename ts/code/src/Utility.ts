import { Scene } from "@babylonjs/core/scene";
import { Inspector } from "@babylonjs/inspector";

export class Utility {
    static setupInspectorControl(scene : Scene){
        window.addEventListener("keydown", (event: KeyboardEvent) => {
            if (event.key === "i") {
                Inspector.Show(scene, {});
            }
        });
    }
}