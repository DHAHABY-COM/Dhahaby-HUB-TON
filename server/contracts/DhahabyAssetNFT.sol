// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC721Receiver {
	function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata data) external returns (bytes4);
}

contract DhahabyAssetNFT {
	string public name;
	string public symbol;
	address public owner;
	uint256 private _nextTokenId = 1;

	mapping(address => bool) public isMinter;
	mapping(bytes32 => bool) public mintedAssetKeys;
	mapping(uint256 => address) private _owners;
	mapping(address => uint256) private _balances;
	mapping(uint256 => address) private _tokenApprovals;
	mapping(address => mapping(address => bool)) private _operatorApprovals;
	mapping(uint256 => string) private _tokenURIs;

	event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
	event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
	event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
	event MinterUpdated(address indexed minter, bool enabled);
	event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
	event AssetKeyMinted(bytes32 indexed assetKey, uint256 indexed tokenId, address indexed to);

	modifier onlyOwner() {
		require(msg.sender == owner, "Only owner");
		_;
	}

	modifier onlyMinter() {
		require(isMinter[msg.sender], "Only minter");
		_;
	}

	constructor(string memory name_, string memory symbol_, address owner_) {
		require(bytes(name_).length > 0, "Name required");
		require(bytes(symbol_).length > 0, "Symbol required");
		name = name_;
		symbol = symbol_;
		owner = owner_ == address(0) ? msg.sender : owner_;
		isMinter[msg.sender] = true;
		isMinter[owner] = true;
		emit OwnershipTransferred(address(0), owner);
		emit MinterUpdated(msg.sender, true);
		if (owner != msg.sender) {
			emit MinterUpdated(owner, true);
		}
	}

	function transferOwnership(address newOwner) external onlyOwner {
		require(newOwner != address(0), "Invalid owner");
		address previousOwner = owner;
		owner = newOwner;
		isMinter[newOwner] = true;
		emit OwnershipTransferred(previousOwner, newOwner);
		emit MinterUpdated(newOwner, true);
	}

	function setMinter(address minter, bool enabled) external onlyOwner {
		require(minter != address(0), "Invalid minter");
		isMinter[minter] = enabled;
		emit MinterUpdated(minter, enabled);
	}

	function balanceOf(address account) public view returns (uint256) {
		require(account != address(0), "Invalid owner");
		return _balances[account];
	}

	function ownerOf(uint256 tokenId) public view returns (address) {
		address tokenOwner = _owners[tokenId];
		require(tokenOwner != address(0), "Token does not exist");
		return tokenOwner;
	}

	function tokenURI(uint256 tokenId) external view returns (string memory) {
		require(_owners[tokenId] != address(0), "Token does not exist");
		return _tokenURIs[tokenId];
	}

	function getApproved(uint256 tokenId) public view returns (address) {
		require(_owners[tokenId] != address(0), "Token does not exist");
		return _tokenApprovals[tokenId];
	}

	function isApprovedForAll(address account, address operator) public view returns (bool) {
		return _operatorApprovals[account][operator];
	}

	function approve(address to, uint256 tokenId) external {
		address tokenOwner = ownerOf(tokenId);
		require(to != tokenOwner, "Already owner");
		require(msg.sender == tokenOwner || isApprovedForAll(tokenOwner, msg.sender), "Not approved");
		_tokenApprovals[tokenId] = to;
		emit Approval(tokenOwner, to, tokenId);
	}

	function setApprovalForAll(address operator, bool approved) external {
		require(operator != msg.sender, "Cannot self-approve");
		_operatorApprovals[msg.sender][operator] = approved;
		emit ApprovalForAll(msg.sender, operator, approved);
	}

	function transferFrom(address from, address to, uint256 tokenId) public {
		require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner or approved");
		require(ownerOf(tokenId) == from, "From mismatch");
		require(to != address(0), "Invalid recipient");
		_transfer(from, to, tokenId);
	}

	function safeTransferFrom(address from, address to, uint256 tokenId) external {
		safeTransferFrom(from, to, tokenId, "");
	}

	function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
		transferFrom(from, to, tokenId);
		require(_checkOnERC721Received(from, to, tokenId, data), "Unsafe recipient");
	}

	function safeMint(address to, string memory uri) public onlyMinter returns (uint256) {
		require(to != address(0), "Invalid recipient");
		uint256 tokenId = _nextTokenId++;
		_balances[to] += 1;
		_owners[tokenId] = to;
		_tokenURIs[tokenId] = uri;
		emit Transfer(address(0), to, tokenId);
		require(_checkOnERC721Received(address(0), to, tokenId, ""), "Unsafe recipient");
		return tokenId;
	}

	function mint(address to, string memory uri) external onlyMinter returns (uint256) {
		return safeMint(to, uri);
	}

	function mintTo(address to, string memory uri) external onlyMinter returns (uint256) {
		return safeMint(to, uri);
	}

	function mintForAsset(address to, string memory uri, bytes32 assetKey) external onlyMinter returns (uint256) {
		require(assetKey != bytes32(0), "Invalid asset key");
		require(!mintedAssetKeys[assetKey], "Asset already minted");
		uint256 tokenId = safeMint(to, uri);
		mintedAssetKeys[assetKey] = true;
		emit AssetKeyMinted(assetKey, tokenId, to);
		return tokenId;
	}

	function mintForPrevaluation(address to, string memory uri, uint256 prevaluationId) external onlyMinter returns (uint256) {
		bytes32 assetKey = keccak256(abi.encodePacked("dhahaby-prevaluation:", prevaluationId));
		return this.mintForAsset(to, uri, assetKey);
	}

	function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
		return interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f || interfaceId == 0x01ffc9a7;
	}

	function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
		address tokenOwner = ownerOf(tokenId);
		return (spender == tokenOwner || getApproved(tokenId) == spender || isApprovedForAll(tokenOwner, spender));
	}

	function _transfer(address from, address to, uint256 tokenId) internal {
		delete _tokenApprovals[tokenId];
		_balances[from] -= 1;
		_balances[to] += 1;
		_owners[tokenId] = to;
		emit Transfer(from, to, tokenId);
	}

	function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) private returns (bool) {
		if (to.code.length == 0) return true;
		try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
			return retval == IERC721Receiver.onERC721Received.selector;
		} catch {
			return false;
		}
	}
}
