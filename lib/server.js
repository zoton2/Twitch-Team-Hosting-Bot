// Referencing packages.
var http = require('http');
var dispatcher = require('httpdispatcher');
var fs = require('fs-extra');

// Referencing other files.
var globalVars = require('./global-vars');
var loggingFuncs = require('./logging');

// Sets up the server.
exports.setUp = function() {
	// Sets up the static directory that contains the logs.
	dispatcher.setStaticDirname(__dirname + '/../persist/');
	dispatcher.setStatic('logs');
	
	// Creates the server.
	var server = http.createServer(handleRequest);
	
	// Makes the sever listen for requests.
	server.listen(globalVars.settings.serverPort, function() {
		loggingFuncs.logMessage(null, 'The server has been set up and is now listening for requests.');
	});
	
	// What to do when the user tries to look at the homepage.
	dispatcher.onGet("/", function(req, res) {
		res.writeHead(200, {'Content-Type': 'text/html'});
		
		// Goes through all the logs and prints their names into the page, with links to them.
		fs.readdir('persist/logs', function(err, files) {
			if (!err) {
				var html = '<a href="stats">STATS FILE</a><br><br>';
				
				for (var i = 0; i < files.length; i++) {
					if (i > 0) {html += '<br>';}
					html += '<a href="logs/' + files[i] + '">' + files[i] + '</a>';
				}
				
				res.end(html);
			}
		});
	});
	
	// What to do when the user tries to look at the statistics page.
	dispatcher.onGet("/stats", function(req, res) {
		// Tries to load the statistics file and sees if it exists.
		var statistics;
		try {
			statistics = fs.readJsonSync('persist/statistics.json', {throws: false});
		} catch (exception) {
			statistics = null;
		}
		
		// Returns the statistics file if it does exist.
		if (statistics) {
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(statistics));
		}
		
		// If not, returns some text instead.
		else {res.writeHead(200, {'Content-Type': 'text/plain'}); res.end('no stats file yet');}
	});
}

// Used to handle the incoming requests.
function handleRequest(request, response) {
	try {
		dispatcher.dispatch(request, response);
		loggingFuncs.logMessage(null, 'Someone has tried to access the server with this request URL: ' + request.url);
	} catch (exception) {
		// Might wanna put an error log here but it's not really needed.
	}
}