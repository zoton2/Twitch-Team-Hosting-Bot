// Referencing packages.
var _ = require('underscore');

// Referencing other files.
var globalVars = require('./global-vars');

// Used to split up an array into chunks of smaller arrays.
// Source: http://www.frontcoded.com/splitting-javascript-array-into-chunks.html
exports.createGroupedArray = function(arr, chunkSize) {
	var groups = [], i;
	for (i = 0; i < arr.length; i += chunkSize) {
		groups.push(arr.slice(i, i + chunkSize));
	}
	return groups;
}

// Used to process arrays in some places.
// Converts them all to lowercase and removes duplicates.
exports.processArray = function(array) {
	var processedArray = exports.lowercaseArray(array);
	return _.uniq(processedArray);
}

// Converts all strings in an array to lowercase.
exports.lowercaseArray = function(array) {
	var newArray = array.slice(0);
	for (var i = 0; i < newArray.length; i++) {newArray[i] = newArray[i].toLowerCase();}
	return newArray;
}

// Function to return a random integer.
exports.randomInt = function(low, high) {
	return Math.floor(Math.random() * (high - low) + low);
}

// Returns if the specific team is hosting the specified channel currently.
// Can also check the last hosted channel if "last" is set to true.
exports.areWeHostingChannel = function(team, channel, last) {
	var hostedChannel = (!last) ? globalVars.currentHostedChannel[team] : globalVars.lastHostedChannel[team];
	if (!hostedChannel) {return false;}
	else {return channel.toLowerCase() === hostedChannel.username;}
}