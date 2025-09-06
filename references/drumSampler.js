const player = document.querySelector('#player');
const mount = document.querySelector('#mount');
const AudioContext = window.AudioContext // Default
	|| window.webkitAudioContext 
	|| false;
const audioContext = new AudioContext();
const mediaElementSource = audioContext.createMediaElementSource(player);

// Very simple function to connect the plugin audionode to the host
const connectPlugin = (audioNode) => {
	mediaElementSource.connect(audioNode);
	audioNode.connect(audioContext.destination);
};
const mountPlugin = (domNode) => {
	mount.innerHtml = '';
	mount.appendChild(domNode);
};
(async () => {
	// Init WamEnv
	const { default: initializeWamHost } = await import("https://www.webaudiomodules.com/sdk/2.0.0-alpha.6/src/initializeWamHost.js");
	const [hostGroupId] = await initializeWamHost(audioContext);
  // Import WAM
	const { default: WAM } = await import('https://www.webaudiomodules.com/community/plugins/burns-audio/drumsampler/index.js');
	// Create a new instance of the plugin
	const instance = await WAM.createInstance(hostGroupId, audioContext);
	window.instance = instance;
  // Connect the audionode to the host
	connectPlugin(instance.audioNode);
  const pluginDomNode = await instance.createGui();

	mountPlugin(pluginDomNode);
  player.onplay = () => {
		audioContext.resume(); // audio context must be resumed because browser restrictions
	};
})();