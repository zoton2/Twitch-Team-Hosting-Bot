// Referencing packages.
var moment = require('moment');
var fs = require('fs-extra');
var async = require('async');

// Declaring variables.
var noOneToHostCheck = [];
var messageQueues = {};
var messagesToSave = {};

// Processes the log messages it receives.
exports.logMessage = function(team, message, noOneToHost) {
	var logName = team || 'general';
	
	// Logs the message with a local timestamp to the console.
	console.log('['+moment().format('YYYY-MM-DD HH:mm:ss')+'] ('+(team?team:'N/A')+') '+message);
	
	// Check done so that the "no one to host" doesn't get spammed to the log files.
	if (!noOneToHost && noOneToHostCheck.indexOf(logName) >= 0) {noOneToHostCheck.splice(noOneToHostCheck.indexOf(logName), 1);}
	
	// If the last and current messages are not the "no one to host" message, logs to the file.
	if (noOneToHostCheck.indexOf(logName) < 0) {
		if (!messageQueues[logName]) {createMessageQueue(logName);}
		
		// Pushes the logged message to the queue.
		var logLine = '['+moment.utc().format('YYYY-MM-DD HH:mm:ss')+'] '+message;
		messageQueues[logName].push(logLine, function(err) {});
		
		// If this message is a "no one to host" message, pushes this log file name to the array.
		if (noOneToHost) {noOneToHostCheck.push(logName);}
	}
}

// Used to create a message queue for the specific log file if one doesn't exist already.
function createMessageQueue(logName) {
	// Creates array to store log messages in that need saving.
	messagesToSave[logName] = [];
	
	// Creates the queue and what will happen with each log message.
	messageQueues[logName] = async.queue(function(logLine, callback) {
		messagesToSave[logName].push(logLine); callback();
	}, 1);
	
	// Creates the function that will run every time the queue has been finished.
	messageQueues[logName].drain = function() {
		var messagesToSaveString;
		
		// Temporarily pauses the queue while the file is modified.
		messageQueues[logName].pause();
		
		// Checks if the log file exists yet; adds a new line to the start if so.
		if (logFileExists(logName)) {messagesToSaveString = '\n';}
		
		// If not, makes sure the logs directory is present; creates it if not.
		else {fs.ensureDirSync('persist/logs');}
		
		// Combines the messages into 1 string and appends it to the file; also erases the array.
		messagesToSaveString += messagesToSave[logName].join('\n');
		fs.appendFileSync('persist/logs/' + logName + '.log', messagesToSaveString);
		messagesToSave[logName] = [];
		
		// Resumes the queue once the file has been updated.
		messageQueues[logName].resume();
	}
}

// Checks if a log file exists or not; returns true/false.
function logFileExists(logName) {
    try {return fs.statSync('persist/logs/' + logName + '.log').isFile();} catch(e) {return false;}
}