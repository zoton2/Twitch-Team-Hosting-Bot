// Some varibles that get filled up elsewhere.
exports.settings = {};
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

// Defaults that are used elsewhere.
exports.recheckLength = 300000;            // 5 minutes
exports.hostLength = 7200000;              // 2 hours
exports.nonPreferredGameLength = 1800000;  // 30 minutes
exports.teamRecheckLength = 3600;          // 1 hour (this is in seconds, not milliseconds!)