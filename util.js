const { MessageEmbed } = require('discord.js')
function sendThenDelete(message, content, timeout = 5000) {
    const embed = new MessageEmbed()
        .setColor('#f1e0ff')
        .setDescription(content);

    return new Promise((resolve, reject) => {
        message.channel.send({embeds: [embed]})
            .then(sent => sleep(timeout)
                .then(() => sent.delete()
                    .then(() => resolve)))
            .catch(console.error);
    });
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { sendThenDelete, sleep };