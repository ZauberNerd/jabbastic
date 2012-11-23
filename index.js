var fs            = require("fs"),
    jsdom         = require("jsdom"),
    xmpp          = require("./lib/xmpp"),
    Subscriptions = require("./lib/subscriptions"),
    list          = require("./list.json"),
    config        = require("./config.json"),
    subscriptions = new Subscriptions("./subscriptions.json", init),
    jabber        = null,
    helptext      = "Type 'list' (without the quotation marks) to see a list of devices.\n\n" +
        "Type 'status <device>[, <device>, <device>,...]' (where device is one or " +
        "more of the device names returned by the 'devices' call) to see it's status.\n\n" +
        "Type 'subscribe <device>[, <device>, <device>,...]' to subscribe for updates. " +
        "As soon as the device(s) become available I'll send you a message.\n\n" +
        "Type 'unsubscribe <device>[, <device>, <device>,...]' to not get updates for the device(s) anymore.\n\n" +
        "This bot was written by +Björn Brauer (http://goo.gl/9OMAE). " +
        "More detailed information about the bot can be found here: http://goo.gl/eByrX",


    actions = {

        list: function (msg) {
            msg.respond(Object.keys(list).join(", "));
        },

        status: function (msg) {

            if (msg.cmdval === "all" || msg.cmdval === "") {
                msg.respond("TODO: return status for all devices at once.");
            } else {
                eachItem(msg.cmdval, function (item) {
                    if (typeof list[item] !== "undefined") {

                        checkStatus(item, list[item], function (data) {
                            msg.respond(formatMessage(data));
                        });

                    } else {
                        msg.respond("invalid device name: " + item);
                    }
                });
            }

        },

        subscribe: function (msg) {

            eachItem(msg.cmdval, function (item) {
                if (typeof list[item] !== "undefined") {

                    if (subscriptions.subscribe(email(msg.sender), item)) {
                        msg.respond("successfully subscribed to: " + item);
                    } else {
                        msg.respond("you are already subscribed to: " + item);
                    }

                } else {
                    msg.respond("invalid device name: " + item);
                }
            });

        },

        unsubscribe: function (msg) {

            eachItem(msg.cmdval, function (item) {
                if (typeof list[item] !== "undefined") {

                    if (subscriptions.unsubscribe(email(msg.sender), item)) {
                        msg.respond("successfully unsubscribed from: " + item);
                    } else {
                        msg.respond("you weren't subscribed to: " + item);
                    }

                } else {
                    msg.respond("invalid device name: " + item);
                }
            });

        },

        subscriptions: function (msg) {
            msg.respond("TODO: list all subscriptions.");
        }
    };


function email(jid) {
    return jid.user + "@" + jid.domain;
}


function eachItem(items, callback) {
    items = items.split(",");
    items.forEach(function (item) {
        item = item.trim().toLowerCase();
        callback(item);
    });
}


function randomNumber(min, max) {
    var r;
    do { r = Math.random(); }
    while (r === 1.0);
    return min + parseInt(r * (max - min + 1), 10);
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


// TODO: refactor every function below this comment.

function checkStatus(itemName, itemObject, callback) {
    // TODO: Cache!
    checkURL(itemName, itemObject, callback);
}


function checkURL(itemName, itemObject, callback) {
    jsdom.env(itemObject.url, ["https://raw.github.com/jquery/sizzle/master/sizzle.js"], function (err, window) {
        if (err !== null) {
            console.error("jsdom error!", err);
            // TODO: Error handling
            return;
        }
        var data = {};
        itemObject.conditions.forEach(function (condition) {
            data[condition.label] = window.Sizzle(condition.query).length === condition.length;
        });
        callback([itemName, data]);
    });
}


function handleSubscriptions(receiver, itemObject, data) {
    console.log(data);
    var message = JSON.stringify(data);
    if (itemObject.lastMessage && itemObject.lastMessage !== message) {
        receiver.forEach(function (receiver) {
            console.log("jabber.send", formatMessage(data));
            jabber.send(receiver, formatMessage(data));
        });
    }
    itemObject.lastMessage = message;
    fs.writeFile("./list.json", JSON.stringify(list));
}


function tick() {
    var nextTick = randomNumber(2, 7),
        item;
    console.log("tick.");
    for (item in subscriptions.get()) {
        if (subscriptions.get().hasOwnProperty(item) &&
                subscriptions.exists(item) && typeof list[item] !== "undefined") {
            checkStatus(item, list[item], handleSubscriptions.bind(null, subscriptions.get(item), list[item]));
        }
    }
    setTimeout(tick, nextTick * 1000 * 60);
    console.log("next tick: ", nextTick, "minutes.");
}



function init() {

    jabber = new xmpp.XMPP(config.jabber);
    tick();

    jabber.on("message", function (msg) {

        if (typeof actions[msg.cmd] !== "undefined") {
            actions[msg.cmd](msg);
        } else {
            msg.respond(helptext);
        }

        console.log(msg);

    });

}