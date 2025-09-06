/// <reference types="vite/client" />

declare module 'https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js' {
    const initializeWamHost: (audioContext: AudioContext) => Promise<string[]>;
    export default initializeWamHost;
}
