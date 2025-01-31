<script lang="ts">
	import { Content } from '$lib/layout/BottomSheet';
	import { closeBottomSheet, openBottomSheet } from '$lib/layout/BottomSheet/Container.svelte';
	import type { UnionModuleState } from '$lib/models';
	import { NEAR_WALLETS, wallet } from '$lib/near';

	const modules$ = wallet.modules$;

	async function handleWalletClick(unionMod: UnionModuleState) {
		await wallet.loginViaWalletSelector(unionMod);
		closeBottomSheet();
	}
</script>

<Content>
	<slot slot="header">
		<h1 class="ml-3 text-2xl text-white font-semibold">Select Wallet</h1>
	</slot>
	<slot>
		<div class="mx-auto flex flex-col gap-4 w-full max-w-xs mt-3 pb-6">
			{#await $modules$ then modules}
				{#each modules as mod}
					<div class="flex gap-2 items-center">
						<button
							disabled={!mod.metadata.available}
							on:click={() => handleWalletClick(mod)}
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
		</div>
	</slot>
</Content>

<style lang="css">
	:global(.bitte-wallet) {
		background: #1a1a1a;
		border-radius: 0.25rem;
	}
</style>
