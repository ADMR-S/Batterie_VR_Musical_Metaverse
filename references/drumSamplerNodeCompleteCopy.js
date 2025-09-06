__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DrumSamplerNode: () => (/* binding */ DrumSamplerNode),
/* harmony export */   NUM_VOICES: () => (/* binding */ NUM_VOICES)
/* harmony export */ });
/* harmony import */ var _webaudiomodules_sdk_parammgr__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @webaudiomodules/sdk-parammgr */ "../../../node_modules/@webaudiomodules/sdk-parammgr/dist/index.js");
/* harmony import */ var _Kit__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./Kit */ "./src/Kit.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};

const NUM_VOICES = 16;
class DrumSamplerNode extends _webaudiomodules_sdk_parammgr__WEBPACK_IMPORTED_MODULE_0__.CompositeAudioNode {
    constructor(instanceId, audioContext, options = {}) {
        super(audioContext, options);
        this.isEnabled = true;
        this.kit = new _Kit__WEBPACK_IMPORTED_MODULE_1__.DrumSamplerKit(instanceId, NUM_VOICES, audioContext);
        this.kit.callback = () => {
            if (this.callback) {
                this.callback();
            }
        };
        this.createNodes();
    }
    getState() {
        const _super = Object.create(null, {
            getState: { get: () => super.getState }
        });
        return __awaiter(this, void 0, void 0, function* () {
            let state = {
                params: yield _super.getState.call(this),
                kit: this.kit.getState(),
            };
            return state;
        });
    }
    setState(state) {
        const _super = Object.create(null, {
            setState: { get: () => super.setState }
        });
        return __awaiter(this, void 0, void 0, function* () {
            if (!state) {
                return;
            }
            if (state.params) {
                yield _super.setState.call(this, state.params);
            }
            if (state.kit) {
                let changed = this.kit.setState(state.kit);
                if (changed) {
                    this.updateNoteExtension();
                }
            }
        });
    }
    setup(paramMgr) {
        paramMgr.addEventListener('wam-midi', (e) => this.processMIDIEvents([{ event: e.detail.data.bytes, time: 0 }]));
        this._wamNode = paramMgr;
        this.paramMgr = paramMgr;
    }
    processMIDIEvents(midiEvents) {
        this.kit.processMIDIEvents(midiEvents);
    }
    set status(_sig) {
        this.isEnabled = _sig;
    }
    createNodes() {
        this.compressor = this.context.createDynamicsCompressor();
        this._output = this.context.createGain();
        this.compressor.connect(this._output);
        this.kit.connect(this.compressor);
    }
    updateNoteExtension() {
        if (!(window.WAMExtensions && window.WAMExtensions.notes)) {
            return;
        }
        let notes = this.kit.notes();
        window.WAMExtensions.notes.setNoteList(this.instanceId, notes);
    }
}


//# sourceURL=webpack://drm-16/./src/Node.ts?