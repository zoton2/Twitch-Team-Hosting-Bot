# Twitch Team Hosting Bot

## What the bot does

This bot is designed to host members of a Twitch.tv team on one or many channels for a set amount of time; picking one at "random" (but favouring lower viewed streams and also preferred games if you so desire), hosting them, then after 2 hours (or 30 minutes if a non-preferred game) repeating this cycle (these are defaults that can be overridden). You can also specify a channel manually at any time.

You can use this bot to host on only one or a specific set of channels, or on anyone on the team as long as they are offline. For example, you could use this bot to promote other people in your team while the rest are offline, or use it only on a community channel, only hosting people from your team on that one account.

***For the bot to be able to host on specific channels, that channel must either be the bot's own channel (where it is the broadcaster) or the bot account must be set as an editor for that channel.***

## Install

#### Node.js

1. [Download the source code of the latest release](https://github.com/zoton2/Twitch-Team-Hosting-Bot/releases/latest) and extract it to the folder where you want to run it from.
2. Run `npm install` in this new directory to install the dependencies.
3. Create a settings file in the `persist` directory called `login-details.json` (see below for information).
4. Run the program using `node index.js` in the directory.

If you ever want to update the bot, just repeat the steps above, but check the `persist` files to see if they need to be changed/updated.

## Settings

All of the settings to run the bot are stored in `*.json` files in the `persist` directory.

#### login-details.json

Most of the settings to run the bot are stored in a file called `login-details.json`. I have included a file called `login-details-example.json` to help show you how to write it.

This is a JSON array with each entry being an object that contains information on the team and the connection. If you were only going to use this for one team, you would only need one object; you only need to add more if you are going to use this for multiple teams.

**Information that can go in the object:**
- `team` *(required)*: The name of the team that the bot will pick channels from to host by default.
- `mainChannel` *(defaults to username)*: The channel the bot will respond to the main commands in.
- `username` *(required)*: The name of the bot which will do the work in the Twitch chat(s).
- `oauth` *(required)*: A chat OAUTH for the above username.
- `manualChannelList` *(defaults to all team members)*: An array of channels the bot will attempt to host on.
- `preferredGames` *(defaults to an empty array)*: An array of game names (or partial game names) the bot will always try to host before trying others.
- `preferredGameHostLength` *(defaults to 120)*: The number in minutes you want preferred games to be hosted for. If you have no preffered games, this will be the length everyone is hosted for.
- `nonPreferredGameHostLength` *(defaults to 30)*: The number in minutes you want non-preferred games to be hosted for. This does nothing if you have no preffered games.
- `hostTrainMessage` *(defaults to nothing)*: A string which will be printed in the hosted channel's chat after a successful host. You can use the `{viewers}` wildcard, which will be replaced with the amount of viewers the channel was hosted for. If this string isn't set, nothing will be printed.
- `autoStart` *(defaults to `true`)*: Whether or not the bot will start hosting people as soon as the application is started.
- `admins` *(defaults to an empty array, needed for whispers)*: An array of people who will be able to use the bots admin commands (the broadcast or the bot account itself will always be able to use these commands).
- `modsAreAdmins` *(defaults to `false`)*: Whether or not mods in the main channel will also be able to use the admin commands.
- `debug` *(defaults to `false`)*: Whether the console will print debug messages from the tmi.js connections or not.

#### settings.json

This settings file has some other general settings for the bot.

- `server` *(defaults to `false`)*: If you want to use the web server or not (see section below).
- `serverPort` *(defaults to `8080`)*: What port the web server will run on.
- `logServerAccess` *(defaults to `true`)*: If you want the program to log when someone tries to access the web server.

#### twitch-api-settings.json

This settings file currently only has one option in it, but this needs to be set otherwise the bot will not start up.

- `clientID` *(required)*: The client ID of an application registered at Twitch. You can [register a new application here](https://www.twitch.tv/kraken/oauth2/clients/new) if you need one.

## Persist Files

Besides the file above, the `persist` directory will store some other stuff too. Once the bot has been ran once (and someone has been hosted) a `statistics.json` file will be created, which lists how many times a channel has been hosted on each team. Right now this is just some nice information to look at, but will be used in the future to pick channels.

There will also be a `logs` directory created, which stores basic logs about what is happening with the bot, with a separate log file for general logs, and one for each team.

## Web Server

If the settings are set correctly (see section above) the bot will create a small web server. If you go to the main page (for example `localhost:8080`) you will find information on the bot's current status, links to some basic API endpoints and also links that allow you to view the logs created by the bot, which are useful for if you want to view the logs that might be on a remote server but don't want to always download the files yourself to read them.

## Bot Commands

These commands can either be used in the main channel's chat, or by whispering the bot account (in which case any "admin" commands will only be useable if you have admins set in the `login-details.json` file).

**Everyone can use these:**
- `!hostedtime` or `!hostedchannel` will tell you how long the currently hosted channel has been hosted for.
- `!hostbotcheck` will tell you if the bot is currently turned on or off.
- `!version` will tell you what version of the application the bot is currently running on.

**Only "admins" can use these:**
- `!starthosting` will start the automatic hosting.
- `!stophosting` will stop the automatic hosting.
- `!manualhost <channel> <length of host in minutes (optional, must be 15 or over)>` will manually host the specified channel; they ***do not*** need to be on the team.
- `!endcurrenthost` will end the host of the current channel and pick a new person to host automatically.

## Where the bot is being used

- [The GTA Speedrunning Community](https://www.twitch.tv/team/gtacommunity) uses it to host the members of their team on their main channel, [GTAMarathon](https://www.twitch.tv/gtamarathon).
- [Voltage](https://www.twitch.tv/team/voltage) uses it to host their team members on the other team channels.
- [Team No Sleep](https://www.twitch.tv/team/teamnosleep) used it to host their team members on the other team channels.

Using this bot somewhere? Use an issue/pull request to get your use added here!