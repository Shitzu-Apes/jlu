import type { GetAccountReturnType, Transport } from '@wagmi/core';
import {
	http,
	createConfig,
	getAccount,
	watchAccount,
	reconnect,
	disconnect as _disconnect,
	switchChain as _switchChain,
	injected
} from '@wagmi/core';
import { base, baseSepolia } from '@wagmi/core/chains';
import { writable } from 'svelte/store';

import { browser } from '$app/environment';
import { showToast } from '$lib/components/Toast.svelte';

export type ConfiguredChain = typeof base;
export type ConfiguredChainId = ConfiguredChain['id'];

// Initialize chain-specific transports
const transports: Record<number, Transport> = {
	[base.id]: http(),
	[baseSepolia.id]: http()
};

// Create wagmi config
export const config = createConfig({
	chains: import.meta.env.VITE_NETWORK_ID === 'mainnet' ? [base] : [baseSepolia],
	connectors: [injected()],
	transports
});

// Create and export a readable wallet store
export type Wallet = GetAccountReturnType;
export type ConnectedWallet = Wallet & { status: 'connected' };

export const evmWallet$ = writable(getAccount(config));

// Watch for account changes
if (browser) {
	watchAccount(config, {
		onChange: (account) => {
			evmWallet$.set(account);
			if (account.status === 'connected') {
				showToast({
					data: {
						type: 'simple',
						data: {
							title: 'Connect',
							description: `Successfully connected Base account ${account.address.slice(0, 6)}...${account.address.slice(-4)}`
						}
					}
				});
			} else if (account.status === 'disconnected') {
				showToast({
					data: {
						type: 'simple',
						data: {
							title: 'Disconnect',
							description: 'Disconnected Base wallet'
						}
					}
				});
			}
		}
	});
	reconnect(config);
}

/**
 * Request wallet to switch to Base chain
 */
export function switchToBase() {
	return _switchChain(config, {
		chainId: import.meta.env.VITE_NETWORK_ID === 'mainnet' ? base.id : baseSepolia.id
	});
}

/**
 * Disconnect the user's wallet
 */
export function disconnect() {
	_disconnect(config);
}
