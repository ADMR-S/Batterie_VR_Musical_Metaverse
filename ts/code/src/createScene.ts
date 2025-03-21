
import type { Scene } from "@babylonjs/core/scene";

// Change this import to check other scenes
import { PhysicsSceneWithHavok } from "./scenes/physicsSceneWithHavok";
import xrSceneWithHavok, { XRSceneWithHavok } from "./scenes/xrSceneWithHavok";
import { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";

export interface CreateSceneClass {
    createScene: (engine: AbstractEngine, canvas: HTMLCanvasElement, audioContext : AudioContext) => Promise<Scene>; //Added audioContext for xrDrum, might be done otherwise
    preTasks?: Promise<unknown>[];
}

export interface CreateSceneModule {
    default: CreateSceneClass;
}

export const getSceneModule = (): CreateSceneClass => {
    return new XRSceneWithHavok();
}