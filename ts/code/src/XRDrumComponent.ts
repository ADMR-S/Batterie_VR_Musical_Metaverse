import { AbstractMesh } from "@babylonjs/core";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";


interface XRDrumComponent {
    name: String;
    drumComponentContainer: TransformNode;

    playSoundOnTrigger(name: string, midiKey: number, duration: number) : void;
    createDrumComponentBody(body : AbstractMesh) : void;
    createDrumComponentTrigger(trigger : AbstractMesh) : void;
}

export default XRDrumComponent;