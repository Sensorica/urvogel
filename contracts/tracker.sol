import "./stdlib/errors.sol";
import "./stdlib/linkedList.sol";

contract tracker is Errors, linkedList {

	uint constant PERM_ADMIN = 1;
	uint constant PERM_CREATE = 2;
	uint constant PERM_TRADE = 3;

	uint constant EVENT_CREATE = 1;
	uint constant EVENT_TRANSFER = 2;
	uint constant EVENT_CLAIM = 3;

	event update(string name, uint key1, uint key2);
	event remove(string name, uint key1, uint key2);

	struct egg {
		uint originDate;
		string desc;
		uint rating;

		history hist;
	}

	struct evt {
		uint type;
		address actor;
		uint time;
	}

	struct history {
		bool claimed;
		uint length;
		uint secretHash;
		address currentOwner;

		mapping(uint => evt) evts;
	}

	struct user{
		string name;
		uint uid;
		address addr;
		bool exists;
		mapping(uint => bool) perms;
	}

	mapping(uint => object) objects;
	mapping(address => user) users;

	linkedlist userList;

	uint EGGIDCOUNT;
	uint USERCOUNT;

	function tracker() {
		EGGIDCOUNT = 0;
		USERCOUNT = 1;

		user owner = users[msg.sender];
		owner.name = "MASTER"
		owner.uid = USERCOUNT;
		owner.addr = msg.sender;
		owner.perms[PERM_ADMIN] = true;
		owner.exists = true;

		pushlink(userList, 0, USERCOUNT, bytes32(msg.sender));
	}

	function isAdmin(address user) constant returns (bool ret) {
		return users[user].perms[PERM_ADMIN];
	}

	function createUser(address userAddress, string name , bool adminPerm, bool createPerm, bool tradePerm) returns (uint error) {
		
		if (!isAdmin(msg.sender)){
			return ACCESS_DENIED;
		}

		if (userAddress == 0) {
			return PARAMETER_ERROR;
		}

		user newuser = users[userAddress];

		if(newuser.exists) {
			return RESOURCE_ALREADY_EXISTS; 
		}

		USERCOUNT = USERCOUNT + 1;

		user newuser = users[userAddress];
		newuser.name = name;
		newuser.uid = USERCOUNT;
		newuser.addr = userAddress;
		newuser.perms[PERM_ADMIN] = adminPerm;
		newuser.perms[PERM_CREATE] = createPerm;
		newuser.perms[PERM_TRADE] = tradePerm;
		newuser.exists = true;

		pushlink(userList, 0, USERCOUNT, bytes32(userAddress));
		update("users", USERCOUNT, 0);

		return NO_ERROR;
	}

	function changeUserPerms(address user, bool adminPerm, bool createPerm, bool tradePerm) returns (uint error) {
		if (!isAdmin(msg.sender)){
			return ACCESS_DENIED;
		}

		if (userAddress == 0) {
			return PARAMETER_ERROR;
		}

		user olduser = users[userAddress];

		if(!olduser.exists) {
			return RESOURCE_NOT_FOUND; 
		} 

		olduser.perms[PERM_ADMIN] = adminPerm;
		olduser.perms[PERM_CREATE] = createPerm;
		olduser.perms[PERM_TRADE] = tradePerm;

		update("users", olduser.uid, 0);

		return NO_ERROR;
	}

	function removeUser(address user) returns (uint error) {
		if (!isAdmin(msg.sender)){
			return ACCESS_DENIED;
		}

		if (userAddress == 0) {
			return PARAMETER_ERROR;
		}

		user olduser = users[userAddress];

		if(!olduser.exists) {
			return RESOURCE_NOT_FOUND; 
		} 

		olduser.exists = false;
		olduser.perms[PERM_ADMIN] = false;
		olduser.perms[PERM_CREATE] = false;
		olduser.perms[PERM_TRADE] = false;

		remove("users", olduser.uid, 0);

		return NO_ERROR;
	}


	function addCreateEvent (history storage hist, address actor, bytes32 secretHash) internal returns (uint error) {

		if (hist.length != 0) {
			return (INVALID_STATE);
		}

		hist.length = hist.length + 1;
		hist.currentSecretHash = secretHash;
		hist.currentOwner = actor;

		evt newEvent = hist.events[hist.length];

		newEvent.type = EVENT_CREATE;
		newEvent.actor = actor;
		newEvent.time = block.timestamp;

		return NO_ERROR;
	}

	function addTransferEvent (history storage hist, address actor, bytes32 secret) internal returns (uint error) {

		if (!hist.claimed) {
			return (INVALID_STATE);
		}

		hist.length = hist.length + 1;
		hist.currentOwner = actor;

		evt newEvent = hist.events[hist.length];

		newEvent.type = EVENT_TRANSFER;
		newEvent.actor = actor;
		newEvent.time = block.timestamp;
	}


	function getEggData(uint objid) returns (address owner, bytes32 secretHash, bool claimed, uint originDate, string desc, uint historyLength){
		egg thisEgg = eggs[eggid];

		owner = thisEgg.hist.currentOwner;
		secretHash = thisEgg.hist.secretHash;
		claimed = thisEgg.hist.claimed;
		originDate = thisEgg.originDate;
		desc = thisEgg.desc;
		historyLength = thisEgg.hist.length;
		return;
	}

	function getHistoryEntry(uint objid, uint eventNum) returns (TODO){

	}

	function createEgg(string desc, bytes32 secretHash) returns (uint error, uint newID) {
		
		user caller = users[msg.sender];

		if (!canCreate(msg.sender)){
			return ACCESS_DENIED;
		}

		EGGIDCOUNT = EGGIDCOUNT + 1;

		egg newEgg = eggs[EGGIDCOUNT];

		newEgg.desc = desc;
		newEgg.originDate = block.timestamp();


		history hist = newEgg.hist;

		hist.length = hist.length + 1;
		hist.currentSecretHash = secretHash;
		hist.currentOwner = msg.sender;

		evt newEvent = hist.events[hist.length];

		newEvent.type = EVENT_CREATE;
		newEvent.actor = msg.sender;
		newEvent.time = block.timestamp;

		return NO_ERROR;
	}

	function transferObject(uint objid, address newOwner) returns (uint error) {

	}

	function claimObject(uint objid, bytes32 secret, bytes32 newSecretHash) returns (uint error) {

	}
}