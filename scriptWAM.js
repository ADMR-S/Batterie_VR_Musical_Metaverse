// index.js
const audioUrl = "https://wasabi.i3s.unice.fr/WebAudioPluginBank/BasketCaseGreendayriffDI.mp3";

// Initialize the Audio Context
const audioCtx = new AudioContext();
const btnStart = document.getElementById("btn-start");

btnStart.onclick = () => {
    audioCtx.resume(); // audio context must be resumed because browser restrictions
};

(async () => {
    // Code of your host goes in a self-invoking asynchronous function.

    // self-invoking function in index.js


    // Register our custom JavaScript processor in the current audio worklet.
    await audioCtx.audioWorklet.addModule("./audio-player-processor.js");

    const response = await fetch(audioUrl);
    const audioArrayBuffer = await response.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(audioArrayBuffer);

    //Transform the audio buffer into a custom audio buffer to add logic inside. (Needed to manipulate the audio, for example, editing...)
    const operableAudioBuffer = Object.setPrototypeOf(audioBuffer, OperableAudioBuffer.prototype);
    const node = new AudioPlayerNode(audioCtx, 2);

    // Connecting host's logic of the page.
    btnStart.onclick = () => {
        if (audioCtx.state === "suspended") audioCtx.resume();
        const playing = node.parameters.get("playing").value;
        if (playing === 1) {
            node.parameters.get("playing").value = 0;
            btnStart.textContent = "Start";
        } else {
            node.parameters.get("playing").value = 1;
            btnStart.textContent = "Stop";
        }
    }

    //OPTIONAL
    // self-invoking function in index.js

    //Sending audio to the processor and connecting the node to the output destination.
    node.port.postMessage(operableAudioBuffer.toArray());

    node.connect(audioCtx.destination);
    node.parameters.get("playing").value = 0;
    node.parameters.get("loop").value = 1;

})();


