// Referencing packages.
var irc = require('tmi.js');
var async = require('async');
var fs = require('fs-extra');

// Referencing other files.
var globalVars = require('./global-vars');
var twitchAPI = require('./twitch-api');

exports.setUpConnections = function(callback) {
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
				twitchAPI.getTeamChannels(loginDetails[i].team, function(error, errorType, response) {
					if (!error) {
						// Makes the correct array for this team.
						globalVars.teamChannels[loginDetails[i].team] = [];
						
						// Pushes all of the channels on the team into the correct array.
						for (var j = 0; j < response.channels.length; j++) {
							globalVars.teamChannels[loginDetails[i].team].push(response.channels[j].channel.name);
						}
						
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
		}
	};
	
	// Sets up the client.
	globalVars.client[account] = new irc.client(ircOptions);
	globalVars.client[account].connect();
	
	// Joins the team channels on connect (which will also happen if we have to reconnect).
	globalVars.client[account].on('connected', function(address, port) {
		for (var i = 0; i < globalVars.teamChannels[team].length; i++) {
			globalVars.client[account].join(globalVars.teamChannels[team][i]);
		}
	});
	
	// Calls back once connected (but only once!)
	globalVars.client[account].once('connected', function(address, port) {
		callback();
	});
}