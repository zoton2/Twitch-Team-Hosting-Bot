// Referencing packages.
var moment = require('moment');

// Referencing other files.
var globalVars = require('./global-vars');
var twitchAPI = require('./twitch-api');
var randomFuncs = require('./random');

// Starts the hosting (only will run if hosting is currently off).
exports.turnOnHosting = function(team) {
	if (!globalVars.active[team]) {
		globalVars.active[team] = true;
		chooseChannel(team);
		globalVars.client[team].say(globalVars.client[team].getUsername(), 'The hosting bot has been turned on.');
	}
}

// Stops the hosting (only will run if hosting is currently on).
exports.turnOffHosting = function(team) {
	if (globalVars.active[team]) {
		// Clearing stuff out.
		globalVars.active[team] = false;
		globalVars.hostStartTime[team] = null;
		clearTimeout(globalVars.timeouts[team]);
		
		// Does the unhosting stuff on all the channels.
		// Needs to check if the unhost was successful really before printing the message.
		for (var i = 0; i < globalVars.channels[team].length; i++) {
			var lastHostedChannel = globalVars.currentHostedChannel[team];
			globalVars.client[team].unhost(globalVars.channels[team][i]);
			//globalVars.client[team].say(globalVars.channels[team][i], 'We have stopped hosting ' + lastHostedChannel + '.');
		}
		
		globalVars.currentHostedChannel[team] = null;
		globalVars.client[team].say(globalVars.client[team].getUsername(), 'The hosting bot has been turned off.');
	}
}

// Chooses a channel from the team to host and hosts it.
function chooseChannel(team) {
	getOnlineChannels(team, function(onlineChannels) {
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
			globalVars.timeouts[team] = setTimeout(function() {chooseChannel(team);}, globalVars.hostLength);
			
			getOfflineChannels(globalVars.channels[team], function(offlineChannels) {
				// Does the hosting stuff on all the offline channels.
				// Needs to check if the host was successful really before printing the message.
				for (var i = 0; i < offlineChannels.length; i++) {
					console.log(offlineChannels[i]);
					globalVars.client[team].host(offlineChannels[i], chosenChannel);
					//globalVars.client[team].say(offlineChannels[i], 'We have started hosting ' + chosenChannel + '.');
				}
			});
		}
		
		else {
			// Checks again after a while (will continue to host the current channel if one is hosted).
			globalVars.timeouts[team] = setTimeout(function() {chooseChannel(team);}, globalVars.recheckLength);
		}
	});
}

// Gets the online channels for the specific team.
function getOnlineChannels(team, callback) {
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

// Gets the offline channels for an array of channels.
function getOfflineChannels(channels, callback) {
	twitchAPI.getStreamStatus(channels, function(error, errorType, response) {
		if (!error) {
			var onlineChannels = [];
			var offlineChannels = [];
			
			// Put all online channel names into an array.
			for (var i = 0; i < response.streams.length; i++) {onlineChannels.push(response.streams[i].channel.name);}
			
			// Checks which channels are offline right now.
			for (var i = 0; i < channels.length; i++) {
				if (onlineChannels.indexOf(channels[i].toLowerCase()) < 0) {
					offlineChannels.push(channels[i]);
				}
			}
			
			callback(offlineChannels);
		}
	});
}