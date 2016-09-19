// Referencing packages.
var fs = require('fs-extra');
var moment = require('moment');
var async = require('async');

// Referencing other files.
var globalVars = require('./global-vars');
var logging = require('./logging');

// Declaring variables.
var timestamp = moment.utc().format('YYYY-MM-DD_HH-mm-ss');

// Loads the stats file into memory if it exists.
exports.loadStatistics = function(callback) {
	logging.logMessage(null, 'Attempting to load the statistics.json file.');
	
	// Loop to make sure the stats file is loaded in correctly in case it fails the first time (or first few).
	var i = 0, statsFile;
	async.whilst(
		function() {return i < 4 && !statsFile;},
		function(callback2) {
			try {statsFile = fs.readJsonSync('persist/statistics.json', {throws: false});} catch(e) {}
			i++; setTimeout(callback2, 2000);
		},
		function(err) {
			if (!statsFile) {
				logging.logMessage(null, 'Could not load the statistics.json file (this is fine if you haven\'t used the bot before).');
			}
			
			else {
				logging.logMessage(null, 'Successfully loaded the statistics.json file' + ((i>1)?' (it took ' + i + 'attempt(s)).':'.'));
				
				// Loops through the teams in the stats file and makes a list of them.
				var teamKeys = []; var newStats = {};
				for (var key in statsFile) {if (statsFile.hasOwnProperty(key)) {
					teamKeys.push(key);
				}}
				
				// Loops through the teams we made a list of and checks all the team names,
				// makes sure there's no duplicates (because of case) and if there is, adds
				// the totals together, and then makes all channel names lower case.
				// This is all done because we used to store stuff based on display names.
				for (var i = 0; i < teamKeys.length; i++) {
					var team = teamKeys[i]; newStats[team] = {};
					for (var key in statsFile[team]) {if (statsFile[team].hasOwnProperty(key)) {
						var channel = key.toLowerCase();
						if (newStats[team][channel]) {newStats[team][channel] += statsFile[team][key];}
						else {newStats[team][channel] = statsFile[team][key];}
					}}
				}
				
				globalVars.statistics = newStats;
				saveStatistics();
				callback();
			}
		}
	);
}

// Will give +1 to the channel being hosted in the statistics.
exports.incrementChannelStat = function(team, channel) {
	channel = channel.toLowerCase();  // Just in case I forget to do this elsewhere!
	
	// Creates the team object if needed.
	if (!globalVars.statistics[team]) {globalVars.statistics[team] = {};}
	
	// Sets up the channel in the statistics or just increments it if it's there already.
	if (!globalVars.statistics[team][channel]) {globalVars.statistics[team][channel] = 1;}
	else {globalVars.statistics[team][channel]++;}
	
	saveStatistics();
}

// Saves the stats file if needed.
function saveStatistics() {
	fs.writeJsonSync('persist/statistics.json', globalVars.statistics);
	
	// Saves a backup with a timestamp of when the application was started.
	// Sometimes on restart we fail to load the old file so it gets overwritten, so this is a failsafe.
	fs.ensureDirSync('persist/stat-backups');
	fs.writeJsonSync('persist/stat-backups/statistics' + timestamp + '.json', globalVars.statistics);
}