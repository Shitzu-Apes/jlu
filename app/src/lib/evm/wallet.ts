import type { GetAccountReturnType, Transport } from '@wagmi/core';
import {
	http,
	createConfig,
	getAccount,
	watchAccount,
	reconnect,
	disconnect as _disconnect,
	switchChain as _switchChain,
	connect as _connect,
	type Connector,
	injected
} from '@wagmi/core';
import { base, baseSepolia } from '@wagmi/core/chains';
import { writable } from 'svelte/store';

import { browser } from '$app/environment';
import { showToast } from '$lib/components/Toast.svelte';

export type ConfiguredChain = typeof base | typeof baseSepolia;
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
		}
	});
	reconnect(config);
}

/**
 * Request wallet to switch to EVM chain
 */
export function switchToChain(chainId: ConfiguredChainId) {
	return _switchChain(config, {
		chainId
	});
}

/**
 * Disconnect the user's wallet
 */
export function disconnect() {
	_disconnect(config);
	showToast({
		data: {
			type: 'simple',
			data: {
				title: 'Disconnect',
				description: 'Disconnected EVM wallet'
			}
		}
	});
}

/**
 * Connect to a wallet
 */
export async function connect(connector: Connector): Promise<GetAccountReturnType> {
	try {
		await _connect(config, { connector });
		const account = getAccount(config);
		if (account.status === 'connected') {
			showToast({
				data: {
					type: 'simple',
					data: {
						title: 'Connect',
						description: `Successfully connected EVM account ${account.address.slice(0, 6)}...${account.address.slice(-4)}`
					}
				}
			});
		}
		return account;
	} catch (error) {
		console.error('Failed to connect EVM wallet:', error);
		throw error;
	}
}
