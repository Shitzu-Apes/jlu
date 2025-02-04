import { derived, writable } from 'svelte/store';

import { Ft } from './fungibleToken';
import { wallet } from './wallet';

import { FixedNumber } from '$lib/util';

const { account$ } = wallet;

// Store for JLU balance
export const jluBalance$ = writable<FixedNumber | null>(null);

// Automatically update balance when account changes
export const jluBalanceAuto$ = derived(account$, async (account) => {
	if (!account?.accountId) return null;
	try {
		const balance = await Ft.balanceOf(import.meta.env.VITE_JLU_TOKEN_ID, account.accountId, 18);
		jluBalance$.set(balance);
		return balance;
	} catch (err) {
		console.error('Failed to fetch JLU balance:', err);
		return null;
	}
});

// Function to manually update balance
export async function updateJluBalance() {
	const account = await account$.subscribe((account) => {
		if (!account?.accountId) return;
		Ft.balanceOf(import.meta.env.VITE_JLU_TOKEN_ID, account.accountId, 18)
			.then((balance) => jluBalance$.set(balance))
			.catch((err) => console.error('Failed to update JLU balance:', err));
	});
	return () => account();
}
