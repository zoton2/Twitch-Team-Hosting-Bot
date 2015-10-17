// Referencing packages.
var irc = require('tmi.js');
var async = require('async');
var fs = require('fs-extra');

// Referencing other files.
var globalVars = require('./global-vars');
var twitchAPI = require('./twitch-api');
var statsFuncs = require('./statistics');

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
		console.log('There are issues loading the login-details.json file.');
		process.exit();
	}
	
	else {
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
				for (var j = 0; j < globalVars.admins[loginDetails[i].team].length; j++) {
					globalVars.admins[loginDetails[i].team][j] = globalVars.admins[loginDetails[i].team][j].toLowerCase();
				}
				
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
							globalVars.channels[loginDetails[i].team] = loginDetails[i].manualChannelList;
							callback2();
						}
					}
				], function (err) {
					// Connects to the chat using the bot account provided.
					connectToChat(loginDetails[i].team, loginDetails[i].username, loginDetails[i].oauth, function() {
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
function connectToChat(team, account, oauth, callback) {
	// Setting up the options.
	var ircOptions = {
		options: {
			debug: true
		},
		connection: {
			random: 'chat',
			reconnect: true
		},
		identity: {
			username: account,
			password: oauth
		},
		channels: globalVars.channels[team].slice(0)
	};
	
	// Sets up the client.
	globalVars.client[team] = new irc.client(ircOptions);
	globalVars.client[team].connect();
	
	// Fires the call back once all of the channels are joined.
	var channelCount = 0;
	var initJoins;
	globalVars.client[team].on('join', initJoins = function(channel, username) {
		if (globalVars.client[team].getUsername() === username) {channelCount++;}
		
		if (channelCount === globalVars.channels[team].length) {
			globalVars.client[team].removeListener('join', initJoins);
			callback();
		}
	});
}