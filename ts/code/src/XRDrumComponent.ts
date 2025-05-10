interface XRDrumComponent {
    playSoundOnTrigger(name: string, midiKey: number, duration: number) : void;
    createDrumComponentBody(name: string, diameter: number, height: number) : void;
    createDrumComponentTrigger(name: string) : void;
}

export default XRDrumComponent;