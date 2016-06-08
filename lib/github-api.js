// Referencing packages.
var request = require('request');

// Referencing other files.
var globalVars = require('./global-vars');
var loggingFuncs = require('./logging');

// Declaring variables.
var lastLatestVersion = '';

// Used to check if a new version is available on GitHub.
exports.checkForNewVersion = function() {
	getLatestVersionNumber(function(latestVersion) {
		if (latestVersion) {
			// Will only run the check if the latest version has actually changed.
			if (lastLatestVersion !== latestVersion) {
				lastLatestVersion = latestVersion;
				var currentVersionSplit = globalVars.version.split('.');
				var latestVersionSplit = latestVersion.version.split('.');
				
				// Goes through the version number to see if the current version is lower than the latest version.
				for (var i = 0; i < 3; i++) {
					if (parseInt(latestVersionSplit[i]) > parseInt(currentVersionSplit[i])) {
						loggingFuncs.logMessage(null, 'There is a new version available (current version: ' + globalVars.version + ' - latest version: ' + latestVersion + ').');
						globalVars.newVersion = latestVersion;
						break;
					}
				}
			}
		}
		
		// Sets this to run again in an hour.
		setTimeout(exports.checkForNewVersion, 3600000);
	});
}

// callback: latest version number
function getLatestVersionNumber = function(callback) {
	request(createRequestOptions('https://api.github.com/repos/zoton2/Twitch-Team-Hosting-Bot/releases/latest'), function(error, response, body) {
		var version;
		if (!error && response.statusCode === 200) {version = JSON.parse(body)['tag_name'].substr(1);}
		callback(version);
	});
}

// Used to create the options for the API requests above.
function createRequestOptions(apiURL) {
	return {
		url: apiURL,
		headers: {
			'Accept': 'application/vnd.github.v3+json'
		}
	}
}