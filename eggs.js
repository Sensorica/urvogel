
var fs = require ('fs');
var prompt = require('prompt');
var erisC = require('eris-contracts');

var nfc  = require('./externals/node-nfc/index').nfc
  , util = require('util')
  , version = nfc.version()
  , devices = nfc.scan()
  ;

console.log('version: ' + util.inspect(version, { depth: null }));
console.log('devices: ' + util.inspect(devices, { depth: null }));

var erisdbURL = "http://localhost:1337/rpc";

// get the abi and deployed data squared away
var contractData = require('./contracts_abi/epm.json');
var eggsContractAddress = contractData["deployStorageK"];
var eggsAbi = JSON.parse(fs.readFileSync("./contracts_abi/abi/" + eggsContractAddress));

// properly instantiate the contract objects manager using the erisdb URL
// and the account data (which is a temporary hack)
var accountData = require('./contracts_abi/accounts.json');
var contractsManager = erisC.newContractManagerDev(erisdbURL, accountData.eggchain_full_001);

// properly instantiate the contract objects using the abi and address
var eggsContract = contractsManager.newContractFactory(eggsAbi).at(eggsContractAddress);

// display the current value of idi's contract by calling
// the `get` function of idi's contract
function getValue(callback) {
  eggsContract.get(function(error, result){
    if (error) { throw error }
    console.log("Egg number now is:\t\t\t" + result.toNumber());
    callback();
  });
}

// prompt the user to change the value of idi's contract
function changeValue() {
  prompt.message = "What number should Idi make it?";
  prompt.delimiter = "\t";
  prompt.start();
  prompt.get(['value'], function (error, result) {
    if (error) { throw error }
    setValue(result.value)
  });
}

// using eris-contracts call the `set` function of idi's
// contract using the value which was recieved from the
// changeValue prompt
function setValue(value) {
  eggsContract.set(value, function(error, result){
    if (error) { throw error }
    getValue(function(){});
  });
}

function read(deviceID) {
  console.log('');
  var nfcdev = new nfc.NFC();

  nfcdev.on('read', function(tag) {
    console.log(util.inspect(tag, { depth: null }));
    if ((!!tag.data) && (!!tag.offset)) {
      console.log(util.inspect(nfc.parse(tag.data.slice(tag.offset)), { depth: null }));
      console.log("Got eggs...") 
      
      eggsContract.get(function(error, result){
        if (error) { throw error }
        curEggs = result.toNumber();
        console.log("Current eggs number is:\t\t\t" + result.toNumber());
        console.log("Adding a dozen eggs")
        setValue(curEggs+12);
      });

      nfcdev.stop();

    } else {
      console.log("No data")
    }

  });

  nfcdev.on('error', function(err) {
    console.log(util.inspect(err, { depth: null }));
  });

  nfcdev.on('stopped', function() {
    console.log('stopped');
  });

  console.log(nfcdev.start(deviceID));
}

//for (var deviceID in devices) read(deviceID);
for (var deviceID in devices) {
  read(deviceID);
}


