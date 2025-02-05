import { writable } from 'svelte/store';

import { Ft } from './fungibleToken';
import { wallet } from './wallet';

import { FixedNumber } from '$lib/util';

const { account$ } = wallet;

// Store for JLU balance
export const jluBalance$ = writable<FixedNumber | null>(null);

// Update balance whenever account changes
account$.subscribe((account) => {
	if (!account?.accountId) {
		jluBalance$.set(null);
		return;
	}

	Ft.balanceOf(import.meta.env.VITE_JLU_TOKEN_ID, account.accountId, 18)
		.then((balance) => jluBalance$.set(balance))
		.catch((err) => {
			console.error('Failed to fetch JLU balance:', err);
			jluBalance$.set(null);
		});
});

// Function to manually update balance
export async function updateJluBalance(diff?: FixedNumber) {
	const account = await account$.subscribe((account) => {
		if (!account?.accountId) return;
		if (diff) {
			jluBalance$.update((balance) => {
				if (!balance) return diff;
				return balance.add(diff);
			});
		} else {
			Ft.balanceOf(import.meta.env.VITE_JLU_TOKEN_ID, account.accountId, 18)
				.then((balance) => jluBalance$.set(balance))
				.catch((err) => console.error('Failed to update JLU balance:', err));
		}
	});
	return () => account();
}
