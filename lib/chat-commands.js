// Referencing other files.
var globalVars = require('./global-vars');

exports.setUpListening = function(team) {
	console.log(team);
	globalVars.client[team].on('chat', function(channel, user, message, self) {
		if (!self) {listenToChat(team, channel, user, message);}
	});
}

function listenToChat(team, channel, user, message) {
	//console.log(message);
}