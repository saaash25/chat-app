const getMessageObject = (text, username = '', chatboxHead = '', room = '') => {
    return {
        text,
        messageTime: new Date().getTime(),
        username,
        chatboxHead,
        room
    }
}

module.exports = getMessageObject