// Referencing other files.
var globalVars = require('./global-vars');

exports.setUpListening = function(team) {
	globalVars.client[team].on('chat', function(channel, user, message, self) {
		if (!self) {listenToChat(team, channel, user, message);}
	});
}

function listenToChat(team, channel, user, message) {
	// These commands only work in the bot account's channel.
	if (channel.replace('#', '') === globalVars.client[team].getUsername()) {
		// Command to show who the bot is currently hosting.
		if (message.toLowerCase() == '!currenthostedchannel') {
			if (globalVars.currentHostedChannel[team]) {globalVars.client[team].say(channel, 'We are currently hosting ' + globalVars.currentHostedChannel[team]);}
			else {globalVars.client[team].say(channel, 'We are not currently hosting anyone.');}
		}
	}
}