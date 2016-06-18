var sqlite3 = require('sqlite3')
var util = require('util');
var async = require('async');
var EventEmitter = require('events');

var parallelLimit = 1;


//Goal pass a structure definition JS object, a contract and a SQL database (Assumes you are using sqllite3)

function sqlcache(filename, account, callback){
	//Sqlcache object is initialized to automatically maintain a table created for that contract
	//under the name contractname
	this.db = new sqlite3.Database(filename, callback);
	this.contracts = {};
	this.accessAccount = account;

	this.emitter = new EventEmitter;

}

//util.inherits(sqlcache, EventEmitter);

module.exports = sqlcache;

for (var k in sqlite3.Database.prototype){
	sqlcache.prototype[k] = function(){
		this.db[k].apply(this.db, arguments)
	}
}

//This is a very expensive operation. should only be used if you have nothing better to do
sqlcache.prototype.initTables = function(contractName, cb){
	var self = this;


	if(!this.contracts[contractName]){
		return cb(new Error("A contract by " + contractName + " was not found"));
	}

	var structDef = this.contracts[contractName].SD;
	var contract = this.contracts[contractName].contract;

	var initSeq = structDef.initSeq;
	var tables = structDef.tables;
	var initCalls = structDef.initCalls;
	var secCalls = structDef.secCalls;

	//Now need to find the maximums for each key Run through the non-dependent keys first then
	//the dependent calls.

	//Non-dependent calls
	async.forEachOf(initCalls, function(keyarray, call, callback){
		//Check the contract has a function for this call
		contract[call](function(err, data){
			data = data.values; 
			if (err) return callback(err);
			//Unpack the max key values you got from this call
			for (var i = 0; i < keyarray.length; i++) {
				var key = keyarray[i];

				//TODO remove this check once abi checks are in pre-processing
				if (!data[initSeq[key].field]){
					return callback(new Error("The return data for  " + call + " did not have a field " + initSeq[key].field + " required for " + key))
				}

				//This check can probably also be avoided by doing pre-processing of the abi
				try{
					initSeq[key].max = parseInt(data[initSeq[key].field]);
				} catch (err){
					return callback(err);
				}
			};
				
			return callback(null);
		})
	}, function(err){
		if(err) return cb(err);
		//Time to run the second round of keys
		async.forEachOf(secCalls, function(keysobj, call, callback){
			var keyarray = keysobj.keyarray;
			var dependent = keysobj.dependent;

			//loop through all dependent key values and make calls to function
			var indices = []
			for (var i = initSeq[dependent].min; i <= initSeq[dependent].max; i++) {
				indices.push(i);
			};

			async.eachLimit(indices, parallelLimit, function(i, callback2){
				contract[call](i, function(err, data){
					if (err) return callback2(err);
					data = data.values;
					//Unpack the max key values you got from this call
					for (var j = 0; j < keyarray.length; j++) {
						var key = keyarray[j];
						if (!data[initSeq[key].field]){
							return callback2(new Error("The return data for  " + call + " did not have a field " + initSeq[key.field] + " required for " + key))
						}
						if(!initSeq[key].max){
							initSeq[key].max = {};
						}
						initSeq[key].max[i] = parseInt(data[initSeq[key].field]);
						i += 1;
					};
					return callback2(null);
				})
			}, callback)
		}, function(err){
			if(err) return cb(err);

			//Now InitSeq is ready to run all the table fillings
			//loop through the tables then loop and loop calls to the update function.
			async.forEachOf(tables, function(table, tabName, callback){

				var key1 = table.keys[0];
				var key2 = "";
				var tks = false;

				if (table.keys.length == 2){
					key2 = table.keys[1];
					tks = true;

					if(initSeq[key1].dependent){
						key2 = key1;
						key1 = table.keys[1]
					}
				}

				var kpairs = [];
				for (var i = initSeq[key1].min; i <= initSeq[key1].max; i++) {
					if (tks){
						var kv2max = (!initSeq[key2].dependent) ? initSeq[key2].max : initSeq[key2].max[i];
						for (var j = initSeq[key2].min; j <= kv2max; j++) {
							kpairs.push([i, j]);
						};
					} else {
						kpairs.push([i]);
					}
				};

				async.eachLimit(kpairs, parallelLimit, function(keys, callback2){
					if(tks){
						self.update(contractName, tabName, keys[0], keys[1], callback2);
					} else {
						self.update(contractName, tabName, keys[0], callback2);
					}
				}, callback);
			}, cb)
		})
	})
}


function processOutput(output){
	var Pop = {};
	Pop.name = output.name;

	switch(true){
		case /bytes/i.test(output.type):
			Pop.type = "VARCHAR(100)";
			Pop.isString = true;
			break;
		case /int/i.test(output.type):
			Pop.type = "INT";
			Pop.isString = false;
			break;
		case /address/i.test(output.type):
			Pop.type = "VARCHAR(100)";
			Pop.isString = true;
			break;
		case /bool/i.test(output.type):
			Pop.type = "BOOLEAN";
			Pop.isString = false;
			break;
		case /string/i.test(output.type):
			Pop.type = "TEXT";
			Pop.isString = true;
			break;
		default:
			throw new Error("Could not Identify return type: " + output.type);
	}

	return Pop;
}

function useOutput(output){
	// This might be expanded over time
	//Currently I only know that exists is a special name that can't be used
	if (output.name == 'exists'){
		return false;
	}

	return true;
}

function preprocess(contract, contractName, SD){

	var NSD = {initSeq:{}, initCalls:{}, secCalls:{}, tables:{}};
	var seenKeys = {};
	//Step 1 Check the tables
	if (!SD.tables) throw new Error("The structure Definition file does not have a \'tables\'' object");
	if (!SD.initSeq) throw new Error("The structure Definition file does not have a \'initSeq\'' object");
	
	NSD.initSeq = SD.initSeq;
	for (tabName in SD.tables){
		var table = SD.tables[tabName];
		//Mandatory structure
		if (!table.call || !table.keys) throw new Error("The table definition \'" + tabName + "\' is missing either \'keys\' or \'call\' and could not be processed");
	
		if (!contract[table.call]) throw new Error("The table \'" + tabName + "s\' call function \'" + table.call + "\' does not appear in the contract.");

		if (table.keys.length != 1 && table.keys.length != 2) throw new Error("The keys array for \'" + tabName + "\' has either too many or too few members (Max is 2)");

		NSD.tables[tabName] = {};
		NSD.tables[tabName].call = table.call;
		NSD.tables[tabName].keys = table.keys;
//		NSD.tables[tabName].fields = table.fields;
		NSD.tables[tabName].name = tabName;

		//Fill in this table's fields by reading the abi
		var funcDefs = contract.abi.filter(function(obj){return (obj.type == 'function' && obj.name == table.call)})

		if (funcDefs.length != 1) throw new Error("Function call is not unique: " + table.call);

		var funcDef = funcDefs[0];

		//Process Outputs
		var tabfields = [];
		for (var i = 0; i < funcDef.outputs.length; i++) {
			var output = funcDef.outputs[i];

			//Determine if we should make a column for this output
			if(useOutput(output)){
				tabfields.push(processOutput(output));
			}

		};

		NSD.tables[tabName].fields = tabfields;

		//Check that the inputs and keys match
		//Keys must all have a mentod for obtaining their range (must appear in init seq)
		for (var i = 0; i < table.keys.length; i++) {
			seenKeys[table.keys[i]] = false;

			var keyInInputs = false;
			for (var j = 0; j < funcDef.inputs.length; j++) {
				if(funcDef.inputs[j].name == table.keys[j]){
					keyInInputs = true;
					break;
				}
			};

			if(!keyInInputs){
				throw new Error("A key for the call is not a valid input: " + table.keys[i])
			}
		};
	}

	//Step 2 Check the initialization sequence

	var indkeys = {}
	var depkeys = []
	//This processes which calls need to be made and what keys can be retrieved from them.
	for (var key in SD.initSeq){
		var ind = SD.initSeq[key];

		var call = ind.call;

		seenKeys[key] = true;

		//Check that the call is valid
		if (!contract[ind.call]) throw new Error("The index \'" + key + "s\' max fetch (call) function \'" + ind.call + "\' does not appear in the contract.");

		//Check that the specified field is one of the outputs of the call.
		var funcDefs = contract.abi.filter(function(obj){return (obj.name == ind.call);})
		if (funcDefs.length != 1) throw new Error("Function call is not unique: " + ind.call);

		if (!funcDefs[0].outputs.some(function(output){return (output.name == ind.field)})) throw new Error("The initialization call " + ind.call + " does not have required field " + ind.field)

		if(!ind.dependent){
			if(!NSD.initCalls[call]){
				NSD.initCalls[call] = [];
			}

			indkeys[key] = true;
			NSD.initCalls[call].push(key);
		} else {

			if(!SD.initSeq[ind.dependent]) throw new Error("The dependancy \'" + ind.dependent + "\' for index \'" + key + "\' does not have an initialization definition.")
			if(!NSD.secCalls[call]){
				NSD.secCalls[call] = {keyarray:[], dependent: ind.dependent};
			}

			if(NSD.secCalls[call].dependent != ind.dependent) throw new Error("There are conflicting dependancies for the call \'" + call + "\' and key \'" + key);

			depkeys.push(key);
			NSD.secCalls[call].keyarray.push(key);
		}
	}

	//Check for circular dependancies
	for (var i = 0; i < depkeys.length; i++) {

		if(!SD.initSeq[depkeys[i]].dependent){
			throw new Error("The dependent key " + depkeys[i] + " has is not dependent on any provided independent keys. Needed: " + SD.initSeq[depkeys[i]].dependent)
		}
	};

	//Check all keys have been seen
	for (var key in seenKeys){
		if(!seenKeys[key]) throw new Error("The key: " + key + " is required for initialization but initialization metod not provided for it");
	}

	return NSD;
}


sqlcache.prototype.addContract = function(contract, structDefRaw, contractName, cb){

	var self = this;
	this.contracts = {};

	if(typeof contractName == 'function'){
		cb = contractName;
		contractName = contract.address;
	}

	if(!contract.update){
		return cb(new Error("The contract provided does not have the update event used for all table updates"))
	}

	//Pre process structDef for integrity and sequencing
	var structDef = {};
	try{
		structDef = preprocess(contract, contractName, structDefRaw);
	} catch (err) {
		return cb(err);
	}
	

	this.contracts[contractName] = {SD: structDef, contract: contract, subObj:[]}

	//create tables, Table name is <contractName><tablename>
	for (var key in structDef.tables){
		var table = structDef.tables[key];
		//Create table

		//sql table creation command
		cmd = "CREATE TABLE " + table.name + "(";

		pkeys = "PRIMARY KEY (";
		for (var i = 0; i < table.keys.length; i++) {
			if(i!=0) {
				pkeys += ", ";
				cmd += ", ";
			}
			pkeys += table.keys[i];
			cmd += table.keys[i] + " INT" 
		};
		pkeys += ")"

		for (var i = 0; i < table.fields.length; i++) {
		 	var field = table.fields[i];
		 	cmd += ", " + field.name + " " + field.type 
		}; 
		cmd += ", " + pkeys + ")"

		this.db.run(cmd, function(err){
			console.log(err)
		});
	}

	var sub = function(err, subObj){
		self.contracts[contractName].subObj.push(subObj);
	};

	//Attach a listener for the update event(only one event)
	contract.update(sub, function(err, eventData){

		console.log("UPDATE DETECTED")
		console.log(eventData)
		//Sort based on what kind
		var name = eventData.args.name.toString();
		var key1 = eventData.args.key1;
		var key2 = eventData.args.key2;

		self.emitter.emit('update', {"table":name, "keys":[key1, key2]})

		self.update(contractName, name, key1, key2, function(err){
			if(err) throw err;
		});

	})

	if (contract.remove){
		contract.remove(sub, function(err, eventData){
			console.log("DELETE DETECTED")
			console.log(eventData)
			//Sort based on what kind
			var name = eventData.args.name.toString();
			var key1 = eventData.args.key1;
			var key2 = eventData.args.key2;

			self.remove(contractName, name, key1, key2, function(err){
				if(err) throw err;
			});
		})
	}

	cb(null)
}

sqlcache.prototype.update = function(contractName, name, key1, key2, cb){
	var self = this;

//	console.log("Updating: " + contractName + " : " + name + " : " + key1 + " : " + key2)

	if(!this.contracts[contractName]){
		return cb(new Error("A contract by " + contractName + " was not found"));
	}

	if(typeof key2 == 'function'){
		cb = key2;
	}


	var structDef = this.contracts[contractName].SD;
	var contract = this.contracts[contractName].contract;

	if(!structDef.tables[name]){
		return cb(new Error("A table with name " + name + " was not found"));
	}


	var table = structDef.tables[name];
	var db = this.db;
	//Now the meat
	//Call contract to get new data


	var processReturn = function(err, output, callback){
		// console.log("Processing the return " + name + " : " + key1)
		// console.log(output)
		if(err) {
			console.log(err)
			callback(err)
		}

		output = output.values;

		//Check if row exists or not. if not insert if so update

		var where = " WHERE " + table.keys[0] + "=" + key1 + (table.keys.length == 2 ? " AND " + table.keys[1] + "=" + key2  : "");

		var cols = "(" + table.keys[0] + (table.keys.length == 2 ? ", " + table.keys[1] : "");
		var vals = "VALUES ("  + key1 + (table.keys.length == 2 ? ", " + key2 : "");

		var ins = "INSERT into " + table.name;
		var upd = "UPDATE " + table.name + " SET ";


		for (var i = 0; i < table.fields.length; i++) {
		 	var field = table.fields[i];
	 		if(i != 0) upd +=", ";
		 	if(output[field.name]){
		 		if(field.isString){
		 			cols += ", " + field.name;
				 	vals += ", \'" + output[field.name] +"\'";
				 	upd += field.name + "=\'" + output[field.name] + "\'";
			 	} else {
			 		cols += ", " + field.name;
				 	vals += ", " + output[field.name];
				 	upd += field.name + "=" + output[field.name]
			 	}
		 	} else {
		 		if(field.isString){
		 			cols += ", " + field.name;
				 	vals += ", \'\'";
				 	upd += field.name + "=\'\'";
			 	} else {
			 		cols += ", " + field.name;
				 	vals += ", 0";
				 	upd += field.name + "=0";
			 	}
		 	} 	
		}; 

		cols += ")"
		vals += ")"

		ins += " " + cols + " " + vals;
		upd += where;

		var delflag = false;

		if(output.hasOwnProperty('exists') && output.exists == false){
			var del = "DELETE from " + table.name + where;
			delflag = true;
		}

		console.log(upd)
		console.log(ins)
		console.log(del)

		//Check if it exists
		db.get("SELECT * from " + table.name + where, function(err, row){
			if(row === undefined && !delflag){
				// console.log("blue")
				// console.log(ins)
				db.run(ins, callback);
			} else if (!delflag){
				// console.log("purple")
				// console.log(upd)
				db.run(upd, callback);
			} else {
				// console.log("yellow")
				// console.log(del)
				db.run(del, callback);
			}
			// return callback(null);
		})
	}
	if(table.keys.length == 1){
		// console.log("Pop goes a weasel")
		contract[table.call](key1, function(err, output){processReturn(err, output, cb)})
	} else if (table.keys.length == 2){
		contract[table.call](key1, key2, function(err, output){processReturn(err, output, cb)})
	} else {
		return cb(new Error("TO MANY KEYS"))
	}
}

sqlcache.prototype.remove = function(contractName, name, key1, key2, cb){
	var self = this;

	if(!this.contracts[contractName]){
		return cb(new Error("A contract by " + contractName + " was not found"));
	}

	var structDef = this.contracts[contractName].SD;
	var contract = this.contracts[contractName].contract;

	if(!structDef.tables[name]){
		return cb(new Error("A table with name " + name + " was not found"));
	}

	var table = structDef.tables[name];
	var db = this.db;
	//Now the meat
	//Call contract to get new data

	var where = " WHERE " + table.keys[0] + "=" + key1 + (table.keys.length == 2 ? " AND " + table.keys[1] + "=" + key2  : "");

	var del = "DELETE from " + table.name + where;

	db.run(del);
	return cb(null);
}

sqlcache.prototype.get = function(contractName, name, key1, key2, callback){
	console.log("getting")
	var self = this;

	var tkflag = false;
	if(typeof key2 == "function"){
		callback = key2
		key2 = null
	}

	if (key2) tkflag = true;
	//This function will perform look ups in the table based on values for key1 and optionally key2

	if(!this.contracts[contractName]){
		return cb(new Error("A contract by " + contractName + " was not found"));
	}

	var structDef = this.contracts[contractName].SD;

	if(!structDef.tables[name]){
		return cb(new Error("A table with name " + name + " was not found"));
	}

	var table = structDef.tables[name];
	var db = this.db;

	var where = " WHERE " + table.keys[0] + "=" + key1 + ((table.keys.length == 2 && tkflag) ? " AND " + table.keys[1] + "=" + key2  : "");

	var get = 'SELECT * from ' + table.name + where;

	console.log(get)

	db.get(get, callback)
}

sqlcache.prototype.set = function(contractName, name, data, key1, key2, callback){
	var self = this;

	var tkflag = false;

	if(typeof key2 == "function"){
		callback = key2
		key2 = null
	}
	if (key2) tkflag = true;

	//This function will perform look ups in the table based on values for key1 and optionally key2

	if(!this.contracts[contractName]){
		return cb(new Error("A contract by " + contractName + " was not found"));
	}

	var structDef = this.contracts[contractName].SD;

	if(!structDef.tables[name]){
		return cb(new Error("A table with name " + name + " was not found"));
	}

	var table = structDef.tables[name];
	var db = this.db;

	var where = " WHERE " + table.keys[0] + "=" + key1 + (table.keys.length == 2 ? " AND " + table.keys[1] + "=" + key2  : "");


	//Slightly more involved


	var cols = "(" + table.keys[0] + (table.keys.length == 2 ? ", " + table.keys[1] : "");
	var vals = "VALUES ("  + key1 + (table.keys.length == 2 ? ", " + key2 : "");

	var ins = "INSERT into " + table.name;
	var upd = "UPDATE " + table.name + " SET ";


	for (var i = 0; i < table.fields.length; i++) {
	 	var field = table.fields[i];
 		if(i != 0) upd +=", ";
	 	if(data[field.name]){
	 		if(field.isString){
	 			cols += ", " + field.name;
			 	vals += ", \'" + data[field.name] +"\'";
			 	upd += field.name + "=\'" + data[field.name] + "\'";
		 	} else {
		 		cols += ", " + field.name;
			 	vals += ", " + data[field.name];
			 	upd += field.name + "=" + data[field.name]
		 	}
	 	} else {
	 		if(field.isString){
	 			cols += ", " + field.name;
			 	vals += ", \'\'";
			 	upd += field.name + "=\'\'";
		 	} else {
		 		cols += ", " + field.name;
			 	vals += ", 0";
			 	upd += field.name + "=0";
		 	}
	 	} 	
	}; 

	cols += ")"
	vals += ")"

	ins += " " + cols + " " + vals;
	upd += where;

	var delflag = false;

	if(!data){
		var del = "DELETE from " + table.name + where;
		delflag = true;
	}

//	console.log(ins)
//	console.log(upd)

	db.get("SELECT * from " + table.name + where, function(err, row){
		if(row === undefined && !delflag){
				console.log("blue")
				console.log(ins)
			db.run(ins, callback);
		} else if (!delflag){
				console.log("purple")
				console.log(upd)
			db.run(upd, callback);
		} else {
				console.log("yellow")
				console.log(del)
			db.run(del, callback);
		}
	})
}

