var util   = require("util"),
    events = require("events"),
    xmpp   = require("node-xmpp");


module.exports.XMPP = XMPP;
module.exports.Message = Message;

util.inherits(XMPP, events.EventEmitter);



function XMPP(options) {

    this.client = new xmpp.Client({
        jid: options.jid,
        password: options.password,
        host: options.host,
        port: options.port
    });

    this.client.on("online", this.online.bind(this));
    this.client.on("stanza", this.stanza.bind(this));
    this.client.on("error", this.error.bind(this));

}


XMPP.prototype.online = function () {

    this.client.send(new xmpp.Element("presence", {}).c("show").t("chat").up());

    console.log(this.client.jid + " is online.");

    var roster_query = new xmpp.Element("iq", {
        type: "get",
        id: Date.now()
    }).c("query", { xmlns: "jabber:iq:roster" });

    setInterval((function () {
        this.client.send(roster_query);
    }).bind(this), 5000);

    this.emit("connected");

};


XMPP.prototype.stanza = function (stanza) {

    if (stanza.attrs.type === "error") {
        console.error("[xmpp error] - " + stanza);
        return;
    }

    if (stanza.getChild("x") && stanza.getChild("x").getChild("invite")) {
        this.handlePresence(stanza);
        return;
    }

    if (stanza.is("presence")) {
        this.handlePresence(stanza);
        return;
    }

    if (stanza.is("message")) {
        this.handleMessage(stanza);
        return;
    }

};


XMPP.prototype.handlePresence = function (stanza) {

    var jid = new xmpp.JID(stanza.attrs.from);

    if (isMe.call(this, jid)) {
        return;
    }

    stanza.attrs.type = stanza.attrs.type || "available";

    switch (stanza.attrs.type) {
        case "subscribe":
            this.client.send(new xmpp.Element("presence", {
                from: this.client.jid.toString(),
                to: stanza.attrs.from,
                id: stanza.attrs.id,
                type: "subscribed"
            }));
        break;
        case "probe":
            this.client.send(new xmpp.Element("presence", {
                from: this.client.jid.toString(),
                to: stanza.attrs.from,
                id: stanza.attrs.id
            }));
        break;
        case "chat":
            this.client.send(new xmpp.Element("presence", {
                to: stanza.attrs.from + "/" + stanza.attrs.to
            }));
        break;
    }

};


XMPP.prototype.handleMessage = function (stanza) {

    var jid = new xmpp.JID(stanza.attrs.from),
        body = stanza.getChild("body");

    if (isMe.call(this, jid) || !body) {
        return;
    }

    this.emit("message", new Message(stanza, this));

};


XMPP.prototype.send = function (to, text) {

    this.client.send(new xmpp.Element("message", {
        to: to,
        type: "chat"
    }).c("body").t(text));

};


XMPP.prototype.error = function (error) {
    this.emit("error", error);
    console.error(error);
};



function Message(stanza, instance) {

    var text  = stanza.getChild("body").getText().toLowerCase(),
        parts = text.split(" ");

    this.sender   = new xmpp.JID(stanza.attrs.from);
    this.text     = text;
    this.cmd      = parts.shift();
    this.cmdval   = parts.join(" ");

    this.respond = function (text) {
        instance.send(this.sender, text);
    };

}



function isMe(jid) {
    return jid.user + "@" + jid.domain === this.client.jid.user + "@" + this.client.jid.domain;
}