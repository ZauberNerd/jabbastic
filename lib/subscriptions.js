var fs = require("fs");

module.exports = Subscriptions;


function Subscriptions(file) {

    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, "{}");
    }

    this.file = file;
    this.subscriptions = JSON.parse(fs.readFileSync(file));

}


Subscriptions.prototype.save = function () {
    fs.writeFile(this.file, JSON.stringify(this.subscriptions));
};


Subscriptions.prototype.get = function (key) {

    return key ? this.subscriptions[key] : this.subscriptions;

};


Subscriptions.prototype.exists = function (key) {
    return typeof this.subscriptions[key] !== "undefined";
};


Subscriptions.prototype.isSubscribed = function (jid, key) {
    if (this.exists(key)) {
        return typeof this.subscriptions[key].subscribers.indexOf(jid) !== -1;
    }
};


Subscriptions.prototype.subscribe = function (jid, key) {

    key = key.split(",");

    key.forEach(function (key) {
        key = key.trim();

        if (key === "") {
            return;
        }

        if (!this.exists(key)) {
            this.subscriptions[key] = { subscribers: [], lastMessage: "" };
        }

        if (!this.isSubscribed(jid) && this.exists(key)) {
            this.subscriptions[key].subscribers.push(jid);
        }

    }, this);

};


Subscriptions.prototype.unsubscribe = function (jid, key) {

    key = key.split(",");

    key.forEach(function (key) {
        var index = -1;
        key = key.trim();

        if (this.exists(key)) {
            index = this.subscriptions[key].subscribers.indexOf(jid);
            if (index !== -1) {
                this.subscriptions[key].subscribers.splice(index, 1);
            }
            if (this.subscriptions[key].subscribers.length === 0) {
                delete this.subscriptions[key];
            }
        }

    }, this);

};