__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (/* binding */ DrumSampler)
/* harmony export */ });
/* harmony import */ var _webaudiomodules_sdk__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @webaudiomodules/sdk */ "../../../node_modules/@webaudiomodules/sdk/dist/index.js");
/* harmony import */ var _webaudiomodules_sdk_parammgr__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @webaudiomodules/sdk-parammgr */ "../../../node_modules/@webaudiomodules/sdk-parammgr/dist/index.js");
/* harmony import */ var _Node__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./Node */ "./src/Node.ts");
/* harmony import */ var preact__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! preact */ "../../../node_modules/preact/dist/preact.module.js");
/* harmony import */ var _views_DrumSamplerView__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./views/DrumSamplerView */ "./src/views/DrumSamplerView.tsx");
/* harmony import */ var _shared_getBaseUrl__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../../shared/getBaseUrl */ "../shared/getBaseUrl.tsx");
/* harmony import */ var _views_DrumSamplerView_scss__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./views/DrumSamplerView.scss */ "./src/views/DrumSamplerView.scss");
/* harmony import */ var _shared_insertStyle__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../shared/insertStyle */ "../shared/insertStyle.ts");
var __awaiter = (undefined && undefined.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};


//Un Drum Sampler a un (des?) node a (ont?) un kit qui a des voix






class DrumSampler extends _webaudiomodules_sdk__WEBPACK_IMPORTED_MODULE_0__.WebAudioModule {
    constructor() {
        super(...arguments);
        this._baseURL = (0,_shared_getBaseUrl__WEBPACK_IMPORTED_MODULE_5__.getBaseUrl)(new URL('.', __webpack_require__.p));
        this._descriptorUrl = `${this._baseURL}/descriptor.json`;
    }
    _loadDescriptor() {
        return __awaiter(this, void 0, void 0, function* () {
            const url = this._descriptorUrl;
            if (!url)
                throw new TypeError('Descriptor not found');
            const response = yield fetch(url);
            const descriptor = yield response.json();
            Object.assign(this.descriptor, descriptor);
            return descriptor;
        });
    }
    initialize(state) {
        const _super = Object.create(null, {
            initialize: { get: () => super.initialize }
        });
        return __awaiter(this, void 0, void 0, function* () {
            yield this._loadDescriptor();
            return _super.initialize.call(this, state);
        });
    }
    createAudioNode(initialState) {
        return __awaiter(this, void 0, void 0, function* () {
            const node = new _Node__WEBPACK_IMPORTED_MODULE_2__.DrumSamplerNode(this.instanceId, this.audioContext);
            const paramsConfig = Object.assign({}, ...node.kit.voices.map((v, i) => v.paramsConfig(i + 1)));
            paramsConfig["compression"] = {
                minValue: 0,
                maxValue: 1,
                defaultValue: 0,
            };
            const internalParamsConfig = Object.assign({}, ...node.kit.voices.map((v, i) => v.internalParamsConfig(i + 1)));
            internalParamsConfig["compThreshold"] = node.compressor.threshold;
            internalParamsConfig["compRatio"] = node.compressor.ratio;
            internalParamsConfig["compKnee"] = node.compressor.knee;
            internalParamsConfig["compAttack"] = node.compressor.attack;
            internalParamsConfig["compRelease"] = node.compressor.release;
            const paramsMapping = Object.assign({}, ...node.kit.voices.map((v, i) => v.paramsMapping(i + 1)));
            paramsMapping['compression'] = {
                compThreshold: {
                    sourceRange: [0, 1],
                    targetRange: [0, -40]
                },
                compRatio: {
                    sourceRange: [0, 1],
                    targetRange: [1, 20]
                },
                compKnee: {
                    sourceRange: [0, 1],
                    targetRange: [20, 0.1]
                },
                compAttack: {
                    sourceRange: [0, 1],
                    targetRange: [0.01, 0.0001]
                },
                compRelease: {
                    sourceRange: [0, 1],
                    targetRange: [0.05, 0.3]
                }
            };
            const optionsIn = { internalParamsConfig, paramsConfig, paramsMapping };
            const paramMgrNode = yield _webaudiomodules_sdk_parammgr__WEBPACK_IMPORTED_MODULE_1__.ParamMgrFactory.create(this, optionsIn);
            node.setup(paramMgrNode);
            if (initialState) {
                node.setState(initialState);
            }
            else {
                node.setState({
                    kit: {
                        slots: [
                            {
                                name: "Kick",
                                uri: "https://burns.ca/static/909/kick.wav",
                                note: 36,
                            },
                            {
                                name: "Rimshot",
                                uri: "https://burns.ca/static/909/rimshot.wav",
                                note: 37,
                            },
                            {
                                name: "Snare",
                                uri: "https://burns.ca/static/909/snare.wav",
                                note: 38,
                            },
                            {
                                name: "Clap",
                                uri: "https://burns.ca/static/909/clap.wav",
                                note: 39,
                            },
                            {
                                name: "Low Tom",
                                uri: "https://burns.ca/static/909/low_tom.wav",
                                note: 41,
                            },
                            {
                                name: "Mid Tom",
                                uri: "https://burns.ca/static/909/mid_tom.wav",
                                note: 47,
                            },
                            {
                                name: "High Tom",
                                uri: "https://burns.ca/static/909/hi_tom.wav",
                                note: 43,
                            },
                            {
                                name: "CH",
                                uri: "https://burns.ca/static/909/ch.wav",
                                note: 42,
                            },
                            {
                                name: "OH",
                                uri: "https://burns.ca/static/909/oh.wav",
                                note: 46,
                            },
                            {
                                name: "Crash",
                                uri: "https://burns.ca/static/909/crash.wav",
                                note: 49,
                            },
                            {
                                name: "Ride",
                                uri: "https://burns.ca/static/909/ride.wav",
                                note: 51,
                            },
                        ]
                    }
                });
            }
            return node;
        });
    }
    createGui() {
        return __awaiter(this, void 0, void 0, function* () {
            const div = document.createElement('div');
            (0,preact__WEBPACK_IMPORTED_MODULE_3__.h)("div", {});
            var shadow = div.attachShadow({ mode: 'open' });
            (0,_shared_insertStyle__WEBPACK_IMPORTED_MODULE_7__.insertStyle)(shadow, _views_DrumSamplerView_scss__WEBPACK_IMPORTED_MODULE_6__["default"].toString());
            div.setAttribute("style", "display: flex; flex-direction: column: width: 100%; height: 100%");
            div.setAttribute("width", "780");
            div.setAttribute("height", "380");
            let initialState = this.audioNode.paramMgr.getParamsValues();
            (0,preact__WEBPACK_IMPORTED_MODULE_3__.render)((0,preact__WEBPACK_IMPORTED_MODULE_3__.h)(_views_DrumSamplerView__WEBPACK_IMPORTED_MODULE_4__.DrumSamplerView, { initialState: initialState, plugin: this }), shadow);
            return div;
        });
    }
    destroyGui(el) {
        (0,preact__WEBPACK_IMPORTED_MODULE_3__.render)(null, el.shadowRoot);
    }
}


//# sourceURL=webpack://drm-16/./src/index.tsx?