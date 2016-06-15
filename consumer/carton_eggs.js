var fs = require ('fs');
var erisC = require('eris-contracts');

// debug: use docker-machine ip <eris> or w/e
var erisdbURL = "http://192.168.99.100:1337/rpc";

// get the abi and deployed data squared away
var contractData = require('./epm.json');
var eggsContractAddress = contractData["deployStorageK"]; //probably needs to change... ?
//var eggsAbi = JSON.parse(fs.readFileSync("./abi/" + eggsContractAddress));
var eggsAbi = JSON.parse(fs.readFileSync("eggtracker.abi"));

// properly instantiate the contract objects manager using the erisdb URL
// and the account data (which is a temporary hack)
var accountData = require('./accounts.json');
// note: fackaccount is needed to query the chain
var contractsManager = erisC.newContractManagerDev(erisdbURL, accountData.trackingchain_developer_000);

// properly instantiate the contract objects using the abi and address
var eggsContract = contractsManager.newContractFactory(eggsAbi).at(eggsContractAddress);

function createEgg(description, secretHash, callback) {
	eggsContract.createEgg(description, secretHash, function(error, result){
	if (error) { throw error }
    		console.log("Egg created: " + result.toString());
	});

}

function transferEgg(eggID, newOwner, callback) {
	eggsContract.transferEgg(eggID, newOwner, function(error, result){
	if (error) { throw error }
    		console.log("Egg transfered: " + result.toString());
	});
}

function claimEgg(eggID, secret, newSH, callback) {
	eggsContract.claimEgg(eggID, secret, newSH, function(error){
    	if (error) { throw error }
		callback("success claiming")
	});
}

// get egg history
// requires cartonID passed in from URL
function getEggHistory(cartonID, callback) { //return something
	eggsContract.getEggData(cartonID, function(error, result){
    	if (error) { throw error }
		var res = result.toString();
    		console.log("Log of egg carton history: " + res);
		//callback(result.toString())
		var totalEvents = res.split(',');
		console.log("total events: " + totalEvents[5])
		for(var eventNumber = 1; eventNumber <= totalEvents[5]; eventNumber++) {
			eventInformation(cartonID, eventNumber, function(error, result){
			if (error) { throw error }
			console.log("Where you eggs have been: %s")
			callback(result.toString())
			});	
	
		}
  	});
}

function eventInformation(cartonID, eventNumber) { // return something
  	eggsContract.getHistoryEntry(cartonID, eventNumber, function(error, result){
    	if (error) { throw error }
	console.log("Place # %s, %s", eventNumber.toString(), result.toString());
	});
}

// start up a server
var http = require('http');
var url = require('url');

const PORT=1212

var server = http.createServer(handleRequest);

server.listen(PORT, function(){
	console.log("Egg provenance server listening on: http://localhost:%s", PORT);
});

function handleRequest(request, response){
	var cartonID = request.url.substr(1);
	console.log("Request for cartonID: " + cartonID + " received.");
	getEggHistory(cartonID, function(id) {
		console.log("some info: %s", id);
	});
	var newBytes = "1cfc1e4dca49a6455be65fcbd2a246d010d29f9e338709050e17221bda60ebea"
	var deseBytes = "2f56ac4dca49a6455be65fcbd2a246d010d29f9e338709050e17221bda604567"
	//createEgg("rottenEgg", deseBytes, function(id) {
	//	console.log("some info: %s", id);
	//});
	//var addr = "EA58F6DE2C3837D6F63178832DDBF823563643EC"
	//transferEgg(cartonID, addr, function(id) {
	//	console.log("some info: %s", id);
	//});
	claimEgg(cartonID, deseBytes, newBytes, function(id) {
		console.log("claimed: %s", id);
	});
	response.end('Your eggs history is:' + cartonID)
}
