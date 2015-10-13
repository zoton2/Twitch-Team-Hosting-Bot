// Referencing packages.
var irc = require('tmi.js');
var async = require('async');
var fs = require('fs-extra');

// Referencing other files.
var globalVars = require('./global-vars');
var twitchAPI = require('./twitch-api');

exports.setUp = function(callback) {
	// Getting the login details from the file the user should've made.
	var loginDetails = fs.readJsonSync('persist/login-details.json', {throws: false});
	
	// Stops the script running if the file cannot be loaded.
	if (!loginDetails) {
		console.log('There are issues loading the login-details.json file.');
		process.exit();
	}
	
	else {
		// Goes through each team and gets the details needed.
		var i = 0;
		async.whilst(
			function() {return i < loginDetails.length;},
			function(callback) {
				// Makes the correct array for this team.
				globalVars.teamChannels[loginDetails[i].team] = [];
						
				// Sets the current hosted channel variable up for this team.
				globalVars.currentHostedChannel[loginDetails[i].team] = null;
				
				twitchAPI.getTeamChannels(loginDetails[i].team, function(error, errorType, response) {
					if (!error) {
						if (!loginDetails[i].onlyOnBotChannel) {
							// Pushes all of the channels on the team into the correct array.
							for (var j = 0; j < response.channels.length; j++) {
								globalVars.teamChannels[loginDetails[i].team].push(response.channels[j].channel.name);
							}
						}
						
						// If only hosting on the bot channel, only puts that channel into the array.
						else {globalVars.teamChannels[loginDetails[i].team].push(loginDetails[i].username);}
						
						// Connects to the chat using the bot account provided.
						connectToChat(loginDetails[i].team, loginDetails[i].username, loginDetails[i].oauth, function() {
							i++;
							callback();
						});
					}
					
					else {callback();}
				});
			},
			function(err) {
				// We are done connecting the accounts.
				callback();
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
		channels: globalVars.teamChannels[team]
	};
	
	// Sets up the client.
	globalVars.client[team] = new irc.client(ircOptions);
	globalVars.client[team].connect();
	
	// Fires the call back once all of the channels are joined.
	var channelCount = 0;
	var initJoins;
	globalVars.client[team].on('join', initJoins = function(channel, username) {
		if (globalVars.client[team].getUsername() === username) {channelCount++;}
		
		if (channelCount === globalVars.teamChannels[team].length) {
			globalVars.client[team].removeListener('join', initJoins);
			callback();
		}
	});
}