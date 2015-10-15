// Referencing packages.
var moment = require('moment');
require('moment-duration-format');

// Referencing other files.
var globalVars = require('./global-vars');
var hostingFuncs = require('./hosting');

exports.setUpListening = function(team) {
	globalVars.client[team].on('chat', function(channel, user, message, self) {
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
				var toSend = 'We have been hosting ' + globalVars.currentHostedChannel[team];
				var hostedTimeInSecs = moment.utc().diff(globalVars.hostStartTime[team], 'seconds');
				var hostedTime = moment.duration(hostedTimeInSecs, 'seconds');
				hostedTime = hostedTime.format('h:mm:ss');
				toSend += ' for ' + hostedTime;
				if (hostedTimeInSecs < 60) {toSend += 's';}
				toSend += '.';
				
				globalVars.client[team].say(channel, toSend);
			}
			
			else {globalVars.client[team].say(channel, 'We are not currently hosting anyone.');}
		}
		
		else if (message.toLowerCase() === '!starthosting' && !globalVars.active[team]) {
			globalVars.active[team] = true;
			hostingFuncs.chooseChannel(team);
		}
	}
}