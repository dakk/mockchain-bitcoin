import { networks, payments, Block, Transaction, ECPairInterface, ECPair, Psbt } from 'bitcoinjs-lib';

export interface MockUTXO {
	value: number;
	tx: string;
	index: number;
}

export interface MockAccountEntry {
	address: string;
	balance: {
		balance: number;
		unconfirmed: number;
		received: number;
	};
	transactions: {
		received: string[];
		sent: string[];
	};
	utxos: MockUTXO[];
}

export class MockChain {
	coinbaseAddress: string;
	accounts: { [address: string]: MockAccountEntry };

	mempool: Transaction[];
	mempoolTransactions: { [hash: string]: Transaction };

	blocks: Block[];
	blockHashes: { [hash: string]: number };
	transactions: { [hash: string]: Transaction };

	constructor(
		protected network: networks.Network = networks.testnet,
		protected coinbaseAccount: ECPairInterface = null
	) {
		this.network = network;
		this.mempool = [];
		this.blocks = [];
		this.blockHashes = {};
		this.accounts = {};

		if (!this.coinbaseAccount) {
			this.coinbaseAccount = ECPair.makeRandom();
			this.coinbaseAddress = payments.p2pkh({ pubkey: this.coinbaseAccount.publicKey }).address;
			this.createAccountEntry(this.coinbaseAddress);
		}

		this.mineBlock();
	}

	protected createAccountEntry(address: string): MockAccountEntry {
		this.accounts[address] = {
			address: address,
			balance: {
				balance: 0,
				received: 0,
				unconfirmed: 0
			},
			transactions: {
				received: [],
				sent: []
			},
			utxos: []
		};
		return this.accounts[address];
	}

	public getHeight(): number {
		return this.blocks.length;
	}

	public getLastBlockHash(): string {
		return this.blocks[this.blocks.length - 1].getId();
	}

	public getAccount(address: string): MockAccountEntry {
		if (address in this.accounts)
			return this.accounts[address];

		return null;
	}

	public getTransaction(txid: string): { confirmed: boolean, tx: Transaction } {
		if (txid in this.mempoolTransactions)
			return { confirmed: false, tx: this.mempoolTransactions[txid] };
		else if (txid in this.transactions)
			return { confirmed: true, tx: this.transactions[txid] };
		else 
			return null;
	}

	/**
	 * Mine a block
	 * @returns Hash of the block mined
	 */
	public mineBlock(): string {
		const cbTransaction = new Psbt();
		cbTransaction.addOutput({
			address: this.coinbaseAddress,
			value: 50
		});
		const block = new Block();
		block.transactions = [cbTransaction.finalizeAllInputs().extractTransaction()].concat(this.mempool);
		this.mempool = [];

		const i = this.blocks.push(block);
		this.blockHashes[block.getId()] = i - 1;
		return block.getId();
	}

	/**
	 * Mine n blocks
	 * @param n Number of blocks to mine
	 * @returns Hash of the last block
	 */
	public mineBlocks(n: number): string {
		let last: string;
		for (let i = 0; i < n; i++)
			last = this.mineBlock();
		return last;
	}

	/**
	 * Send value to receiver
	 * @param value Amount in bitcoin
	 * @param receiver Address of the receiver
	 * @returns Txid of the faucet transaction
	 */
	public faucet(value: number, receiver: string): string {
		const txb = new Psbt({
			network: this.network
		});
		txb.addOutput({
			address: receiver,
			value: value
		});
		txb.finalizeAllInputs();
		const tx = txb.extractTransaction();
		this.pushTransaction(tx.toHex());
		return tx.getId();
	}

	/**
	 * Push a transaction to the mempool
	 * @param txhex Hex encoded transaction
	 * @returns Txid of the transaction
	 */
	public pushTransaction(txhex: string): string {
		const tx = Transaction.fromHex(txhex);
		this.mempool.push(tx);

		return tx.getId();
	}
}
