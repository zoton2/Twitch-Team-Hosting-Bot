var request = require('request');

// callback: error (true/false), error type, parsed data
exports.getTeamLiveChannels = function(team, callback) {
	var apiURL = 'http://api.twitch.tv/api/team/' + team + '/live_channels.json';
	
	request(apiURL, function(error, response, body) {
		if (!error && response.statusCode === 200) {callback(false, null, JSON.parse(body));}
		else {callback(true, 'connection_error');}
	});
}

// callback: error (true/false), error type, parsed data
exports.getTeamChannels = function(team, callback) {
	var apiURL = 'http://api.twitch.tv/api/team/' + team + '/all_channels.json';
	
	request(apiURL, function(error, response, body) {
		if (!error && response.statusCode === 200) {callback(false, null, JSON.parse(body));}
		else {callback(true, 'connection_error');}
	});
}