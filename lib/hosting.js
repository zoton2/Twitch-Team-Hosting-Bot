// Referencing packages.
var async = require('async');
var _ = require('underscore');
var moment = require('moment');
require('moment-duration-format');

// Referencing other files.
var loggingFuncs = require('./logging');
var globalVars = require('./global-vars');
var twitchAPI = require('./twitch-api');
var randomFuncs = require('./random');
var statsFuncs = require('./statistics');

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
					globalVars.client[team].say(channel, 'We have stopped hosting ' + lastHostedChannel + '.');
					channelsChecked.push(channel);
					
					// Checks if all channels have been checked yet, and removes the listeners if so.
					if (channelsChecked.length === globalVars.channels[team].length) {
						loggingFuncs.logMessage(team, 'Successfully unhosted ' + lastHostedChannel + ' on all applicable channels.');
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
						loggingFuncs.logMessage(team, 'Could not unhost ' + lastHostedChannel + ' from ' + channel + ' (' + msgid + ').');
						channelsChecked.push(channel);
						
						// Checks if all channels have been checked yet, and removes the listeners if so.
						if (channelsChecked.length === globalVars.channels[team].length) {
							loggingFuncs.logMessage(team, 'Successfully unhosted ' + lastHostedChannel + ' on all applicable channels.');
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
	checkIfChannelExistsAndOnline(channel, function(exists, name, game, viewers) {
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
			
			var lengthInMS = (length && length >= 15) ? length*60000 : null;
			var preferredGame = checkIfPlayingPreferredGame(team, game);
			loggingFuncs.logMessage(team, 'A manual host has been triggered for ' + name + (lengthInMS?' with a manual hosting length of '+length+'m':'') + ' (has ' + viewers + ' viewers).');
			if (globalVars.preferredGames[team].length > 0) {loggingFuncs.logMessage(team, name + ' is ' + (preferredGame?'playing a preferred game.':'not playing a preferred game.'));}
			exports.chooseChannel(team, name, lengthInMS, preferredGame);
			message += (message === '') ? 'The hosting bot ' : '';
			message += 'is now attempting to host ' + name + (lengthInMS?' with a manual hosting length of '+exports.formatMS(lengthInMS):'') + '.';
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
			if (!globalVars.teamChannels[team] && !globalVars.isUsingManualChannelList[team] && globalVars.teamLastCheck[team] < moment().unix() - globalVars.teamRecheckLength) {
				// Used to check if the team members have changed or not since the last host (and 1+ hour has passed since the last check).
				recheckTeamMembers(team, function() {callback(null);});
			}
			
			else {callback(null);}
		},
		function(callback) {
			// If a channel hasn't been specified manually, finds one on the team.
			if (!chosenChannel) {
				getOnlineChannels(team, function(onlineChannels) {
					// If the current hosted channel is still online, removes it from the online channels list.
					for (var i = 0; i < onlineChannels.length; i++) {
						if (onlineChannels[i].username === globalVars.currentHostedChannel[team] || onlineChannels[i].username === globalVars.lastHostedChannel[team]) {
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
							chosenChannel = onlineChannels[0].username;
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
							var random = randomFuncs.randomInt(0, channelsToChoose.length);
							chosenChannel = channelsToChoose[random].username;
						}
					}
					
					// No channels online to pick from.
					else {chosenChannel = null;}
					
					callback(null);
				});
			}
			
			else {callback(null);}
		}
	], function(err) {
		if (chosenChannel) {
			// Logs a message for the last hosted channel, if there was one.
			if (globalVars.currentHostedChannel[team]) {
				loggingFuncs.logMessage(team, 'Stopped hosting ' + globalVars.currentHostedChannel[team] + ' (hosted for ' + exports.calculateHostedTime(team) + ').');
			}
			
			clearVariables(team);
			
			// Removes the chosen channel from the channel list if needed.
			var otherTeamChannels = globalVars.channels[team].slice(0);
			if (otherTeamChannels.indexOf(chosenChannel) >= 0) {
				otherTeamChannels.splice(otherTeamChannels.indexOf(chosenChannel), 1);
			}
			
			loggingFuncs.logMessage(team, 'Going to host ' + chosenChannel + '; taking 4 minutes to check what channels are offline before we host on them.');
			
			// This function will not trigger the callback for 4 minutes (see the notes on the function below).
			// During this time the target channel might go offline, but they should be unhosted 10 minutes later if so.
			getOfflineChannels(team, otherTeamChannels, function(offlineChannels) {
				globalVars.currentHostedChannel[team] = chosenChannel;
				globalVars.hostStartTime[team] = moment.utc();
				checkIfOffline(team);
				statsFuncs.incrementChannelStat(team, chosenChannel);
				
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
				loggingFuncs.logMessage(team, 'Started hosting ' + chosenChannel + ' (hosting length: ' + exports.formatMS(refreshLength) + ').');
				
				if (offlineChannels.length > 0) {
					var channelsChecked = [];
					var hostEvent;
					var noticeEvent;
					var totalViewersForHost = 0;
					
					loggingFuncs.logMessage(team, 'Channel(s) offline we will attempt to host on: ' + offlineChannels.join(', '));
					
					// Listens for the host event on all the channels.
					globalVars.client[team].on('hosting', hostEvent = function(channel, target, viewers) {
						// If the host was successful, we print a message.
						if (channelsChecked.indexOf(channel) < 0 && offlineChannels.indexOf(channel) && target.toLowerCase() === chosenChannel.toLowerCase()) {
							globalVars.client[team].say(channel, 'We have started hosting ' + chosenChannel + '.');
							if (!isNaN(parseInt(viewers))) {totalViewersForHost += parseInt(viewers);}
							checkIfChannelFullyHosted(team, channel, chosenChannel, hostEvent, noticeEvent, channelsChecked, offlineChannels, totalViewersForHost);
						}
					});
					
					// Listens for notices on all the channels.
					globalVars.client[team].on('notice', noticeEvent = function(channel, msgid, message) {
						if (channelsChecked.indexOf(channel) < 0 && offlineChannels.indexOf(channel)) {
							// If there is an error hosting the channel, doesn't do anything.
							if (msgid === 'bad_host_rate_exceeded' || msgid === 'no_permission' || msgid === 'bad_host_hosting' || msgid === 'msg_banned' || msgid === 'bad_host_error') {
								loggingFuncs.logMessage(team, 'Could not host ' + chosenChannel + ' on ' + channel + ' (' + msgid + ').');
								checkIfChannelFullyHosted(team, channel, chosenChannel, hostEvent, noticeEvent, channelsChecked, offlineChannels, totalViewersForHost);
							}
						}
					});
					
					// Executes the host command on all the channels.
					var i = 0;
					async.whilst(
						function() {return i < offlineChannels.length;},
						function(callback) {
							globalVars.client[team].host(offlineChannels[i], chosenChannel);
							i++;
							setTimeout(callback, 2000);
						},
						function(err) {}
					);
				}
				
				else {
					loggingFuncs.logMessage(team, 'All channels currently online so ' + chosenChannel + ' has not been hosted anywhere.');
					globalVars.adminCommandsActive[team] = true;
				}
			});
		}
		
		else {
			// Checks again after a while (will continue to host the current channel if one is hosted).
			loggingFuncs.logMessage(team, 'No one to host, will check again every 5 minutes.', true);
			var timeout = setTimeout(function() {if (globalVars.adminCommandsActive[team]) {exports.chooseChannel(team);}}, globalVars.recheckLength);
			globalVars.timeouts[team].push(timeout);
			globalVars.adminCommandsActive[team] = true;
		}
	});
}

// Ran by the above function; put here to stop repeating the code twice. Could be a bit cleaner.
function checkIfChannelFullyHosted(team, channel, chosen, hostEvent, noticeEvent, channelsChecked, offline, viewersForHost) {
	channelsChecked.push(channel);

	// Checks if all channels have been checked yet, and removes the listeners if so.
	if (channelsChecked.length === offline.length) {
		loggingFuncs.logMessage(team, 'Successfully hosted ' + chosen + ' for about ' + viewersForHost + ' viewers on all applicable channels.');
		globalVars.client[team].removeListener('hosting', hostEvent);
		globalVars.client[team].removeListener('notice', noticeEvent);
		
		// If the channel has a "host train" message, prints this in the target channel's chat (replacing the wildcard if needed).
		if (globalVars.hostTrainMessage[team]) {
			var hostTrainMessage = globalVars.hostTrainMessage[team].replace(/{viewers}/g, viewersForHost);
			globalVars.client[team].say(chosen, hostTrainMessage);
		}
		
		globalVars.adminCommandsActive[team] = true;
	}
}

// Gets the online channels for the specific team.
function getOnlineChannels(team, callback) {
	if (!globalVars.teamChannels[team]) {
		twitchAPI.getTeamLiveChannels(team, function(error, errorType, response) {
			var onlineChannels = [];
			
			if (!error) {
				for (var i = 0; i < response.length; i++) {
					// Uses the display name if available.
					var name = response[i].display_name;
					if (!name) {name = response[i].username;}
					
					onlineChannels.push({
						username: name,
						currentGame: response[i].game,
						currentViewers: response[i].viewers
					});
				}
			}
			
			else {
				loggingFuncs.logMessage(team, 'Error accessing the Twitch API for "getTeamLiveChannels".');
			}
			
			callback(onlineChannels);
		});
	}
	
	else {
		twitchAPI.getStreamStatus(globalVars.teamChannels[team], function(error, errorType, response) {
			var onlineChannels = [];
			
			if (!error) {
				for (var i = 0; i < response.streams.length; i++) {
					// Uses the display name if available.
					var name = response.streams[i].channel.display_name;
					if (!name) {name = response.streams[i].channel.name;}
					
					onlineChannels.push({
						username: name,
						currentGame: response.streams[i].game,
						currentViewers: response.streams[i].viewers
					});
				}
			}
			
			callback(onlineChannels);
		});
	}
}

// Gets the offline channels for an array of channels.
// Checks 5 times with a delay of 1 minute because Twitch's API can sometimes return incorrect results.
function getOfflineChannels(team, channels, callback) {
	var allOnlineChannels = [];
	var i = 0;
	async.whilst(
		function() {return i < 5;},
		function(callback) {
			twitchAPI.getStreamStatus(channels, function(error, errorType, response) {
				if (!error) {
					// Put all online channel names into an array.
					var onlineChannels = [];
					for (var j = 0; j < response.streams.length; j++) {onlineChannels.push(response.streams[j].channel.name);}
					
					// Combines the online channels with the last check (if available) and removes duplicates.
					allOnlineChannels = _.union(allOnlineChannels, onlineChannels);
					
					// Only calls back with a delay if this is not the last check.
					if (i < 4) {setTimeout(callback, 60000);}
					else {callback();}
					i++;
				}
				
				// If we get an error, tries again after 20 seconds.
				else {
					loggingFuncs.logMessage(team, 'Couldn\'t access the Twitch API (' + errorType + '), trying again in 20 seconds.');
					setTimeout(callback, 20000);
				}
			});
		},
		function(err) {
			// Checks which channels are offline right now and calls back with them.
			callback(_.difference(channels, allOnlineChannels));
		}
	);
}

// Checks if a channel exists and is online, according to Twitch's API.
// Also returns their name/display name for ease of use.
function checkIfChannelExistsAndOnline(channel, callback) {
	var channels = [channel];
	
	twitchAPI.getStreamStatus(channels, function(error, errorType, response) {
		if (error || response.streams.length === 0) {callback(false);}
		
		else {
			var name = response.streams[0].channel.display_name;
			if (!name) {name = response.streams[0].channel.name;}
			var game = response.streams[0].channel.game;
			var viewers = response.streams[0].viewers;
			callback(true, name, game, viewers);
		}
	});
}

// Used to check if the host target goes offline.
function checkIfOffline(team) {
	var detectedOffline = false;
	
	globalVars.client[team].on('notice', globalVars.offlineNotice[team] = function(channel, msgid, message) {
		// Checks any of the channels we are connected to, to see if our target goes offline.
		if (globalVars.adminCommandsActive[team] && !detectedOffline && msgid === 'host_target_went_offline'
			&& message.toLowerCase().indexOf(globalVars.currentHostedChannel[team].toLowerCase()) === 0) {
			var justHostedChannel = globalVars.currentHostedChannel[team];
			
			loggingFuncs.logMessage(team, 'Stopped hosting ' + globalVars.currentHostedChannel[team] + ' (went offline, hosted for ' + exports.calculateHostedTime(team) + ').');
			detectedOffline = true;
			clearVariables(team);
			globalVars.lastHostedChannel[team] = justHostedChannel;
			exports.chooseChannel(team);
		}
	});
	
	// Sets up a 5 minute interval to check the Twitch API to see if the person we are hosting has gone offline.
	// Sometimes Twitch doesn't supply the notice we check for above, so this is for safety.
	var detectedOfflineFirstCheck = false;
	var timeout = setInterval(function() {
		twitchAPI.getStreamStatus([globalVars.currentHostedChannel[team].toLowerCase()], function(error, errorType, response) {
			if (globalVars.adminCommandsActive[team] && !error && !detectedOffline) {
				if (response.streams.length === 0) {
					if (!detectedOfflineFirstCheck) {detectedOfflineFirstCheck = true;}
					
					// If there is no error and the stream is not reported as online two times in a row, unhost them and move on.
					else {
						var justHostedChannel = globalVars.currentHostedChannel[team];
						
						loggingFuncs.logMessage(team, 'Stopped hosting ' + globalVars.currentHostedChannel[team] + ' (went offline, hosted for ' + exports.calculateHostedTime(team) + ').');
						detectedOffline = true;
						clearVariables(team);
						globalVars.lastHostedChannel[team] = justHostedChannel;
						exports.chooseChannel(team);
					}
				}
				
				else {detectedOfflineFirstCheck = false;}
			}
		});
	}, globalVars.recheckLength);
	globalVars.timeouts[team].push(timeout);
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

// Clears out some global variables for the specified team.
function clearVariables(team) {
	globalVars.currentHostedChannel[team] = null;
	globalVars.lastHostedChannel[team] = null;
	globalVars.hostStartTime[team] = null;
	
	for (var i = 0; i < globalVars.timeouts[team].length; i++) {
		clearTimeout(globalVars.timeouts[team][i]);
		clearInterval(globalVars.timeouts[team][i]);
	}
	
	globalVars.timeouts[team] = [];
	
	if (globalVars.offlineNotice[team]) {
		globalVars.client[team].removeListener('notice', globalVars.offlineNotice[team]);
		globalVars.offlineNotice[team] = null;
	}
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
			var newChannels = _.difference(channelsInThisCheck, globalVars.channels[team]);
			
			// Gets channels that we have already but weren't in this API call.
			var oldChannels = _.difference(globalVars.channels[team], channelsInThisCheck);
			
			// If we have any channels that we need to add/remove.
			if (newChannels.length > 0 || oldChannels.length > 0) {
				// Joins new channels if needed.
				// TODO: We should delay these so we don't flood the server with requests.
				for (var i = 0; i < newChannels.length; i++) {
					globalVars.client[team].join(newChannels[i]);
					loggingFuncs.logMessage(team, 'Channel added to team: ' + newChannels[i]);
				}
				
				// Leaves old channels if needed.
				// TODO: We should delay these so we don't flood the server with requests.
				for (var i = 0; i < oldChannels.length; i++) {
					globalVars.client[team].part(oldChannels[i]);
					loggingFuncs.logMessage(team, 'Channel removed from team: ' + oldChannels[i]);
				}
				
				// Updates the current channels for this team with the array we made.
				globalVars.channels[team] = channelsInThisCheck;
			}
			
			callback();
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