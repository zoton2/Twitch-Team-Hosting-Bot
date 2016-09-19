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
var logging = require('./logging');

// Declaring variables.
var listeningChannels = [];
var channelUpdateInterval = {};
var backupCheckInterval = {};

// Set up the event emitter on the relevant variable.
globalVars.streamEvents = new events.EventEmitter();

twitchPubSub.events.on('streamUp', function(channel) {
	addLiveChannel(channel, 0);
});

twitchPubSub.events.on('streamDown', function(channel) {
	removeOfflineChannel(channel);
});

twitchPubSub.events.on('viewCount', function(channel, viewers) {
	if (globalVars.liveStreamsInfo[channel]) {globalVars.liveStreamsInfo[channel].viewers = viewers;}
	
	// If we saw a channel as offline but they sent a viewcount after, consider them still online.
	else {addLiveChannel(channel, viewers);}
});

// What to do in the case of a PubSub connection going down.
twitchPubSub.events.on('disconnected', function(disConnNum) {
	// Set up an interval so every 1 minute the API is checked for offline/online streams.
	backupCheckInterval[disConnNum] = setInterval(function() {checkTwitchAPIForStreamStatus(twitchPubSub.wsTopics[disConnNum]);}, 60000);
	
	// Checking to see for when the connection comes back up (checking it is the correct connection).
	// If it does, checks the API one last time, clears the interval and removes the listener.
	var connectedEvent; twitchPubSub.events.on('connected', connectedEvent = function(connNum) {
		if (disConnNum === connNum) {
			clearInterval(backupCheckInterval[disConnNum]);
			twitchPubSub.events.removeListener('connected', connectedEvent);
			checkTwitchAPIForStreamStatus(twitchPubSub.wsTopics[disConnNum]);
		}
	});
});

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
				checkTwitchAPIForStreamStatus(groupedChannels[i], function() {i++; callback2();});
			},
			function(err) {
				// Add new channels to the relevant array.
				listeningChannels = listeningChannels.concat(newChannels);
				
				if (newChannels.length > 0) {
					logging.logMessage(null, 'These channels are now being listened to: ' + newChannels.join(', '));
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
		}
		
		// Remove old channels from the relevant arrays.
		listeningChannels = _.difference(listeningChannels, oldChannels);
		
		if (oldChannels.length > 0) {
			logging.logMessage(null, 'These channels are no longer being listened to: ' + oldChannels.join(', '));
		}
		if (callback) {callback();}
	});
}

// Used to set up the check to see if a channel is hosting a channel not on the team.
exports.setUpHostChecking = function(team) {
	var timeouts = {};
	globalVars.client[team].on('hosting', function(channel, target, viewers) {
		channel = channel.replace('#', '');
		
		// Checks if this hosting event is for the channel we are currently hosting (if any).
		if (!globalVars.currentHostedChannel[team] || target.toLowerCase() !== globalVars.currentHostedChannel[team].username) {
			// If they already have a timeout setup, clear it. If not, add them to the list.
			if (timeouts[channel]) {clearTimeout(timeouts[channel]);}
			else {globalVars.channelsToNotHostOn[team].push(channel);}
			logging.logMessage(team, channel + ' is hosting ' + target + ', we will not host on their channel for 25 minutes.');
			
			// Sets up a timeout to remove the channel from the list after 25 minutes.
			timeouts[channel] = setTimeout(function() {
				globalVars.channelsToNotHostOn[team].splice(globalVars.channelsToNotHostOn[team].indexOf(channel), 1);
				timeouts[channel] = undefined;
				logging.logMessage(team, channel + ' can now be hosted on again.');
			}, 1500000);
		}
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

// Queries the Twitch API to see what channels may currently be online/offline.
function checkTwitchAPIForStreamStatus(channels, callback) {
	twitchAPI.getStreamStatus(channels, function(error, errorType, response) {
		if (!error) {
			// Gets details about the currently online streams.
			var streams = response.streams;
			var onlineChannels = [];
			var onlineChannelsDetails = {};
			for (var i = 0; i < streams.length; i++) {
				onlineChannels.push(streams[i].channel.name);
				onlineChannelsDetails[streams[i].channel.name] = {
					viewers: streams[i].viewers,
					channelInfo: streams[i].channel
				};
			}
			
			// If the offline channels were online according to the code, removes them.
			var offlineChannels = _.difference(channels, onlineChannels);
			for (var i = 0; i < offlineChannels.length; i++) {
				if (globalVars.liveStreamsInfo[offlineChannels[i]]) {
					removeOfflineChannel(offlineChannels[i]);
				}
			}
			
			// If the online channels were offline according to the code, adds them.
			for (var i = 0; i < onlineChannels.length; i++) {
				if (!globalVars.liveStreamsInfo[onlineChannels[i]]) {
					var details = onlineChannelsDetails[onlineChannels[i]];
					addLiveChannel(onlineChannels[i], details.viewers, details.channelInfo);
				}
			}
			
			if (callback) {callback();}
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