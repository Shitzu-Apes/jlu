import { writable } from 'svelte/store';

import { fetchApi } from '../api';

import WalletSelector from './WalletSelector.svelte';

import { openBottomSheet } from '$lib/layout/BottomSheet/Container.svelte';

export type Auth = {
	expires_at: number;
	token: {
		access_token: string;
		expires_in: number;
		refresh_token: string;
		scope: string;
		token_type: 'bearer';
	};
	user: {
		id: string;
		name: string;
		username: string;
	};
};

export async function showWalletSelector(initialNetwork?: 'near' | 'solana' | 'base') {
	openBottomSheet(WalletSelector, { initialNetwork });
}

export const session$ = writable<Promise<Auth | undefined>>(new Promise<never>(() => undefined));

export async function logout() {
	try {
		// Call the logout endpoint using fetchApi
		await fetchApi('/auth/logout', { method: 'POST' });
	} catch (error) {
		console.error('Error during logout:', error);
	} finally {
		// Clear local storage
		localStorage.removeItem('auth');
		// Always clear the session store, even if the API call fails
		session$.set(Promise.resolve(undefined));
	}
}
