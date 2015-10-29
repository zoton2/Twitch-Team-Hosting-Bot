// Referencing packages.
var irc = require('tmi.js');
var async = require('async');
var fs = require('fs-extra');

// Referencing other files.
var loggingFuncs = require('./logging');
var globalVars = require('./global-vars');
var twitchAPI = require('./twitch-api');
var statsFuncs = require('./statistics');
var logServer = require('./log-server');

exports.setUp = function(callback) {
	// Getting the login details from the file the user should've made.	
	var loginDetails;
	try {
		loginDetails = fs.readJsonSync('persist/login-details.json', {throws: false});
	} catch (exception) {
		loginDetails = null;
	}
	
	// Stops the script running if the file cannot be loaded.
	if (!loginDetails) {
		loggingFuncs.logMessage(null, 'There are issues loading the login-details.json file.');
		process.exit();
	}
	
	// Check that things in the login details file are correct.
	else {
		if (loginDetails.length > 0) {
			var issues = [];
			
			// Checks all the login details for issues.
			for (var i = 0; i < loginDetails.length; i++) {
				if (!loginDetails[i].team) {issues.push('team');}
				if (!loginDetails[i].username) {issues.push('username');}
				if (!loginDetails[i].oauth) {issues.push('oauth');}
			}
			
			// If there are issues with required variables, exits.
			if (issues.length > 0) {
				loggingFuncs.logMessage(null, 'There are ' + issues.length + ' issues with your login-details.json file not containing required information.');
				process.exit();
			}
		}
		
		// If there are no details to use, exits.
		else {
			loggingFuncs.logMessage(null, 'Your login-details.json file does not contain any settings or is not written correctly.');
			process.exit();
		}
	}
	
	// Getting the settings from the settings file, if it exists.
	try {
		globalVars.settings = fs.readJsonSync('persist/settings.json', {throws: false});
	} catch (exception) {
		globalVars.settings = null;
	}
	
	// Tells the user if the file cannot be loaded.
	if (!globalVars.settings) {
		loggingFuncs.logMessage(null, 'There are issues loading the settings.json file, using defaults.');
		globalVars.settings = {};
	}
	
	// Check that things in the settings file are correct, and if not use defaults.
	else {
		if (!globalVars.settings.logServer) {globalVars.settings.logServer = false;}
		if (!globalVars.settings.logServerPort) {globalVars.settings.logServerPort = 8080;}
	}
	
	else {
		// Start the server if the user wants it.
		if (globalVars.settings.logServer) {logServer.setUpServer();}
		
		statsFuncs.loadStatistics();
		var autoStartList = [];
		
		// Goes through each team and gets the details needed.
		var i = 0;
		async.whilst(
			function() {return i < loginDetails.length;},
			function(callback) {
				// Sets up default variables for this team.
				globalVars.channels[loginDetails[i].team] = [];
				globalVars.currentHostedChannel[loginDetails[i].team] = null;
				globalVars.active[loginDetails[i].team] = false;
				globalVars.timeouts[loginDetails[i].team] = [];
				globalVars.adminCommandsActive[loginDetails[i].team] = false;
				
				// Sets the list of preferred games if set, otherwise sets it to blank.
				if (loginDetails[i].preferredGames && loginDetails[i].preferredGames.constructor === Array && loginDetails[i].preferredGames.length > 0) {globalVars.preferredGames[loginDetails[i].team] = loginDetails[i].preferredGames;}
				else {globalVars.preferredGames[loginDetails[i].team] = [];}
				
				// If the settings want this team to start hosting as soon as the bot starts (or omits the setting) sets this.
				if (loginDetails[i].autoStart === undefined || loginDetails[i].autoStart === true) {
					autoStartList.push(loginDetails[i].team);
				}
				
				// Sets the list of admins if set, otherwise sets it to blank.
				if (loginDetails[i].admins && loginDetails[i].admins.constructor === Array && loginDetails[i].admins.length > 0) {globalVars.admins[loginDetails[i].team] = loginDetails[i].admins;}
				else {globalVars.admins[loginDetails[i].team] = [];}
				
				// Converts admin names to lower case (for easier comparison elsewhere in the code).
				globalVars.admins[loginDetails[i].team] = lowercaseArray(globalVars.admins[loginDetails[i].team]);
				
				// Checks if the debug setting specified is a boolean, and sets it to false if not.
				if (typeof(loginDetails[i].debug) != "boolean") {loginDetails[i].debug = false;}
				
				async.waterfall([
					function(callback2) {
						// Queries the API for a list of channels on the team if needed.
						if (!loginDetails[i].manualChannelList || loginDetails[i].manualChannelList.constructor != Array || loginDetails[i].manualChannelList.length === 0) {
							twitchAPI.getTeamChannels(loginDetails[i].team, function(error, errorType, response) {
								if (!error) {
									// Pushes all of the channels on the team into the correct array.
									for (var j = 0; j < response.channels.length; j++) {
										globalVars.channels[loginDetails[i].team].push(response.channels[j].channel.name);
									}
									
									callback2();
								}
								
								else {callback();}
							});
						}
						
						// If a manual channel list has been specified, uses that instead.
						else {
							loginDetails[i].manualChannelList = lowercaseArray(loginDetails[i].manualChannelList);
							globalVars.channels[loginDetails[i].team] = loginDetails[i].manualChannelList;
							callback2();
						}
					}
				], function(err) {
					// Connects to the chat using the bot account provided.
					connectToChat(loginDetails[i].team, loginDetails[i].username, loginDetails[i].oauth, loginDetails[i].debug, function() {
						loggingFuncs.logMessage(loginDetails[i].team, 'Finished initial setting up and connecting.');
						i++;
						callback();
					});
				});
			},
			function(err) {
				// We are done connecting the accounts.
				callback(autoStartList);
			}
		);
	}
}

// Used by the above function to connect bots to the chat.
function connectToChat(team, account, oauth, debug, callback) {
	var channels = globalVars.channels[team].slice(0);
	
	// Joins the bot channel as well if it isn't specified anywhere else.
	if (channels.indexOf(account.toLowerCase()) === -1) {
		channels.push(account.toLowerCase());
	}
	
	// Setting up the options.
	var ircOptions = {
		options: {
			debug: debug
		},
		connection: {
			random: 'chat',
			reconnect: true
		},
		identity: {
			username: account,
			password: oauth
		},
		channels: channels
	};
	
	// Sets up the client.
	globalVars.client[team] = new irc.client(ircOptions);
	globalVars.client[team].connect();
	
	// Will quit the application if we haven't connected after 30 seconds.
	// (Sometimes it can't connect and never tries again for some reason.)
	var noConnectionTimeout = setTimeout(function() {
		loggingFuncs.logMessage(team, 'Cannot connect; quitting. Try running me again!');
		process.exit();
	}, 30000);
	
	// Calls back once the connection is done.
	globalVars.client[team].once('connected', function(address, port) {
		clearTimeout(noConnectionTimeout);
	});
	
	// Fires the call back once all of the channels are joined.
	var channelCount = 0;
	var initJoins;
	globalVars.client[team].on('join', initJoins = function(channel, username) {
		if (globalVars.client[team].getUsername() === username) {channelCount++;}
		
		if (channelCount === channels.length) {
			globalVars.client[team].removeListener('join', initJoins);
			
			// Starts connecting for the whispers.
			connectWhispers(team, ircOptions, function() {
				callback();
			});
		}
	});
}

// Called by the function above to also connect whispers, so uses some stuff from that.
function connectWhispers(team, ircOptions, callback) {
	// Changes options for the whisper connection.
	ircOptions.connection.random = 'group';
	ircOptions.channels = ['#jtv'];
	
	// Sets up the client.
	globalVars.clientWhisper[team] = new irc.client(ircOptions);
	globalVars.clientWhisper[team].connect();
	
	// Will quit the application if whispers haven't connected after 30 seconds.
	// (Sometimes it can't connect and never tries again for some reason.)
	var noConnectionTimeout = setTimeout(function() {
		loggingFuncs.logMessage(team, 'Cannot connect whispers; quitting. Try running me again!');
		process.exit();
	}, 30000);
	
	// Calls back once the connection is done.
	globalVars.clientWhisper[team].once('connected', function(address, port) {
		clearTimeout(noConnectionTimeout);
		callback();
	});
}

// Converts all strings in an array to lowercase.
function lowercaseArray(array) {
	array = array.slice(0);
	
	for (var i = 0; i < array.length; i++) {
		array[i] = array[i].toLowerCase();
	}
	
	return array;
}