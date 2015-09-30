// Referencing other files.
var connections = require('./lib/connections');

// Does the initial connection setting up stuff.
connections.setUpConnections(function() {
	console.log('done connecting');
});