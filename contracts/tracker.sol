import "./stdlib/errors.sol";
import "./stdlib/linkedList.sol";

contract tracker is Errors, linkedList {

	uint constant PERM_ADMIN = 1;
	uint constant PERM_CREATE = 2;
	uint constant PERM_TRADE = 3;

	struct object{

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

	uint OBIDCOUNT;
	uint USERCOUNT;

	function tracker() {
		OBIDCOUNT = 0;
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

	function createUser(address user, uint permnum, bool setto) returns (uint error) {

	}

	function changeUserPerms(address user, uint permnum, bool setto) returns (uint error) {

	}

	function removeUser() returns (uint error) {

	}


	function getHistoryLength(uint objid) returns (uint historyLength){

	}

	function getHistoryEntry(uint objid, uint eventNum) returns (TODO){

	}
}