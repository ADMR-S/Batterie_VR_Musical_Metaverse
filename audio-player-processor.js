
// audio-player-processor.js

class AudioPlayerProcessor extends AudioWorkletProcessor {

    static get parameterDescriptors() {
        return [{
            name: "playing",
            minValue: 0,
            maxValue: 1,
            defaultValue: 0
        }];
    }
    
    constructor(options) {
        super(options);
    
        this.audio = null;
        this.playhead = 0;
    
        this.port.onmessage = (e) => {
            if (e.data.audio) {
                this.audio = e.data.audio;
            }
        };
    }
    
    process(inputs, outputs, parameters) {
        if (!this.audio) return true;
    
        // Initializing the buffer with the given outputs and the audio length.
        const bufferSize = outputs[0][0].length;
        const audioLength = this.audio[0].length;
    
        // Only one output is used. Because we use our buffer source see {OperableAudioBuffer}
        const output = outputs[0];
    
        for (let i = 0; i < bufferSize; i++) {
            const playing = !!(i < parameters.playing.length ? parameters.playing[i] : parameters.playing[0]);
            if (!playing) continue; // Not playing
    
            const channelCount = Math.min(this.audio.length, output.length);
            for (let channel = 0; channel < channelCount; channel++) {
                output[channel][i] = this.audio[channel][this.playhead];
            }
            this.playhead++;
        }
        return true;
    }
}

    // audio-player-processor.js

const {registerProcessor} = globalThis;

try {
registerProcessor("audio-player-processor", AudioPlayerProcessor);
} catch (error) {
console.warn(error);
}
