__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   AudioPool: () => (/* binding */ AudioPool)
/* harmony export */ });
class AudioPool {
    constructor(audioContext) {
        this.audioContext = audioContext;
    }
    loadSample(url, callback) {
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.responseType = 'arraybuffer';
        request.onload = () => {
            this.audioContext.decodeAudioData(request.response, (buffer) => {
                callback(buffer);
            });
        };
        request.send();
    }
}


//# sourceURL=webpack://drm-16/./src/AudioPool.ts?