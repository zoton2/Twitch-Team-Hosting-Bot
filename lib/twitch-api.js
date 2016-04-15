var request = require('request');
var $ = require('cheerio');
var async = require('async');

// callback: error (true/false), error type, parsed data
exports.getTeamLiveChannels = function(team, callback) {
	exports.getTeamChannels(team, function(error, errorType, response) {
		var liveChannels = [];
		var liveChannelsNames = [];
		
		if (!error) {
			for (var i = 0; i < response.length; i++) {
				if (response[i].live) {
					liveChannels.push(response[i]);
					liveChannelsNames.push(response[i].username);
				}
			}
			
			exports.getStreamStatus(liveChannelsNames, function(error, errorType, response) {
				if (!error) {
					for (var i = 0; i < liveChannels.length; i++) {
						liveChannels[i].game = response.streams[i].game;
						liveChannels[i].status = response.streams[i].channel.status;
					}
					
					callback(false, null, liveChannels);
				}
				
				else {callback(error, errorType);}
			});
		}
		
		else {callback(error, errorType);}
	});
}

// callback: error (true/false), error type, parsed data
exports.getTeamChannels = function(team, callback) {
	// Variables to store relevant information.
	var memberObjectList = [];
	var page = 1;
	var totalPages = 1;
	
	// Loop to go through all the pages.
	async.whilst(
		function() {return page < totalPages+1;},
		function(callback) {
			// Makes a request to the relevant page where the team members list is stored.
			request('https://www.twitch.tv/team/' + team.toLowerCase() + '/live_member_list?page=' + page, function(error, response, body) {
				if (!error && response.statusCode == 200) {
					// Check on the first page to see if there is more than one page.
					if (page === 1) {
						var pageLinks = $('.page_links a', body).toArray();
						if (pageLinks.length > 0) {totalPages = parseInt($(pageLinks[pageLinks.length-2]).text());}
					}
					
					// Get the list of members on this page and push their information into the array.
					var memberList = $('#team_member_list .member', body).toArray();
					for (var i = 0; i < memberList.length; i++) {
						memberObjectList.push({
							username: $('.clearfix', memberList[i]).attr('href').substr(1).toLowerCase(),
							display_name: $('.member_name', memberList[i]).text(),
							live: $(memberList[i]).hasClass('live'),
							viewers: parseInt($('.channel_count', memberList[i]).text()) || null
						});
					}
					
					page++;
					callback();
				}
				
				else {callback(true);}
			});
		},
		function(err) {
			if (err) {callback(true, 'connection_error');}
			else {callback(false, null, memberObjectList);}
		}
	);
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
// not currently used by anything but might as well leave it here for now
exports.getChannelData = function(channel, callback) {
	var apiURL = 'https://api.twitch.tv/kraken/channels/' + channel;
	
	request(apiURL, function(error, response, body) {
		if (!error && response.statusCode === 200) {callback(false, null, JSON.parse(body));}
		else if (!error && response.statusCode === 404) {callback(true, 'channel_not_found');}
		else {callback(true, 'connection_error');}
	});
}