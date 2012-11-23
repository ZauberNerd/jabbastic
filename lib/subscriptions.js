var fs     = require("fs"),
    byline = require("byline");




function parseLine(tmpSubs, line) {
    var data = line.split(";"),
        action = data[0] === "sub" ? "subscribe" : "unsubscribe";

    tmpSubs[action](data[1], data[2]);
}


function pushUnique(key, item) {
    if (this.subscriptions[key].indexOf(item) === -1) {
        this.subscriptions[key].push(item);
    }
}


function merge(tmpSubs, key) {
    var tmpArr = [];

    if (typeof this.subscriptions[key] === "undefined") {
        this.subscriptions[key] = tmpSubs[key];
    } else {
        tmpArr = this.subscriptions[key].concat(tmpSubs[key]);
        tmpArr.forEach(pushUnique.bind(this, key));
    }
}


function mergeSubscriptions(tmpSubs) {
    Object.keys(tmpSubs).forEach(merge.bind(this, tmpSubs));
    if (typeof this.callback === "function") {
        this.callback();
    }
}




module.exports = Subscriptions;


function Subscriptions(file, callback) {

    this.file          = file;
    this.callback      = callback;
    this.subscriptions = {};

    if (file !== null) {
        this.parse(file);
        this.createLog(file);
    }

}


Subscriptions.prototype.parse = function (file) {

    var stream = byline(fs.createReadStream(file)),
        tmpSubs = new Subscriptions(null);

    stream.on("data", parseLine.bind(null, tmpSubs));
    stream.on("end", mergeSubscriptions.bind(this, tmpSubs.subscriptions));

};


Subscriptions.prototype.createLog = function (file) {
    this.logStream = fs.createWriteStream(file, {'flags': 'a'});
};


Subscriptions.prototype.log = function (action, jid, key) {
    if (typeof this.logStream !== "undefined") {
        this.logStream.write([action, jid, key, "\n"].join(";"));
    }
};


Subscriptions.prototype.get = function (key) {
    return key ? this.subscriptions[key] : this.subscriptions;
};


Subscriptions.prototype.exists = function (key) {
    return typeof this.subscriptions[key] !== "undefined";
};


Subscriptions.prototype.isSubscribed = function (jid, key) {
    return this.subscriptions[key].indexOf(jid) !== -1;
};


Subscriptions.prototype.subscribe = function (jid, key) {

    var retVal = false;

    if (!this.exists(key)) {
        this.subscriptions[key] = [];
    }

    if (!this.isSubscribed(jid, key)) {
        this.subscriptions[key].push(jid);
        this.log("sub", jid, key);
        retVal = true;
    }

    return retVal;

};


Subscriptions.prototype.unsubscribe = function (jid, key) {

    var index = -1,
        retVal = false;

    if (this.exists(key)) {
        index = this.subscriptions[key].indexOf(jid);
        if (index !== -1) {
            this.subscriptions[key].splice(index, 1);
            this.log("unsub", jid, key);
            retVal = true;
        }
        if (this.subscriptions[key].length === 0) {
            delete this.subscriptions[key];
        }
    }

    return retVal;

};