// Get version number of application from the package.json file.
var pkginfo = require('pkginfo')(module, 'version');
exports.version = module.exports['version'];

// Some varibles that get filled up elsewhere.
exports.settings;
exports.mainChannel = {};
exports.channels = {};
exports.isUsingManualChannelList = {};
exports.client = {};
exports.currentHostedChannel = {};
exports.lastHostedChannel = {};
exports.timeouts = {};
exports.preferredGames = {};
exports.hostStartTime = {};
exports.active = {};
exports.admins = {};
exports.statistics = {};
exports.offlineNotice = {};
exports.adminCommandsActive = {};
exports.clientID = '';
exports.teamLastCheck = {};
exports.currentHostRefreshLength = {};
exports.preferredGameHostLength = {};
exports.nonPreferredGameHostLength = {};
exports.hostTrainMessage = {};

// Defaults that are used elsewhere.
exports.recheckLength = 300000;    // 5 minutes
exports.teamRecheckLength = 3600;  // 1 hour (this is in seconds, not milliseconds!)