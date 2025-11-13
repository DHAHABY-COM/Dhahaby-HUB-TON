import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import solc from "solc";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

dotenv.config();

const DEFAULT_RPC = "https://api.avax-test.network/ext/bc/C/rpc";
const RPC_URL = process.env.AVAX_NFT_ISSUANCE_RPC_URL || process.env.AVAX_CCHAIN_RPC_URL || DEFAULT_RPC;
const PRIVATE_KEY = process.env.NFT_ISSUANCE_PRIVATE_KEY_AVAX || process.env.AVAX_PRIVATE_KEY;
const OWNER = process.env.AVAX_NFT_OWNER || process.env.AVAX_VALUATION_OWNER || "";
const NAME = process.env.NFT_ERC721_NAME || "Dhahaby Asset NFT";
const SYMBOL = process.env.NFT_ERC721_SYMBOL || "DHABY";

if (!PRIVATE_KEY) {
	throw new Error("Missing NFT_ISSUANCE_PRIVATE_KEY_AVAX (or AVAX_PRIVATE_KEY) in .env");
}

const contractPath = path.resolve("contracts/DhahabyAssetNFT.sol");
const source = fs.readFileSync(contractPath, "utf8");

const input = {
	language: "Solidity",
	sources: {
		"DhahabyAssetNFT.sol": { content: source },
	},
	settings: {
		optimizer: { enabled: true, runs: 200 },
		outputSelection: {
			"*": {
				"*": ["abi", "evm.bytecode"],
			},
		},
	},
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
if (output.errors) {
	const fatal = output.errors.filter((e) => e.severity === "error");
	output.errors.forEach((e) => {
		console.log(`${e.severity.toUpperCase()}: ${e.formattedMessage}`);
	});
	if (fatal.length) {
		throw new Error("Solidity compilation failed");
	}
}

const compiled = output.contracts["DhahabyAssetNFT.sol"]["DhahabyAssetNFT"];
if (!compiled?.abi || !compiled?.evm?.bytecode?.object) {
	throw new Error("Compilation output missing ABI/bytecode");
}

const provider = new JsonRpcProvider(RPC_URL);
const wallet = new Wallet(PRIVATE_KEY, provider);
const ownerAddress = OWNER || wallet.address;

const factory = new ContractFactory(compiled.abi, compiled.evm.bytecode.object, wallet);
const contract = await factory.deploy(NAME, SYMBOL, ownerAddress);

const deployTx = contract.deploymentTransaction();
console.log("Deploying transaction hash:", deployTx?.hash || "<unknown>");
console.log("Deployer:", wallet.address);
console.log("Owner:", ownerAddress);
console.log("Name:", NAME);
console.log("Symbol:", SYMBOL);
console.log("RPC:", RPC_URL);

await contract.waitForDeployment();
const address = await contract.getAddress();
const network = await provider.getNetwork();

console.log("DhahabyAssetNFT deployed at:", address);
console.log("Chain ID:", Number(network.chainId));

const artifactPath = path.resolve("build/DhahabyAssetNFT.avax.json");
fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(
	artifactPath,
	JSON.stringify(
		{
			network: "avax-c-chain",
			chainId: Number(network.chainId),
			address,
			owner: ownerAddress,
			name: NAME,
			symbol: SYMBOL,
			abi: compiled.abi,
		},
		null,
		2
	)
);

console.log("Saved artifact:", artifactPath);
console.log("Set these envs for AVAX:");
console.log(`NFT_ISSUANCE_CONTRACT_ADDRESS_AVAX=${address}`);
console.log(`AVAX_NFT_CONTRACT_ADDRESS=${address}`);
