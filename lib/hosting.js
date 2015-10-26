// Referencing packages.
var async = require('async');
var moment = require('moment');
require('moment-duration-format');

// Referencing other files.
var loggingFuncs = require('./logging');
var globalVars = require('./global-vars');
var twitchAPI = require('./twitch-api');
var randomFuncs = require('./random');
var statsFuncs = require('./statistics');

// Starts the hosting (only will run if hosting is currently off).
exports.turnOnHosting = function(team) {
	if (!globalVars.active[team]) {
		globalVars.active[team] = true;
		exports.chooseChannel(team);
		loggingFuncs.logMessage(team, 'The hosting bot has been turned on.');
		globalVars.client[team].say(globalVars.client[team].getUsername(), 'The hosting bot has been turned on.');
	}
}

// Stops the hosting (only will run if hosting is currently on).
exports.turnOffHosting = function(team) {
	if (globalVars.active[team]) {
		globalVars.active[team] = false;
		
		// Does the unhosting stuff on all the channels, if a channel is currenty hosted.
		if (globalVars.currentHostedChannel[team]) {
			var lastHostedChannel = globalVars.currentHostedChannel[team];
			var channelsChecked = [];
			var unhostEvent;
			var noticeEvent;
			
			// Listens for the unhost event on all the channels.
			globalVars.client[team].on('unhost', unhostEvent = function(channel, viewers) {
				// If the unhost was successful, we print a message.
				if (channelsChecked.indexOf(channel) < 0) {
					globalVars.client[team].say(channel, 'We have stopped hosting ' + lastHostedChannel + '.');
					channelsChecked.push(channel);
					
					// Checks if all channels have been checked yet, and removes the listeners if so.
					if (channelsChecked.length === globalVars.channels[team].length) {
						loggingFuncs.logMessage(team, 'Successfully unhosted ' + lastHostedChannel + ' on all applicable channels.');
						globalVars.client[team].removeListener('unhost', unhostEvent);
						globalVars.client[team].removeListener('notice', noticeEvent);
					}
				}
			});
			
			// Listens for notices on all the channels.
			globalVars.client[team].on('notice', noticeEvent = function(channel, msgid, message) {
				if (channelsChecked.indexOf(channel) < 0) {
					// If no one is being hosted or we don't have editor rights there, doesn't do anything.
					if (msgid === 'not_hosting' || msgid === 'no_permission') {
						channelsChecked.push(channel);
						
						// Checks if all channels have been checked yet, and removes the listeners if so.
						if (channelsChecked.length === globalVars.channels[team].length) {
							loggingFuncs.logMessage(team, 'Successfully unhosted ' + lastHostedChannel + ' on all applicable channels.');
							globalVars.client[team].removeListener('unhost', unhostEvent);
							globalVars.client[team].removeListener('notice', noticeEvent);
						}
					}
				}
			});
			
			// Executes the unhost command on all the channels.
			for (var i = 0; i < globalVars.channels[team].length; i++) {
				globalVars.client[team].unhost(globalVars.channels[team][i]);
			}
		}
		
		clearVariables(team);
		loggingFuncs.logMessage(team, 'The hosting bot has been turned off.');
		globalVars.client[team].say(globalVars.client[team].getUsername(), 'The hosting bot has been turned off.');
	}
}

// Used to host someone manually; they don't even have to be on the team!
exports.manuallyHostChannel = function(team, channel) {
	checkIfChannelExists(channel, function(exists, name) {
		if (!exists) {globalVars.client[team].say(globalVars.client[team].getUsername(), 'That channel doesn\'t exist.');}
		
		else {
			// Turns on the hosting bot if it wasn't on.
			if (!globalVars.active[team]) {
				globalVars.active[team] = true;
				loggingFuncs.logMessage(team, 'The hosting bot has been turned on.');
				globalVars.client[team].say(globalVars.client[team].getUsername(), 'The hosting bot has been turned on.');
			}
			
			exports.chooseChannel(team, name);
		}
	});
}

// Chooses a channel from the team to host and hosts it.
exports.chooseChannel = function(team, channel) {
	var chosenChannel = channel;
	var preferredGame = true;
	
	async.waterfall([
		function(callback) {
			// If a channel hasn't been specified manually, finds one on the team.
			if (!chosenChannel) {
				getOnlineChannels(team, function(onlineChannels) {
					// If the current hosted channel is still online, removes it from the online channels list.
					for (var i = 0; i < onlineChannels.length; i++) {
						if (onlineChannels[i].username === globalVars.currentHostedChannel[team]) {
							onlineChannels.splice(i, 1);
							break;
						}
					}
					
					// If there are channels online to host...
					if (onlineChannels.length > 0) {
						// Only 1 channel online, chooses this by default.
						if (onlineChannels.length === 1) {chosenChannel = onlineChannels[0].username;}
						
						// More than 1...
						else {
							var channelsToChoose = [];
							
							// Gets a list of channels playing a preferred game.
							for (var i = 0; i < onlineChannels.length; i++) {
								for (var j = 0; j < globalVars.preferredGames[team].length; j++) {
									if (onlineChannels[i].currentGame && onlineChannels[i].currentGame.toLowerCase().indexOf(globalVars.preferredGames[team][j].toLowerCase()) >= 0) {
										channelsToChoose.push(onlineChannels[i]);
										break;
									}
								}
							}
							
							// If no channels are playing preferred games, anyone can be hosted.
							if (channelsToChoose.length == 0) {
								if (globalVars.preferredGames[team].length > 0) {preferredGame = false;}
								channelsToChoose = onlineChannels;
							}
							
							// Gets the average viewers for all the channels we can choose.
							var totalViewers = 0;
							for (var i = 0; i < channelsToChoose.length; i++) {totalViewers += channelsToChoose[i].currentViewers;}
							var averageViewers = Math.floor(totalViewers/channelsToChoose.length);
							
							loggingFuncs.logMessage(team, 'Channels online (playing a preferred game): ' + channelsToChoose.length + '.');
							loggingFuncs.logMessage(team, 'Average viewers on those channels: ' + averageViewers + '.');
							
							// Removes channels that have a viewer count higher than the average.
							for (var i = 0; i < channelsToChoose.length; i++) {
								if (channelsToChoose[i].currentViewers > averageViewers) {
									channelsToChoose.splice(i, 1);
									i--;
								}
							}
							
							// Chooses a channel.
							var random = randomFuncs.randomInt(0, channelsToChoose.length);
							chosenChannel = channelsToChoose[random].username;
						}
					}
					
					// No channel online to pick from.
					else {chosenChannel = null;}
					
					callback();
				});
			}
			
			else {callback();}
		}
	], function(err) {
		if (chosenChannel) {
			// Logs a message for the last hosted channel, if there was one.
			if (globalVars.currentHostedChannel[team]) {
				loggingFuncs.logMessage(team, 'Stopped hosting ' + globalVars.currentHostedChannel[team] + ' (hosted for ' + exports.calculateHostedTime(team) + ').');
			}
			
			clearVariables(team);
			globalVars.currentHostedChannel[team] = chosenChannel;
			globalVars.hostStartTime[team] = moment.utc();
			checkIfOffline(team);
			statsFuncs.incrementChannelStat(team, chosenChannel);
			loggingFuncs.logMessage(team, 'Started hosting ' + chosenChannel + '.');
			
			// Changes the host/recheck length depending on if we're hosting a preferred game or not.
			var refreshLength;
			if (preferredGame) {refreshLength = globalVars.hostLength;}
			else {refreshLength = globalVars.nonPreferredGameLength;}
			globalVars.timeouts[team] = setTimeout(function() {exports.chooseChannel(team);}, refreshLength);
			
			getOfflineChannels(globalVars.channels[team], function(offlineChannels) {
				var channelsChecked = [];
				var hostEvent;
				var noticeEvent;
				
				// Listens for the host event on all the channels.
				globalVars.client[team].on('hosting', hostEvent = function(channel, target, viewers) {
					// If the host was successful, we print a message.
					if (channelsChecked.indexOf(channel) < 0) {
						globalVars.client[team].say(channel, 'We have started hosting ' + chosenChannel + '.');
						channelsChecked.push(channel);
						
						// Checks if all channels have been checked yet, and removes the listeners if so.
						if (channelsChecked.length === offlineChannels.length) {
							loggingFuncs.logMessage(team, 'Successfully hosted ' + chosenChannel + ' on all applicable channels.');
							globalVars.client[team].removeListener('hosting', hostEvent);
							globalVars.client[team].removeListener('notice', noticeEvent);
						}
					}
				});
				
				// Listens for notices on all the channels.
				globalVars.client[team].on('notice', noticeEvent = function(channel, msgid, message) {
					if (channelsChecked.indexOf(channel) < 0) {
						// If host rate is exceeded or we don't have editor rights there, doesn't do anything.
						if (msgid === 'bad_host_rate_exceeded' || msgid === 'no_permission') {
							channelsChecked.push(channel);
							
							// Checks if all channels have been checked yet, and removes the listeners if so.
							if (channelsChecked.length === offlineChannels.length) {
								loggingFuncs.logMessage(team, 'Successfully hosted ' + chosenChannel + ' on all applicable channels.');
								globalVars.client[team].removeListener('hosting', hostEvent);
								globalVars.client[team].removeListener('notice', noticeEvent);
							}
						}
					}
				});
				
				// Executes the host command on all the channels.
				for (var i = 0; i < offlineChannels.length; i++) {
					globalVars.client[team].host(offlineChannels[i], chosenChannel);
				}
			});
		}
		
		else {
			// Checks again after a while (will continue to host the current channel if one is hosted).
			loggingFuncs.logMessage(team, 'No one to host, will check again after a delay.');
			globalVars.timeouts[team] = setTimeout(function() {exports.chooseChannel(team);}, globalVars.recheckLength);
		}
	});
}

// Gets the online channels for the specific team.
function getOnlineChannels(team, callback) {
	twitchAPI.getTeamLiveChannels(team, function(error, errorType, response) {
		if (!error) {
			var onlineChannels = [];
			
			for (var i = 0; i < response.channels.length; i++) {
				// Uses the display name if available.
				var name = response.channels[i].channel.display_name;
				if (!name) {name = response.channels[i].channel.name;}
				
				onlineChannels.push({
					username: name,
					currentGame: response.channels[i].channel.meta_game,
					currentViewers: response.channels[i].channel.current_viewers
				});
			}
			
			callback(onlineChannels);
		}
	});
}

// Gets the offline channels for an array of channels.
function getOfflineChannels(channels, callback) {
	twitchAPI.getStreamStatus(channels, function(error, errorType, response) {
		if (!error) {
			var onlineChannels = [];
			var offlineChannels = [];
			
			// Put all online channel names into an array.
			for (var i = 0; i < response.streams.length; i++) {onlineChannels.push(response.streams[i].channel.name);}
			
			// Checks which channels are offline right now.
			for (var i = 0; i < channels.length; i++) {
				if (onlineChannels.indexOf(channels[i].toLowerCase()) < 0) {
					offlineChannels.push(channels[i]);
				}
			}
			
			callback(offlineChannels);
		}
	});
}

// Checks if a channel exists, according to Twitch's API.
// Also returns their name/display name for ease of use.
function checkIfChannelExists(channel, callback) {
	twitchAPI.getChannelData(channel, function(error, errorType, response) {
		if (error) {callback(false);}
		
		else {
			var name = response.display_name;
			if (!name) {name = response.name;}
			callback(true, name);
		}
	});
}

// Used to check if the host target goes offline.
function checkIfOffline(team) {
	var detectedOffline = false;
	
	globalVars.client[team].on('notice', globalVars.offlineNotice[team] = function(channel, msgid, message) {
		// Checks any of the channels we are connected to, to see if our target goes offline.
		if (!detectedOffline && msgid === 'host_target_went_offline'
			&& message.toLowerCase().indexOf(globalVars.currentHostedChannel[team].toLowerCase()) === 0) {
			loggingFuncs.logMessage(team, 'Stopped hosting ' + globalVars.currentHostedChannel[team] + ' (went offline, hosted for ' + exports.calculateHostedTime(team) + ').');
			detectedOffline = true;
			clearVariables(team);			
			exports.chooseChannel(team);
		}
	});
}

// Clears out some global variables for the specified team.
function clearVariables(team) {
	globalVars.currentHostedChannel[team] = null;
	globalVars.hostStartTime[team] = null;
	clearTimeout(globalVars.timeouts[team]);
	
	if (globalVars.offlineNotice[team]) {
		globalVars.client[team].removeListener('notice', globalVars.offlineNotice[team]);
		globalVars.offlineNotice[team] = null;
	}
}

// Used to calculate the time the current hosted channel for the team has been hosted for.
exports.calculateHostedTime = function(team) {
	// If hosted time is null, returns a 0 instead (although this shouldn't happen!).
	if (!globalVars.hostStartTime[team]) {return '0s';}
	
	var hostedTimeInSecs = moment.utc().diff(globalVars.hostStartTime[team], 'seconds');
	var hostedTime = moment.duration(hostedTimeInSecs, 'seconds');
	hostedTime = hostedTime.format('h:mm:ss');
	if (hostedTimeInSecs < 60) {return hostedTime + 's';}
	else {return hostedTime;}
}