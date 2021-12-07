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
	.setImage('https://i.imgur.com/xGIAI1T.png');

player.on('trackStart', (queue, track) => {
	const Playing = new MessageEmbed()
		.setColor('#f1e0ff')
		.setTitle(track.title)
		.setURL(track.url)
		.setFields([{ name: track.author, value: track.duration, inline: true }, { name: `Requested by`, value: `${track.requestedBy} `, inline: true }])
		.setImage(track.thumbnail)
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
	client.Menu.edit({ content: updateQueue(queue), embeds: client.Menu.embeds });
});

player.on('queueUpdated', (queue) => {
	client.Menu.edit({ content: updateQueue(queue), embeds: client.Menu.embeds });
});

player.on('error', (_, error) => {
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
	};

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
		if (client.Ch == null) {
			client.Ch = m.channel;
		}
		if (m.content.startsWith('.')) {
			const command = m.content.slice(1);
			if (m.author.id == process.env.OWNER && command == 'init')
				initMenu(m);
			else if (command.startsWith('bump'))
				player.bump(m, command.slice(4).trim());
			else if (command.startsWith('remove'))
				player.remove(m, command.slice(6).trim());
			else if (command.startsWith('rm'))
				player.remove(m, command.slice(2).trim());
		}
		else {
			if (client.Menu == null) {
				initMenu(m);
			}

			player.play(m);
		};
		m.delete();
	}
});

client.login(process.env.TOKEN);