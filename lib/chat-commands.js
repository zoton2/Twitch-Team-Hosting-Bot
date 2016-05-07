// Referencing other files.
var globalVars = require('./global-vars');
var hostingFuncs = require('./hosting');
var loggingFuncs = require('./logging');

exports.setUpListening = function(team) {
	globalVars.client[team].on('whisper', function(user, message) {
		// This should remove any excessive whitespace added by users with just 1 space.
		message = message.replace(/\s{2,}/g, ' ');
		
		// Checks if person sending a whisper is classified as an admin or not.
		var admin = false;
		if (globalVars.admins[team].length > 0 && globalVars.admins[team].indexOf(user.username) >= 0) {admin = true;}
		
		listenForCommands(team, message, admin, user.username, true, function(toSend) {
			if (toSend) {globalVars.client[team].whisper(user.username, toSend);}
		});
	});
	
	globalVars.client[team].on('chat', function(channel, user, message, self) {
		// All this stuff only works in the bot channel (might be changed later).
		if (!self && channel.replace('#', '') === globalVars.client[team].getUsername()) {
			// This should remove any excessive whitespace added by users with just 1 space.
			message = message.replace(/\s{2,}/g, ' ');
			
			// Sets the user as the broadcaster if they are.
			if (user.username == channel.replace('#', '')) {user['broadcaster'] = true;}
			else {user['broadcaster'] = false;}
			
			// Checks if the person chatting is classified as an admin or not.
			var admin = false;
			if ((globalVars.admins[team].length > 0 && globalVars.admins[team].indexOf(user.username) >= 0)
				|| (globalVars.admins[team].length === 0 && user['user-type'] == 'mod')
				|| user.broadcaster) {
				admin = true;
			}
			
			listenForCommands(team, message, admin, user.username, false, function(toSend) {
				if (toSend) {globalVars.client[team].say(channel, toSend);}
			});
		}
	});
}

function listenForCommands(team, message, admin, username, whisper, callback) {
	var sentCallback = false;
	
	// Comand to show how long the current host has been active.
	if (message.toLowerCase() === '!hostedtime' || message.toLowerCase() === '!hostedchannel') {
		logCommandUsage(team, username, whisper, message);
		
		if (globalVars.currentHostedChannel[team]) {
			sentCallback = true;
			
			// Composes the message including the time the host has been active.
			return callback('We have been hosting ' + globalVars.currentHostedChannel[team] + ' for ' + hostingFuncs.calculateHostedTime(team) + '.');
		}
		
		else {sentCallback = true; return callback('We are currently not hosting anyone.');}
	}
	
	// Command to show if the hosting bot is currently turned on or off.
	if (message.toLowerCase() === '!hostbotcheck') {
		var state = (globalVars.active[team]) ? "on" : "off";
		sentCallback = true;
		logCommandUsage(team, username, whisper, message);
		return callback('The hosting bot is currently turned ' + state + '.');
	}
	
	// Only admins (or mods, if no admin accounts are set) and the broadcaster can use these commands.
	if (admin && globalVars.adminCommandsActive[team]) {
		// Start the automatic hosting.
		if (message.toLowerCase() === '!starthosting') {
			logCommandUsage(team, username, whisper, message);
			
			hostingFuncs.turnOnHosting(team, function(error, message) {
				if (!error) {sentCallback = true; return callback(message);}
			});
		}
		
		// Stop the automatic hosting.
		else if (message.toLowerCase() === '!stophosting') {
			logCommandUsage(team, username, whisper, message);
			
			hostingFuncs.turnOffHosting(team, function(error, message) {
				if (!error) {sentCallback = true; return callback(message);}
			});
		}
		
		// Manually hosts someone.
		else if (message.toLowerCase().indexOf('!manualhost ') === 0) {
			logCommandUsage(team, username, whisper, message);
			var channelToHostOptions = message.substr(12);
			
			if (channelToHostOptions != '') {
				var options = channelToHostOptions.split(' ');
				var length = (options[1] && !isNaN(parseInt(options[1]))) ? parseInt(options[1]) : null;
				hostingFuncs.manuallyHostChannel(team, options[0], length, function(error, message) {
					if (!error) {sentCallback = true; return callback(message);}
				});
			}
		}
		
		// Ends the current host and find someone else to host.
		// Right now, if no one else on the team is live, the same person will be hosted again after 1 minute.
		// Can be a little "buggy" if there's no one else to host; needs some improvement.
		else if (message.toLowerCase() === '!endcurrenthost') {
			logCommandUsage(team, username, whisper, message);
			
			if (globalVars.active[team] && globalVars.currentHostedChannel[team]) {
				loggingFuncs.logMessage(team, 'The current host has been ended manually.');
				hostingFuncs.chooseChannel(team);
				sentCallback = true;
				return callback();
			}
			
			else {
				sentCallback = true;
				return callback('We are currently not hosting anyone.');
			}
		}
	}
	
	// If nothing has happened in 60 seconds, does a callback to close this function.
	setTimeout(function() {
		if (!sentCallback) {return callback();}
	}, 60000);
}

function logCommandUsage(team, username, whisper, message) {
	loggingFuncs.logMessage(team, username + ' has used a command' + (whisper?' (via whisper)':'') + ': ' + message);
}