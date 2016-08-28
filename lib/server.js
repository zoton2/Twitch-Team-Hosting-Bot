// Referencing packages.
var http = require('http');
var dispatcher = require('httpdispatcher');
var fs = require('fs-extra');

// Referencing other files.
var globalVars = require('./global-vars');
var hostingFuncs = require('./hosting');
var loggingFuncs = require('./logging');

// Sets up the server.
exports.setUp = function() {
	// Creates the server.
	var server = http.createServer(handleRequest);
	
	// Makes the sever listen for requests.
	server.listen(globalVars.settings.serverPort, function() {
		loggingFuncs.logMessage(null, 'The web server has been set up and is now listening for requests.');
	});
	
	setUpAPI();
	
	// What to do when the user tries to look at the homepage.
	dispatcher.onGet("/", function(req, res) {
		res.writeHead(200, {'Content-Type': 'text/html'});
		
		// Prints current version and newest version if an update is available.
		var html = '<b>Current Version:</b> ' + globalVars.version + '<br>';
		if (globalVars.newVersion) {html += '<b>Latest Version:</b> <a href="https://github.com/zoton2/Twitch-Team-Hosting-Bot/releases/latest">' + globalVars.newVersion + '</a><br>';}
		html += '<br>'
		
		// Goes through the teams to print their current status.
		for (var team in globalVars.channels) {
			if (globalVars.channels.hasOwnProperty(team)) {
				html += '<b>' + team + '</b> [' + (globalVars.active[team] ? "on":"off") + ']';
				
				// Prints who they are hosting (if anyone) and how long for.
				if (globalVars.active[team]) {
					var hostedChannel = 'no one';
					
					if (globalVars.currentHostedChannel[team]) {
						hostedChannel = globalVars.currentHostedChannel[team].displayName +
						' (' + hostingFuncs.calculateHostedTime(team) + '/' +
						hostingFuncs.formatMS(globalVars.currentHostRefreshLength[team]) + ')';
					}
					
					html += ' currently hosting ' + hostedChannel;
				}
				
				html += '<br>';
			}
		}
		
		// API endpoint links.
		html += '<br><b>API Endpoints</b><br>' +
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
				// Custom font.
				html = '<link href="https://fonts.googleapis.com/css?family=Roboto+Mono:400,700" rel="stylesheet" type="text/css">';
				
				// If a line limit is set, then it will only return those last log lines.
				var logLines = logFile.split(/\r?\n/g);
				var startLine = (lineLimit && logLines.length >= lineLimit && lineLimit > 0) ? logLines.length - lineLimit : 0;
				logLines = logLines.slice(startLine);
				for (var i = 0; i < logLines.length; i++){logLines[i] = '<b>' + logLines[i].substr(0, 21) + '</b>' + logLines[i].substr(21);}
				html += '<span id="log-lines" style="font-family:Roboto Mono;">' + logLines.join('<br>') + '</span>';
				
				// JavaScript to convert timestamps to local.
				html += '<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.13.0/moment.min.js"></script>' +
				'<script src="https://code.jquery.com/jquery-3.0.0.min.js" integrity="sha256-JmvOoLtYsmqlsWxa7mDSLMwa6dZ9rrIdtrrVYRnDRH0=" crossorigin="anonymous"></script>' +
				'<script src="js/log.js"></script>';
			}
		}
		
		res.writeHead(statusCode, {'Content-Type': 'text/html'});
		res.end(html);
	});
	
	// JavaScript file used in the above request.
	dispatcher.onGet("/js/log.js", function(req, res) {
		res.writeHead(200, {'Content-Type': 'application/javascript'});
		res.end(fs.readFileSync('server-js/log.js', 'utf8'));
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
		
		// Only logs server access messages if the user has this turned on.
		if (globalVars.settings.logServerAccess) {
			loggingFuncs.logMessage(null, 'Someone has tried to access the server with this request URL: ' + request['url']);
		}
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