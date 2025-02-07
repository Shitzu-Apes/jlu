<script lang="ts">
	import { AnchorProvider } from '@coral-xyz/anchor';
	import { ChainKind, getClient, omniAddress, OmniBridgeAPI, type Chain } from 'omni-bridge-sdk';
	import { writable, get } from 'svelte/store';
	import { match } from 'ts-pattern';

	import { showWalletSelector } from '$lib/auth';
	import Button from '$lib/components/Button.svelte';
	import TokenInput from '$lib/components/TokenInput.svelte';
	import TransferStatus from '$lib/components/TransferStatus.svelte';
	import { nearWallet } from '$lib/near';
	import { solanaWallet } from '$lib/solana/wallet';
	import { jluBalance$ } from '$lib/stores/jlu';
	import { transfers } from '$lib/stores/transfers';

	const { accountId$, isLoading$, selector$ } = nearWallet;
	const { publicKey$ } = solanaWallet;

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

	function handleSourceNetworkChange(network: Network) {
		if (network === $destinationNetwork$) {
			// If selecting same network as destination, swap them
			destinationNetwork$.set($sourceNetwork$);
		}
		sourceNetwork$.set(network);
	}

	function handleDestinationNetworkChange(network: Network) {
		if (network === $sourceNetwork$) {
			// If selecting same network as source, swap them
			sourceNetwork$.set($destinationNetwork$);
		}
		destinationNetwork$.set(network);
	}

	function handleMaxAmount() {
		const currentBalance = $sourceNetwork$ === 'near' ? $jluBalance$.near : $jluBalance$.solana;
		if (currentBalance) {
			$amountValue$ = currentBalance.toString();
		}
	}

	function handleFillRecipient() {
		match($destinationNetwork$)
			.with('solana', () => {
				if ($publicKey$) {
					$recipientAddress$ = $publicKey$.toBase58();
				} else {
					showWalletSelector('solana');
				}
			})
			.with('base', () => {
				// TODO: Add Base wallet integration
				showWalletSelector();
			})
			.with('near', () => {
				if ($accountId$) {
					$recipientAddress$ = $accountId$;
				} else {
					showWalletSelector('near');
				}
			})
			.exhaustive();
	}

	function getWalletButtonText(network: Network): string {
		return match(network)
			.with('solana', () => ($publicKey$ ? 'Use Wallet' : 'Connect Wallet'))
			.with('base', () => 'Connect Wallet')
			.with('near', () => ($accountId$ ? 'Use Wallet' : 'Connect Wallet'))
			.exhaustive();
	}

	async function handleBridge() {
		if (!$amount$) {
			return;
		}

		if ($sourceNetwork$ === 'near' && !$accountId$) {
			showWalletSelector('near');
			return;
		}

		if ($sourceNetwork$ === 'solana' && !$publicKey$) {
			showWalletSelector('solana');
			return;
		}

		const amount = $amount$.toU128();
		const api = new OmniBridgeAPI();

		const transferEvent = await match($sourceNetwork$)
			.with('near', async () => {
				const selector = await $selector$;

				const client = getClient(ChainKind.Near, selector);

				const sender = omniAddress(ChainKind.Near, $accountId$ ?? '');
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
				return client.initTransfer({
					amount: BigInt(amount),
					fee: BigInt(fee.transferred_token_fee ?? 0),
					nativeFee: BigInt(fee.native_token_fee),
					recipient,
					tokenAddress
				});
			})
			.with('solana', async () => {
				const wallet = get(solanaWallet.selectedWallet$);
				if (!wallet) return;
				const publicKey = $publicKey$?.toBase58();
				if (!publicKey) return;

				const provider = solanaWallet.getProvider();
				if (!provider) {
					console.error('Provider not connected.');
					return;
				}
				const client = getClient(ChainKind.Sol, provider);

				const sender = omniAddress(ChainKind.Sol, publicKey);
				const recipient = omniAddress(
					match($destinationNetwork$)
						.with('near', () => ChainKind.Near)
						.with('solana', () => ChainKind.Sol)
						.with('base', () => ChainKind.Base)
						.exhaustive(),
					$recipientAddress$
				);
				const tokenAddress = omniAddress(ChainKind.Sol, import.meta.env.VITE_JLU_TOKEN_ID_SOLANA);

				const fee = await api.getFee(sender, recipient, tokenAddress);
				console.log(amount)
				return client.initTransfer({
					amount: BigInt(amount)/BigInt(1000000000n),
					fee: BigInt(fee.transferred_token_fee ?? 0),
					nativeFee: BigInt(fee.native_token_fee),
					recipient,
					tokenAddress
				});
			})
			.with('base', () => {
				// TODO: Add Base chain support
				throw new Error();
			})
			.exhaustive();

		console.log('[transferEvent]', transferEvent);
		if (!transferEvent) {
			throw new Error('Failed to initiate transfer');
		}

		const chain: Chain = match($sourceNetwork$)
			.with('near', () => 'Near' as const)
			.with('solana', () => 'Sol' as const)
			.with('base', () => 'Base' as const)
			.exhaustive();

		// Show the transfer status component
		const transfer = transfers.getTransfer(chain, transferEvent.transfer_message.origin_nonce);
		if (!transfer) {
			showTransferStatus = true;
		}
	}

	let showTransferStatus = false;
	$: latestTransfer = $transfers[0];

	function isValidAddress(address: string, network: Network): boolean {
		if (!address) return false;

		return match(network)
			.with('near', () => Boolean(address.match(/^[0-9a-zA-Z.-_]+$/)))
			.with('solana', () => Boolean(address.match(/^[0-9a-zA-Z]{44}$/)))
			.with('base', () => Boolean(address.match(/^0x[0-9a-fA-F]{40}$/)))
			.exhaustive();
	}

	$: walletConnected = match($sourceNetwork$)
		.with('near', () => Boolean($accountId$))
		.with('solana', () => Boolean($publicKey$))
		.with('base', () => false)
		.exhaustive();

	$: currentBalance = match($sourceNetwork$)
		.with('near', () => $jluBalance$.near?.valueOf() ?? 0n)
		.with('solana', () => ($jluBalance$.solana?.valueOf() ?? 0n) * 1000000000n)
		.with('base', () => 0n)
		.exhaustive();

	$: canBridge =
		Boolean($amount$) &&
		walletConnected &&
		!$isLoading$ &&
		$sourceNetwork$ !== $destinationNetwork$ &&
		(!$jluBalance$ || ($amount$ && $amount$.valueOf() <= currentBalance)) &&
		isValidAddress($recipientAddress$, $destinationNetwork$);

	$: needsWalletConnection = match($sourceNetwork$)
		.with('near', () => !$accountId$)
		.with('solana', () => !$publicKey$)
		.with('base', () => true)
		.exhaustive();
</script>

<main class="w-full max-w-2xl mx-auto py-6 px-4">
	<div class="flex flex-col gap-6">
		<div class="flex flex-col items-center gap-3">
			<h1 class="text-4xl font-bold text-purple-100">Bridge JLU</h1>
			<p class="text-lg text-purple-200/70">Transfer your JLU tokens between networks</p>
		</div>

		<div class="flex flex-col gap-5 bg-purple-900/20 rounded-xl p-5">
			<!-- Source Network -->
			<div class="flex flex-col gap-1.5">
				<div class="text-sm text-purple-200/70">From</div>
				<div class="grid grid-cols-3 gap-2">
					{#each networks as network}
						<button
							class="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-purple-900/20 {$sourceNetwork$ ===
							network.id
								? 'bg-purple-900/40 border-purple-500/50'
								: 'hover:bg-purple-900/30'} transition-colors"
							on:click={() => handleSourceNetworkChange(network.id)}
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
			<div class="flex flex-col gap-1.5">
				<div class="text-sm text-purple-200/70">To</div>
				<div class="grid grid-cols-3 gap-2">
					{#each networks as network}
						<button
							class="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-purple-900/20 {$destinationNetwork$ ===
							network.id
								? 'bg-purple-900/40 border-purple-500/50'
								: 'hover:bg-purple-900/30'} transition-colors"
							on:click={() => handleDestinationNetworkChange(network.id)}
						>
							<img src={network.icon} alt={network.name} class="w-8 h-8 rounded-full" />
							<span class="text-sm font-medium">{network.name}</span>
						</button>
					{/each}
				</div>
			</div>

			<!-- Amount -->
			<div class="flex flex-col gap-1.5">
				<div class="flex items-center justify-between">
					<div class="text-sm text-purple-200/70">Amount</div>
					{#if $sourceNetwork$ === 'near' ? $jluBalance$.near : $jluBalance$.solana}
						<div class="flex items-center gap-2 text-purple-200/70">
							<img src="/logo.webp" alt="JLU" class="w-4 h-4 rounded-full" />
							<span class="text-sm font-medium text-purple-100"
								>{($sourceNetwork$ === 'near' ? $jluBalance$.near : $jluBalance$.solana)?.format({
									maximumSignificantDigits: 8
								})}</span
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
					{#if $sourceNetwork$ === 'near' ? $jluBalance$.near : $jluBalance$.solana}
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
			<div class="flex flex-col gap-1.5">
				<div class="text-sm text-purple-200/70">Recipient Address</div>
				<div class="relative">
					<input
						type="text"
						bind:value={$recipientAddress$}
						class="w-full bg-zinc-900/50 text-white border border-purple-900/20 rounded-xl pl-4 pr-[120px] py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
						placeholder="{networks.find((n) => n.id === $destinationNetwork$)?.name} address"
					/>
					<button
						on:click={handleFillRecipient}
						class="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-purple-200/70 hover:text-purple-100 hover:bg-purple-900/30 px-2 py-0.5 rounded transition-colors z-10"
					>
						{getWalletButtonText($destinationNetwork$)}
					</button>
				</div>
			</div>

			<Button
				onClick={handleBridge}
				loading={$isLoading$}
				disabled={false}
				class="w-full"
			>
				{#if needsWalletConnection}
					Connect Wallet
				{:else if !$amount$}
					Enter Amount
				{:else if $sourceNetwork$ === 'base'}
					Bridging from Base not yet supported
				{:else}
					Bridge {$amount$.format({
						compactDisplay: 'short',
						notation: 'compact',
						maximumFractionDigits: 4,
						maximumSignificantDigits: 8
					})} JLU
				{/if}
			</Button>

			{#if showTransferStatus && latestTransfer}
				<div class="p-4 bg-purple-900/30 rounded-xl">
					<TransferStatus
						chain={latestTransfer.chain}
						nonce={latestTransfer.nonce}
						amount={latestTransfer.amount}
					/>
				</div>
			{/if}

			{#if $transfers.length > 0}
				<div class="flex flex-col gap-2">
					<div class="text-sm text-purple-200/70">Recent Transfers</div>
					<div class="flex flex-col gap-1.5">
						{#each $transfers as transfer}
							<div class="flex items-center justify-between p-3 bg-purple-900/20 rounded-lg">
								<div class="flex flex-col gap-1">
									<div class="text-sm font-medium">
										{transfer.amount} JLU
									</div>
									<div class="text-xs text-purple-200/70">
										{new Date(transfer.timestamp).toLocaleString()}
									</div>
								</div>
								<TransferStatus
									chain={transfer.chain}
									nonce={transfer.nonce}
									amount={transfer.amount}
								/>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="flex flex-col gap-1.5 text-sm text-purple-200/70">
				<p>Note:</p>
				<ul class="list-disc list-inside flex flex-col gap-1">
					<li>Currently bridging from NEAR and Solana networks is supported</li>
					<li>Bridge fees may apply depending on the source and destination network</li>
					<li>Bridging time should be less than 1 minute</li>
				</ul>
			</div>
		</div>
	</div>
</main>
