// Referencing packages.
var request = require('request');
var $ = require('cheerio');
var async = require('async');

// Referencing other files.
var globalVars = require('./global-vars');

// callback: error (true/false), error type, parsed data
exports.getTeamChannels = function(team, callback) {
	var channels = [];
	var channelsNameOnly = [];
	var page = 1;
	var allPages = false;
	
	// Loop to go through all the pages.
	async.whilst(
		function() {return !allPages;},
		function(callback) {
			requestTeamChannelList(team, page, function(error, errorType, response, pageTotal) {
				if (!error) {
					// Checks if any of the channels on this page were on the previous pages.
					// If they were, then the process is reset so the list will be accurate.
					for (var i = 0; i < response.length; i++) {
						if (channelsNameOnly.indexOf(response[i].username) >= 0) {
							channels = []; channelsNameOnly = []; page = 1; return callback();
						}
					}
					
					for (var i = 0; i < response.length; i++) {channelsNameOnly.push(response[i].username);}
					channels = channels.concat(response);
					if (page === pageTotal) {allPages = true;}
					else {page++;}
					callback();
				}
				
				else {
					callback(true);
				}
			});
		},
		function(err) {
			if (err) {callback(true, 'connection_error');}
			else {callback(false, null, channels);}
		}
	);
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

// callback: error (true/false), error type, list of channels (as objects) on that page, total number of pages
function requestTeamChannelList(team, page, callback) {
	request('https://www.twitch.tv/team/' + team.toLowerCase() + '/live_member_list?page=' + page, function(error, response, body) {
		if (!error && response.statusCode == 200) {
			var channels = [];
			
			// Get the list of channels on this page and pushes their information into the array.
			var channelArray = $('#team_member_list .member', body).toArray();
			for (var i = 0; i < channelArray.length; i++) {
				channels.push({
					username: $('.clearfix', channelArray[i]).attr('href').substr(1).toLowerCase(),
					displayName: $('.member_name', channelArray[i]).text(),
					live: $(channelArray[i]).hasClass('live')
				});
			}
			
			// Code below checks for number of pages available.
			var totalPages = 1;
			
			// Checks to see if the team actually has multiple pages (else it only has 1).
			if ($('.page_links', body).length > 0) {
				// If the "next page" link is disabled, we are on the last page.
				if ($('.page_links .next_page', body).hasClass('disabled')) {
					totalPages = parseInt($('.page_links .current', body).text());
				}
				
				// Otherwise, find the link to the last page and use that.
				else {
					var pageLinks = $('.page_links a', body).toArray();
					totalPages = parseInt($(pageLinks[pageLinks.length-2]).text());
				}
			}
			
			callback(false, null, channels, totalPages);
		}
		
		else {callback(true, 'connection_error');}
	});
}

// Used to create the options for the API requests above, which includes the client ID.
function createRequestOptions(apiURL) {
	return {
		url: apiURL,
		headers: {
			'Accept': 'application/vnd.twitchtv.v3+json',
			'Client-ID': globalVars.clientID
		}
	}
}