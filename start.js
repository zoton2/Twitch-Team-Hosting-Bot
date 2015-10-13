// Referencing other files.
var globalVars = require('./lib/global-vars');
var init = require('./lib/init');
var hostingFuncs = require('./lib/hosting');
var chatCommandFuncs = require('./lib/chat-commands');

// Does the initial connection and setting up stuff.
init.setUp(function() {
	// Starts off by selecting a channel from each team needed.
	for (var key in globalVars.teamChannels) {
		if (globalVars.teamChannels.hasOwnProperty(key)) {
			chatCommandFuncs.setUpListening(key);
			hostingFuncs.chooseChannel(key);
		}
	}
});