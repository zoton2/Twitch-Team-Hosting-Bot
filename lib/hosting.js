// Referencing other files.
var globalVars = require('./global-vars');
var twitchAPI = require('./twitch-api');

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