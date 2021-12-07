function sendThenDelete(message, content, timeout = 5000) {
    return new Promise((resolve, reject) => {
        message.channel.send(content)
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