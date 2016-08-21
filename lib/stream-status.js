// STUFF TO IMPROVE:
// listenToChannels doesn't check if the channels actually exist, could be implemented.

// Referencing packages.
var events = require('events');
var async = require('async');

// Referencing other files.
var globalVars = require('./global-vars');
var utils = require('./utils');
var twitchPubSub = require('./twitch-pubsub');
var twitchAPI = require('./twitch-api');

// Declaring variables.
var listeningChannels = [];
var channelUpdateInterval = {};

// Set up the event emitter on the relevant variable.
globalVars.streamEvents = new events.EventEmitter();

globalVars.twitchPubSubEvents.on('streamUp', function(channel) {
	addLiveChannel(channel, 0);
});

globalVars.twitchPubSubEvents.on('streamDown', function(channel) {
	removeOfflineChannel(channel);
});

globalVars.twitchPubSubEvents.on('viewCount', function(channel, viewers) {
	// If we receive this event but didn't know this channel was live, adds it to the list. If not just updates the viewer count.
	if (!globalVars.liveStreamsInfo[channel]) {addLiveChannel(channel, viewers);}
	else {globalVars.liveStreamsInfo[channel]['viewers'] = viewers;}
	
	//console.log(globalVars.liveStreamsInfo[channel]);
});

// Used to add channels to be kept track of.
// channels should be an array of channels to start listening for information about.
exports.listenToChannels = function(channels, callback) {
	var newChannels = utils.processArray(channels);
	
	for (var i = 0; i < newChannels.length;) {
		// If we are already listening for a channel, remove it from the array to ignore it.
		if (listeningChannels.indexOf(newChannels[i]) >= 0) {newChannels.splice(i, 1);} else {i++;}
	}
	
	// not sure if we need this check but adding it for safety
	if (newChannels.length > 0) {
		twitchPubSub.listenToTopics(processVideoPlaybackTopics(newChannels), function() {
			var groupedChannels = utils.createGroupedArray(newChannels, 100);
			
			var i = 0;
			async.whilst(
				function() {return i < groupedChannels.length;},
				function(callback2) {
					twitchAPI.getStreamStatus(groupedChannels[i], function(error, errorType, response) {
						if (!error) {
							for (var j = 0; j < response.streams.length; j++) {
								addLiveChannel(response.streams[j].channel.name, response.streams[j].viewers, response.streams[j]);
							}
							
							i++; callback2();
						}
					});
				},
				function(err) {
					// Add new channels to the relevant array.
					listeningChannels = listeningChannels.concat(newChannels);
					
					if (callback) {callback();}
				}
			);
		});
	}
	
	else if (callback) {callback();}
}

// Used to stop keeping track of channels.
// channels should be an array of channels to start listening for information about.
exports.unlistenToChannels = function(channels, callback) {
	var oldChannels = utils.processArray(channels);
	
	for (var i = 0; i < oldChannels.length;) {
		// If we are not listening for a channel, remove it from the array to ignore it.
		if (listeningChannels.indexOf(oldChannels[i]) < 0) {oldChannels.splice(i, 1);} else {i++;}
	}
	
	// not sure if we need this check but adding it for safety
	if (newChannels.length > 0) {
		twitchPubSub.unlistenToTopics(processVideoPlaybackTopics(oldChannels), function() {
			// For us this channel is now "offline" so do the appropriate stuff.
			for (var i = 0; i < oldChannels.length; i++) {removeOfflineChannel(oldChannels[i]);}
			
			// Remove old channels from the relevant arrays.
			listeningChannels = _.difference(listeningChannels, oldChannels);
			
			if (callback) {callback();}
		});
	}
	
	else if (callback) {callback();}
}

// streamData will only exist if the data has been looked up elsewhere and we don't need to do an additional check
function addLiveChannel(channel, viewers, streamData) {
	if (!streamData) {
		twitchAPI.getChannelData(channel, function(error, errorType, response) {
			if (!error) {
				globalVars.liveStreamsInfo[channel] = {
					displayName: response['display_name'] || response.name,
					status: response.status,
					game: response.game,
					viewers: viewers
				};
				
				globalVars.streamEvents.emit('streamOnline', channel, globalVars.liveStreamsInfo[channel]);
			}
		});
	}
	
	else {
		globalVars.liveStreamsInfo[channel] = {
			displayName: streamData.channel['display_name'] || streamData.channel.name,
			status: streamData.channel.status,
			game: streamData.channel.game,
			viewers: streamData.viewers
		};
		
		globalVars.streamEvents.emit('streamOnline', channel, globalVars.liveStreamsInfo[channel]);
	}
	
	channelUpdateInterval[channel] = setInterval(function() {updateChannelDetails(channel)}, globalVars.recheckLength);
}

function removeOfflineChannel(channel) {
	globalVars.streamEvents.emit('streamOffline', channel, globalVars.liveStreamsInfo[channel]);
	globalVars.liveStreamsInfo[channel] = null;
	clearInterval(channelUpdateInterval[channel]);
}

function processVideoPlaybackTopics(channels) {
	var topics = [];
	for (var i = 0; i < channels.length; i++) {topics.push('video-playback.'+channels[i]);}
	return topics;
}

function updateChannelDetails(channel) {
	twitchAPI.getChannelData(channel, function(error, errorType, response) {
		if (!error) {
			var currentChannelDetails = {
				displayName: response['display_name'] || response.name,
				status: response.status,
				game: response.game,
				viewers: globalVars.liveStreamsInfo[channel].viewers || 0
			};
			
			if (currentChannelDetails.status !== globalVars.liveStreamsInfo[channel].status
				|| currentChannelDetails.game !== globalVars.liveStreamsInfo[channel].game) {
					globalVars.streamEvents.emit('streamUpdated', channel, globalVars.liveStreamsInfo[channel], currentChannelDetails);
				}
				
			globalVars.liveStreamsInfo[channel] = currentChannelDetails;
		}
	});
}