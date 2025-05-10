import { AbstractMesh } from "@babylonjs/core";

interface XRDrumComponent {
    playSoundOnTrigger(name: string, midiKey: number, duration: number) : void;
    createDrumComponentBody(body : AbstractMesh) : void;
    createDrumComponentTrigger(trigger : AbstractMesh) : void;
}

export default XRDrumComponent;