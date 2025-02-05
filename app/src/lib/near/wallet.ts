import type {
	Account,
	BrowserWallet,
	BrowserWalletMetadata,
	FinalExecutionOutcome,
	InjectedWalletMetadata,
	ModuleState,
	Wallet as NearWallet
} from '@near-wallet-selector/core';
import { createConfig, http } from '@wagmi/core';
import type { SvelteComponent } from 'svelte';
import { derived, get, readable, writable } from 'svelte/store';
import { P, match } from 'ts-pattern';
import { injected, walletConnect } from 'wagmi/connectors';

import { browser } from '$app/environment';
import { showToast, showTxToast } from '$lib/components/Toast.svelte';
import EvmOnboardSheet from '$lib/layout/BottomSheet/EvmOnboardSheet.svelte';
import type { UnionModuleState } from '$lib/models';

export type TransactionCallbacks<T> = {
	onSuccess?: (outcome: T | undefined) => Promise<void> | void;
	onError?: () => Promise<void> | void;
	onFinally?: () => Promise<void> | void;
};

const near = {
	id: 397,
	name: 'Near Protocol',
	nativeCurrency: {
		name: 'NEAR',
		symbol: 'NEAR',
		decimals: 18
	},
	rpcUrls: {
		default: { http: ['https://eth-rpc.mainnet.near.org'] }
	},
	blockExplorers: {
		default: {
			name: 'NEAR Explorer',
			url: 'https://eth-explorer.near.org'
		}
	}
};
const nearTestnet = {
	id: 398,
	name: 'Near Protocol Testnet',
	nativeCurrency: {
		name: 'NEAR',
		symbol: 'NEAR',
		decimals: 18
	},
	rpcUrls: {
		default: { http: ['https://eth-rpc.testnet.near.org'] }
	},
	blockExplorers: {
		default: {
			name: 'NEAR Explorer',
			url: 'https://eth-explorer-testnet.near.org'
		}
	},
	testnet: true
};

export const wagmiConfig = browser
	? createConfig({
			chains: import.meta.env.VITE_NETWORK_ID === 'mainnet' ? [near] : [nearTestnet],
			transports: {
				[397]: http(),
				[398]: http()
			},
			connectors: [
				walletConnect({
					projectId: import.meta.env.VITE_WC_PROJECT_ID ?? 'dba65fff73650d32ae5157f3492c379e',
					metadata: {
						name: 'Juicy Lucy',
						url: window.location.hostname,
						icons: [
							'https://raw.githubusercontent.com/Shitzu-Apes/jlu/6393b6ab38f0fd213d478355425c0f465d37ad16/static/logo.webp'
						],
						description: 'Juicy Lucy'
					},
					showQrModal: false
				}),
				injected({ shimDisconnect: true })
			]
		})
	: (undefined as unknown as ReturnType<typeof createConfig>);

export class Wallet {
	public selector$ = readable(
		browser
			? Promise.all([
					import('@near-wallet-selector/core'),
					import('@near-wallet-selector/meteor-wallet'),
					import('@near-wallet-selector/here-wallet'),
					import('@near-wallet-selector/bitte-wallet'),
					import('@near-wallet-selector/near-mobile-wallet'),
					import('@near-wallet-selector/okx-wallet'),
					import('@near-wallet-selector/my-near-wallet'),
					import('@near-wallet-selector/wallet-connect'),
					import('@near-wallet-selector/ethereum-wallets'),
					import('@web3modal/wagmi'),
					import('@keypom/one-click-connect')
				]).then(
					([
						{ setupWalletSelector },
						{ setupMeteorWallet },
						{ setupHereWallet },
						{ setupBitteWallet },
						{ setupNearMobileWallet },
						{ setupOKXWallet },
						{ setupMyNearWallet },
						{ setupWalletConnect },
						{ setupEthereumWallets },
						{ createWeb3Modal },
						{ setupOneClickConnect }
					]) => {
						this.isLoading$.set(false);
						return setupWalletSelector({
							network: import.meta.env.VITE_NETWORK_ID,
							modules: [
								setupMeteorWallet(),
								setupHereWallet(),
								setupBitteWallet(),
								setupNearMobileWallet({
									dAppMetadata: {
										name: 'Juicy Lucy',
										logoUrl:
											'https://raw.githubusercontent.com/Shitzu-Apes/jlu/6393b6ab38f0fd213d478355425c0f465d37ad16/static/logo.webp'
									}
								}),
								setupOKXWallet(),
								setupMyNearWallet(),
								setupWalletConnect({
									projectId:
										import.meta.env.VITE_WC_PROJECT_ID ?? 'dba65fff73650d32ae5157f3492c379e',
									metadata: {
										name: 'Juicy Lucy',
										url: window.location.hostname,
										icons: [
											'https://raw.githubusercontent.com/Shitzu-Apes/jlu/6393b6ab38f0fd213d478355425c0f465d37ad16/static/logo.webp'
										],
										description: 'Juicy Lucy'
									}
								}),
								setupEthereumWallets({
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
									wagmiConfig: wagmiConfig as any,
									web3Modal: createWeb3Modal({
										wagmiConfig,
										projectId: import.meta.env.VITE_WC_PROJECT_ID
										// eslint-disable-next-line @typescript-eslint/no-explicit-any
									}) as any
								}),
								setupOneClickConnect({
									contractId: import.meta.env.VITE_CONTRACT_ID,
									networkId: import.meta.env.VITE_NETWORK_ID
									// eslint-disable-next-line @typescript-eslint/no-explicit-any
								}) as any
							]
						});
					}
				)
			: // eslint-disable-next-line @typescript-eslint/no-empty-function
				new Promise<never>(() => {})
	);

	public isLoading$ = writable(true);

	private _account$ = writable<Account | undefined>();
	public account$ = derived(this._account$, (a) => a);

	public accountId$ = derived(this.account$, (account) => {
		return account?.accountId;
	});

	public walletName$ = derived(this._account$, async () => {
		const selector = await get(this.selector$);
		const wallet = await selector.wallet();
		return wallet.metadata.name;
	});

	public walletId$ = derived(this._account$, async () => {
		const selector = await get(this.selector$);
		const wallet = await selector.wallet();
		console.log('[wallet]', wallet);
		return wallet.id;
	});

	public iconUrl$ = derived(this._account$, async (account) => {
		if (!account) return;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		if ((account as any).walletId === 'sweat-wallet') {
			return 'https://sweateconomy.com/icon-main-color.72b79a87.png';
		}
		const selector = await get(this.selector$);
		const wallet = await selector.wallet();
		return wallet.metadata.iconUrl;
	});

	public modules$ = derived(this.selector$, async (s) => {
		const selector = await s;
		return selector.store
			.getState()
			.modules.map((mod): UnionModuleState | undefined => {
				switch (mod.type) {
					case 'injected':
						return {
							...mod,
							type: 'injected',
							metadata: mod.metadata as InjectedWalletMetadata
						};
					case 'browser':
						return {
							...mod,
							type: 'browser',
							metadata: mod.metadata as BrowserWalletMetadata
						};
					case 'bridge':
						return {
							...mod,
							type: 'bridge',
							metadata: mod.metadata as BrowserWalletMetadata
						};
					case 'instant-link':
						return;
					default:
						throw new Error(`unimplemented: ${mod.type}`);
				}
			})
			.filter((mod) => mod != null);
	});

	constructor() {
		this.selector$.subscribe(async (s) => {
			const selector = await s;
			const isSignedInWithNear = selector.isSignedIn();
			if (isSignedInWithNear) {
				const account = selector.store.getState().accounts.find(({ active }) => active);
				if (!account) return;
				this._account$.set(account);
			}
		});

		if (import.meta.env.DEV) {
			this._account$.subscribe((account) => {
				console.info('assign new account:', account);
			});
		}

		this.loginViaWalletSelector = this.loginViaWalletSelector.bind(this);
		this.signOut = this.signOut.bind(this);
	}

	public async loginViaWalletSelector(unionMod: UnionModuleState) {
		const mod = unionMod as ModuleState<NearWallet>;
		const wallet = await mod.wallet();

		return match(wallet)
			.with({ type: P.union('browser', 'injected', 'bridge') }, async (wallet) => {
				// FIXME optional access key not yet supported by wallet selector
				const contractId = match(wallet.id)
					.with(P.union('meteor-wallet', 'ethereum-wallets'), () => undefined as unknown as string)
					.otherwise(() => import.meta.env.VITE_CONTRACT_ID);
				const accounts = await wallet.signIn({
					contractId
				});
				const account = accounts.pop();
				if (!account) return;
				this._account$.set(account);
				showToast({
					data: {
						type: 'simple',
						data: {
							title: 'Connect',
							description: `Successfully connected Near account ${account.accountId.length > 24 ? `${account.accountId.substring(0, 6)}...${account.accountId.slice(-4)}` : account.accountId} via ${wallet.metadata.name}`
						}
					}
				});
			})
			.otherwise(() => {
				throw new Error('unimplemented');
			});
	}

	public async signOut() {
		const account = get(this._account$);
		if (!account) return;
		const selector = await get(this.selector$);
		const wallet = await selector.wallet();
		await wallet.signOut();
		showToast({
			data: {
				type: 'simple',
				data: {
					title: 'Disconnect',
					description: `Disconnected Near account ${account.accountId.length > 24 ? `${account.accountId.substring(0, 6)}...${account.accountId.slice(-4)}` : account.accountId}`
				}
			}
		});
		this._account$.set(undefined);
	}

	public async signAndSendTransactions(
		params: Parameters<BrowserWallet['signAndSendTransactions']>[0],
		{ onSuccess, onError, onFinally }: TransactionCallbacks<FinalExecutionOutcome[]>
	) {
		const selector = await get(this.selector$);
		const wallet = await selector.wallet();
		const txPromise = wallet.signAndSendTransactions(params);
		if (!txPromise) return;
		showTxToast(txPromise);
		return txPromise
			.then((outcome) => {
				if (onSuccess) {
					onSuccess(outcome || undefined);
				}
			})
			.catch(onError)
			.finally(onFinally);
	}

	public async signAndSendTransaction(
		params: Parameters<BrowserWallet['signAndSendTransaction']>[0],
		{ onSuccess, onError, onFinally }: TransactionCallbacks<FinalExecutionOutcome>
	) {
		const selector = await get(this.selector$);
		const wallet = await selector.wallet();
		const txPromise = wallet.signAndSendTransaction(params);
		if (!txPromise) return;
		showTxToast(txPromise);
		return txPromise
			.then((outcome) => {
				if (onSuccess) {
					onSuccess(outcome || undefined);
				}
			})
			.catch(onError)
			.finally(onFinally);
	}
}

export const wallet = new Wallet();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface WalletMetadata<T extends SvelteComponent = any> {
	url?: string;
	extensionUrl?: string;
	twitter?: string;
	telegram?: string;
	discord?: string;
	name?: string;
	infoSheet?: T;
}

export const NEAR_WALLETS: Record<string, WalletMetadata> = {
	'meteor-wallet': {
		url: 'https://meteorwallet.app/',
		twitter: 'https://x.com/MeteorWallet'
	},
	'here-wallet': {
		url: 'https://herewallet.app/',
		twitter: 'https://x.com/here_wallet'
	},
	'bitte-wallet': {
		url: 'https://bitte.ai/',
		twitter: 'https://x.com/BitteProtocol',
		telegram: 'https://t.me/mintdev'
	},
	'near-mobile-wallet': {
		url: 'https://nearmobile.app/',
		twitter: 'https://x.com/NEARMobile_app',
		telegram: 'https://t.me/NEARMobile'
	},
	'okx-wallet': {
		url: 'https://okx.com/web3',
		twitter: 'https://x.com/okxweb3'
	},
	'my-near-wallet': {
		url: 'https://app.mynearwallet.com/',
		twitter: 'https://twitter.com/MyNearWallet',
		telegram: 'https://t.me/mnw_chat'
	},
	'wallet-connect': {
		name: 'WalletConnect (Near)'
	},
	'ethereum-wallets': {
		infoSheet: EvmOnboardSheet
	},
	'sweat-wallet': {}
};
