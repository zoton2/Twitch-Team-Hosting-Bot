// Used to split up an array into chunks of smaller arrays.
// Source: http://www.frontcoded.com/splitting-javascript-array-into-chunks.html
exports.createGroupedArray = function(arr, chunkSize) {
	var groups = [], i;
	for (i = 0; i < arr.length; i += chunkSize) {
		groups.push(arr.slice(i, i + chunkSize));
	}
	return groups;
}

// Converts all strings in an array to lowercase.
exports.lowercaseArray = function(array) {
	var newArray = array.slice(0);
	
	for (var i = 0; i < newArray.length; i++) {
		newArray[i] = newArray[i].toLowerCase();
	}
	
	return newArray;
}