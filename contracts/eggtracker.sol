import "./stdlib/errors.sol";
import "./stdlib/linkedList.sol";
import "./stdlib/tracker.sol";

contract eggtracker is Errors, linkedList, tracker{

	uint constant PERM_ADMIN = 1;
	uint constant PERM_CREATE = 2;
	uint constant PERM_TRADE = 3;

	event update(string name, uint key1, uint key2);
	event remove(string name, uint key1, uint key2);

	struct egg {
		uint originDate;
		string desc;
		uint rating;

		history hist;
	}

	struct user{
		string name;
		uint uid;
		address addr;
		bool exists;
		mapping(uint => bool) perms;
	}

	mapping(uint => egg) eggs;
	mapping(address => user) users;

	linkedlist userList;

	uint EGGIDCOUNT;
	uint USERCOUNT;

	function eggtracker() {
		EGGIDCOUNT = 0;
		USERCOUNT = 1;

		user owner = users[msg.sender];
		owner.name = "MASTER";
		owner.uid = USERCOUNT;
		owner.addr = msg.sender;
		owner.perms[PERM_ADMIN] = true;
		owner.exists = true;

		pushlink(userList, 0, USERCOUNT, bytes32(msg.sender));
	}

	function isAdmin(address user) constant returns (bool ret) {
		return users[user].perms[PERM_ADMIN];
	}

	function canCreate(address user) constant returns (bool ret) {
		return users[user].perms[PERM_CREATE];
	}

	function canTrade(address user) constant returns (bool ret) {
		return users[user].perms[PERM_TRADE];
	}

	function createUser(address userAddress, string name , bool adminPerm, bool createPerm, bool tradePerm) returns (uint error) {
		
		if (!isAdmin(msg.sender)){
			return ACCESS_DENIED;
		}

		if (userAddress == 0) {
			return PARAMETER_ERROR;
		}

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

	function changeUserPerms(address userAddress, bool adminPerm, bool createPerm, bool tradePerm) returns (uint error) {
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

	function removeUser(address userAddress) returns (uint error) {
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

	function getShit() returns (uint EGGLen, uint USERLen){
		EGGLen = EGGIDCOUNT;
		USERLen = userList.len-1;
		return;
	}

	function getUser(uint uid) returns (string name, address addr, bool exists, bool adminPerm, bool createPerm, bool tradePerm) {
		address userAddress = address(getlinkdataat(userList, int(uid)));
		user thisUser = users[userAddress];
		name = thisUser.name;
		addr = thisUser.addr;
		exists = thisUser.exists;
		adminPerm = thisUser.perms[PERM_ADMIN];
		createPerm = thisUser.perms[PERM_CREATE];
		tradePerm = thisUser.perms[PERM_TRADE];
		return;
	}


	function getEggData(uint eggid) returns (address owner, bytes32 secretHash, bool claimed, uint originDate, string desc, uint historyLength){
		egg thisEgg = eggs[eggid];

		owner = thisEgg.hist.currentOwner;
		secretHash = thisEgg.hist.secretHash;
		claimed = thisEgg.hist.claimed;
		originDate = thisEgg.originDate;
		desc = thisEgg.desc;
		historyLength = thisEgg.hist.length;
		return;
	}

	function getHistoryEntry(uint eggid, uint eventNum) returns (uint etype, address actor, uint time){
		egg thisEgg = eggs[eggid];

		evt thisEvent = thisEgg.hist.events[eventNum];
		etype = thisEvent.etype;
		actor = thisEvent.actor;
		time = thisEvent.time;
		return;
	}

	function createEgg(string desc, bytes32 secretHash) returns (uint error, uint newID) {
		
		if (!canCreate(msg.sender)){
			return (ACCESS_DENIED, 0);
		}

		EGGIDCOUNT = EGGIDCOUNT + 1;

		egg newEgg = eggs[EGGIDCOUNT];

		uint err = createEvent(newEgg.hist, msg.sender, secretHash);

		if (err != 0) {
			EGGIDCOUNT = EGGIDCOUNT - 1;
			return (err, 0);
		}

		newEgg.desc = desc;
		newEgg.originDate = block.timestamp;

		return (NO_ERROR, EGGIDCOUNT);
	}

	function transferEgg(uint eggid, address newOwner) returns (uint error) {

		if (!canTrade(msg.sender)){
			return ACCESS_DENIED;
		}

		egg thisEgg = eggs[eggid];

		return transferEvent(thisEgg.hist, msg.sender, newOwner);
	}

	function claimEgg(uint eggid, bytes32 secret, bytes32 newSecretHash) returns (uint error) {

		if (!canTrade(msg.sender)){
			return ACCESS_DENIED;
		}

		egg thisEgg = eggs[eggid];

		return claimEvent(thisEgg.hist, msg.sender, secret, newSecretHash);
	}
}