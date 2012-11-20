var page = require("webpage").create(),
    system = require("system"),
    url = "",
    label = "",
    evaluator = "";

if (system.args.length === 1) {
    console.log("Usage: check-site.js <URL>");
    phantom.exit();
}

url = system.args[1];
label = system.args[2];
evaluator = system.args[3];

page.open(url, function (status) {
    if (status !== "success") {
        console.log("NETWORKERR");
    } else {
        var result = page.evaluate(evaluator);
        console.log(label);
        console.log(JSON.stringify(result));
    }
    phantom.exit();
});