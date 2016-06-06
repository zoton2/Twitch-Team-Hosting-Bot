// Referencing packages.
var http = require('http');
var dispatcher = require('httpdispatcher');
var fs = require('fs-extra');

// Referencing other files.
var globalVars = require('./global-vars');
var loggingFuncs = require('./logging');

// Sets up the server.
exports.setUp = function() {
	// Creates the server.
	var server = http.createServer(handleRequest);
	
	// Makes the sever listen for requests.
	server.listen(globalVars.settings.serverPort, function() {
		loggingFuncs.logMessage(null, 'The server has been set up and is now listening for requests.');
	});
	
	setUpAPI();
	
	// What to do when the user tries to look at the homepage.
	dispatcher.onGet("/", function(req, res) {
		res.writeHead(200, {'Content-Type': 'text/html'});
		
		// API endpoint links.
		var html = '<b>API Endpoints</b><br>' +
		'<a href="api/statistics">/statistics</a>';
		
		// Get a list of files/folders from the logs directory.
		var logFileList; try {logFileList = fs.readdirSync('persist/logs');} catch(e) {}
		
		// Check the files from the directory for actual log files.
		for (var i = 0; i < logFileList.length;) {
			if (!/\.(log)$/i.test(logFileList[i])) {logFileList.splice(i, 1);}
			else {
				// If this is a log file, makes a list of log files with correct links.
				var logFileName = logFileList[i].slice(0, -4);
				if (i === 0) {html += '<br><br><b>Log Files</b><br>'}
				html += '<a href="log?file=' + logFileName + '">' + logFileName + '</a>' +
				' (<a href="log?file=' + logFileName + '&limit=50">only last 50 lines</a>)';
				i++; if (i < logFileList.length) {html += '<br>';}
			}
		}
		
		res.end(html);
	});
	
	// What to do if someone tries to view a log file.
	dispatcher.onGet("/log", function(req, res) {
		var logFileName = req['params']['file'];
		var lineLimit = (req['params']['limit'] && !isNaN(parseInt(req['params']['limit']))) ? parseInt(req['params']['limit']) : null;
		
		// Default variables to use.
		var html = 'Log file not found.';
		var statusCode = 404;
		
		if (logFileName) {
			// Tries to load in the log file and sees if it exists. If so, prints it to the page.
			var logFile; try {logFile = fs.readFileSync('persist/logs/' + logFileName + '.log', 'utf8');} catch(e) {}
			if (logFile) {
				// If a line limit is set, then it will only return those last log lines.
				var logLines = logFile.split(/\r?\n/g);
				var startLine = (lineLimit && logLines.length >= lineLimit && lineLimit > 0) ? logLines.length - lineLimit : 0;
				html = logLines.slice(startLine).join('<br>');
			}
		}
		
		res.writeHead(statusCode, {'Content-Type': 'text/html'});
		res.end(html);
	});
}

// Used to handle the incoming requests.
function handleRequest(request, response) {
	try {
		// Redirection for legacy log URLs.
		if (request['url'].indexOf('/logs/') === 0 && /\.(log)$/i.test(request['url'])) {
			var logFileName = request['url'].substr(6).slice(0, -4);
			response.writeHead(302, {'Location': '/log?file=' + logFileName});
			response.end();
		}
		
		else {dispatcher.dispatch(request, response);}
		
		loggingFuncs.logMessage(null, 'Someone has tried to access the server with this request URL: ' + request['url']);
	} catch (exception) {
		// Might wanna put an error log here but it's not really needed.
	}
}

function setUpAPI() {
	dispatcher.onGet("/api/statistics", function(req, res) {
		res.writeHead(200, {'Content-Type': 'application/json'});
		
		// Tries to load the statistics file and sees if it exists.
		var statistics; try {statistics = fs.readJsonSync('persist/statistics.json', {throws: false});} catch (e) {}
		
		// Returns a blank object if there are no statistics yet.
		if (!statistics) {statistics = {};}
		
		res.end(JSON.stringify(statistics));
	});
}