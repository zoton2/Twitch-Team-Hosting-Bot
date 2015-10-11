// Referencing other files.
var globalVars = require('./lib/global-vars');
var init = require('./lib/init');
var hostingFuncs = require('./lib/hosting');

// Does the initial connection and setting up stuff.
init.setUp(function() {
	// Starts off by selecting a channel from each team needed.
	for (var key in globalVars.teamChannels) {
		if (globalVars.teamChannels.hasOwnProperty(key)) {
			hostingFuncs.chooseChannel(key);
		}
	}
});