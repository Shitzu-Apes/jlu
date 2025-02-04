<script lang="ts">
	import { derived } from 'svelte/store';

	import { showWalletSelector } from '$lib/auth';
	import Button from '$lib/components/Button.svelte';
	import { wallet } from '$lib/near';
	import { Ft } from '$lib/near/fungibleToken';
	import { updateJluBalance } from '$lib/near/jlu';

	const { account$ } = wallet;

	// Derive token balance when account is connected
	const balance$ = derived(account$, async (account) => {
		if (!account?.accountId) return null;
		try {
			const balance = await Ft.balanceOf(
				import.meta.env.VITE_JLU_TOKEN_ID_OLD,
				account.accountId,
				18
			);
			return balance;
		} catch (err) {
			console.error('Failed to fetch JLU balance:', err);
			return null;
		}
	});

	async function handleMigrate() {
		const account = $account$;
		if (!account) return;

		const balance = await $balance$;
		if (!balance) return;

		await Ft.ft_transfer_call(
			{
				tokenId: import.meta.env.VITE_JLU_TOKEN_ID_OLD,
				receiverId: import.meta.env.VITE_JLU_TOKEN_ID,
				amount: balance.toU128(),
				memo: ''
			},
			{
				onSuccess: async () => {
					console.log('Migration successful');
					await updateJluBalance();
				}
			}
		);
	}
</script>

<main class="flex-1 flex flex-col items-center justify-center p-4">
	<div class="w-full max-w-2xl space-y-8">
		<div class="text-center space-y-4">
			<h1 class="text-4xl font-bold text-purple-100">Token Migration</h1>
			<p class="text-lg text-purple-200/70">Migrate your existing JLU tokens to the new contract</p>
		</div>

		{#if $account$}
			<div class="bg-purple-900/20 rounded-xl p-6 space-y-6">
				<div class="space-y-2">
					<h2 class="text-xl font-semibold">Your Balance</h2>
					{#await $balance$}
						<p class="text-purple-200/70">Loading your token balance...</p>
					{:then balance}
						{#if balance}
							<p class="text-2xl font-medium">{balance.format()} JLU</p>
						{:else}
							<p class="text-purple-200/70">No JLU tokens found</p>
						{/if}
					{:catch error}
						<p class="text-red-400">Failed to load balance: {error.message}</p>
					{/await}
				</div>

				<div class="space-y-4">
					<div class="flex justify-between items-center">
						<span class="text-purple-200/70">Available to Migrate</span>
						{#await $balance$}
							<span class="font-medium">Loading...</span>
						{:then balance}
							<span class="font-medium">{balance?.format() ?? '0.00'} JLU</span>
						{/await}
					</div>

					{#await $balance$}
						<Button disabled loading class="w-full">Loading...</Button>
					{:then balance}
						<Button
							onClick={handleMigrate}
							disabled={!balance || balance.valueOf() === 0n}
							class="w-full"
						>
							{#if !balance || balance.valueOf() === 0n}
								No Tokens to Migrate
							{:else}
								Migrate {balance.format()} JLU
							{/if}
						</Button>
					{/await}
				</div>

				<div class="text-sm text-purple-200/70">
					<p>Note:</p>
					<ul class="list-disc list-inside mt-2 space-y-1">
						<li>This is a one-way migration - you cannot reverse this process</li>
						<li>New JLU tokens will be minted 1:1 for your migrated tokens</li>
					</ul>
				</div>
			</div>
		{:else}
			<div class="bg-purple-900/20 rounded-xl p-6 text-center">
				<p class="text-lg mb-4">Connect your NEAR wallet to start the migration process</p>
				<Button onClick={showWalletSelector}>Connect Wallet</Button>
			</div>
		{/if}
	</div>
</main>
