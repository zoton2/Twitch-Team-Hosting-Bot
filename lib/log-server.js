// Referencing packages.
var http = require('http');
var dispatcher = require('httpdispatcher');
var fs = require('fs-extra');

// Referencing other files.
var globalVars = require('./global-vars');

exports.setUpServer = function() {
	function handleRequest(request, response) {
		try {
			dispatcher.dispatch(request, response);
		} catch (exception) {
			console.log(exception);
		}
	}
	
	dispatcher.setStaticDirname(__dirname + '/../persist/');
	dispatcher.setStatic('logs');
	
	var server = http.createServer(handleRequest);
	
	server.listen(globalVars.settings.logServerPort, function() {
		console.log("Server listening on: http://localhost:%s", globalVars.settings.logServerPort);
	});
	
	dispatcher.onGet("/", function(req, res) {
		res.writeHead(200, {'Content-Type': 'text/html'});
		
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
	
	dispatcher.onGet("/stats", function(req, res) {
		var statistics;
		try {
			statistics = fs.readJsonSync('persist/statistics.json', {throws: false});
		} catch (exception) {
			statistics = null;
		}
		
		if (statistics) {
			res.writeHead(200, {'Content-Type': 'application/json'});
			res.end(JSON.stringify(statistics));
		}
		
		else {res.writeHead(200, {'Content-Type': 'text/plain'}); res.end('no stats file yet');}
	});
}