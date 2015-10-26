// Referencing packages.
var moment = require('moment');
var fs = require('fs-extra');

// Declaring variables.
var firstLog = true;
var logExists = false;

// Processes the log messages it receives.
exports.logMessage = function(team, message) {
	// Checks if a log file exists yet if we haven't checked before.
	if (firstLog) {
		var logFile;
		try {
			logFile = fs.readFileSync('persist/log.txt', {throws: false});
		} catch (exception) {
			logFile = null;
		}
		
		if (logFile) {logExists = true;}
		firstLog = false;
	}
	
	// Creates the log messages.
	var timestampUTC = moment.utc().format('YYYY-MM-DD HH:mm:ss');
	var timestampLocal = moment().format('YYYY-MM-DD HH:mm:ss');
	if (!team) {team = 'N/A';}
	var messageLocal = '[' + timestampLocal + '] (' + team + ') ' + message;
	var messageUTC = '[' + timestampUTC + '] (' + team + ') ' + message;
	
	// Logs to the console.
	console.log(messageLocal);
	
	// Logs to a file.
	if (logExists) {messageUTC = '\n' + messageUTC;}	
	fs.appendFileSync('persist/log.txt', messageUTC);
	if (!logExists) {logExists = true;}
}