var jsdom         = require("jsdom"),
    fs            = require("fs"),
    xmpp          = require("./lib/xmpp"),
    Subscriptions = require("./lib/subscriptions"),
    list          = require("./list.json"),
    config        = require("./config.json"),
    jabber        = new xmpp.XMPP(config.jabber),
    subscriptions = new Subscriptions("./subscriptions.json"),
    sizzle        = fs.readFileSync("./lib/sizzle.js").toString(),
    helptext      = "Type 'list' (without the quotation marks) to see a list of devices.\n\n" +
        "Type 'status <device>[, <device>, <device>,...]' (where device is one or " +
        "more of the device names returned by the 'devices' call) to see it's status.\n\n" +
        "Type 'subscribe <device>[, <device>, <device>,...]' to subscribe for updates. " +
        "As soon as the device(s) become available I'll send you a message..\n\n" +
        "Type 'unsubscribe <device>[, <device>, <device>,...]' to not get updates for this device(s) anymore.",
    actions       = {
        list: function (msg) {
            msg.respond(Object.keys(list).join(", "));
        },
        status: function (msg) {
            var items = msg.cmdval.split(",");

            items.forEach(function (item) {
                item = item.trim();

                if (typeof list[item] !== "undefined") {

                    checkURL(item, list[item], function (data) {
                        msg.respond(formatMessage(data));
                    });

                    match = true;

                }
            });

            if (items[0] === "all" || items[0] === "") {
                msg.respond("TODO: check status for all");
            }
        },
        subscribe: function (msg) {
            subscriptions.subscribe(msg.sender, msg.cmdval);
            msg.respond("success");
        },
        unsubscribe: function (msg) {
            subscriptions.unsubscribe(msg.sender, msg.cmdval);
            msg.respond("success");
        }
    };



jabber.on("message", function (msg) {

    if (typeof actions[msg.cmd] !== "undefined") {
        actions[msg.cmd](msg);
    } else {
        msg.respond(helptext);
    }

});


function randomNumber(min, max) {
    var r;
    do { r = Math.random(); }
    while (r === 1.0);
    return min + parseInt(r * (max - min + 1), 10);
}


function checkURL(itemName, itemObject, callback) {
    jsdom.env(itemObject.url, ["https://raw.github.com/jquery/sizzle/master/sizzle.js"], function (err, window) {
        var data = {};
        itemObject.conditions.forEach(function (condition) {
            data[condition.label] = window.Sizzle(condition.query).length === condition.length;
        });
        callback([itemName, data]);
    });
}


function formatMessage(data) {
    var str = data[0] + ": ",
        label;
    for (label in data[1]) {
        if (data[1].hasOwnProperty(label)) {
            if (data[1][label]) {
                str += "is " + label + ". ";
            } else {
                str += "is not " + label + ". ";
            }
        }
    }
    str += "\n" + list[data[0]].url;
    return str;
}


function handleSubscriptions(subscription, item, data) {
    console.log(data);
    var receiver = subscription.subscribers,
        message = JSON.stringify(data);
    if (subscription.lastMessage !== message) {
        receiver.forEach(function (receiver) {
            console.log("jabber.send", formatMessage(data));
            jabber.send(receiver, formatMessage(data));
        });
    }
    subscription.lastMessage = message;
    subscriptions.save();
}


function tick() {
    var nextTick = randomNumber(2, 7),
        item;
    console.log("tick.");
    for (item in subscriptions.get()) {
        if (subscriptions.get().hasOwnProperty(item) &&
                subscriptions.exists(item) && typeof list[item] !== "undefined") {
            checkURL(item, list[item], handleSubscriptions.bind(null, subscriptions.get(item), item));
        }
    }
    setTimeout(tick, nextTick * 1000 * 60);
    console.log("next tick: ", nextTick, "minutes.");
}


tick();