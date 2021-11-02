const getMessageObject = (text,username,chatboxHead="",room="") => {
    return {
        text,
        "messageTime": new Date().getTime(),
        username,
        "chatboxHead":chatboxHead,
        "room":room
    }
}
module.exports=getMessageObject