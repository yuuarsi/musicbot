require('dotenv').config();
const { Client, Intents, MessageEmbed, } = require('discord.js');
const { MusicPlayer, updateQueue } = require('./player');

const client = new Client({
	intents:
		[Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MEMBERS,
		Intents.FLAGS.GUILD_VOICE_STATES,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
		]
});
const player = new MusicPlayer(client);

const NothingPlaying = new MessageEmbed()
	.setColor('#f1e0ff')
	.setTitle('Current Not Playing')
	.setImage('https://i.imgur.com/IPNgl72.gif');

player.on('trackStart', (queue, track) => {
	const Playing = client.Menu.embeds[0];
	Playing.setTitle(track.title)
		.setURL(track.url)
		.setDescription(`Requested by ${track.requestedBy}`)
		.setFields([{ name: 'Channel', value: `[${track.author}](${track.raw.videoDetails.ownerProfileUrl})`, inline: true }, { name: `Duration`, value: `${(track.raw.videoDetails.isLive) ? 'Live' :track.duration}`, inline: true }])
		.setImage(track.raw.videoDetails.thumbnails.at(-1).url)
		.setFooter(`${queue.tracks.length} songs in playlist.`);
	client.Menu.edit({ content: updateQueue(queue), embeds: [Playing] });
});

player.on('trackAdd', (queue, track) => {
	const Adding = client.Menu.embeds[0];
	Adding.setFooter(`${queue.tracks.length} songs in playlist.`)
	client.Menu.edit({ content: updateQueue(queue), embeds: [Adding] });
});

player.on('tracksAdd', (queue, tracks) => {
	const Adding = client.Menu.embeds[0];
	Adding.setFooter(`${queue.tracks.length} songs in playlist.`)
	client.Menu.edit({ content: updateQueue(queue), embeds: [Adding] });
});

player.on('queueEnd', (_) => {
	client.Menu.edit({ content: ' ', embeds: [NothingPlaying] });
});

player.on('botDisconnect', (_) => {
	client.Menu.edit({ content: ' ', embeds: [NothingPlaying] });
});

player.on('stopped', (_) => {
	client.Menu.edit({ content: ' ', embeds: [NothingPlaying] });
});

player.on('shuffled', (queue) => {
	client.Menu.edit({ content: updateQueue(queue), embeds: client.Menu.embeds });
});

player.on('cleared', (queue) => {
	const update = client.Menu.embeds[0];
	update.setFooter(`${queue.tracks.length} songs in playlist.`)
	client.Menu.edit({ content: updateQueue(queue), embeds: client.Menu.embeds });
});

player.on('queueUpdated', (queue) => {
	const update = client.Menu.embeds[0];
	update.setFooter(`${queue.tracks.length} songs in playlist.`)
	client.Menu.edit({ content: updateQueue(queue), embeds: [update] });
});

player.on('error', (_, error) => {
	if (error.name == 'DestroyedQueue') return;
	console.error(error);
});

player.on('connectionError', (_, error) => {
	console.error(error);
});

player.on('debug', (_, msg) => {
	//console.log(msg);
});

function initMenu(msg) {
	msg.channel.bulkDelete(50)
		.then(() => {
			msg.channel.send({ embeds: [NothingPlaying] })
				.then(menu => {
					client.MenuID = menu.id;
					client.Menu = menu;
				})
				.then(() => addControl(client.Menu));
		})
		.catch(console.error);
}

async function addControl(msg) {
	const _CONTROLS = player.CONTROLS;
	await msg.reactions.removeAll();
	for (const key of [..._CONTROLS.keys()]) {
		await msg.react(key).catch(console.error);
	}

	const filter = (reaction, user) => {
		return _CONTROLS.has(reaction.emoji.toString()) && !user.bot;
	}

	const collector = msg.createReactionCollector({ filter });
	collector.on('collect', (reaction, user) => {
		const act = _CONTROLS.get(reaction.emoji.toString()).bind(player);
		act(reaction.message, user);
		msg.reactions.cache.get(reaction.emoji.toString()).users.remove(user.id);
	});
}

client.once('ready', (c) => {
	console.log('Ready!');
	client.MenuID = null;
	client.Menu = null;
	client.Ch = null;
	client.Paused = false;
});

client.on('messageCreate', (m) => {
	if (m.channelId == '917380661785010206') {
		if (m.author.bot) return;
		if (client.Ch === null)
			client.Ch = m.channel;
		if (client.Menu === null)
			initMenu(m);
		if (m.content.startsWith('.')) {
			let command = m.content.slice(1);
			if (m.author.id == process.env.OWNER && command == 'init')
				initMenu(m);
			else if (m.author.id == process.env.OWNER && command == 'dc')
				player.getQueue(m.author.id).destroy();
			else if (command.startsWith('bump') || command.startsWith('move'))
				player.bump(m, command.slice(4).trim());
			else if (command.startsWith('mv'))
				player.bump(m, command.slice(2).trim());
			else if (command.startsWith('remove')) {
				command = command.slice(6).trim();
				if (command == 'double' || command == 'dupl')
					player.removeDuplicate(m);
				else
					player.remove(m, command);
			}
			else if (command.startsWith('rm')) {
				command = command.slice(2).trim();
				if (command == 'double' || command == 'dupl')
					player.removeDuplicate(m);
				else
					player.remove(m, command);
			}
			else if (command.startsWith('clear'))
				player.clear(m);
		}
		else {
			player.play(m);
		}
		m.delete();
	}
});

client.login(process.env.TOKEN);