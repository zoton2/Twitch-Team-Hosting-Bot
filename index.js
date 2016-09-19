// Referencing other files.
var logging = require('./lib/logging');
var globalVars = require('./lib/global-vars');
var init = require('./lib/init');
var hosting = require('./lib/hosting');
var chatCommands = require('./lib/chat-commands');
var githubAPI = require('./lib/github-api');

logging.logMessage(null, 'Starting up (version ' + globalVars.version + ').');
githubAPI.checkForNewVersion();

// Does the initial connection and setting up stuff.
init.setUp(function(autoStartList) {
	logging.logMessage(null, 'All teams set up and connected.');
	
	// Goes through all of the teams at the start to kick things off; will start the hosting if set to do this.
	for (var team in globalVars.channels) {
		if (globalVars.channels.hasOwnProperty(team)) {
			globalVars.adminCommandsActive[team] = true;
			chatCommands.setUpListening(team);
			if (autoStartList.indexOf(team) >= 0) {
				hosting.turnOnHosting(team, function(error, message) {
					if (!error) {
						// could send the message at some point
					}
				});
			}
		}
	}
});