// STUFF TO IMPROVE:
// Add jitter to PINGing?
// Make it so if the connection count could be reduced when stuff is removed, do so by moving topics to other connections.
// Twitch can kick you off if you have over 10 connections (apparently?), maybe issue a warning somehow.
// Add more events for things like connecting and disconnecting?
// Check if a connection has 0 topics being listened and remove it/move stuff around.
// If a connection is down for a long period, check Twitch API as well for online/offline streams.
// If you send a message to a connection that is currently down, it "won't work" (might even crash, not sure).

// Referencing packages.
var Html5WebSocket = require('html5-websocket');
var WebSocket = require('reconnecting-websocket');
var randomstring = require('randomstring');
var events = require('events');
var async = require('async');
var _ = require('underscore');

// Referencing other files.
var utils = require('./utils');
var loggingFuncs = require('./logging');

// Declaring variables.
var address = 'wss://pubsub-edge.twitch.tv/v1';
var ws = {};
var pingInterval = {};
var wsOpen = {};
var connectionCount = 0;  // Used to make a unique identifier, might not be the actual count.
var listOfConnections = [];
var topicLimit = 49;
var initCallbackDone = [];

// Declaring exported variables.
exports.wsTopics = {};
exports.twitchPubSubEvents = new events.EventEmitter();

// Used to listen to topics that we aren't already listening for.
// topics should be an array of new topics to listen to.
exports.listenToTopics = function(topics, callback) {
	var newTopics = utils.processArray(topics);
	var connToListen = []; var groupedTopics = {};
	
	for (var i = 0; i < newTopics.length;) {
		// If we are already listening for a topic, remove it from the array to ignore it.
		if (findLocationOfTopic(newTopics[i]) >= 0) {newTopics.splice(i, 1);} else {i++;}
	}
	
	for (var i = 0; i < listOfConnections.length; i++) {
		// If there are no new topics to be added, the looping is stopped early.
		if (newTopics.length === 0) {break;}
		
		// Checks if this connection has any free slots, and if so...
		if (exports.wsTopics[listOfConnections[i]].length < topicLimit) {
			// Sets up new topics to be added to that connection.
			connToListen.push(listOfConnections[i]);
			groupedTopics[listOfConnections[i]] = newTopics.slice(0, topicLimit-exports.wsTopics[listOfConnections[i]].length);
			newTopics.splice(0, topicLimit-exports.wsTopics[listOfConnections[i]].length);
		}
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
				exports.wsTopics[connToListen[i]] = exports.wsTopics[connToListen[i]].concat(groupedTopics[connToListen[i]]);
				i++; callback2();
			});
		},
		function(err) {
			// If all old connections have been checked and there are still topics to listen to, sets up new connections.
			if (newTopics.length > 0) {
				splitUpTopicsInitNewConnections(newTopics, function() {if (callback) {callback();}});
			} else {if (callback) {callback();}}
		}
	);
}

// Used to unlisten from topics that we may already be listening for.
// topics should be an array of topics to unlisten to.
exports.unlistenToTopics = function(topics, callback) {
	var oldTopics = utils.processArray(topics);
	var connToUnlisten = []; var groupedTopics = {};
	
	// Loops through the topics to be removed to find out data about them.
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
			groupedTopics[topicLocation].push(oldTopics[i]); i++;
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
				exports.wsTopics[connToUnlisten[i]] = _.difference(exports.wsTopics[connToUnlisten[i]], groupedTopics[connToUnlisten[i]]);
				i++; callback2();
			});
		},
		function(err) {if (callback) {callback();}}
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
	listOfConnections.push(connectionCount);
	exports.wsTopics[connectionCount] = topics.slice(0);
	loggingFuncs.logMessage(null, 'Creating new PubSub connection (' + connectionCount + ').');
	
	initializeConnection(connectionCount, function() {
		connectionCount++;
		callback();
	});
}

// Used to connect to the WebSocket, either when we need a new one or an older one needs to reconnect.
function initializeConnection(connectionNumber, callback) {
	ws[connectionNumber] = new WebSocket(address, null, {constructor: Html5WebSocket, debug: true});
	
	ws[connectionNumber].onerror = function(error) {
		loggingFuncs.logMessage(null, 'Error on PubSub connection (' + connectionNumber + ') [' + error.code + '].');
	}
	
	// When the connection is opened, sets up the ping interval and sends an initial listening message for the topics.
	ws[connectionNumber].onopen = function() {
		loggingFuncs.logMessage(null, 'Connected to PubSub connection (' + connectionNumber + ').');
		exports.twitchPubSubEvents.emit('connected', connectionNumber);
		wsOpen[connectionNumber] = true;
		
		pingInterval[connectionNumber] = setInterval(function() {pingConnection(connectionNumber);}, 300000);
		
		var listenMessage = {
			type: 'LISTEN',
			data: {
				topics: exports.wsTopics[connectionNumber]
			}
		};
		
		sendMessage(connectionNumber, listenMessage, false, function(message) {
			// Only fires a callback on the initial setting up of this connection.
			if (initCallbackDone.indexOf(connectionNumber) < 0) {
				initCallbackDone.push(connectionNumber); callback();
			}
		});
	}
	
	ws[connectionNumber].onclose = function() {
		loggingFuncs.logMessage(null, 'Disconnected from PubSub connection (' + connectionNumber + ').');
		refreshConnection(connectionNumber);
	}
	
	ws[connectionNumber].onmessage = function(e) {handleMessages(connectionNumber, e.data);}
}

// Used to handle the messages sent over the connection, and then act accordingly.
// This usually means emitting events.
function handleMessages(connectionNumber, data) {
	var parsed = JSON.parse(data);
	//console.log(parsed);  // debug
	
	// If told to reconnect, will refresh the connection.
	if (parsed.type === 'RECONNECT') {
		loggingFuncs.logMessage(null, 'A RECONNECT has been issued on PubSub connection (' + connectionNumber + ').');
		refreshConnection(connectionNumber, true);
	}
	
	// This is where all of the messages are handled. This has been tested with video-playback,
	// might not work well with other stuff, but we don't use anything else yet anyway.
	else if (parsed.type === 'MESSAGE'){
		var messageParse = JSON.parse(parsed.data.message);
		var topicType = parsed.data.topic.substring(0, parsed.data.topic.indexOf('.'));
		var channelName = parsed.data.topic.substr(parsed.data.topic.indexOf('.')+1);
		
		if (topicType === 'video-playback') {
			switch(messageParse.type) {
				case 'stream-up':
					// emits: channel name, play delay, server time
					exports.twitchPubSubEvents.emit('streamUp', channelName, messageParse.play_delay, messageParse.server_time);
					break;
				case 'stream-down':
					// emits: channel name, server time
					exports.twitchPubSubEvents.emit('streamDown', channelName, messageParse.server_time);
					break;
				case 'viewcount':
					// emits: channel name, viewers, server time
					exports.twitchPubSubEvents.emit('viewCount', channelName, messageParse.viewers, messageParse.server_time);
					break;
			}
		}
	}
}

// Used to ping a connection, which needs to be done every 5 minutes.
// If we do not receive a PONG back within 10 seconds, the connection is refreshed.
function pingConnection(connectionNumber) {
	var pingCheckTimeout = setTimeout(function() {
		loggingFuncs.logMessage(null, 'Ping timeout on PubSub connection (' + connectionNumber + ').');
		refreshConnection(connectionNumber, true);
	}, 10000);
	sendMessage(connectionNumber, {type: "PING"}, true, function(message) {
		clearTimeout(pingCheckTimeout);
	});
}

// Used to reconnect a connection, either because we are told to or the connection drops.
function refreshConnection(connectionNumber, close) {
	loggingFuncs.logMessage(null, 'Refreshing PubSub connection (' + connectionNumber + ').');
	wsOpen[connectionNumber] = false;
	exports.twitchPubSubEvents.emit('disconnected', connectionNumber);
	clearInterval(pingInterval[connectionNumber]);
	if (close) {ws[connectionNumber].close();}
}


// Used to send a message on a connection. A nonce is added here for ease of use.
// For a PING, will callback when a PONG is received. Otherwise calls back if the nonce matches.
function sendMessage(connectionNumber, message, ping, callback) {
	if (!ping) {message.nonce = randomstring.generate();}
	ws[connectionNumber].send(JSON.stringify(message));
	
	var messageEvent; ws[connectionNumber].addEventListener('message', messageEvent = function(e) {
		var parsed = JSON.parse(e.data);
		if ((ping && parsed.type === 'PONG') || message.nonce === parsed.nonce) {
			ws[connectionNumber].removeEventListener('message', messageEvent);
			if (callback) {callback(parsed);}
		}
	});
}

// Used to find the location of a topic, if it has one.
// Returns the identifier of the connection if it exists, otherwise returns -1.
function findLocationOfTopic(topic) {
	for (var i = 0; i < listOfConnections.length; i++) {
		if (exports.wsTopics[listOfConnections[i]].indexOf(topic) >= 0) {return listOfConnections[i];}
	}
	
	return -1;
}