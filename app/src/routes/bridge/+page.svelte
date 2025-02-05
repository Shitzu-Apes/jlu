<script lang="ts">
	import { writable } from 'svelte/store';

	import { showWalletSelector } from '$lib/auth';
	import Button from '$lib/components/Button.svelte';
	import TokenInput from '$lib/components/TokenInput.svelte';
	import { wallet } from '$lib/near';
	import { jluBalance$ } from '$lib/near/jlu';

	const { accountId$, isLoading$ } = wallet;

	type Network = 'near' | 'solana' | 'base';

	const networks = [
		{
			id: 'near',
			name: 'NEAR',
			icon: '/near-logo.webp',
			disabled: false
		},
		{
			id: 'solana',
			name: 'Solana',
			icon: '/sol-logo.webp',
			disabled: true
		},
		{
			id: 'base',
			name: 'Base',
			icon: '/base-logo.webp',
			disabled: true
		}
	] as const;

	const sourceNetwork$ = writable<Network>('near');
	const destinationNetwork$ = writable<Network>('solana');
	const amount$ = writable<string>('');

	function handleSwapNetworks() {
		const source = $sourceNetwork$;
		const destination = $destinationNetwork$;
		sourceNetwork$.set(destination);
		destinationNetwork$.set(source);
	}

	function handleMaxAmount() {
		if ($jluBalance$) {
			amount$.set($jluBalance$.format());
		}
	}

	async function handleBridge() {
		if (!$accountId$) {
			showWalletSelector();
			return;
		}

		// TODO: Implement bridging logic
		console.log('Bridge from', $sourceNetwork$, 'to', $destinationNetwork$);
	}

	$: canBridge = $amount$ && $accountId$ && $sourceNetwork$ === 'near' && !$isLoading$;
</script>

<main class="w-full max-w-2xl mx-auto py-8 px-4">
	<div class="space-y-8">
		<div class="text-center space-y-4">
			<h1 class="text-4xl font-bold text-purple-100">Bridge JLU</h1>
			<p class="text-lg text-purple-200/70">Transfer your JLU tokens between networks</p>
		</div>

		<div class="bg-purple-900/20 rounded-xl p-6 space-y-6">
			<!-- Source Network -->
			<div class="space-y-2">
				<div class="text-sm text-purple-200/70">From</div>
				<div class="grid grid-cols-3 gap-2">
					{#each networks as network}
						<button
							class="flex flex-col items-center gap-2 p-3 rounded-xl border border-purple-900/20 {$sourceNetwork$ ===
							network.id
								? 'bg-purple-900/40 border-purple-500/50'
								: 'hover:bg-purple-900/30'} transition-colors {network.disabled
								? 'opacity-50 cursor-not-allowed'
								: ''}"
							on:click={() => sourceNetwork$.set(network.id)}
							disabled={network.disabled}
						>
							<img src={network.icon} alt={network.name} class="w-8 h-8 rounded-full" />
							<span class="text-sm font-medium">{network.name}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Swap Button -->
			<div class="flex justify-center">
				<button
					class="p-2 rounded-lg hover:bg-purple-900/30 transition-colors"
					on:click={handleSwapNetworks}
					aria-label="Swap networks"
				>
					<div class="i-mdi:swap-vertical text-2xl text-purple-200/70" />
				</button>
			</div>

			<!-- Destination Network -->
			<div class="space-y-2">
				<div class="text-sm text-purple-200/70">To</div>
				<div class="grid grid-cols-3 gap-2">
					{#each networks as network}
						<button
							class="flex flex-col items-center gap-2 p-3 rounded-xl border border-purple-900/20 {$destinationNetwork$ ===
							network.id
								? 'bg-purple-900/40 border-purple-500/50'
								: 'hover:bg-purple-900/30'} transition-colors {network.disabled
								? 'opacity-50 cursor-not-allowed'
								: ''}"
							on:click={() => destinationNetwork$.set(network.id)}
							disabled={network.disabled}
						>
							<img src={network.icon} alt={network.name} class="w-8 h-8 rounded-full" />
							<span class="text-sm font-medium">{network.name}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Amount -->
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<div class="text-sm text-purple-200/70">Amount</div>
					{#if $jluBalance$}
						<div class="flex items-center gap-2 text-purple-200/70">
							<img src="/logo.webp" alt="JLU" class="w-4 h-4 rounded-full" />
							<span class="text-sm font-medium text-purple-100">{$jluBalance$.format()}</span>
							<span class="text-sm">Available</span>
						</div>
					{/if}
				</div>
				<div class="relative">
					<div class="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10">
						<img src="/logo.webp" alt="JLU" class="w-5 h-5 rounded-full" />
						<span class="text-sm font-medium">JLU</span>
					</div>
					<TokenInput
						bind:value={$amount$}
						decimals={18}
						class="w-full bg-zinc-900/50 text-white border border-purple-900/20 rounded-xl pl-20 pr-16 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
						placeholder="0.0"
					/>
					{#if $jluBalance$}
						<button
							on:click={handleMaxAmount}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-purple-200/70 hover:text-purple-100 hover:bg-purple-900/30 px-2 py-0.5 rounded transition-colors z-10"
						>
							Max
						</button>
					{/if}
				</div>
			</div>

			<Button onClick={handleBridge} loading={$isLoading$} disabled={!canBridge} class="w-full">
				{#if $accountId$}
					{#if !$amount$}
						Enter Amount
					{:else if $sourceNetwork$ !== 'near'}
						Only NEAR Network Supported
					{:else}
						Bridge {$amount$} JLU
					{/if}
				{:else}
					Connect Wallet
				{/if}
			</Button>

			<div class="text-sm text-purple-200/70">
				<p>Note:</p>
				<ul class="list-disc list-inside mt-2 space-y-1">
					<li>Currently only bridging from NEAR network is supported</li>
					<li>Bridge fees may apply depending on the destination network</li>
					<li>Bridging time varies by network and can take up to 15 minutes</li>
				</ul>
			</div>
		</div>
	</div>
</main>
