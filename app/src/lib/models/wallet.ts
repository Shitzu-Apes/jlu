import type {
	BrowserWalletMetadata,
	InjectedWalletMetadata,
	BridgeWalletMetadata
} from '@near-wallet-selector/core';

// needed to fix types into discriminated union for Svelte template
interface BaseWallet {
	id: string;
}
interface BrowserWallet extends BaseWallet {
	type: 'browser';
	metadata: BrowserWalletMetadata;
}
interface InjectedWallet extends BaseWallet {
	type: 'injected';
	metadata: InjectedWalletMetadata;
}
interface BridgeWallet extends BaseWallet {
	type: 'bridge';
	metadata: BridgeWalletMetadata;
}

export type UnionModuleState = BrowserWallet | InjectedWallet | BridgeWallet;
