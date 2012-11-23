var fs = require("fs"),
    subscriptions = JSON.parse(fs.readFileSync("../nexus-check/subscriptions.json")),
    list = JSON.parse(fs.readFileSync("../nexus-check/list.json")),
    newsubscriptions = [],
    newlist = list;

Object.keys(subscriptions).forEach(function (subscription) {
    if (newlist.hasOwnProperty(subscription)) {
        subscriptions[subscription].subscribers.forEach(function (subscriber) {
            newsubscriptions.push(["sub", subscriber, subscription, "\n"].join(";"));
        });
        newlist[subscription].lastMessage = subscriptions[subscription].lastMessage;
    } else {
        console.log("invalid name: ", subscription, "subscribers: ", subscriptions[subscription]);
    }
});

fs.writeFileSync("subscriptions.bak.json", JSON.stringify(subscriptions));
fs.writeFileSync("list.bak.json", JSON.stringify(list));

fs.writeFileSync("subscriptions.json", newsubscriptions.join(""));
fs.writeFileSync("list.json", JSON.stringify(newlist));