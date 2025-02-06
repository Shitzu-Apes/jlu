<script lang="ts">
	import type { SignerWalletAdapter } from '@solana/wallet-adapter-base';

	import { Content } from '$lib/layout/BottomSheet';
	import { closeBottomSheet, openBottomSheet } from '$lib/layout/BottomSheet/Container.svelte';
	import type { UnionModuleState } from '$lib/models';
	import { NEAR_WALLETS, nearWallet } from '$lib/near';
	import { solanaWallet } from '$lib/solana/wallet';

	const modules$ = nearWallet.modules$;
	const solanaWallets$ = solanaWallet.wallets$;

	export let initialNetwork: 'near' | 'solana' | undefined = undefined;
	let selectedNetwork: 'near' | 'solana' = initialNetwork ?? 'near';

	function handleNetworkChange(network: 'near' | 'solana') {
		if (document.startViewTransition) {
			document.startViewTransition(() => {
				selectedNetwork = network;
			});
		} else {
			selectedNetwork = network;
		}
	}

	async function handleNearWalletClick(unionMod: UnionModuleState) {
		await nearWallet.loginViaWalletSelector(unionMod);
		closeBottomSheet();
	}

	async function handleSolanaWalletClick(wallet: SignerWalletAdapter) {
		try {
			await solanaWallet.connect(wallet);
			closeBottomSheet();
		} catch (error) {
			console.error('Failed to connect wallet:', error);
		}
	}
</script>

<Content>
	<slot slot="header">
		<h1 class="ml-3 text-2xl text-white font-semibold">Select Wallet</h1>
	</slot>
	<slot>
		<div class="flex justify-center gap-2 mb-6">
			<button
				class="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 {selectedNetwork ===
				'near'
					? 'bg-purple-900/40 text-purple-100'
					: 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'}"
				on:click={() => handleNetworkChange('near')}
			>
				<img src="/near-logo.webp" alt="NEAR" class="w-5 h-5 rounded-full" />
				NEAR
			</button>
			<button
				class="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 {selectedNetwork ===
				'solana'
					? 'bg-purple-900/40 text-purple-100'
					: 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'}"
				on:click={() => handleNetworkChange('solana')}
			>
				<img src="/sol-logo.webp" alt="Solana" class="w-5 h-5 rounded-full" />
				Solana
			</button>
		</div>

		<div class="mx-auto flex flex-col gap-4 w-full max-w-xs mt-3 pb-6">
			<div class="wallet-list">
				{#if selectedNetwork === 'near'}
					{#await $modules$ then mods}
						{#each mods as mod (mod.id)}
							<div class="flex gap-2 items-center">
								<button
									disabled={!mod.metadata.available}
									on:click={() => handleNearWalletClick(mod)}
									class="hover:bg-purple-800/50 p-2 rounded-xl flex items-center flex-1 transition-colors"
								>
									<img
										src={mod.metadata.iconUrl}
										alt={mod.metadata.name}
										class={`w-10 h-10 object-contain mr-5 ${mod.metadata.name.replaceAll(' ', '-').toLowerCase()}`}
									/>
									<div class="flex flex-col text-left uppercase mr-auto">
										<span class="text-white">{NEAR_WALLETS[mod.id].name ?? mod.metadata.name}</span>
										{#if NEAR_WALLETS[mod.id].url != null}
											<span class="text-sm text-gray-400">
												{new URL(NEAR_WALLETS[mod.id].url ?? '').hostname}
											</span>
										{/if}
									</div>
								</button>
								{#if mod.type === 'injected'}
									{#if NEAR_WALLETS[mod.id].extensionUrl != null}
										<a
											href={NEAR_WALLETS[mod.id].extensionUrl}
											target="_blank"
											rel="noopener"
											class="hover:bg-purple-800/50 p-2 rounded-xl transition-colors"
											on:click|stopPropagation
											aria-label="Download Wallet"
										>
											<div class="i-mdi:download w-8 h-8" />
										</a>
									{:else if mod.metadata.downloadUrl != null && mod.id !== 'ethereum-wallets'}
										<a
											href={mod.metadata.downloadUrl}
											target="_blank"
											rel="noopener"
											class="hover:bg-purple-800/50 p-2 rounded-xl transition-colors"
											on:click|stopPropagation
											aria-label="Download Wallet"
										>
											<div class="i-mdi:download w-8 h-8 text-white" />
										</a>
									{:else if NEAR_WALLETS[mod.id].infoSheet != null}
										<button
											class="hover:bg-purple-800/50 p-2 rounded-xl transition-colors"
											on:click={() => {
												openBottomSheet(NEAR_WALLETS[mod.id].infoSheet);
											}}
											aria-label="Learn More"
										>
											<div class="i-mdi:information-outline w-8 h-8 text-white" />
										</button>
									{/if}
								{/if}
							</div>
						{/each}
					{/await}
				{:else}
					{#each $solanaWallets$ as wallet}
						<div class="flex gap-2 items-center">
							<button
								on:click={() => handleSolanaWalletClick(wallet)}
								class="hover:bg-purple-800/50 p-2 rounded-xl flex items-center flex-1 transition-colors"
							>
								<img src={wallet.icon} alt={wallet.name} class="w-10 h-10 object-contain mr-5" />
								<div class="flex flex-col text-left uppercase mr-auto">
									<span class="text-white">{wallet.name}</span>
								</div>
							</button>
							{#if wallet.url}
								<a
									href={wallet.url}
									target="_blank"
									rel="noopener"
									class="hover:bg-purple-800/50 p-2 rounded-xl transition-colors"
									on:click|stopPropagation
									aria-label="Download Wallet"
								>
									<div class="i-mdi:download w-8 h-8 text-white" />
								</a>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</slot>
</Content>

<style>
	:global(.bitte-wallet) {
		background: #1a1a1a;
		border-radius: 0.25rem;
	}

	.wallet-list {
		view-transition-name: wallet-list;
	}

	::view-transition-old(wallet-list) {
		animation: fade-out 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	::view-transition-new(wallet-list) {
		animation: fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	@keyframes fade-out {
		0% {
			opacity: 1;
			transform: translateX(0);
		}
		100% {
			opacity: 0;
			transform: translateX(-32px);
		}
	}

	@keyframes fade-in {
		0% {
			opacity: 0;
			transform: translateX(32px);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
		}
	}
</style>
