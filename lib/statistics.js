// Referencing packages.
var fs = require('fs-extra');

// Referencing other files.
var globalVars = require('./global-vars');

// Loads the stats file into memory if it exists.
exports.loadStatistics = function() {
	var statsFile; try {statsFile = fs.readJsonSync('persist/statistics.json', {throws: false});} catch (e) {}
	if (statsFile) {globalVars.statistics = statsFile;}
}

// Saves the stats file if needed.
exports.saveStatistics = function() {
	fs.writeJsonSync('persist/statistics.json', globalVars.statistics);
}

// Will give +1 to the channel being hosted in the statistics.
exports.incrementChannelStat = function(team, channel) {
	// Creates the team object if needed.
	if (!globalVars.statistics[team]) {globalVars.statistics[team] = {};}
	
	// Sets up the channel in the statistics or just increments it if it's there already.
	if (!globalVars.statistics[team][channel]) {globalVars.statistics[team][channel] = 1;}
	else {globalVars.statistics[team][channel]++;}
	
	exports.saveStatistics();
}