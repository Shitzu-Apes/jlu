<script lang="ts">
	import { writable } from 'svelte/store';

	import { showWalletSelector } from '$lib/auth';
	import Button from '$lib/components/Button.svelte';
	import { wallet } from '$lib/near';
	import { Ft } from '$lib/near/fungibleToken';
	import { updateJluBalance } from '$lib/near/jlu';
	import { FixedNumber } from '$lib/util';

	const { account$, isLoading$ } = wallet;

	// Store for old JLU balance
	const oldBalance$ = writable<FixedNumber | null>(null);

	// Update balance when account changes
	account$.subscribe(async (account) => {
		if (!account?.accountId) {
			oldBalance$.set(null);
			return;
		}
		try {
			const balance = await Ft.balanceOf(
				import.meta.env.VITE_JLU_TOKEN_ID_OLD,
				account.accountId,
				18
			);
			oldBalance$.set(balance);
		} catch (err) {
			console.error('Failed to fetch JLU balance:', err);
			oldBalance$.set(null);
		}
	});

	async function handleMigrate() {
		const account = $account$;
		if (!account) return;

		const balance = $oldBalance$;
		if (!balance) return;

		await Ft.ft_transfer_call(
			{
				tokenId: import.meta.env.VITE_JLU_TOKEN_ID_OLD,
				receiverId: import.meta.env.VITE_JLU_TOKEN_ID,
				amount: balance.toU128(),
				memo: ''
			},
			{
				onSuccess: async (tx) => {
					console.log('Migration successful', tx);
					oldBalance$.set(null); // Old balance is now 0
					await updateJluBalance(balance); // Add migrated amount to new balance
				}
			}
		);
	}
</script>

<main class="w-full max-w-2xl mx-auto py-8 px-4">
	<div class="space-y-8">
		<div class="text-center space-y-4">
			<h1 class="text-4xl font-bold text-purple-100">Token Migration</h1>
			<p class="text-lg text-purple-200/70">Migrate your existing JLU tokens to the new contract</p>
		</div>

		{#if $account$}
			<div class="bg-purple-900/20 rounded-xl p-6 space-y-6">
				<div class="space-y-2">
					<div class="text-sm text-purple-200/70">Your Balance</div>
					{#if $oldBalance$}
						<p class="text-2xl font-medium">{$oldBalance$.format()} JLU</p>
					{:else}
						<p class="text-purple-200/70">No JLU tokens found</p>
					{/if}
				</div>

				<div class="space-y-4">
					<div class="flex justify-between items-center">
						<span class="text-purple-200/70">Available to Migrate</span>
						<span class="font-medium">{$oldBalance$?.format() ?? '0.00'} JLU</span>
					</div>

					<Button
						onClick={handleMigrate}
						disabled={!$oldBalance$ || $oldBalance$.valueOf() === 0n}
						class="w-full"
					>
						{#if !$oldBalance$ || $oldBalance$.valueOf() === 0n}
							No Tokens to Migrate
						{:else}
							Migrate {$oldBalance$.format()} JLU
						{/if}
					</Button>
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
				<Button onClick={showWalletSelector} loading={$isLoading$} class="w-full"
					>Connect Wallet</Button
				>
			</div>
		{/if}
	</div>
</main>
