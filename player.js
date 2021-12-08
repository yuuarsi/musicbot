const { Collection } = require('discord.js');
const { Player } = require('discord-player');
const { sendThenDelete } = require('./util');
const playdl = require('play-dl');

const VideoRegex = /(((?:https?:)\/\/)?((?:www|m)\.)?((?:youtube\.com|youtu.be))((?!channel)(?!user)\/(?:[\w\-]+\?v=|embed\/|v\/)?)((?!playlist)(?!channel)(?!user)[\w\-]+))(\S+)?$/;
const PlaylistRegex = /((?:https?:)\/\/)?((?:www|m)\.)?((?:youtube\.com)).*(youtu.be\/|list=)([^#&?]*).*/;

class MusicPlayer extends Player {
    constructor(client, options = {}) {
        super(client, options);
        this.CONTROLS = new Collection(Object.entries({
            '⏮️': this.prev,
            '⏯️': this.pause,
            '⏭️': this.skip,
            '⏹️': this.stop,
            '🔀': this.shuffle,
        }));
    }

    async play(message) {
        let query = message.content;
        const requestVC = this.getVC(message, message.author.id);
        const selfVC = this.getVC(message, this.client.user.id);

        if (!requestVC)
            return sendThenDelete(message, 'You are not in a voice channel!');
        if (!(selfVC == requestVC) && selfVC)
            return sendThenDelete(message, 'You are not in my voice channel!');

        this.client.queue = this.createQueue(message.guild, {
            metadata: {
                channel: requestVC,
            },
            leaveOnEnd: false,
            leaveOnEmptyCooldown: 60000,
            disableVolume: true,
            onBeforeCreateStream: async function (track, source, _queue) {
                // only trap youtube source
                if (source === "youtube") {
                    // track here would be youtube track
                    return (await playdl.stream(track.url)).stream;
                    // we must return readable stream or void (returning void means telling discord-player to look for default extractor)
                }
            }
        })

        try {
            if (!this.client.queue.connection)
                await this.client.queue.connect(requestVC);
        } catch {
            this.client.queue.destroy();
            return sendThenDelete(message, 'Could not join your voice channel!');
        }

        if (VideoRegex.test(query)) {
            query = VideoRegex.exec(query)[1];
            const track = await this.search(query, {
                requestedBy: message.author
            }).then(x => x.tracks[0]);

            if (!track)
                return sendThenDelete(message, `❌ | **${query}** not found!`, 10000);

            this.client.queue.addTrack(track);
        }
        else if (PlaylistRegex.test(query)) {
            const tracks = await this.search(query, {
                requestedBy: message.author
            }).then(x => x);

            if (tracks.tracks.length < 1)
                return sendThenDelete(message, `❌ | **${query}** not found!`, 10000);

            this.client.queue.addTracks(tracks.tracks);
        }
        else {
            const track = await this.search(query, {
                requestedBy: message.author
            }).then(x => x.tracks[0]);

            if (!track)
                return sendThenDelete(message, `❌ | **${query}** not found!`, 10000);

            this.client.queue.addTrack(track);
        }

        if (!this.client.queue.playing)
            this.client.queue.play();
    }

    pause(m, u) {
        if (!this.checkVC(m, u)) return;
        try {
            this.client.Paused = !this.client.Paused;
            this.client.queue.setPaused(this.client.Paused);
        } catch (e) {
            console.error(e);
        }
    }

    prev(m, u) {
        if (!this.checkVC(m, u)) return;
        try {
            if (this.client.queue.previousTracks.length < 2) return;
            this.client.queue.back();
        } catch (e) {
            console.error(e);
        }
    }

    skip(m, u) {
        if (!this.checkVC(m, u)) return;
        try {
            this.client.queue.skip();
        } catch (e) {
            console.error(e);
        }
    }

    stop(m, u) {
        if (!this.checkVC(m, u)) return;
        try {
            this.client.queue.stop();
            this.emit('stopped', this.client.queue);
        } catch (e) {
            console.error(e);
        }
    }

    shuffle(m, u) {
        if (!this.checkVC(m, u)) return;
        try {
            this.client.queue.tracks = shuffle(this.client.queue.tracks);
            this.emit('shuffled', this.client.queue);
        } catch (e) {
            console.error(e);
        }
    }

    clear(m) {
        if (!this.checkVC(m, m.author)) return;
        try {
            this.client.queue.clear();
            this.emit('cleared', this.client.queue);
            sendThenDelete(m, `Playlist was cleared by ${m.author}`, 10000);
        } catch (e) {
            console.error(e);
        }
    }

    bump(m, pos) {
        if (!this.checkVC(m, m.author)) return;
        try {
            const t = this.client.queue.remove(Number(pos) - 1);
            this.client.queue.insert(t, 0);
            this.emit('queueUpdated', this.client.queue);
        } catch (e) {
            console.error(e);
        }
    }

    remove(m, pos) {
        if (!this.checkVC(m, m.author)) return;
        try {
            const track = this.client.queue.remove(Number(pos) - 1);
            console.log(track);
            sendThenDelete(m, `[${track.title}](${track.url}) was removed by ${m.author}`);
            this.emit('queueUpdated', this.client.queue);
        } catch (e) {
            console.error(e);
        }
    }

    removeDuplicate(m) {
        if (!this.checkVC(m, m.author)) return;
        try {
            const newQueue = uniqBy(this.client.queue.tracks, k => k.raw.id);
            const old = this.client.queue.tracks.length
            this.client.queue.tracks = newQueue;

            if (old - newQueue.length > 0)
                sendThenDelete(m, `${old - newQueue.length} duplicated songs removed by ${m.author}.`, 10000);
            this.emit('queueUpdated', this.client.queue);
        } catch (e) {
            console.error(e);
        }
    }

    getVC(m, id) {
        try {
            return m.channel.guild.voiceStates.cache.get(id).channel;
        } catch {
            return false;
        }
    }

    checkVC(m, u) {
        const requestVC = this.getVC(m, u.id);
        const selfVC = this.getVC(m, this.client.user.id);

        return requestVC && (selfVC == requestVC);
    }
}

function updateQueue(queue) {
    const list = queue.tracks.slice(0, 20).reverse();
    let content = '';
    let count = (queue.tracks.length > 20) ? 21 : queue.tracks.length + 1;
    if (queue.tracks.length > 20) content += `...and ${queue.tracks.length - 20} more songs.\n`
    list.forEach(track => {
        count--;
        content += `${count}. ${track.title}\n`
    });
    if (content == '') {
        return ' ';
    }
    return content;
}

function shuffle(array) {
    let currentIndex = array.length, randomIndex;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }

    return array;
}

function uniqBy(a, key) {
    var seen = {};
    return a.filter(function (item) {
        var k = key(item);
        return seen.hasOwnProperty(k) ? false : (seen[k] = true);
    })
}

module.exports = { MusicPlayer, updateQueue };