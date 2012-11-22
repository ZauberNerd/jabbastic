var path          = require("path"),
    spawn         = require("child_process").spawn,
    phantomjs     = require("phantomjs").path,
    xmpp          = require("./lib/xmpp"),
    Subscriptions = require("./lib/subscriptions"),
    list          = require("./list.json"),
    config        = require("./config.json"),
    jabber        = new xmpp.XMPP(config.jabber),
    subscriptions = new Subscriptions("./subscriptions.json"),
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


var tmpResults = {},
    counter = 0;


function spawnPhantom(url, label, evaluator, callback) {

    // var uid = parseInt(Date.now() / 10 / 1000, 10);
    var uid = counter++;

    tmpResults[label + uid] = [];

    var phantom = spawn(phantomjs, [path.join(__dirname, "check-site.js"), url, label, evaluator]);

    phantom.stdout.setEncoding("utf-8");

    (function (resultLabel) {
        phantom.stdout.on("data", function (data) {
            var str = data.toString(),
                lines = str.split(/(\r?\n)/g),
                length = lines.length,
                i;

            for (i = 0; i < length; i++) {
                if (lines[i].length !== 0 && lines[i] !== "\n") {
                    tmpResults[resultLabel].push(lines[i]);
                }
            }

            if (tmpResults[resultLabel].length === 2) {
                tmpResults[resultLabel][1] = JSON.parse(tmpResults[resultLabel][1]);
                callback(tmpResults[resultLabel]);
                delete tmpResults[resultLabel];
            }

        });
    }(label + uid));

}


function createEvaluator(conditions) {
    return "function () {" +
        "var conditions = " + JSON.stringify(conditions) + "," +
            "retVal = {};" +
        "conditions.forEach(function (condition) {" +
            "retVal[condition.label] = document.querySelectorAll(condition.query).length === condition.length;" +
        "});" +
        "return retVal;" +
    "}";
}


function checkURL(itemName, itemObject, callback) {
    spawnPhantom(itemObject.url, itemName, createEvaluator(itemObject.conditions), callback);
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
    data = JSON.stringify(data);
    var receiver = subscription.subscribers;
    if (subscription.lastMessage !== data) {
        receiver.forEach(function (receiver) {
            // jabber.send(receiver, formatMessage(data));
        });
    }
    subscription.lastMessage = data;
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