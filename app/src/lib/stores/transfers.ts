import type { Chain, TransferStatus } from 'omni-bridge-sdk';
import { writable, get } from 'svelte/store';

import { browser } from '$app/environment';

export type Transfer = {
	chain: Chain;
	nonce: number;
	amount: string;
	status: TransferStatus;
	timestamp: number;
};

function createTransfersStore() {
	// Load initial state from localStorage
	const initialState: Transfer[] = browser
		? JSON.parse(localStorage.getItem('transfers') || '[]')
		: [];

	const { subscribe, update } = writable<Transfer[]>(initialState);

	return {
		subscribe,
		addTransfer: (transfer: Transfer) => {
			update((transfers) => {
				const newTransfers = [transfer, ...transfers];
				if (browser) {
					localStorage.setItem('transfers', JSON.stringify(newTransfers));
				}
				return newTransfers;
			});
		},
		updateTransfer: (chain: Chain, nonce: number, status: Transfer['status']) => {
			update((transfers) => {
				const newTransfers = transfers.map((t) =>
					t.chain === chain && t.nonce === nonce ? { ...t, status } : t
				);
				if (browser) {
					localStorage.setItem('transfers', JSON.stringify(newTransfers));
				}
				return newTransfers;
			});
		},
		getTransfer: (chain: Chain, nonce: number) => {
			const transfers = get({ subscribe });
			return transfers.find((t) => t.chain === chain && t.nonce === nonce);
		}
	};
}

export const transfers = createTransfersStore();
