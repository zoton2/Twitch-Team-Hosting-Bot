// Function to return a random integer.
exports.randomInt = function(low, high) {
	return Math.floor(Math.random() * (high - low) + low);
}