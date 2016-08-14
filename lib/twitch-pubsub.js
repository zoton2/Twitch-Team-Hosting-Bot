// STUFF TO IMPROVE:
// Add jitter.
// Make it back off if it fails to reconnect.
// Make it so if the connection count could be reduced when stuff is removed, do so by moving topics to other connections.
// The wsOpen variables (inside the object) are currently not used for any checks, not sure if needed.
// Twitch can kick you off if you have over 10 connections (apparently?), maybe issue a warning somehow.
// Warn if a user calls setUp after it has already been called once?
// Make more callbacks optional.
// Add more events for things like connecting and disconnecting?
// Check if a connection has 0 topics being listened and remove it/move stuff around.
// Probably a lot more stuff.

// Referencing packages.
var WebSocket = require('ws');
var randomstring = require('randomstring');
var events = require('events');
var async = require('async');
var _ = require('underscore');

// Referencing other files.
var globalVars = require('./global-vars');
var utils = require('./utils');

// Declaring variables.
var address = 'wss://pubsub-edge.twitch.tv/v1';
var ws = {};
var wsTopics = [];
var pingInterval = {};
var wsOpen = {};
var connectionCount = 0;
var topicLimit = 49;

// Used to set up the WebSocket(s) when the program starts up. Calls back when done.
// topics should be an array of topics to listen to from startup.
// You could provide no topics, but the connection kicks you off anyway, so no point.
exports.setUp = function(topics, callback) {
	// Set up the event emitter on the relevant variable.
	globalVars.twitchPubSubEvents = new events.EventEmitter();
	
	// Remove duplicates (just in case somehow something is added twice).
	var newTopics = processTopics(topics);
	
	// Triggers a fuction below; see that for more information.
	splitUpTopicsInitNewConnections(topics, callback);
}

// Used to listen to topics that we aren't already listening for (this is checked).
// topics should be an array of new topics to listen to.
exports.listenToTopics = function(topics, callback) {
	// Remove duplicates (just in case somehow something is added twice).
	var newTopics = processTopics(topics);
	
	var connToListen = []; var groupedTopics = {};
	
	for (var i = 0; i < newTopics.length;) {
		// If we are already listening for a topic, remove it from the array to ignore it.
		if (findLocationOfTopic(newTopics[i]) >= 0) {newTopics.splice(i, 1);} else {i++;}
	}
	
	for (var i = 0; i < connectionCount; i++) {
		// Checks if this connection has any free slots.
		if (wsTopics[i].length < topicLimit) {
			// Sets up new topics to be added to that connection.
			connToListen.push(i);
			groupedTopics[i] = newTopics.slice(0, topicLimit-wsTopics[i].length);
			newTopics.splice(0, topicLimit-wsTopics[i].length);
		}
		
		// If there are no new topics to be added, breaks the loop.
		if (newTopics.length === 0) {break;}
	}
	
	// Loops through the grouped topics and sends messages to the relevant connections.
	var i = 0;
	async.whilst(
		function() {return i < connToListen.length;},
		function(callback2) {
			var listenMessage = {
				type: 'LISTEN',
				data: {
					topics: groupedTopics[connToListen[i]]
				}
			};
			
			sendMessage(connToListen[i], listenMessage, false, function(message) {
				// Adds listened topics to the main topics array.
				wsTopics[connToListen[i]] = wsTopics[connToListen[i]].concat(groupedTopics[connToListen[i]]);
				i++; callback2();
			});
		},
		function(err) {
			// If all old connections have been checked and there are still topics to listen to, sets up new connections.
			if (newTopics.length > 0) {splitUpTopicsInitNewConnections(newTopics, callback);} else {callback();}
		}
	);
}

// Used to unlisten from topics that we may already be listening for (this is checked).
// topics should be an array of topics to unlisten to.
exports.unlistenToTopics = function(topics, callback) {
	// Remove duplicates (just in case somehow something is added twice).
	var oldTopics = processTopics(topics);
	
	var connToUnlisten = []; var groupedTopics = {};
	
	for (var i = 0; i < oldTopics.length;) {
		var topicLocation = findLocationOfTopic(oldTopics[i]);
		
		// If we are not listening for a topic, remove it from the array to ignore it.
		if (topicLocation < 0) {oldTopics.splice(i, 1);}
		else {
			// If the topic is in a location we haven't seen before, sets that up.
			if (connToUnlisten.indexOf(topicLocation) < 0) {
				connToUnlisten.push(topicLocation);
				groupedTopics[topicLocation] = [];
			}
			
			// Adds the topic to the correct group.
			groupedTopics[topicLocation].push(oldTopics[i]);
			i++;
		}
	}
	
	// Loops through the grouped topics and sends messages to the relevant connections.
	var i = 0;
	async.whilst(
		function() {return i < connToUnlisten.length;},
		function(callback2) {
			var unlistenMessage = {
				type: 'UNLISTEN',
				data: {
					topics: groupedTopics[connToUnlisten[i]]
				}
			};
			
			sendMessage(connToUnlisten[i], unlistenMessage, false, function(message) {
				// Removes unlistened topics from the main topics array.
				wsTopics[connToUnlisten[i]] = _.difference(wsTopics[connToUnlisten[i]], groupedTopics[connToUnlisten[i]]);
				i++; callback2();
			});
		},
		function(err) {callback();}
	);
}

// Used to create new connections with an array of topics when needed. Could do with a better name!
function splitUpTopicsInitNewConnections(topics, callback) {
	// Split up the topics into chunks of 49 (the limit) if needed.
	var groupedTopics = utils.createGroupedArray(topics, topicLimit);
	
	// Loops through the groups just made and makes connections for all of them.
	var i = 0;
	async.whilst(
		function() {return i < groupedTopics.length;},
		function(callback2) {
			createNewConnection(groupedTopics[i], function() {i++; callback2();});
		},
		function(err) {callback();}
	);
}

// Used to create a new connection when needed.
function createNewConnection(topics, callback) {
	wsOpen[connectionCount] = false;
	wsTopics.push(topics.slice(0));
	
	initializeConnection(connectionCount, function() {
		wsOpen[connectionCount] = true;
		connectionCount++;
		callback();
	});
}

// Used to connect to the WebSocket, either when we need a new one or an older one needs to reconnect.
function initializeConnection(connectionNumber, callback) {
	ws[connectionNumber] = new WebSocket(address);
	
	ws[connectionNumber].on('error', function(error) {
		console.log(error);  // Do something with error?
	});
	
	ws[connectionNumber].on('open', function() {
		//pingConnection(connectionNumber);  // Don't think we need to ping on connection?
		pingInterval[connectionNumber] = setInterval(function() {pingConnection(connectionNumber);}, 300000);
		
		var listenMessage = {
			type: 'LISTEN',
			data: {
				topics: wsTopics[connectionNumber]
			}
		};
		
		sendMessage(connectionNumber, listenMessage, false, function(message) {callback();});
	});
	
	ws[connectionNumber].on('close', function() {refreshConnection(connectionNumber);});
	ws[connectionNumber].on('message', function(data) {handleMessages(connectionNumber, data);});
}

// Used to handle the messages sent over the connection, and then act accordingly.
// This usually means emitting events.
function handleMessages(connectionNumber, data) {
	var parsed = JSON.parse(data);
	//console.log(parsed);  // debug
	
	// If told to reconnect, will refresh the connection.
	if (parsed['type'] === 'RECONNECT') {
		refreshConnection(connectionNumber);
	}
	
	else if (parsed['type'] === 'MESSAGE'){
		var messageParse = JSON.parse(parsed['data']['message']);
		var topicType = parsed['data']['topic'].substring(0, parsed['data']['topic'].indexOf('.'));
		var channelName = parsed['data']['topic'].substr(parsed['data']['topic'].indexOf('.')+1);
		
		if (topicType === 'video-playback') {
			switch(messageParse['type']) {
				case 'stream-up':
					// emits: channel name, play delay, server time
					globalVars.twitchPubSubEvents.emit('streamUp', channelName, messageParse['play_delay'], messageParse['server_time']);
					break;
				case 'stream-down':
					// emits: channel name, server time
					globalVars.twitchPubSubEvents.emit('streamDown', channelName, messageParse['server_time']);
					break;
				case 'viewcount':
					// emits: channel name, viewers, server time
					globalVars.twitchPubSubEvents.emit('viewCount', channelName, messageParse['viewers'], messageParse['server_time']);
					break;
			}
		}
	}
}

// Used to ping a connection, which needs to be done every 5 minutes.
// If we do not receive a PONG back within 10 seconds, the connection is refreshed.
function pingConnection(connectionNumber) {
	var pingCheckTimeout = setTimeout(function() {
		refreshConnection(connectionNumber);
	}, 10000);
	sendMessage(connectionNumber, {type: "PING"}, true, function(message) {
		clearTimeout(pingCheckTimeout);
	});
}

// Used to reconnect a connection, either because we are told to or the connection drops.
function refreshConnection(connectionNumber) {
	wsOpen[connectionNumber] = false;
	clearInterval(pingInterval[connectionNumber]);
	
	// Waits 10 seconds before reconnecting (should be improved).
	setTimeout(function() {
		initializeConnection(connectionNumber, function() {
			wsOpen[connectionNumber] = true;
		});
	}, 10000);
}


// Used to send a message on a connection. A nonce is added here for ease of use.
// For a PING, will callback when a PONG is received. Otherwise calls back if the nonce matches.
function sendMessage(connectionNumber, message, ping, callback) {
	message['nonce'] = randomstring.generate();
	ws[connectionNumber].send(JSON.stringify(message));
	
	var messageEvent; ws[connectionNumber].on('message', messageEvent = function(data) {
		var parsed = JSON.parse(data);
		if ((ping && parsed['type'] === 'PONG') || message['nonce'] === parsed['nonce']) {
			ws[connectionNumber].removeListener('message', messageEvent);
			if (callback) {callback(parsed);}
		}
	});
}

// Used to process topics in some places.
// Converts them all to lowercase and removes duplicates.
function processTopics(topics) {
	var processedTopics = utils.lowercaseArray(topics);
	return _.uniq(processedTopics);
}

// Used to find the location of a topic, if it has one.
// Returns the number of the connection if it exists, otherwise returns -1.
function findLocationOfTopic(topic) {
	for (var i = 0; i < wsTopics.length; i++) {
		if (wsTopics[i].indexOf(topic) >= 0) {return i;}
	}
	
	return -1;
}