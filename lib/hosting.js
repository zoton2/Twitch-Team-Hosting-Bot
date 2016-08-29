// Referencing packages.
var async = require('async');
var _ = require('underscore');
var moment = require('moment');
require('moment-duration-format');

// Referencing other files.
var loggingFuncs = require('./logging');
var globalVars = require('./global-vars');
var twitchAPI = require('./twitch-api');
var statsFuncs = require('./statistics');
var streamStatus = require('./stream-status');
var utils = require('./utils');

// Declaring variables.
var monitoringForOnlineChannels = {};

// Starts the hosting (only will run if hosting is currently off).
exports.turnOnHosting = function(team, callback) {
	if (!globalVars.active[team]) {
		globalVars.active[team] = true;
		exports.chooseChannel(team);
		loggingFuncs.logMessage(team, 'The hosting bot has been turned on.');
		callback(false, 'The hosting bot has been turned on.');
	}
	
	else {callback(true);}
}

// Stops the hosting (only will run if hosting is currently on).
// TODO: Make it only unhost if the channel is hosting the person we want to unhost.
exports.turnOffHosting = function(team, callback) {
	if (globalVars.active[team]) {
		globalVars.adminCommandsActive[team] = false;
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
					globalVars.client[team].say(channel, 'We have stopped hosting ' + lastHostedChannel.displayName + '.');
					channelsChecked.push(channel);
					
					// Checks if all channels have been checked yet, and removes the listeners if so.
					if (channelsChecked.length === globalVars.channels[team].length) {
						loggingFuncs.logMessage(team, 'Successfully unhosted ' + lastHostedChannel.displayName + ' on all applicable channels.');
						globalVars.client[team].removeListener('unhost', unhostEvent);
						globalVars.client[team].removeListener('notice', noticeEvent);
						globalVars.adminCommandsActive[team] = true;
					}
				}
			});
			
			// Listens for notices on all the channels.
			globalVars.client[team].on('notice', noticeEvent = function(channel, msgid, message) {
				if (channelsChecked.indexOf(channel) < 0) {
					// If no one is being hosted or we don't have editor rights there, doesn't do anything.
					if (msgid === 'not_hosting' || msgid === 'no_permission' || msgid === 'msg_banned' || msgid === 'bad_host_error') {
						loggingFuncs.logMessage(team, 'Could not unhost ' + lastHostedChannel.displayName + ' from ' + channel + ' (' + msgid + ').');
						channelsChecked.push(channel);
						
						// Checks if all channels have been checked yet, and removes the listeners if so.
						if (channelsChecked.length === globalVars.channels[team].length) {
							loggingFuncs.logMessage(team, 'Successfully unhosted ' + lastHostedChannel.displayName + ' on all applicable channels.');
							globalVars.client[team].removeListener('unhost', unhostEvent);
							globalVars.client[team].removeListener('notice', noticeEvent);
							globalVars.adminCommandsActive[team] = true;
						}
					}
				}
			});
			
			// Executes the unhost command on all the channels.
			var i = 0;
			async.whilst(
				function() {return i < globalVars.channels[team].length;},
				function(callback) {
					globalVars.client[team].unhost(globalVars.channels[team][i]);
					i++;
					setTimeout(callback, 2000);
				},
				function(err) {}
			);
		}
		
		else {globalVars.adminCommandsActive[team] = true;}
		
		clearVariables(team);
		loggingFuncs.logMessage(team, 'The hosting bot has been turned off.');
		callback(false, 'The hosting bot has been turned off.');
	}
	
	else {callback(true);}
}

// Used to host someone manually; they don't even have to be on the team!
exports.manuallyHostChannel = function(team, channel, length, callback) {
	checkIfChannelExistsAndOnline(channel, function(exists, username, displayName, game, viewers) {
		if (!exists) {callback(false, 'That channel doesn\'t exist or is offline.');}
		
		else {
			globalVars.adminCommandsActive[team] = false;
			var message = '';
			
			// Turns on the hosting bot if it wasn't on.
			if (!globalVars.active[team]) {
				globalVars.active[team] = true;
				loggingFuncs.logMessage(team, 'The hosting bot has been turned on.');
				message = 'The hosting bot has been turned on and ';
			}
			
			// If the channel is not on any team, sets up listening for them temporarily.
			// This is needed so we can identify when they go offline.
			if (!isChannelOnAnyTeam(username)) {streamStatus.listenToChannels([username]);}
			
			var lengthInMS = (length && length >= 15) ? length*60000 : null;
			var preferredGame = checkIfPlayingPreferredGame(team, game);
			loggingFuncs.logMessage(team, 'A manual host has been triggered for ' + displayName + (lengthInMS?' with a manual hosting length of '+length+'m':'') + ' (has ' + viewers + ' viewers).');
			if (globalVars.preferredGames[team].length > 0) {loggingFuncs.logMessage(team, displayName + ' is ' + (preferredGame?'playing a preferred game.':'not playing a preferred game.'));}
			exports.chooseChannel(team, {username: username, displayName: displayName}, lengthInMS, preferredGame);
			message += (message === '') ? 'The hosting bot ' : '';
			message += 'is now attempting to host ' + displayName + (lengthInMS?' with a manual hosting length of '+exports.formatMS(lengthInMS):'') + '.';
			callback(false, message);
		}
	});
}

// Chooses a channel from the team to host and hosts it.
exports.chooseChannel = function(team, channel, manualHostLength, preferredGame) {
	globalVars.adminCommandsActive[team] = false;
	var chosenChannel = channel;
	preferredGame = (globalVars.preferredGames[team].length > 0 ? (preferredGame == null ? true : preferredGame) : true);
	
	async.waterfall([
		function(callback) {
			if (!globalVars.teamChannels[team] && globalVars.teamLastCheck[team] < moment().unix() - globalVars.teamRecheckLength) {
				// Used to check if the team members have changed or not since the last host (and 1+ hour has passed since the last check).
				recheckTeamMembers(team, callback);
			}
			
			else {callback();}
		},
		function(callback) {
			// If a channel hasn't been specified manually, finds one on the team.
			if (!chosenChannel) {
				var onlineChannels = getOnlineChannels(team);
				
				// If the current hosted channel is still online, removes it from the online channels list.
				for (var i = 0; i < onlineChannels.length; i++) {
					if ((globalVars.currentHostedChannel[team] && onlineChannels[i].username === globalVars.currentHostedChannel[team].username)
						|| (globalVars.lastHostedChannel[team] && onlineChannels[i].username === globalVars.lastHostedChannel[team].username)) {
						globalVars.lastHostedChannel[team] = null;
						onlineChannels.splice(i, 1);
						break;
					}
				}
				
				// If there are channels online to host...
				if (onlineChannels.length > 0) {
					// Only 1 channel online, chooses this by default.
					if (onlineChannels.length === 1) {
						// Checks if this lone channel is playing a preffered game or not.
						if (globalVars.preferredGames[team].length > 0 && !checkIfPlayingPreferredGame(team, onlineChannels[0].currentGame)) {preferredGame = false;}
						chosenChannel = {username: onlineChannels[0].username, displayName: onlineChannels[0].displayName};
						loggingFuncs.logMessage(team, 'Only 1 channel online' + (globalVars.preferredGames[team].length>0?(preferredGame?' (playing a preferred game)':' (not playing a preferred game)'):'') + ', will host them (has ' + onlineChannels[0].currentViewers + ' viewers).');
					}
					
					// More than 1...
					else {
						var channelsToChoose = [];
						
						// Gets a list of channels playing a preferred game.
						for (var i = 0; i < onlineChannels.length; i++) {
							if (checkIfPlayingPreferredGame(team, onlineChannels[i].currentGame)) {
								channelsToChoose.push(onlineChannels[i]);
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
						
						loggingFuncs.logMessage(team, 'Channels online' + (globalVars.preferredGames[team].length>0?(preferredGame?' (playing a preferred game)':' (not playing a preferred game)'):'') + ': ' + channelsToChoose.length + '.');
						loggingFuncs.logMessage(team, 'Average viewers on those channels: ' + averageViewers + '.');
						loggingFuncs.logMessage(team, 'Total viewers on those channels: ' + totalViewers + '.');
						
						// Removes channels that have a viewer count higher than the average.
						for (var i = 0; i < channelsToChoose.length;) {
							if (channelsToChoose[i].currentViewers > averageViewers) {channelsToChoose.splice(i, 1);}
							else {i++;}
						}
						
						// Chooses a channel.
						var random = utils.randomInt(0, channelsToChoose.length);
						chosenChannel = {username: channelsToChoose[random].username, displayName: channelsToChoose[random].displayName};
					}
				}
				
				// No channels online to pick from.
				else {chosenChannel = null;}
				
				callback();
			}
			
			else {callback();}
		}
	], function(err) {
		if (chosenChannel) {
			// Logs a message for the last hosted channel, if there was one.
			if (globalVars.currentHostedChannel[team]) {
				loggingFuncs.logMessage(team, 'Stopped hosting ' + globalVars.currentHostedChannel[team].displayName + ' (hosted for ' + exports.calculateHostedTime(team) + ').');
			}
			
			clearVariables(team);
			
			// Removes the chosen channel from the channel list if needed.
			var otherTeamChannels = globalVars.channels[team].slice(0);
			if (otherTeamChannels.indexOf(chosenChannel.username) >= 0) {
				otherTeamChannels.splice(otherTeamChannels.indexOf(chosenChannel.username), 1);
			}
			
			var offlineChannels = getOfflineChannels(team, otherTeamChannels);
			globalVars.currentHostedChannel[team] = chosenChannel;
			globalVars.hostStartTime[team] = moment.utc();
			checkIfOffline(team);
			statsFuncs.incrementChannelStat(team, chosenChannel.username);  // might be buggy because of case sensitivity?
			
			// Changes the host/recheck length depending on if we're hosting a preferred game or not.
			var refreshLength;
			if (!manualHostLength) {
				if (preferredGame) {refreshLength = globalVars.preferredGameHostLength[team];}
				else {refreshLength = globalVars.nonPreferredGameHostLength[team];}
			}
			else {refreshLength = manualHostLength;}
			var timeout = setTimeout(function() {if (globalVars.adminCommandsActive[team]) {exports.chooseChannel(team);}}, refreshLength);
			globalVars.timeouts[team].push(timeout);
			globalVars.currentHostRefreshLength[team] = refreshLength;
			loggingFuncs.logMessage(team, 'Started hosting ' + chosenChannel.displayName + ' (hosting length: ' + exports.formatMS(refreshLength) + ').');
			
			if (offlineChannels.length > 0) {
				var channelsChecked = [];
				var hostEvent;
				var noticeEvent;
				var totalViewersForHost = 0;
				
				loggingFuncs.logMessage(team, 'Channel(s) offline we will attempt to host on: ' + offlineChannels.join(', '));
				
				// Listens for the host event on all the channels.
				globalVars.client[team].on('hosting', hostEvent = function(channel, target, viewers) {
					// If the host was successful, we print a message.
					if (channelsChecked.indexOf(channel) < 0 && offlineChannels.indexOf(channel) && target.toLowerCase() === chosenChannel.username) {
						globalVars.client[team].say(channel, 'We have started hosting ' + chosenChannel.displayName + '.');
						if (!isNaN(parseInt(viewers))) {totalViewersForHost += parseInt(viewers);}
						checkIfChannelFullyHosted(team, channel, chosenChannel, hostEvent, noticeEvent, channelsChecked, offlineChannels, totalViewersForHost);
					}
				});
				
				// Listens for notices on all the channels.
				globalVars.client[team].on('notice', noticeEvent = function(channel, msgid, message) {
					if (channelsChecked.indexOf(channel) < 0 && offlineChannels.indexOf(channel)) {
						// If there is an error hosting the channel, doesn't do anything.
						if (msgid === 'bad_host_rate_exceeded' || msgid === 'no_permission' || msgid === 'bad_host_hosting' || msgid === 'msg_banned' || msgid === 'bad_host_error') {
							loggingFuncs.logMessage(team, 'Could not host ' + chosenChannel.displayName + ' on ' + channel + ' (' + msgid + ').');
							checkIfChannelFullyHosted(team, channel, chosenChannel, hostEvent, noticeEvent, channelsChecked, offlineChannels, totalViewersForHost);
						}
					}
				});
				
				// Executes the host command on all the channels.
				var i = 0;
				async.whilst(
					function() {return i < offlineChannels.length;},
					function(callback) {
						globalVars.client[team].host(offlineChannels[i], chosenChannel.username);
						i++;
						setTimeout(callback, 2000);
					}
				);
			}
			
			else {
				loggingFuncs.logMessage(team, 'All channels currently online so ' + chosenChannel.displayName + ' has not been hosted anywhere.');
				globalVars.adminCommandsActive[team] = true;
			}
		}
		
		else {
			// Checks again after a while (will continue to host the current channel if one is hosted).
			loggingFuncs.logMessage(team, 'No one to host, will monitor for channels to go live.', true);
			if (!monitoringForOnlineChannels[team]) {monitorForOnlineChannels(team);}
			globalVars.adminCommandsActive[team] = true;
		}
	});
}

// Ran by the above function; put here to stop repeating the code twice. Could be a bit cleaner.
function checkIfChannelFullyHosted(team, channel, chosen, hostEvent, noticeEvent, channelsChecked, offline, viewersForHost) {
	channelsChecked.push(channel);

	// Checks if all channels have been checked yet, and removes the listeners if so.
	if (channelsChecked.length === offline.length) {
		loggingFuncs.logMessage(team, 'Successfully hosted ' + chosen.displayName + ' for about ' + viewersForHost + ' viewers on all applicable channels.');
		globalVars.client[team].removeListener('hosting', hostEvent);
		globalVars.client[team].removeListener('notice', noticeEvent);
		
		// If the channel has a "host train" message, prints this in the target channel's chat (replacing the wildcard if needed).
		if (globalVars.hostTrainMessage[team]) {
			var hostTrainMessage = globalVars.hostTrainMessage[team].replace(/{viewers}/g, viewersForHost);
			globalVars.client[team].say(chosen.username, hostTrainMessage);
		}
		
		globalVars.adminCommandsActive[team] = true;
	}
}

function monitorForOnlineChannels(team) {
	monitoringForOnlineChannels[team] = true;
	
	var onlineNotice; globalVars.streamEvents.on('streamOnline', onlineNotice = function(channel, streamInfo) {
		if (globalVars.allTeamChannels[team].indexOf(channel) >= 0) {
			globalVars.streamEvents.removeListener('streamOnline', onlineNotice);
			monitoringForOnlineChannels[team] = false;
			if (globalVars.adminCommandsActive[team]) {exports.chooseChannel(team);}
		}
	});
}

// Gets the online channels for the specific team.
function getOnlineChannels(team) {
	var onlineChannels = [];
	
	if (!globalVars.teamChannels[team]) {
		var channels = globalVars.allTeamChannels[team];
		
		for (var i = 0; i < channels.length; i++) {
			if (globalVars.liveStreamsInfo[channels[i]]) {
				onlineChannels.push({
					username: globalVars.liveStreamsInfo[channels[i]].username,
					displayName: globalVars.liveStreamsInfo[channels[i]].displayName,
					currentGame: globalVars.liveStreamsInfo[channels[i]].game,
					currentViewers: globalVars.liveStreamsInfo[channels[i]].viewers
				});
			}
		}
	}
	
	else {
		for (var i = 0; i < globalVars.teamChannels[team].length; i++) {
			if (globalVars.liveStreamsInfo[globalVars.teamChannels[team][i]]) {
				onlineChannels.push({
					username: globalVars.liveStreamsInfo[globalVars.teamChannels[team][i]].username,
					displayName: globalVars.liveStreamsInfo[globalVars.teamChannels[team][i]].displayName,
					currentGame: globalVars.liveStreamsInfo[globalVars.teamChannels[team][i]].game,
					currentViewers: globalVars.liveStreamsInfo[globalVars.teamChannels[team][i]].viewers
				});
			}
		}
	}
	
	return onlineChannels;
}

// Gets the offline channels for an array of channels.
function getOfflineChannels(team, channels) {
	var allOfflineChannels = [];
	
	for (var i = 0; i < channels.length; i++) {
		if (!globalVars.liveStreamsInfo[channels[i]]) {allOfflineChannels.push(channels[i]);}
	}
	
	return allOfflineChannels;
}

// Checks if a channel exists and is online, according to Twitch's API.
// Also returns their name/display name for ease of use.
function checkIfChannelExistsAndOnline(channel, callback) {
	var channels = [channel];
	
	twitchAPI.getStreamStatus(channels, function(error, errorType, response) {
		if (error || response.streams.length === 0) {callback(false);}
		
		else {
			var username = response.streams[0].channel.name;
			var displayName = response.streams[0].channel.display_name;
			if (!displayName) {name = response.streams[0].channel.name;}
			var game = response.streams[0].channel.game;
			var viewers = response.streams[0].viewers;
			callback(true, username, displayName, game, viewers);
		}
	});
}

// Used to check if the host target goes offline.
function checkIfOffline(team) {
	// Set up a listener to check for channels going offline.
	globalVars.streamEvents.on('streamOffline', globalVars.offlineNotice[team] = function(channel, streamInfo) {
		// If the channel that has gone offline is the one we are currently hosting...
		if (globalVars.adminCommandsActive[team] && channel === globalVars.currentHostedChannel[team].username) {
			// Set up a timeout to give the channel a 5 minute grace period to come back online (see below).
			// If it does not come back online, this code will run to unhost them.
			var timeout = setTimeout(function() {
				var justHostedChannel = globalVars.currentHostedChannel[team];
				loggingFuncs.logMessage(team, 'Stopped hosting ' + globalVars.currentHostedChannel[team].displayName + ' (went offline, hosted for ' + exports.calculateHostedTime(team) + ').');
				clearVariables(team);
				globalVars.lastHostedChannel[team] = justHostedChannel;
				if (!monitoringForOnlineChannels[team]) {exports.chooseChannel(team);}
			}, globalVars.recheckLength);
			globalVars.timeouts[team].push(timeout);
			
			// Set up a listener to check for channels coming back online.
			globalVars.streamEvents.on('streamOnline', globalVars.onlineNotice[team] = function(channel_, streamInfo_) {
				// If this channel comes back online, don't unhost them and keep an eye on them for longer.
				if (globalVars.adminCommandsActive[team] && channel_ === globalVars.currentHostedChannel[team].username) {
					globalVars.streamEvents.removeListener('streamOnline', globalVars.onlineNotice[team]);
					clearTimeout(timeout);
				}
			});
		}
	});
}

// Checks if the game name passed to it is a preferred game (for that team) or not.
// If the team has no preffered games, this will always return false.
function checkIfPlayingPreferredGame(team, game) {
	// Loops through all the preferred games to check them.
	for (var i = 0; i < globalVars.preferredGames[team].length; i++) {
		if (game && game.toLowerCase().indexOf(globalVars.preferredGames[team][i].toLowerCase()) >= 0) {
			return true;
		}
	}
	
	// If we get here then the channel is not playing a preferred game.
	return false;
}

// Used to check if a specified channel is on any team the bot is set up for.
function isChannelOnAnyTeam(channel) {
	// Loops through all the teams and checks if the channel is in their array.
	for (var team in globalVars.allTeamChannels) {
		if (globalVars.allTeamChannels.hasOwnProperty(team)) {
			if (globalVars.allTeamChannels[team].indexOf(channel) >= 0) {
				return true;
			}
		}
	}
	
	// If we get here, the channel isn't on any team.
	return false;
}

// Clears out some global variables for the specified team.
function clearVariables(team) {
	// If the channel we are currently hosting is not on any team (if someone is being hosted), unlistens to them.
	if (globalVars.currentHostedChannel[team] && !isChannelOnAnyTeam(globalVars.currentHostedChannel[team].username)) {
		streamStatus.unlistenToChannels([globalVars.currentHostedChannel[team].username]);
	}
	
	globalVars.currentHostedChannel[team] = null;
	globalVars.lastHostedChannel[team] = null;
	globalVars.hostStartTime[team] = null;
	
	for (var i = 0; i < globalVars.timeouts[team].length; i++) {
		clearTimeout(globalVars.timeouts[team][i]);
		clearInterval(globalVars.timeouts[team][i]);
	}
	
	globalVars.timeouts[team] = [];
	if (globalVars.offlineNotice[team]) {globalVars.streamEvents.removeListener('streamOffline', globalVars.offlineNotice[team]);}
	if (globalVars.onlineNotice[team]) {globalVars.streamEvents.removeListener('streamOnline', globalVars.onlineNotice[team]);}
}

// Used to recheck what members are on the team before it attempts to host on them,
// for example if someone has been added or removed from the team.
// If the API call errors out, then nothing is changed.
function recheckTeamMembers(team, callback) {
	var channelsInThisCheck = [];
	
	twitchAPI.getTeamChannels(team, function(error, errorType, response) {
		if (!error) {
			globalVars.teamLastCheck[team] = moment().unix();
			
			// Compiles an array of channels that are, according this this API call, currently in the team.
			for (var i = 0; i < response.length; i++) {channelsInThisCheck.push(response[i].username);}
			
			// Gets channels that were in this API call but we don't have already.
			var newChannels = _.difference(channelsInThisCheck, globalVars.allTeamChannels[team]);
			
			// Gets channels that we have already but weren't in this API call.
			var oldChannels = _.difference(globalVars.allTeamChannels[team], channelsInThisCheck);
			
			// If we have any channels that we need to add/remove.
			if (newChannels.length > 0 || oldChannels.length > 0) {
				async.waterfall([
					function(callback2) {
						if (newChannels.length > 0) {streamStatus.listenToChannels(newChannels, callback2);}
						else {callback2();}
					},
					function(callback2) {
						if (oldChannels.length > 0) {streamStatus.unlistenToChannels(oldChannels, callback2);}
						else {callback2();}
					}
				], function(err) {
					// Joins new channels if needed.
					// TODO: We should delay these so we don't flood the server with requests.
					for (var i = 0; i < newChannels.length; i++) {
						if (!globalVars.isUsingManualChannelList[team]) {globalVars.client[team].join(newChannels[i]);}
						loggingFuncs.logMessage(team, 'Channel added to team: ' + newChannels[i]);
					}
					
					// Leaves old channels if needed.
					// TODO: We should delay these so we don't flood the server with requests.
					for (var i = 0; i < oldChannels.length; i++) {
						if (!globalVars.isUsingManualChannelList[team]) {globalVars.client[team].part(oldChannels[i]);}
						loggingFuncs.logMessage(team, 'Channel removed from team: ' + oldChannels[i]);
					}
					
					// Updates the current channels for this team with the array we made.
					if (!globalVars.isUsingManualChannelList[team]) {globalVars.channels[team] = channelsInThisCheck;}
					globalVars.allTeamChannels[team] = channelsInThisCheck;
					
					callback();
				});
			}
			
			else {callback();}
		}
		
		else {callback();}
	});
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

// Coverts a time in milliseconds to a more readable format.
exports.formatMS = function(ms) {
	var duration = moment.duration(ms);
	return duration.format('h:mm:ss');
}