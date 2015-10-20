// Referencing other files.
var globalVars = require('./global-vars');
var hostingFuncs = require('./hosting');

exports.setUpListening = function(team) {
	globalVars.client[team].on('chat', function(channel, user, message, self) {
		// This should remove any excessive whitespace added by users with just 1 space.
		var message = message.replace(/\s{2,}/g, ' ');
		
		// Sets the user as the broadcaster if they are.
		if (user.username == channel.replace('#', '').toLowerCase()) {user['broadcaster'] = true;}
		else {user['broadcaster'] = false;}
		
		if (!self) {listenToChat(team, channel, user, message);}
	});
}

function listenToChat(team, channel, user, message) {
	// These commands only work in the bot account's channel.
	if (channel.replace('#', '') === globalVars.client[team].getUsername()) {
		// Command to show who the bot is currently hosting.
		if (message.toLowerCase() === '!hostedchannel') {
			if (globalVars.currentHostedChannel[team]) {globalVars.client[team].say(channel, 'We are currently hosting ' + globalVars.currentHostedChannel[team] + '.');}
			else {globalVars.client[team].say(channel, 'We are not currently hosting anyone.');}
		}
		
		// Comand to show how long the current host has been active (this might be able to fully replace the above command?)
		else if (message.toLowerCase() === '!hostedtime') {
			if (globalVars.currentHostedChannel[team]) {
				// Composes the message including the time the host has been active.
				globalVars.client[team].say(channel, 'We have been hosting ' + globalVars.currentHostedChannel[team] + ' for ' + hostingFuncs.calculateHostedTime(team) + '.');
			}
			
			else {globalVars.client[team].say(channel, 'We are not currently hosting anyone.');}
		}
		
		// Only admins (or mods, if no admin accounts are set) and the broadcaster can use these commands.
		if ((globalVars.admins[team].length > 0 && globalVars.admins[team].indexOf(user.username) >= 0)
			|| (globalVars.admins[team].length === 0 && user['user-type'] == 'mod')
			|| user.broadcaster) {
			// Start the automatic hosting.
			if (message.toLowerCase() === '!starthosting') {
				hostingFuncs.turnOnHosting(team);
			}
			
			// Stop the automatic hosting.
			else if (message.toLowerCase() === '!stophosting') {
				hostingFuncs.turnOffHosting(team);
			}
		}
	}
}