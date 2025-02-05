<script lang="ts">
	import { ChainKind, getClient, omniAddress, OmniBridgeAPI } from 'omni-bridge-sdk';
	import { writable } from 'svelte/store';
	import { match } from 'ts-pattern';

	import { showWalletSelector } from '$lib/auth';
	import Button from '$lib/components/Button.svelte';
	import TokenInput from '$lib/components/TokenInput.svelte';
	import { wallet } from '$lib/near';
	import { jluBalance$ } from '$lib/near/jlu';

	const { accountId$, isLoading$, selector$ } = wallet;

	type Network = 'near' | 'solana' | 'base';

	const networks = [
		{
			id: 'near',
			name: 'Near',
			icon: '/near-logo.webp'
		},
		{
			id: 'solana',
			name: 'Solana',
			icon: '/sol-logo.webp'
		},
		{
			id: 'base',
			name: 'Base',
			icon: '/base-logo.webp'
		}
	] as const;

	const sourceNetwork$ = writable<Network>('near');
	const destinationNetwork$ = writable<Network>('solana');
	let amount: TokenInput;
	$: amount$ = amount?.u128$;
	let amountValue$ = writable<string | undefined>();
	const recipientAddress$ = writable<string>('');

	function handleSwapNetworks() {
		const source = $sourceNetwork$;
		const destination = $destinationNetwork$;
		sourceNetwork$.set(destination);
		destinationNetwork$.set(source);
	}

	function handleMaxAmount() {
		if ($jluBalance$) {
			$amountValue$ = $jluBalance$.toString();
		}
	}

	async function handleBridge() {
		if (!$accountId$ || !$amount$) {
			showWalletSelector();
			return;
		}
		const amount = $amount$.toU128();

		await match($sourceNetwork$)
			.with('near', async () => {
				const selector = await $selector$;

				const client = getClient(ChainKind.Near, selector);
				const api = new OmniBridgeAPI(import.meta.env.VITE_NETWORK_ID as 'mainnet' | 'testnet');

				const sender = omniAddress(
					match($sourceNetwork$)
						.with('near', () => ChainKind.Near)
						.with('solana', () => ChainKind.Sol)
						.with('base', () => ChainKind.Base)
						.exhaustive(),
					$accountId$
				);
				const recipient = omniAddress(
					match($destinationNetwork$)
						.with('near', () => ChainKind.Near)
						.with('solana', () => ChainKind.Sol)
						.with('base', () => ChainKind.Base)
						.exhaustive(),
					$recipientAddress$
				);
				const tokenAddress = omniAddress(ChainKind.Near, import.meta.env.VITE_JLU_TOKEN_ID);

				const fee = await api.getFee(sender, recipient, tokenAddress);
				console.log('fee', fee);
				client.initTransfer({
					amount: BigInt(amount),
					fee: BigInt(fee.transferred_token_fee ?? 0),
					nativeFee: BigInt(fee.native_token_fee),
					recipient,
					tokenAddress
				});
			})
			.with('solana', () => {
				// TODO
				// const client = getClient(ChainKind.Sol, $accountId$);
			})
			.with('base', () => {
				// const client = getClient(ChainKind.Base, $accountId$);
			})
			.exhaustive();
	}

	function isValidAddress(address: string, network: Network): boolean {
		if (!address) return false;

		return match(network)
			.with('near', () => Boolean(address.match(/^[0-9a-zA-Z.-_]+$/)))
			.with('solana', () => Boolean(address.match(/^[0-9a-zA-Z]{44}$/)))
			.with('base', () => Boolean(address.match(/^0x[0-9a-fA-F]{40}$/)))
			.exhaustive();
	}

	$: canBridge =
		$amount$ &&
		$accountId$ &&
		$sourceNetwork$ === 'near' &&
		!$isLoading$ &&
		$sourceNetwork$ !== $destinationNetwork$ &&
		(!$jluBalance$ || ($amount$ && $amount$.valueOf() <= $jluBalance$.valueOf())) &&
		isValidAddress($recipientAddress$, $destinationNetwork$);
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
								: 'hover:bg-purple-900/30'} transition-colors"
							on:click={() => sourceNetwork$.set(network.id)}
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
								: 'hover:bg-purple-900/30'} transition-colors"
							on:click={() => destinationNetwork$.set(network.id)}
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
							<span class="text-sm font-medium text-purple-100"
								>{$jluBalance$.format({ maximumSignificantDigits: 8 })}</span
							>
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
						bind:this={amount}
						bind:value={$amountValue$}
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

			<!-- Recipient Address -->
			<div class="space-y-2">
				<div class="text-sm text-purple-200/70">Recipient Address</div>
				<input
					type="text"
					bind:value={$recipientAddress$}
					class="w-full bg-zinc-900/50 text-white border border-purple-900/20 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
					placeholder="{networks.find((n) => n.id === $destinationNetwork$)?.name} address"
				/>
			</div>

			<Button onClick={handleBridge} loading={$isLoading$} disabled={!canBridge} class="w-full">
				{#if $accountId$}
					{#if !$amount$}
						Enter Amount
					{:else if $sourceNetwork$ !== 'near'}
						Only NEAR Network Supported
					{:else}
						Bridge {$amount$.format({
							compactDisplay: 'short',
							notation: 'compact',
							maximumFractionDigits: 4,
							maximumSignificantDigits: 8
						})} JLU
					{/if}
				{:else}
					Connect Wallet
				{/if}
			</Button>

			<div class="text-sm text-purple-200/70">
				<p>Note:</p>
				<ul class="list-disc list-inside mt-2 space-y-1">
					<li>Currently only bridging from NEAR network is supported</li>
					<li>Bridge fees may apply depending on the source and destination network</li>
					<li>Bridging time should be less than 1 minute</li>
				</ul>
			</div>
		</div>
	</div>
</main>
