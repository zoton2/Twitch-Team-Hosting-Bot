// Referencing other files.
var globalVars = require('./global-vars');
var hosting = require('./hosting');
var logging = require('./logging');

// Declaring variables.
var workingMessage = 'The bot is currently working on something and the admin commands are disabled.'

exports.setUpListening = function(team) {
	globalVars.client[team].on('message', function(channel, user, message, self) {
		if (!self) {
			var admin = false, willCheck = false, whisper = false;
			
			// This should remove any excessive whitespace added by users with just 1 space.
			message = message.replace(/\s{2,}/g, ' ');
			
			// Normal chat commands only works in the main channel channel (might be changed later).
			if (user['message-type'] === 'chat' && channel.replace('#', '') === globalVars.mainChannel[team].toLowerCase()) {
				// Checks if the person chatting is classified as an admin or not.
				if (globalVars.admins[team].indexOf(user.username) >= 0
					|| (globalVars.modsAreAdmins[team] && user['user-type'] == 'mod')
					|| user.username === channel.replace('#', '')
					|| user.username === globalVars.client[team].getUsername().toLowerCase()) {
					admin = true;
				}
				
				willCheck = true;
			}
			
			// For messages received over whisper.
			else if (user['message-type'] === 'whisper') {
				// Checks if person sending a whisper is classified as an admin or not.
				if (globalVars.admins[team].length > 0 && globalVars.admins[team].indexOf(user.username) >= 0) {admin = true;}
				
				willCheck = true; whisper = true;
			}
			
			if (willCheck) {
				listenForCommands(team, message, admin, user.username, whisper, function(toSend) {
					if (toSend && whisper) {globalVars.client[team].whisper(user.username, toSend);}  // whisper
					if (toSend && !whisper) {globalVars.client[team].say(channel, toSend);}  // chat message
				});
			}
		}
	});
}

function listenForCommands(team, message, admin, username, whisper, callback) {
	// Comand to show how long the current host has been active.
	if (message.toLowerCase() === '!hostedtime' || message.toLowerCase() === '!hostedchannel') {
		logCommandUsage(team, username, whisper, message);
		
		if (globalVars.currentHostedChannel[team]) {
			// Composes the message including the time the host has been active.
			return callback('We have been hosting ' + globalVars.currentHostedChannel[team].displayName + ' for ' + hosting.calculateHostedTime(team) + ' (hosting length: ' + hosting.formatMS(globalVars.currentHostRefreshLength[team]) + ').');
		}
		
		else {return callback('We are currently not hosting anyone.');}
	}
	
	// Command to show if the hosting bot is currently turned on or off.
	if (message.toLowerCase() === '!hostbotcheck') {
		var state = (globalVars.active[team]) ? "on" : "off";
		logCommandUsage(team, username, whisper, message);
		return callback('The hosting bot is currently turned ' + state + '.');
	}
	
	// Command to show the current version of the bot.
	if (message.toLowerCase() === '!version') {
		logCommandUsage(team, username, whisper, message);
		return callback('The bot is currently running on version ' + globalVars.version + '.');
	}
	
	// Only admins (or mods, if no admin accounts are set) and the broadcaster can use these commands.
	if (admin) {
		// Start the automatic hosting.
		if (message.toLowerCase() === '!starthosting') {
			logCommandUsage(team, username, whisper, message);
			if (!globalVars.adminCommandsActive[team]) {return callback(workingMessage);}
			
			hosting.turnOnHosting(team, function(error, message) {
				if (!error) {return callback(message);}
			});
		}
		
		// Stop the automatic hosting.
		if (message.toLowerCase() === '!stophosting') {
			logCommandUsage(team, username, whisper, message);
			if (!globalVars.adminCommandsActive[team]) {return callback(workingMessage);}
			
			hosting.turnOffHosting(team, function(error, message) {
				if (!error) {return callback(message);}
			});
		}
		
		// Manually hosts someone.
		if (message.toLowerCase().indexOf('!manualhost ') === 0) {
			logCommandUsage(team, username, whisper, message);
			if (!globalVars.adminCommandsActive[team]) {return callback(workingMessage);}
			var channelToHostOptions = message.substr(12);
			
			if (channelToHostOptions != '') {
				var options = channelToHostOptions.split(' ');
				var length = (options[1] && !isNaN(parseInt(options[1]))) ? parseInt(options[1]) : null;
				hosting.manuallyHostChannel(team, options[0], length, function(error, message) {
					if (!error) {return callback(message);}
				});
			}
		}
		
		// Ends the current host and find someone else to host.
		// Used to be buggy but with the new PubSub setup, it should be fine.
		if (message.toLowerCase() === '!endcurrenthost') {
			logCommandUsage(team, username, whisper, message);
			if (!globalVars.adminCommandsActive[team]) {return callback(workingMessage);}
			
			if (globalVars.active[team] && globalVars.currentHostedChannel[team]) {
				logging.logMessage(team, 'The current host has been ended manually.');
				hosting.chooseChannel(team);
				return callback();
			}
			
			else {return callback('We are currently not hosting anyone.');}
		}
	}
	
	// If nothing has happened in 60 seconds, does a callback to close this function.
	setTimeout(function() {return callback();}, 60000);
}

function logCommandUsage(team, username, whisper, message) {
	logging.logMessage(team, username + ' has used a command' + (whisper?' (via whisper)':'') + ': ' + message);
}