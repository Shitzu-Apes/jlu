<script lang="ts">
	import { clickOutside } from '$lib/actions';
	import { showWalletSelector } from '$lib/auth';
	import { wallet } from '$lib/near';

	const { accountId$, iconUrl$, walletName$ } = wallet;

	let isOpen = false;

	function handleSignOut() {
		wallet.signOut();
		isOpen = false;
	}
</script>

{#if $accountId$}
	<div class="relative" use:clickOutside={() => (isOpen = false)}>
		<button
			on:click={() => (isOpen = !isOpen)}
			class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-purple-900/20 transition-colors"
			aria-label="Wallet menu"
		>
			{#await Promise.all([$iconUrl$, $walletName$]) then [iconUrl, walletName]}
				<img
					src={iconUrl}
					alt={walletName}
					class="w-7 h-7 rounded-full {(walletName ?? '').replaceAll(' ', '-').toLowerCase()}"
				/>
				<div class="i-mdi:chevron-down text-lg text-purple-200/70" />
			{/await}
		</button>

		{#if isOpen}
			<div
				class="absolute right-0 top-full mt-2 w-72 bg-zinc-900 rounded-xl border border-purple-900/20 shadow-lg py-2 z-50"
			>
				{#await Promise.all( [$iconUrl$, $walletName$, $accountId$] ) then [iconUrl, walletName, accountId]}
					<div class="px-4 py-2 border-b border-purple-900/20">
						<div class="flex items-center gap-3">
							<img
								src={iconUrl}
								alt={walletName}
								class="w-10 h-10 rounded-full {(walletName ?? '')
									.replaceAll(' ', '-')
									.toLowerCase()}"
							/>
							<div class="flex-1 min-w-0">
								<div class="text-sm font-medium text-purple-100">{walletName}</div>
								<div class="text-sm text-purple-200/70 truncate">{accountId}</div>
							</div>
						</div>
					</div>
					<div class="py-1">
						<button
							on:click={handleSignOut}
							class="w-full px-4 py-2 text-left text-sm text-purple-200/70 hover:bg-purple-900/20 transition-colors flex items-center gap-2"
						>
							<div class="i-mdi:logout text-xl" />
							Disconnect Wallet
						</button>
					</div>
				{/await}
			</div>
		{/if}
	</div>
{:else}
	<button
		class="px-4 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-500/80 text-white font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
		on:click={showWalletSelector}
	>
		<span class="block md:hidden">Connect</span>
		<span class="hidden md:block">Connect Wallet</span>
	</button>
{/if}

<style>
	:global(.bitte-wallet) {
		background: #1a1a1a;
		border-radius: 0.25rem;
	}
</style>
