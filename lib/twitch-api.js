// Referencing packages.
var request = require('request');
var $ = require('cheerio');
var async = require('async');

// Referencing other files.
var globalVars = require('./global-vars');

// callback: error (true/false), error type, list of channels (as objects)
exports.getTeamChannels = function(team, callback) {
	request(createRequestOptions('https://api.twitch.tv/kraken/teams/' + team.toLowerCase(), true), function(error, response, body) {
		if (!error && response.statusCode === 200) {
			var parsed = JSON.parse(body);
			var channels = [];
			
			// Get the list of channels on this team and pushes their information into the array.
			var channelArray = parsed.users;
			for (var i = 0; i < channelArray.length; i++) {
				channels.push({
					username: channelArray[i].name,
					displayName: channelArray[i].display_name,
					userID: channelArray[i]['_id']
				});
			}
			
			callback(false, null, channels);
		}
		
		else {callback(true, 'connection_error');}
	});
}

// channels must be an array of channels to be checked
// callback: error (true/false), error type, parsed data
exports.getStreamStatus = function(channels, callback) {
	request(createRequestOptions('https://api.twitch.tv/kraken/streams?limit=100&channel=' + channels.toString()), function(error, response, body) {
		if (!error && response.statusCode === 200) {callback(false, null, JSON.parse(body));}
		else {callback(true, 'connection_error');}
	});
}

// callback: error (true/false), error type, parsed data
exports.getChannelData = function(channel, callback) {
	request(createRequestOptions('https://api.twitch.tv/kraken/channels/' + channel), function(error, response, body) {
		if (!error && response.statusCode === 200) {callback(false, null, JSON.parse(body));}
		else if (!error && response.statusCode === 404) {callback(true, 'channel_not_found');}
		else {callback(true, 'connection_error');}
	});
}

// Used to create the options for the API requests above, which includes the client ID.
// Supplying ver5 as true will use API v5. If the team name is also suppied, the oauth for said team is also added to the header.
function createRequestOptions(apiURL, ver5, team) {
	var options = {
		url: apiURL,
		headers: {
			'Accept': 'application/vnd.twitchtv.v3+json',
			'Client-ID': globalVars.clientID
		}
	};
	
	if (ver5) {options.headers['Accept'] = 'application/vnd.twitchtv.v5+json';}
	if (team) {options.headers['Authorization'] = 'OAuth ' + globalVars.oauthToken[team];}
	
	return options;
}