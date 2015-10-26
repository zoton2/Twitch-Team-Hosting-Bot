// Referencing packages.
var moment = require('moment');
var fs = require('fs-extra');

// Declaring variables.
var firstLog = [];
var logExists = [];

// Processes the log messages it receives.
exports.logMessage = function(team, message) {
	var logName = team;
	if (!team) {logName = 'general';}
	
	// Checks if a log file exists yet if we haven't checked before.
	if (firstLog.indexOf(logName) < 0) {
		fs.ensureDirSync('persist/logs');
		
		var logFile;
		try {
			logFile = fs.readFileSync('persist/logs/' + logName + '.log', {throws: false});
		} catch (exception) {
			logFile = null;
		}
		
		if (logFile) {logExists.push(logName);}
		firstLog.push(logName);
	}
	
	// Creates the log messages.
	var timestampUTC = moment.utc().format('YYYY-MM-DD HH:mm:ss');
	var timestampLocal = moment().format('YYYY-MM-DD HH:mm:ss');
	var teamString = team;
	if (!team) {teamString = 'N/A';}
	var messageLocal = '[' + timestampLocal + '] (' + teamString + ') ' + message;
	var messageUTC = '[' + timestampUTC + '] (' + teamString + ') ' + message;
	
	// Logs to the console.
	console.log(messageLocal);
	
	// Logs to a file.
	if (logExists.indexOf(logName) >= 0) {messageUTC = '\n' + messageUTC;}	
	fs.appendFileSync('persist/logs/' + logName + '.log', messageUTC);
	if (logExists.indexOf(logName) < 0) {logExists.push(logName);}
}