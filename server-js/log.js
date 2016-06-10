// Separate each line into an array.
var logLines = $('#log-lines').html().split('<br>');
var newLogLines = [];

// Go through each line and replace the timestamp with one that is in the viewer's local time.
for (var i = 0; i < logLines.length; i++){
    var localTime = moment(moment.utc(logLines[i].substr(4, 19)).toDate()).format('YYYY-MM-DD HH:mm:ss');
	newLogLines.push('<b>[' + localTime + ']</b> ' + logLines[i].substr(29));
}

// Replace the old lines with the new ones.
$('#log-lines').html(newLogLines.join('<br>'));