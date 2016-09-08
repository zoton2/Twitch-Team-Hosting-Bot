// STUFF TO IMPROVE:
// listenToChannels doesn't check if the channels actually exist, could be implemented (I don't really need it right now though).

// Referencing packages.
var events = require('events');
var async = require('async');
var _ = require('underscore');

// Referencing other files.
var globalVars = require('./global-vars');
var utils = require('./utils');
var twitchPubSub = require('./twitch-pubsub');
var twitchAPI = require('./twitch-api');
var loggingFuncs = require('./logging');

// Declaring variables.
var listeningChannels = [];
var channelUpdateInterval = {};
var viewCountTimeout = {};

// Set up the event emitter on the relevant variable.
globalVars.streamEvents = new events.EventEmitter();

globalVars.twitchPubSubEvents.on('streamUp', function(channel) {
	addLiveChannel(channel, 0);
	checkIfStillOnline(channel);
});

globalVars.twitchPubSubEvents.on('streamDown', function(channel) {
	removeOfflineChannel(channel);
	clearTimeout(viewCountTimeout[channel]);  // compliments fix below
});

globalVars.twitchPubSubEvents.on('viewCount', function(channel, viewers) {
	if (globalVars.liveStreamsInfo[channel]) {globalVars.liveStreamsInfo[channel].viewers = viewers;}
	
	// Compliments the fix below.
	// I did this once before but removed it because it was broken/not needed.
	// Not sure if it will work correctly, we'll see.
	else {
		addLiveChannel(channel, viewers);
		loggingFuncs.logMessage(null, 'We thought ' + channel + ' was offline when they weren\'t (viewcount).');  // debug
	}
	
	checkIfStillOnline(channel);
});

function checkIfStillOnline(channel) {
	// TEMPORARY(?) BECAUSE TWITCH IS BAD
	// Setup a timeout for if we haven't received a viewcount for 5 minutes.
	// If so we are going to consider the channel as offline for now.
	clearTimeout(viewCountTimeout[channel]);
	viewCountTimeout[channel] = setTimeout(function() {
		twitchAPI.getStreamStatus([channel], function(error, errorType, response) {
			if (!error && response.streams.length === 0) {
				// If they are offline according to the API, removes them as a live channel in the code.
				removeOfflineChannel(channel);
				loggingFuncs.logMessage(null, 'We think ' + channel + ' went offline (viewcount + API).');  // debug
			}
			
			else {
				checkIfStillOnline(channel);
			}
		});
	}, globalVars.recheckLength);
}

// Used to add channels to be kept track of.
// channels should be an array of channels to start listening for information about.
exports.listenToChannels = function(channels, callback) {
	var newChannels = utils.processArray(channels);
	
	for (var i = 0; i < newChannels.length;) {
		// If we are already listening for a channel, remove it from the array to ignore it.
		if (listeningChannels.indexOf(newChannels[i]) >= 0) {newChannels.splice(i, 1);} else {i++;}
	}
	
	twitchPubSub.listenToTopics(processVideoPlaybackTopics(newChannels), function() {
		// Splits up the list of channels (if needed) into groups of 100 for the API requests.
		var groupedChannels = utils.createGroupedArray(newChannels, 100);
		
		var i = 0;
		async.whilst(
			function() {return i < groupedChannels.length;},
			function(callback2) {
				// Queries the Twitch API to see what channels may currently be online.
				twitchAPI.getStreamStatus(groupedChannels[i], function(error, errorType, response) {
					if (!error) {
						var streams = response.streams;
						for (var j = 0; j < streams.length; j++) {
							addLiveChannel(streams[j].channel.name, streams[j].viewers, streams[j].channel);
						}
						
						i++; callback2();
					}
				});
			},
			function(err) {
				// Add new channels to the relevant array.
				listeningChannels = listeningChannels.concat(newChannels);
				
				if (newChannels.length > 0) {
					loggingFuncs.logMessage(null, 'These channels are now being listened to: ' + newChannels.join(', '));
				}
				if (callback) {callback();}
			}
		);
	});
}

// Used to stop keeping track of channels.
// channels should be an array of channels to stop listening for information about.
exports.unlistenToChannels = function(channels, callback) {
	var oldChannels = utils.processArray(channels);
	
	for (var i = 0; i < oldChannels.length;) {
		// If we are not listening for a channel, remove it from the array to ignore it.
		if (listeningChannels.indexOf(oldChannels[i]) < 0) {oldChannels.splice(i, 1);} else {i++;}
	}
	
	twitchPubSub.unlistenToTopics(processVideoPlaybackTopics(oldChannels), function() {
		// For us these channels are now "offline" so do the appropriate stuff.
		for (var i = 0; i < oldChannels.length; i++) {
			removeOfflineChannel(oldChannels[i]);
			clearTimeout(viewCountTimeout[oldChannels[i]]);  // compliments fix above
		}
		
		// Remove old channels from the relevant arrays.
		listeningChannels = _.difference(listeningChannels, oldChannels);
		
		if (oldChannels.length > 0) {
			loggingFuncs.logMessage(null, 'These channels are no longer being listened to: ' + oldChannels.join(', '));
		}
		if (callback) {callback();}
	});
}

// channelData will only exist if the data has been looked up elsewhere and we don't need to do an additional check
function addLiveChannel(channel, viewers, channelData) {
	// Checks to see if we didn't have this channel listed as being online; sometimes Twitch can be glitchy!
	if (!globalVars.liveStreamsInfo[channel]) {
		async.waterfall([
			function(callback) {
				// If the channel data wasn't specified to us, we need to get it at this point.
				if (!channelData) {
					twitchAPI.getChannelData(channel, function(error, errorType, response) {
						if (!error) {channelData = response; callback();}
					});
				} else {callback();}
			}
		], function(err) {
			// Stores the information about the stream we have and emits an event.
			globalVars.liveStreamsInfo[channel] = createStreamInfoObject(channelData, viewers);
			globalVars.streamEvents.emit('streamOnline', channel, globalVars.liveStreamsInfo[channel]);
		});
		
		// Double check to make sure we don't have an interval set up, just to make sure.
		if (!channelUpdateInterval[channel]) {
			channelUpdateInterval[channel] = setInterval(function() {updateChannelDetails(channel)}, globalVars.recheckLength);
		}
	}
}

function removeOfflineChannel(channel) {
	// Checks to see if we had this channel listed as being online; sometimes Twitch can be glitchy!
	if (globalVars.liveStreamsInfo[channel]) {
		globalVars.streamEvents.emit('streamOffline', channel, globalVars.liveStreamsInfo[channel]);
		globalVars.liveStreamsInfo[channel] = undefined;
		clearInterval(channelUpdateInterval[channel]);
		channelUpdateInterval[channel] = undefined;
	}
}

// Used to periodically check a channel's game/title setting (because this is not sent over PubSub yet).
function updateChannelDetails(channel) {
	twitchAPI.getChannelData(channel, function(error, errorType, response) {
		// We do an extra check here because sometimes (rarely?) this can trigger after the channel goes offline.
		if (!error && globalVars.liveStreamsInfo[channel]) {
			var oldChannelDetails = globalVars.liveStreamsInfo[channel];
			var currentChannelDetails = createStreamInfoObject(response, globalVars.liveStreamsInfo[channel].viewers);
			globalVars.liveStreamsInfo[channel] = currentChannelDetails;
			
			// If the title/game have changed, we emit an event.
			if (currentChannelDetails.status !== oldChannelDetails.status || currentChannelDetails.game !== oldChannelDetails.game) {
				globalVars.streamEvents.emit('streamUpdated', channel, currentChannelDetails, oldChannelDetails);
			}
		}
	});
}

// Used to create video-playback topics based on an array of channel names.
function processVideoPlaybackTopics(channels) {
	var topics = [];
	for (var i = 0; i < channels.length; i++) {topics.push('video-playback.'+channels[i]);}
	return topics;
}

// Used to create an object with information about an online stream for use above.
function createStreamInfoObject(channelData, viewers) {
	var info = {
		username: channelData.name,
		displayName: channelData.display_name || channelData.name,
		status: channelData.status,
		game: channelData.game,
		viewers: viewers
	};
	
	return info;
}