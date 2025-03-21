__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DrumSamplerKit: () => (/* binding */ DrumSamplerKit)
/* harmony export */ });
/* harmony import */ var _shared_midi__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../../shared/midi */ "../shared/midi.ts");
/* harmony import */ var _AudioPool__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./AudioPool */ "./src/AudioPool.ts");
/* harmony import */ var _Voice__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./Voice */ "./src/Voice.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};



class DrumSamplerKit {
    constructor(instanceId, numVoices, audioContext) {
        this.instanceId = instanceId;
        this.audioContext = audioContext;
        this.numVoices = numVoices;
        this.voices = [];
        this.buffers = [];
        this.noteMap = new Map();
        this.audioPool = new _AudioPool__WEBPACK_IMPORTED_MODULE_1__.AudioPool(audioContext);
        this.loaded = false;
        this.state = { slots: [] };
        for (var i = 0; i < numVoices; i++) {
            this.voices.push(new _Voice__WEBPACK_IMPORTED_MODULE_2__.DrumSamplerVoice(audioContext));
            this.buffers.push(undefined);
        }
    }
    getState() {
        return {
            slots: this.state.slots.map(s => { return Object.assign({}, s); })
        };
    }
    setState(state) {
        return __awaiter(this, void 0, void 0, function* () {
            if (state.slots) {
                return yield this.updateSlots(state.slots);
            }
            return false;
        });
    }
    updateSlot(index, slot) {
        return __awaiter(this, void 0, void 0, function* () {
            let slots = [...this.state.slots];
            slots[index] = slot;
            yield this.updateSlots(slots);
        });
    }
    updateSlots(slots) {
        return __awaiter(this, void 0, void 0, function* () {
            let notes = new Map();
            var noteMapChanged = false;
            for (let i = 0; i < this.numVoices; i++) {
                if (slots[i] && slots[i].uri) {
                    if (!this.state.slots[i] || slots[i].uri != this.state.slots[i].uri) {
                        if (window.WAMExtensions && window.WAMExtensions.assets) {
                            window.WAMExtensions.assets.loadAsset(this.instanceId, slots[i].uri).then((asset) => __awaiter(this, void 0, void 0, function* () {
                                if (asset.content) {
                                    let buffer = yield asset.content.arrayBuffer();
                                    this.audioContext.decodeAudioData(buffer, (buffer) => {
                                        this.buffers[i] = buffer;
                                        if (this.callback) {
                                            this.callback();
                                        }
                                    });
                                }
                            }));
                        }
                        else {
                            this.audioPool.loadSample(slots[i].uri, (buffer) => {
                                this.buffers[i] = buffer;
                                if (this.callback) {
                                    this.callback();
                                }
                            });
                            noteMapChanged = true;
                        }
                    }
                    this.state.slots[i] = Object.assign({}, slots[i]);
                }
                else {
                    if (this.state.slots[i]) {
                        noteMapChanged = true;
                    }
                    this.state.slots[i] = undefined;
                    this.buffers[i] = undefined;
                }
                if (slots[i]) {
                    var arr = notes.get(slots[i].note);
                    if (!arr) {
                        arr = [];
                        notes.set(slots[i].note, arr);
                    }
                    arr.push(i);
                }
            }
            this.noteMap = notes;
            return noteMapChanged;
        });
    }
    connect(node) {
        for (let v of this.voices) {
            v.connect(node);
        }
    }
    processMIDIEvents(midiEvents) {
        midiEvents.forEach((message) => {
            if (message.event[0] == _shared_midi__WEBPACK_IMPORTED_MODULE_0__.MIDI.NOTE_ON && message.event[2] > 0) {
                let midiNote = message.event[1];
                let voices = this.noteMap.get(midiNote);
                if (voices) {
                    for (let i of voices) {
                        this.voices[i].play(this.buffers[i]);
                    }
                }
            }
        });
    }
    notes() {
        var notes = [];
        this.state.slots.forEach((slot) => {
            if (!slot) {
                return;
            }
            notes.push({
                blackKey: false,
                name: slot.name,
                number: slot.note
            });
        });
        notes = notes.sort((a, b) => a.number - b.number);
        return notes;
    }
}


//# sourceURL=webpack://drm-16/./src/Kit.ts?