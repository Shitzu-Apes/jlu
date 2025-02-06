import type { Adapter } from '@solana/wallet-adapter-base';
import {
	PhantomWalletAdapter,
	SolflareWalletAdapter,
	TorusWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, Connection, type PublicKey } from '@solana/web3.js';
import { derived, get, writable } from 'svelte/store';

import { showToast } from '$lib/components/Toast.svelte';

const network = import.meta.env.VITE_NETWORK_ID === 'mainnet' ? 'mainnet-beta' : 'devnet';
const endpoint = clusterApiUrl(network);
const connection = new Connection(endpoint);

class SolanaWallet {
	private _wallets$ = writable<Adapter[]>([]);
	private _selectedWallet$ = writable<Adapter | undefined>();
	private _publicKey$ = writable<PublicKey | undefined>();
	private _isAutoConnecting$ = writable(false);

	constructor() {
		const wallets = [
			new PhantomWalletAdapter(),
			new SolflareWalletAdapter(),
			new TorusWalletAdapter()
		];
		this._wallets$.set(wallets);

		// Try to auto-connect on initialization
		this.autoConnect();

		// Subscribe to wallet adapter events
		wallets.forEach((wallet) => {
			wallet.on('connect', () => {
				this._selectedWallet$.set(wallet);
				this._publicKey$.set(wallet.publicKey ?? undefined);
			});

			wallet.on('disconnect', () => {
				const current = get(this._selectedWallet$);
				if (current?.name === wallet.name) {
					this._selectedWallet$.set(undefined);
					this._publicKey$.set(undefined);
				}
			});
		});
	}

	public wallets$ = derived(this._wallets$, (w) => w);
	public selectedWallet$ = derived(this._selectedWallet$, (w) => w);
	public publicKey$ = derived(this._publicKey$, (k) => k);
	public connected$ = derived(this._selectedWallet$, (w) => w?.connected ?? false);
	public isAutoConnecting$ = derived(this._isAutoConnecting$, (s) => s);

	private async autoConnect() {
		this._isAutoConnecting$.set(true);
		try {
			const wallets = get(this._wallets$);
			for (const wallet of wallets) {
				try {
					await wallet.connect();
					// Don't show toast for auto-connect
					this._selectedWallet$.set(wallet);
					this._publicKey$.set(wallet.publicKey ?? undefined);
					break;
				} catch {
					// Continue to next wallet if this one fails
					continue;
				}
			}
		} catch (error) {
			console.error('Auto-connect failed:', error);
		} finally {
			this._isAutoConnecting$.set(false);
		}
	}

	public async connect(wallet: Adapter) {
		try {
			await wallet.connect();
			this._selectedWallet$.set(wallet);
			this._publicKey$.set(wallet.publicKey ?? undefined);

			showToast({
				data: {
					type: 'simple',
					data: {
						title: 'Connect',
						description: `Successfully connected Solana account ${wallet.publicKey?.toBase58().slice(0, 6)}...${wallet.publicKey?.toBase58().slice(-4)} via ${wallet.name}`
					}
				}
			});
		} catch (error) {
			console.error('Failed to connect wallet:', error);
			showToast({
				data: {
					type: 'simple',
					data: {
						title: 'Connection Failed',
						description: 'Failed to connect Solana wallet. Please try again.',
						type: 'error'
					}
				}
			});
			throw error;
		}
	}

	public async disconnect() {
		const wallet = get(this._selectedWallet$);
		const publicKey = get(this._publicKey$);
		if (!wallet) return;

		try {
			await wallet.disconnect();
			showToast({
				data: {
					type: 'simple',
					data: {
						title: 'Disconnect',
						description: `Disconnected Solana account ${publicKey?.toBase58().slice(0, 6)}...${publicKey?.toBase58().slice(-4)}`
					}
				}
			});
			this._selectedWallet$.set(undefined);
			this._publicKey$.set(undefined);
		} catch (error) {
			console.error('Failed to disconnect wallet:', error);
			showToast({
				data: {
					type: 'simple',
					data: {
						title: 'Disconnect Failed',
						description: 'Failed to disconnect Solana wallet. Please try again.',
						type: 'error'
					}
				}
			});
			throw error;
		}
	}

	public getConnection() {
		return connection;
	}
}

export const solanaWallet = new SolanaWallet();
