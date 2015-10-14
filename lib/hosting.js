// Referencing packages.
var moment = require('moment');

// Referencing other files.
var globalVars = require('./global-vars');
var twitchAPI = require('./twitch-api');
var randomFuncs = require('./random');

// Chooses a channel from the team to host and hosts it.
exports.chooseChannel = function(team) {
	exports.getOnlineChannels(team, function(onlineChannels) {
		var chosenChannel;
		
		// If the current hosted channel is still online, removes it from the online channels list.
		for (var i = 0; i < onlineChannels.length; i++) {
			if (onlineChannels[i].username === globalVars.currentHostedChannel[team]) {
				onlineChannels.splice(i, 1);
				break;
			}
		}
		
		// If there are channels online to host...
		if (onlineChannels.length > 0) {
			// Only 1 channel online, chooses this by default.
			if (onlineChannels.length === 1) {chosenChannel = onlineChannels[0].username;}
			
			// More than 1...
			else {
				var channelsToChoose = [];
				
				// Gets a list of channels playing a preferred game.
				for (var i = 0; i < onlineChannels.length; i++) {
					for (var j = 0; j < globalVars.preferredGames[team].length; j++) {
						if (onlineChannels[i].currentGame.toLowerCase().indexOf(globalVars.preferredGames[team][j].toLowerCase()) >= 0) {
							channelsToChoose.push(onlineChannels[i]);
							break;
						}
					}
				}
				
				// If no channels are playing preferred games, anyone can be hosted.
				if (channelsToChoose.length == 0) {channelsToChoose = onlineChannels;}
				
				var random = randomFuncs.randomInt(0, channelsToChoose.length);
				chosenChannel = channelsToChoose[random].username;
			}
		}
		
		// No channel online to pick from.
		else {chosenChannel = null;}
		
		if (chosenChannel) {
			globalVars.currentHostedChannel[team] = chosenChannel;
			globalVars.hostStartTime[team] = moment.utc();
			// actual hosting stuff should go here
		}
		
		else {
			// Checks again after a while (will continue to host the current channel if one is hosted).
			globalVars.timeouts[team] = setTimeout(function() {exports.chooseChannel(team);}, globalVars.recheckLength)
		}
	});
}

exports.getOnlineChannels = function(team, callback) {
	twitchAPI.getTeamLiveChannels(team, function(error, errorType, response) {
		if (!error) {
			var onlineChannels = [];
			
			for (var i = 0; i < response.channels.length; i++) {
				// Uses the display name if available.
				var name = response.channels[i].channel.display_name;
				if (!name) {name = response.channels[i].channel.name;}
				
				onlineChannels.push({
					username: name,
					currentGame: response.channels[i].channel.meta_game,
					currentViewers: response.channels[i].channel.current_viewers
				});
			}
			
			callback(onlineChannels);
		}
	});
}