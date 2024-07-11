# OpenRCT2 Configurable Objective Setter

This plugin for OpenRCT2 semi-randomly changes a scenario's objective while offering many options for customising the difficulty. If you want to enjoy old familiar scenarios but are forever finding them too easy, this might be for you!

The range of settings is quite extensive: essentially you set what it is allowed to do and how much, and it will try to create an objective that satisfies those constraints. It works by simulating a "playthrough" of settings and iterating on them to get closer to what was requested.

The default settings are intended to make objectives that are somewhere around the higher difficulty end of the original games' scenarios. These can be altered quite drastically to make things that should only just about be possible by playing "normally", or even beyond.

![Game in progress UI](/img/inprogressui.png)

Multiplayer is completely untested and something will very likely break, though it could probably be run in singleplayer before hosting the park. I have never played multiplayer OpenRCT2 and have no understanding of the finer points of writing a plugin that works in multiplayer, and I'm not aware of any resources that discuss this. The new scripted conditions might not work in multiplayer, though.

# Settings

The UI has quite a lot of settings on it. All options have hover-over tooltips that attempt to explain what they do, some have an extra "?" button which brings up more info around the setting in question.

The interesting kind of difficulty in my opinion is that which comes from financial pressure - which is something that I've tried to go quite a long way towards including options for. The default settings do not necessarily show this off all too well, increasing the difficulty can be done by...

- Increasing the "Difficulty".
- _Lowering_ the "Financial Difficulty" value (which will have it try to make cash tighter).
- Enabling "force buy land to expand". To get good results with this option, you will likely need to reduce the number of tiles per soft guest cap in the Land tab, else the simulation will probably spend much more cash buying land than you do. The extended help for these options will display a park's current value for this stat, which should help to pick a value for it.
- Increasing the minimum loan interest. Having less high interest debt to pay off rather than being saddled with a gigantic low interest loan that isn't worth repaying is more interesting in my opinion.
- Adjusting simulation settings, particularly expected profit per guest in pay per ride parks.

![Pregame UI 1](/img/pregameui1.png)
![Pregame UI 2](/img/pregameui2.png)

Many of the default values are simply guesses on my part: depending on how you like to play your game some options will want changing.

# Installation and Usage

As with all OpenRCT2 plugins, scroll up to the top of the page, find the "Releases" section, and download the latest. Copy this to your OpenRCT2 plugin directory, which is:

- Windows: `C:\Users\YourName\Documents\OpenRCT2\plugin`
- Mac: `/Users/YourName/Library/Application Support/OpenRCT2/plugin`
- Linux: `$XDG_CONFIG_HOME/OpenRCT2/plugin` or in its absence `$HOME/.config/OpenRCT2/plugin`

If you had the game open, you will need to quit and relaunch it.

If everything went well, this plugin's entry will appear under the map button dropdown once playing a scenario.

# Thanks

- This is built on Basssiiie's [Typescript plugin template](https://github.com/Basssiiie/OpenRCT2-Simple-Typescript-Template), which was an incredibly useful starting point as this is the first thing I've ever had to do with Javascript/Typescript at all and having simple instructions to follow for a hot-reloading setup was amazing.
- Basssiiie's [FlexUI library](https://github.com/Basssiiie/OpenRCT2-FlexUI), without this the options panel would almost certainly be a much less usable disaster, or just missing entirely.