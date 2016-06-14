var fs = require ('fs');
var erisC = require('eris-contracts');

// debug: use docker-machine ip <eris> or w/e
var erisdbURL = "http://192.168.99.100:1337/rpc";

// get the abi and deployed data squared away
var contractData = require('./epm.json');
var eggsContractAddress = contractData["deployStorageK"]; //probably needs to change... ?
var eggsAbi = JSON.parse(fs.readFileSync("./abi/" + eggsContractAddress));

// properly instantiate the contract objects manager using the erisdb URL
// and the account data (which is a temporary hack)
var accountData = require('./accounts.json');
// note: fackaccount is needed to query the chain
var contractsManager = erisC.newContractManagerDev(erisdbURL, accountData.eggchain_fakeaccount_000);

// properly instantiate the contract objects using the abi and address
var eggsContract = contractsManager.newContractFactory(eggsAbi).at(eggsContractAddress);

// get egg history
// requires cartonID passed in from URL
function getHistory(cartonID) { //return something
	eggsContract.getEggData(cartonID, function(error, result){
    	if (error) { throw error }
    	console.log("Log of egg carton history" + result.toString());
  	});
}
// var placesCartonWent = getEggData.historyLength
// loop through placesCartonWent

function locationInformation(cartonID, eventNumber) {
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
	var cartonID = url.parse(request.url).pathname
	console.log("Request for cartonID" + cartonID + " received.");

	response.end('Your eggs history is:')
}
