var fs            = require("fs"),
    jsdom         = require("jsdom"),
    xmpp          = require("./lib/xmpp"),
    Subscriptions = require("./lib/subscriptions"),
    list          = require("./list.json"),
    config        = require("./config.json"),
    subscriptions = new Subscriptions("./subscriptions.json", init),
    jabber        = null,
    cache         = {},
    CACHE_TIME    = 3 * 1000 * 60,
    RANDOM_TICK   = [2 * 1000 * 60, 6 * 1000 * 60],
    helptext      = "Type 'list' (without the quotation marks) to see a list of devices.\n\n" +
        "Type 'status <device>[, <device>, <device>,...]' (where device is one or " +
        "more of the device names returned by the 'devices' call) to see it's status.\n\n" +
        "Type 'subscribe <device>[, <device>, <device>,...]' to subscribe for updates. " +
        "As soon as the device(s) become available I'll send you a message.\n\n" +
        "Type 'unsubscribe <device>[, <device>, <device>,...]' to not get updates for the device(s) anymore.\n\n" +
        "Type 'subscriptions' to see a list of devices you are subscribed to.\n\n" +
        "This bot was written by +Björn Brauer (http://goo.gl/9OMAE). " +
        "More detailed information about the bot can be found here: http://goo.gl/eByrX",

    logger = {
        0: "log",
        1: "info",
        2: "warn",
        3: "error",
        log: function (level, message) {
            var date = new Date(),
                time = date.getMonth() + "/" + date.getDate() + "/" + date.getFullYear() + " - " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
            if (typeof level !== "number") {
                message = level;
                level = 1;
            }
            console[this[level]].apply(console, ["[" + time + "]"].concat(message));
        },
        error: function (message) {
            this.log(3, message);
        }
    },


    actions = {

        list: function (msg) {
            msg.respond(Object.keys(list).join(", "));
        },

        status: function (msg) {

            if (msg.cmdval === "all" || msg.cmdval === "") {
                Object.keys(list).forEach(function (item) {
                    checkStatus(item, list[item], function (data) {
                        msg.respond(formatMessage(data));
                    });
                });
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
            msg.respond(subscriptions.getSubscriptions(email(msg.sender)).join(", "));
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

function checkStatus(itemName, itemObject, callback, force) {
    if (typeof cache[itemName] === "undefined") {
        cache[itemName] = { data: [], time: 0 };
    }
    if (!force && Date.now() - cache[itemName].time < CACHE_TIME) {
        callback([itemName, cache[itemName].data]);
    } else {
        checkURL(itemName, itemObject, function (data) {
            cache[itemName].data = data[1];
            cache[itemName].time = Date.now();
            callback(data);
        });
    }
}


function checkURL(itemName, itemObject, callback) {
    logger.log("checkURL: " + itemObject.url);
    jsdom.env(itemObject.url, ["https://raw.github.com/jquery/sizzle/master/sizzle.js"], function (err, window) {
        if (err !== null) {
            logger.error("jsdom error!", err);
            // TODO: Error handling
            return;
        }
        var data = {};
        itemObject.conditions.forEach(function (condition) {
            data[condition.label] = window.Sizzle(condition.query).length === condition.length;
        });
        callback([itemName, data]);
        window.close();
    });
}


function handleSubscriptions(receiver, itemObject, data) {
    logger.log(data);
    var message = JSON.stringify(data);
    if (itemObject.lastMessage && itemObject.lastMessage !== message) {
        receiver.forEach(function (receiver) {
            logger.log("jabber.send", formatMessage(data));
            jabber.send(receiver, formatMessage(data));
        });
    }
    itemObject.lastMessage = message;
    fs.writeFile("./list.json", JSON.stringify(list));
}


function tick() {
    var nextTick = randomNumber.apply(null, RANDOM_TICK),
        item;
    logger.log("tick.");
    for (item in subscriptions.get()) {
        if (subscriptions.get().hasOwnProperty(item) &&
                subscriptions.exists(item) && typeof list[item] !== "undefined") {
            checkStatus(item, list[item], handleSubscriptions.bind(null, subscriptions.get(item), list[item]), true);
        }
    }
    setTimeout(tick, nextTick);
    logger.log("next tick: " + (nextTick / 1000) + " seconds.");
}



function init() {

    jabber = new xmpp.XMPP(config.jabber);

    jabber.on("connected", function (jid) {
        logger.log(jid, "is online.");
    });

    jabber.on("message", function (msg) {

        logger.log("Message from", email(msg.sender), msg.text);

        if (typeof actions[msg.cmd] !== "undefined") {
            actions[msg.cmd](msg);
        } else {
            msg.respond(helptext);
        }

    });

    jabber.on("error", function (err) {
        logger.error("[xmpp error]", err);
    });

    tick();

}