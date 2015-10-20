// Referencing other files.
var loggingFuncs = require('./lib/logging');
var globalVars = require('./lib/global-vars');
var init = require('./lib/init');
var hostingFuncs = require('./lib/hosting');
var chatCommandFuncs = require('./lib/chat-commands');

loggingFuncs.logMessage(null, 'Starting up...');

// Does the initial connection and setting up stuff.
init.setUp(function(autoStartList) {
	// Goes through all of the teams at the start to kick things off; will start the hosting if set to do this.
	for (var key in globalVars.channels) {
		if (globalVars.channels.hasOwnProperty(key)) {
			chatCommandFuncs.setUpListening(key);
			if (autoStartList.indexOf(key) >= 0) {hostingFuncs.turnOnHosting(key);}
		}
	}
});