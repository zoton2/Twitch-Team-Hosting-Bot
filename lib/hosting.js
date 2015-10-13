// Referencing other files.
var globalVars = require('./global-vars');
var twitchAPI = require('./twitch-api');
var randomFuncs = require('./random');

exports.chooseChannel = function(teamName) {
	exports.getOnlineChannels(teamName, function(onlineChannels) {
		var chosenChannel;
		
		// If the current hosted channel is still online, removes it from the online channels list.
		if (onlineChannels.indexOf(globalVars.currentHostedChannel[teamName]) >= 0) {
			onlineChannels.splice(onlineChannels.indexOf(globalVars.currentHostedChannel[teamName]), 1);
		}
		
		// If there are channels online to host...
		if (onlineChannels.length != 0) {
			// Only 1 channel online, chooses this by default.
			if (onlineChannels.length === 1) {chosenChannel = onlineChannels[0];}
			
			// More than 1; it will pick one randomly.
			else {
				var random = randomFuncs.randomInt(0, onlineChannels.length);
				chosenChannel = onlineChannels[random];
			}
		}
		
		// No channel online to pick from.
		else {chosenChannel = null;}
		
		if (chosenChannel) {globalVars.currentHostedChannel[teamName] = chosenChannel;}
		
		else {
			// Checks again after a while...
			globalVars.teamTimeouts[teamName] = setTimeout(function() {exports.chooseChannel(teamName);}, globalVars.recheckLength)
		}
	});
}

exports.getOnlineChannels = function(teamName, callback) {
	twitchAPI.getTeamLiveChannels(teamName, function(error, errorType, response) {
		if (!error) {
			var onlineChannels = [];
			
			for (var i = 0; i < response.channels.length; i++) {
				onlineChannels.push(response.channels[i].channel.name);
			}
			
			callback(onlineChannels);
		}
		
		else {
			// do something with the error
		}
	});
}