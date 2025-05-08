//TODO : Déplacer code composants batterie ici

import { TransformNode } from "@babylonjs/core";
import { Scene } from "@babylonjs/core/scene";

interface XRDrumComponent {
    playSoundOnTrigger(name: string, midiKey: number, duration: number) : void;
    createDrumComponentBody(name: string, diameter: number, height: number) : void;
    createDrumComponentTrigger(name: string, diameter: number, height: number) : void;
}


export default XRDrumComponent;