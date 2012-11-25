var fs            = require("fs"),
    jsdom         = require("jsdom"),
    xmpp          = require("./lib/xmpp"),
    Subscriptions = require("./lib/subscriptions"),
    list          = require("./list.json"),
    config        = require("./config.json"),
    subscriptions = new Subscriptions("./subscriptions.json", init),
    jabber        = null,
    RANDOM_TICK   = [1 * 1000 * 60, 6 * 1000 * 60],
    CACHE_TIME    = RANDOM_TICK[0],
    cache         = {},
    messages      = {},
    helptext      = "Type 'list' (without the quotation marks) to see a list of devices.\n\n" +
        "Type 'status <device>[, <device>, ...]' (where device is one or " +
        "more of the device names returned by the 'list' call) to see it's status.\n\n" +
        "Type 'status' or 'status all' to see the status of all devices.\n\n" +
        "Type 'subscribe <device>[, <device>, ...]' to subscribe for updates. " +
        "As soon as the device(s) become available I'll send you a message.\n\n" +
        "Type 'unsubscribe <device>[, <device>, ...]' to not get updates for the device(s) anymore.\n\n" +
        "Type 'subscriptions' to see a list of devices you are subscribed to.\n\n" +
        "This bot was written by +Björn Brauer (http://goo.gl/9OMAE). " +
        "More detailed information about the bot can be found here: http://goo.gl/eByrX",


    logger = (function () {

        var loglevel = ["log", "info", "warn", "error"],
            logger = {},
            errLog = fs.createWriteStream("./logs/error.log", { "flags": "a" }),
            debugLog = fs.createWriteStream("./logs/debug.log", { "flags": "a"});

        function pad(number) {
            return number <= 9 ? "0" + String(number) : String(number);
        }

        function formatDate() {
            var now = new Date(),
                date = [pad(now.getMonth()), pad(now.getDate()), now.getFullYear()].join("/"),
                time = [pad(now.getHours()), pad(now.getMinutes()), pad(now.getSeconds())].join(":");
            return "[" + date + " - " + time + "]";
        }

        function writeLog(level, args) {
            (level === 3 ? errLog : debugLog).write(JSON.stringify(args) + "\n");
        }

        function log(level, args) {
            args = [formatDate()].concat(Array.prototype.slice.call(args));
            console[loglevel[level]].apply(console, args);
            writeLog(level, args);
        }

        loglevel.forEach(function (level, i) {
            logger[level] = function () { log(i, arguments); };
        });

        return logger;

    }()),


    actions = {

        list: function (msg) {
            msg.respond(Object.keys(list).join(", "));
        },

        status: function (msg) {

            if (msg.cmdval === "all" || msg.cmdval === "") {
                Object.keys(list).forEach(function (item) {
                    checkStatus(item, list[item], function (data) {
                        msg.respond(formatMessage(data[0], data[1]));
                    });
                });
            } else {
                eachItem(msg.cmdval, function (item) {
                    if (typeof list[item] !== "undefined") {

                        checkStatus(item, list[item], function (data) {
                            msg.respond(formatMessage(data[0], data[1]));
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


function formatMessage(name, data) {
    var str = name + ": ",
        label;
    for (label in data) {
        if (data.hasOwnProperty(label)) {
            if (data[label]) {
                str += "is " + label + ". ";
            } else {
                str += "is not " + label + ". ";
            }
        }
    }
    return str;
}


// TODO: refactor every function below this comment.

function checkStatus(itemName, itemObject, callback, force) {
    if (typeof cache[itemName] === "undefined") {
        cache[itemName] = { data: [], time: 0 };
    }
    if (!force && Date.now() - cache[itemName].time < CACHE_TIME) {
        logger.log("checkStatus", itemName, "responding with cached data", "age" +
            cache[itemName].time, cache[itemName].data);
        callback([itemName, cache[itemName].data]);
    } else {
        logger.log("checkStatus", itemName, "retrieving new data");
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
        logger.log("checkURL", "got data for " + itemName, data);
        callback([itemName, data]);
        window.close();
    });
}


function sendMessage(data, jid) {

    var text       = formatMessage(list[data[0]].url, data[1]),
        key        = jid + text,
        message    = messages[key] || { retries: 0, data: data, jid: jid },
        slotTime   = 3,
        maxTimes   = Math.pow(2, message.retries) - 1,
        multiplier = message.retries <= 10 ? randomNumber(0, maxTimes) : maxTimes,
        timeout    = multiplier * slotTime;

    if (message.retries >= 16) {
        logger.error("message has reached more than 16 retries. giving up.", message);
        delete messages[key];
        return;
    }

    if (message.deleteTimeout) {
        clearTimeout(message.deleteTimeout);
        message.deleteTimeout = null;
    }

    setTimeout(function () {

        jabber.send(jid, text);
        logger.log("Sending message (retry: " + message.retries + ", in " +
                timeout + " seconds) to: " + jid, "text: " + text);

        // Delete the message object after timeout + 10 Minutes.
        messages[key].deleteTimeout = setTimeout(function () {
            delete messages[key];
        }, timeout * 1000 + (10 * 60 * 1000));

    }, timeout * 1000);

    message.retries += 1;
    messages[key] = message;

}


function handleSubscriptions(receiver, itemObject, data) {
    logger.log("handleSubscriptions", receiver, data);
    var message = JSON.stringify(data);
    if (itemObject.lastMessage && itemObject.lastMessage !== message) {
        receiver.forEach(sendMessage.bind(null, data));
        logger.log("handleSubscriptions", "notifying all subscribers");
    }
    itemObject.lastMessage = message;
    fs.writeFile("./list.json", JSON.stringify(list, null, 4));
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
        logger.log(jid.user, "is online.");
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

    jabber.on("stanzaerror", function (stanza) {
        var message;
        logger.error("[xmpp error]", stanza.toString());
        if (stanza.name === "message" && stanza.getChild("error").attrs.code === "503") {
            logger.log("Service unavailable. Probably exceeded quota. Try to reschedule the message later.");
            message = messages[stanza.attrs.from + stanza.getChild("body").getText()];
            if (message && message.data && message.jid) {
                sendMessage(message.data, message.jid);
            }
        }
    });

    tick();

}