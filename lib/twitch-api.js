var request = require('request');
var $ = require('cheerio');
var async = require('async');

// callback: error (true/false), error type, parsed data
exports.getTeamLiveChannels = function(team, callback) {
	// Variables to store relevant information.
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
					for (var i = 0; i < response.length; i++) {
						if (response[i].live) {channels.push(response[i]); channelsNameOnly.push(response[i].username);}
						else {allPages = true; break;}
					}
					
					if (!allPages && page === pageTotal) {allPages = true;}
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
			
			else {
				// This part relies on Twitch returning the online channels in the order we supplied them in.
				// I think it should work like this but will add a check at a later date.
				exports.getStreamStatus(channelsNameOnly, function(error, errorType, response) {
					if (!error) {
						for (var i = 0; i < response.streams.length; i++) {
							if (response.streams[i].channel.name === channelsNameOnly[i]) {
								channels[i].game = response.streams[i].game;
								channels[i].status = response.streams[i].channel.status;
							}
							
							else {channels.splice(i, 1); response.streams.splice(i, 1); i--;}
						}
						
						callback(false, null, channels);
					}
					
					else {callback(true, 'connection_error');}
				});
			}
		}
	);
}

// callback: error (true/false), error type, parsed data
exports.getTeamChannels = function(team, callback) {
	// Variables to store relevant information.
	var channels = [];
	var page = 1;
	var allPages = false;
	
	// Loop to go through all the pages.
	async.whilst(
		function() {return !allPages;},
		function(callback) {
			requestTeamChannelList(team, page, function(error, errorType, response, pageTotal) {
				if (!error) {
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
	request('https://api.twitch.tv/kraken/streams?limit=100&channel=' + channels.toString(), function(error, response, body) {
		if (!error && response.statusCode === 200) {callback(false, null, JSON.parse(body));}
		else {callback(true, 'connection_error');}
	});
}

// not currently used by anything but might as well leave it here for now
// callback: error (true/false), error type, parsed data
exports.getChannelData = function(channel, callback) {
	request('https://api.twitch.tv/kraken/channels/' + channel, function(error, response, body) {
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
					display_name: $('.member_name', channelArray[i]).text(),
					live: $(channelArray[i]).hasClass('live'),
					viewers: parseInt($('.channel_count', channelArray[i]).text()) || null
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