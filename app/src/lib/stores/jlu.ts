import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import { writable, derived, get } from 'svelte/store';

import { Ft } from '../near/fungibleToken';
import { nearWallet } from '../near/wallet';
import { solanaWallet } from '../solana/wallet';

import { FixedNumber } from '$lib/util';

const { account$ } = nearWallet;
const { publicKey$ } = solanaWallet;

type JluBalance = {
	near: FixedNumber | null;
	solana: FixedNumber | null;
};

// Store for JLU balance
const jluBalance$ = writable<JluBalance>({
	near: null,
	solana: null
});

async function fetchNearBalance(accountId: string): Promise<FixedNumber | null> {
	try {
		return await Ft.balanceOf(import.meta.env.VITE_JLU_TOKEN_ID, accountId, 18);
	} catch (err) {
		console.error('Failed to fetch NEAR JLU balance:', err);
		return null;
	}
}

async function fetchSolanaBalance(publicKey: PublicKey): Promise<FixedNumber | null> {
	try {
		const connection = solanaWallet.getConnection();
		const tokenMint = new PublicKey(import.meta.env.VITE_JLU_TOKEN_ID_SOLANA);
		const associatedTokenAddress = await getAssociatedTokenAddress(tokenMint, publicKey);

		try {
			const account = await getAccount(connection, associatedTokenAddress);
			return new FixedNumber(account.amount.toString(), 9); // Solana JLU uses 9 decimals
		} catch (err) {
			// Account doesn't exist yet (no tokens) or other error
			console.error('Failed to fetch Solana JLU balance:', err);
			return null;
		}
	} catch (err) {
		console.error('Failed to fetch Solana JLU balance:', err);
		return null;
	}
}

// Update NEAR balance whenever account changes
account$.subscribe(async (account) => {
	if (!account?.accountId) {
		jluBalance$.update((b) => ({ ...b, near: null }));
		return;
	}

	const balance = await fetchNearBalance(account.accountId);
	jluBalance$.update((b) => ({ ...b, near: balance }));
});

// Update Solana balance whenever wallet changes
publicKey$.subscribe(async (publicKey) => {
	if (!publicKey) {
		jluBalance$.update((b) => ({ ...b, solana: null }));
		return;
	}

	const balance = await fetchSolanaBalance(publicKey);
	jluBalance$.update((b) => ({ ...b, solana: balance }));
});

// Derived store that returns the sum of all balances
export const activeBalance$ = derived<[typeof jluBalance$], FixedNumber | null>(
	[jluBalance$],
	([$jluBalance]) => {
		const balances = [$jluBalance.near, $jluBalance.solana].filter(
			(b): b is FixedNumber => b !== null
		);

		if (balances.length === 0) return null;

		return balances.reduce((sum, balance) => sum.add(balance));
	}
);

// Function to manually update balance
export async function updateJluBalance(diff?: FixedNumber) {
	const account = get(account$);
	const publicKey = get(publicKey$);

	// Update NEAR balance if connected
	if (account?.accountId) {
		if (diff) {
			jluBalance$.update((balance) => ({
				...balance,
				near: balance.near ? balance.near.add(diff) : diff
			}));
		} else {
			const nearBalance = await fetchNearBalance(account.accountId);
			jluBalance$.update((b) => ({ ...b, near: nearBalance }));
		}
	}

	// Update Solana balance if connected
	if (publicKey) {
		if (diff) {
			jluBalance$.update((balance) => ({
				...balance,
				solana: balance.solana ? balance.solana.add(diff) : diff
			}));
		} else {
			const solanaBalance = await fetchSolanaBalance(publicKey);
			jluBalance$.update((b) => ({ ...b, solana: solanaBalance }));
		}
	}
}

export { jluBalance$ };
