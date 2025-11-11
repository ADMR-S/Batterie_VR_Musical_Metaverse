import { AbstractMesh } from "@babylonjs/core";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";


interface XRDrumComponent {
    name: String;
    drumComponentContainer: TransformNode;

    playSoundOnTrigger(midiKey: number, duration: number) : void;
    animateOnHit() : void;
    createDrumComponentBody(body : AbstractMesh) : void;
    createDrumComponentTrigger(trigger : AbstractMesh) : void;
}

export default XRDrumComponent;