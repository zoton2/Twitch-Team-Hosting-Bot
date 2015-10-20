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

// channels must be an array of channels to be checked
// callback: error (true/false), error type, parsed data
exports.getStreamStatus = function(channels, callback) {
	var apiURL = 'https://api.twitch.tv/kraken/streams?limit=100&channel=';
	
	for (var i = 0; i < channels.length; i++) {
		apiURL += channels[i];
		if (i < channels.length-1) {apiURL += ',';}
	}
	
	request(apiURL, function(error, response, body) {
		if (!error && response.statusCode === 200) {callback(false, null, JSON.parse(body));}
		else {callback(true, 'connection_error');}
	});
}

// callback: error (true/false), error type, parsed data
exports.getChannelData = function(channel, callback) {
	var apiURL = 'https://api.twitch.tv/kraken/channels/' + channel;
	
	request(apiURL, function(error, response, body) {
		if (!error && response.statusCode === 200) {callback(false, null, JSON.parse(body));}
		else if (!error && response.statusCode === 404) {callback(true, 'channel_not_found');}
		else {callback(true, 'connection_error');}
	});
}