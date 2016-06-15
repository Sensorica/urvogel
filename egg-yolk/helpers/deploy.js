var egg = require("../egg.js");
var eggc = new egg;

var config = require("../modules/config.js");

var fs = require("fs-extra");

var accountName = config.edb.account;

var accounts = fs.readJSONSync("./accounts.json");
var account = accounts[accountName];

console.log(account)

eggc.deploy(account, function(err){
	if(err) throw err;
	console.log("Deployed")
	console.log(accounts)
	eggc.initialize_users(accounts, function(err){
		console.log("Contract initialized with users. Enjoy!")
	})
})
	