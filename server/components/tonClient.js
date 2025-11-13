import { TonClient, WalletContractV5R1, internal } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { toNano, Address, beginCell, SendMode} from "@ton/core";
import dotenv from "dotenv";

dotenv.config();

const CONTRACT_ADDRESS = Address.parse(process.env.CONTRACT_ADDRESS);
const TON_MNEMONIC = process.env.TON_MNEMONIC;

const client = new TonClient({
	endpoint: process.env.TON_API_TESTNET_URL,
	apiKey: process.env.TON_API_KEY,
});

function normalizeAddress(addr) {
	if (!addr) throw new Error("Empty address")
	try {
		// Some SDKs return base64url with '-' and '_', fix that first
		const base64Addr = addr.replace(/-/g, '+').replace(/_/g, '/')
		// Parse whatever form it’s in
		const parsed = Address.parseFriendly(base64Addr).address
		// Re-encode as bounceable testnet address (→ kQ...)
		return parsed.toString({ testOnly: true, bounceable: true })
	} catch (err) {
		console.error('Invalid TON address:', addr, err)
		throw new Error('Invalid TON address format')
	}
}

function strToCell(str) {
	return beginCell().storeStringTail(str).endCell()
}

export async function waitForConfirmation(client, openedWallet, walletAddress, oldSeqno) {
	console.log("⏳ Waiting for confirmation...");

	let newSeqno = oldSeqno;
	let attempts = 0;

	// Poll every 3 seconds until seqno increases
	while (newSeqno === oldSeqno) {
		await new Promise((r) => setTimeout(r, 3000));
		newSeqno = await openedWallet.getSeqno();
		attempts++;
		console.log(`🔁 Attempt ${attempts}: current seqno = ${newSeqno}`);
	}

	console.log("✅ Transaction confirmed on-chain. Fetching tx info...");

	// Fetch latest transaction (most recent)
	const txs = await client.getTransactions(walletAddress, { limit: 1 });
	if (!txs || txs.length === 0) throw new Error("Transaction not found!");
	console.log("📝 Transaction details:", txs);

	const tx = txs[0];
	const lt = tx.lt;
	const hashBuffer = tx.hash();
	const txHash = hashBuffer.toString('hex'); // Example conversion
	const txId = `${txHash}`;
	console.log(tx.hash().toString("base64url"));
	console.log(`🔗 TX ID: ${txId}`);
	console.log(`🌐 Explorer: https://testnet.tonscan.org/tx/${txId}`);

	return txId;
}


export async function sendCreateValuation({ id, user, store, valuationHash }) {
	// ✅ Load wallet from mnemonic
	const key = await mnemonicToPrivateKey(TON_MNEMONIC.split(' '))
	console.log("🔑 Wallet public key:", key.publicKey.toString("hex"));
	// const wallet = WalletContractV5R1.create({ walletId: { networkGlobalId: -3 }, publicKey: key.publicKey });
	const wallet = WalletContractV5R1.create({
		walletId: {
			networkGlobalId: -3,
			context: {
				workchain: 0,
				subwalletNumber: 0,
				walletVersion: "v5r1",
			}
		}, // -3 for Testnet
		publicKey: key.publicKey,
	});
	const walletAddress = wallet.address;
	const balance = await client.getBalance(walletAddress);
	console.log(`Wallet Address: ${walletAddress.toString({ testOnly: true, bounceable: true })}`);
	console.log(`Current Wallet Balance: ${balance} TON`);


	// Open wallet and contract
	const openedWallet = client.open(wallet);
	const sender = wallet.sender(key.secretKey);
	console.log("✅ Client and Sender are ready.",openedWallet, sender);
	const contractAddress = Address.parse(process.env.CONTRACT_ADDRESS);

	console.log("📦 Contract Address:", contractAddress.toString({ testOnly: true, bounceable: true }));
	// Build the message
	const msg = {
		$$type: "CreateValuation",
		query_id: 0n,
		user: Address.parse(store).toString({ testOnly: true, bounceable: true }),
		store: Address.parse(store).toString({ testOnly: true, bounceable: true }),
		valuationHash: "hash_xxxx"
	};

	console.log("🧾 msg:", msg);
	console.log("🧾 user:", user, Address.parse(user), Address.parse(normalizeAddress(user)))
	console.log("🧾 store:", store, Address.parse(store), Address.parse(normalizeAddress(store)))

	const messageBody = beginCell()
		.storeUint(783258973, 32) // Function ID for CreateValuation
		.storeUint(0, 64) // query_id
		.storeRef(strToCell(Address.parse(normalizeAddress(user)).toString({ testOnly: true, bounceable: true })))
		.storeRef(strToCell(Address.parse(normalizeAddress(store)).toString({ testOnly: true, bounceable: true })))
		.storeRef(strToCell(valuationHash))
		.endCell();
	const seqno = await openedWallet.getSeqno();
	console.log("⏱️ Current wallet seqno:", seqno);
	const tx = await openedWallet.sendTransfer({
		seqno,
		secretKey: key.secretKey,
		messages: [
			internal({
				to: CONTRACT_ADDRESS,
				value: toNano("0.05"),
				body: messageBody,
			}),
		],
		sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
	});

	console.log("🚀 Transaction sent. Waiting for confirmation...");
	const txId = await waitForConfirmation(client, openedWallet, walletAddress, seqno);
	return txId;
}
