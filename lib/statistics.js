// Referencing packages.
var fs = require('fs-extra');

// Referencing other files.
var globalVars = require('./global-vars');

// Loads the stats file into memory if it exists.
exports.loadStatistics = function() {
	var statsFile; try {statsFile = fs.readJsonSync('persist/statistics.json', {throws: false});} catch(e) {}
	if (statsFile) {
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
		
		saveStatistics();
		globalVars.statistics = newStats;
	}
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
	fs.writeJson('persist/statistics.json', globalVars.statistics);
}