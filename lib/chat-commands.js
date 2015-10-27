// Referencing other files.
var globalVars = require('./global-vars');
var hostingFuncs = require('./hosting');

exports.setUpListening = function(team) {
	globalVars.clientWhisper[team].on('whisper', function(username, message) {
		// This should remove any excessive whitespace added by users with just 1 space.
		message = message.replace(/\s{2,}/g, ' ');
		
		// Checks if person sending a whisper is classified as an admin or not.
		var admin = false;
		if (globalVars.admins[team].length > 0 && globalVars.admins[team].indexOf(username) >= 0) {admin = true;}
		
		listenForCommands(team, message, admin, function(toSend) {
			if (toSend) {globalVars.clientWhisper[team].whisper(username, toSend);}
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
			
			listenForCommands(team, message, admin, function(toSend) {
				if (toSend) {globalVars.client[team].say(channel, toSend);}
			});
		}
	});
}

function listenForCommands(team, message, admin, callback) {
	sentCallback = false;
	
	// Command to show who the bot is currently hosting.
	if (message.toLowerCase() === '!hostedchannel') {
		if (globalVars.currentHostedChannel[team]) {
			sentCallback = true;
			return callback('We are currently hosting ' + globalVars.currentHostedChannel[team] + '.');
		}
		
		else {sentCallback = true; return callback('We are not currently hosting anyone.');}
	}
	
	// Comand to show how long the current host has been active (this might be able to fully replace the above command?)
	else if (message.toLowerCase() === '!hostedtime') {
		if (globalVars.currentHostedChannel[team]) {
			sentCallback = true;
			
			// Composes the message including the time the host has been active.
			return callback('We have been hosting ' + globalVars.currentHostedChannel[team] + ' for ' + hostingFuncs.calculateHostedTime(team) + '.');
		}
		
		else {sentCallback = true; return callback('We are not currently hosting anyone.');}
	}
	
	// Only admins (or mods, if no admin accounts are set) and the broadcaster can use these commands.
	if (admin && globalVars.adminCommandsActive[team]) {
		// Start the automatic hosting.
		if (message.toLowerCase() === '!starthosting') {
			hostingFuncs.turnOnHosting(team, function(error, message) {
				if (!error) {sentCallback = true; return callback(message);}
			});
		}
		
		// Stop the automatic hosting.
		else if (message.toLowerCase() === '!stophosting') {
			hostingFuncs.turnOffHosting(team, function(error, message) {
				if (!error) {sentCallback = true; return callback(message);}
			});
		}
		
		// Manually hosts someone.
		else if (message.toLowerCase().indexOf('!manualhost ') === 0) {
			var channelToHost = message.substr(12);
			
			if (channelToHost != '') {
				hostingFuncs.manuallyHostChannel(team, channelToHost, function(error, message) {
					if (!error) {sentCallback = true; return callback(message);}
				});
			}
		}
		
		// Ends the current host and find someone else to host.
		// Right now, if no one else on the team is live, the same person will be hosted again after 1 minute.
		else if (message.toLowerCase() === '!endcurrenthost') {
			if (globalVars.active[team] && globalVars.currentHostedChannel[team]) {
				hostingFuncs.chooseChannel(team);
				sentCallback = true;
				return callback();
			}
			
			else {
				sentCallback = true;
				return callback('We are not currently hosting anyone.');
			}
		}
	}
	
	// If nothing has happened in 60 seconds, does a callback to close this function.
	setTimeout(function() {
		if (!sentCallback) {return callback();}
	}, 60000);
}