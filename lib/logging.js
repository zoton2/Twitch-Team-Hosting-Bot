// Referencing packages.
var moment = require('moment');

// Processes the log messages it receives.
exports.logMessage = function(team, message) {
	var timestampUTC = moment.utc().format('YYYY-MM-DD HH:mm:ss');
	var timestampLocal = moment().format('YYYY-MM-DD HH:mm:ss');
	if (!team) {team = 'N/A';}
	console.log('[' + timestampLocal + '] (' + team + ') ' + message);
	// should also log this stuff to some sort of file
}