<script lang="ts">
	import Button from './Button.svelte';

	import { clickOutside } from '$lib/actions';
	import { showWalletSelector } from '$lib/auth';
	import { wallet } from '$lib/near';

	const { accountId$, iconUrl$, walletName$, isLoading$ } = wallet;

	let isOpen = false;

	function handleSignOut() {
		wallet.signOut();
		isOpen = false;
	}
</script>

{#if $accountId$}
	<div class="relative" use:clickOutside={() => (isOpen = false)}>
		<Button
			type="secondary"
			size="s"
			onClick={() => (isOpen = !isOpen)}
			class="!px-2"
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
		</Button>

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
					<div class="px-2 py-1">
						<Button
							type="secondary"
							size="s"
							onClick={handleSignOut}
							class="w-full !justify-start !px-4"
						>
							<div class="i-mdi:logout text-xl" />
							<span class="ml-2">Disconnect Wallet</span>
						</Button>
					</div>
				{/await}
			</div>
		{/if}
	</div>
{:else}
	<Button size="m" onClick={showWalletSelector} loading={$isLoading$}>
		<span class="block md:hidden">Connect</span>
		<span class="hidden md:block">Connect Wallet</span>
	</Button>
{/if}

<style>
	:global(.bitte-wallet) {
		background: #1a1a1a;
		border-radius: 0.25rem;
	}
</style>
