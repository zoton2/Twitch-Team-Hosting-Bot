# Twitch Team Hosting Bot

***Work In Progress***

A twitch.tv chat hosting bot that will host a channel onto other offline channels; mainly designed for team use.

## What the bot does...

This bot is designed to host members of a twitch.tv team on one or many channels for a set amount of time; picking one at "random" (but favouring lower viewed streams and also preferred games if you so desire), hosting them, then after 2 hours (or 30 minutes if a non-preferred game) repeating this cycle. You can also specify a channel manually at any time.

You can use this bot to host on only one or a specific set of channels, or on anyone on the team as long as they are offline. For example, you could use this bot to promote other people in your team while the rest are offline, or use it only on a community channel, only hosting people from your team on that one account.

***For the bot to be able to host on specific channels, that channel must either be the bot's own channel (where it is the broadcaster) or the bot account must be set as an editor for that channel.***

## Install

#### Node.js

1. [Download this project's files as a ZIP](https://github.com/zoton2/Twitch-Team-Hosting-Bot/archive/master.zip) and extract it where you want it to store the files, or clone it.
2. Run `npm install` in this new directory to install the dependencies.
3. Create a settings file in the `persist` directory called `login-details.json` (see below for information).
4. Run the program using `node index.js` in the directory.

## Settings

All of the settings to run the application are stored in the file called `login-details.json` in the `persist` folder. I have included a file called `login-details-example.json` to help show you how to write it.

This is a JSON array with each entry being an object that contains information on the team and the connection. If you were only going to use this for one team, you would only need one object; you only need to add more if you are going to use this for multiple teams.

**Information that can go in the object:**
- `team` *(required)*: The name of the team that the bot will pick channels from to host by default.
- `username` *(required)*: The name of the bot which will do the work in the Twitch chat(s).
- `oauth` *(required)*: A chat OAUTH for the above username.
- `manualChannelList` *(defaults to all team members)*: An array of channels the bot will attempt to host on.
- `preferredGames` *(defaults to an empty array)*: An array of game names (or partial game names) the bot will always try to host before trying others.
- `autoStart` *(defaults to `true`)*: `true` means the bot will start hosting people as soon as it turns on.
- `admins` *(defaults to mods in the bot channel, needed for whispers)*: An array of people who will be able to use the bots main commands. **The bot account itself will always be able to use these commands.**
- `debug` *(defaults to `false`)*: Whether the console will print debug messages from the tmi.js connections or not.

## Persist Files

Besides the file above, the `persist` directory will store some other stuff too. Once the bot has been ran once (and someone has been hosted) a `statistics.json` file will be created, which lists how many times a channel has been hosted on each team. Right now this is just some nice information to look at, but will be used in the future to pick channels.

There will also be a `logs` directory created, which stores basic logs about what is happening with the bot, with a separate log file for general logs, and one for each team.

## Bot Commands

These commands can either be used in the chat of the bot account's channel, or by whispering the bot (in which case any "admin" commands will only be useable if you have admins set in the `login-details.json` file).

**Everyone can use these:**
- `!hostedtime` or `!hostedchannel` will tell you how long the currently hosted channel has been hosted for.
- `!hostbotcheck` will tell you if the bot is currently turned on or off.

**Only "admins" can use these:**
- `!starthosting` will start the automatic hosting.
- `!stophosting` will stop the automatic hosting.
- `!manualhost <channel> <length of host in minutes (optional, must be over 15)>` will manually host the specified channel; they ***do not*** need to be on the team.
- `!endcurrenthost` will end the host of the current channel and pick a new person to host automatically.
