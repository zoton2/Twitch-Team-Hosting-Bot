// Referencing other files.
var connections = require('./lib/connections');
var hosting = require('./lib/hosting');

// Does the initial connection setting up stuff (also joins channels).
connections.setUpConnections(function() {
	hosting.getOnlineChannels('example', function(onlineChannels) {
		console.log(onlineChannels);
	});
});