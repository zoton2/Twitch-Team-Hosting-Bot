// Referencing other files.
var globalVars = require('./lib/global-vars');
var init = require('./lib/init');
var hostingFuncs = require('./lib/hosting');
var chatCommandFuncs = require('./lib/chat-commands');

// Does the initial connection and setting up stuff.
init.setUp(function() {
	// Goes through all of the teams at the start to kick things off.
	for (var key in globalVars.channels) {
		if (globalVars.channels.hasOwnProperty(key)) {
			chatCommandFuncs.setUpListening(key);
			hostingFuncs.chooseChannel(key);
		}
	}
});