<script lang="ts">
	import { getConnectorClient, type Config } from '@wagmi/core';
	import { base, baseSepolia } from '@wagmi/core/chains';
	import { BrowserProvider, JsonRpcSigner } from 'ethers';
	import {
		ChainKind,
		getClient,
		omniAddress,
		OmniBridgeAPI,
		type Chain,
		type Transfer
	} from 'omni-bridge-sdk';
	import { writable, get } from 'svelte/store';
	import { slide } from 'svelte/transition';
	import { match } from 'ts-pattern';

	import { showWalletSelector } from '$lib/auth';
	import Button from '$lib/components/Button.svelte';
	import { showToast } from '$lib/components/Toast.svelte';
	import TokenInput from '$lib/components/TokenInput.svelte';
	import TransferStatus from '$lib/components/TransferStatus.svelte';
	import { evmWallet$, config, switchToBase } from '$lib/evm/wallet';
	import { nearWallet } from '$lib/near';
	import { solanaWallet } from '$lib/solana/wallet';
	import { jluBalance$, updateJluBalance } from '$lib/stores/jlu';
	import { transfers } from '$lib/stores/transfers';

	const { accountId$, selector$ } = nearWallet;
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
	const isLoading$ = writable<boolean>(false);

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
		// Reset recipient address when destination changes
		recipientAddress$.set('');
	}

	function handleMaxAmount() {
		const currentBalance = match($sourceNetwork$)
			.with('near', () => $jluBalance$.near)
			.with('solana', () => $jluBalance$.solana)
			.with('base', () => $jluBalance$.base)
			.exhaustive();

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
				if ($evmWallet$.status === 'connected') {
					$recipientAddress$ = $evmWallet$.address;
				} else {
					showWalletSelector('base');
				}
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
			.with('base', () => ($evmWallet$.status === 'connected' ? 'Use Wallet' : 'Connect Wallet'))
			.with('near', () => ($accountId$ ? 'Use Wallet' : 'Connect Wallet'))
			.exhaustive();
	}

	async function getEthersSigner(config: Config) {
		const evmWallet = $evmWallet$;
		const client = await getConnectorClient(config, {
			chainId: evmWallet.chainId,
			connector: evmWallet.connector,
			account: evmWallet.address
		});
		const chain = import.meta.env.VITE_NETWORK_ID === 'mainnet' ? base : baseSepolia;
		const network = {
			chainId: chain.id,
			name: chain.name,
			ensAddress: client.chain?.contracts?.ensRegistry?.address
		};
		const provider = new BrowserProvider(client.transport, network);
		const signer = new JsonRpcSigner(provider, client.account.address);
		return signer;
	}

	async function handleBridge() {
		if (!$amount$) {
			return;
		}

		$isLoading$ = true;
		const amount = $amount$.toU128();
		const api = new OmniBridgeAPI();

		const rawTransferEvent = await match($sourceNetwork$)
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
					fee: fee.transferred_token_fee ?? 0n,
					nativeFee: fee.native_token_fee ?? 0n,
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
				return client.initTransfer({
					amount: BigInt(amount) / 1_000_000_000n,
					fee: fee.transferred_token_fee ?? 0n,
					nativeFee: fee.native_token_fee ?? 0n,
					recipient,
					tokenAddress
				});
			})
			.with('base', async () => {
				if ($evmWallet$.status !== 'connected') return;

				// Check if we're on the correct network
				const targetChainId =
					import.meta.env.VITE_NETWORK_ID === 'mainnet' ? base.id : baseSepolia.id;
				if ($evmWallet$.chainId !== targetChainId) {
					try {
						await switchToBase();
					} catch (error) {
						console.error('Failed to switch network:', error);
						showToast({
							data: {
								type: 'simple',
								data: {
									title: 'Network Switch Failed',
									description: 'Please switch to Base network to continue.',
									type: 'error'
								}
							}
						});
						return;
					}
				}

				// Get ethers signer
				const signer = await getEthersSigner(config);
				const client = getClient(ChainKind.Base, signer);

				const sender = omniAddress(ChainKind.Base, $evmWallet$.address);
				const recipient = omniAddress(
					match($destinationNetwork$)
						.with('near', () => ChainKind.Near)
						.with('solana', () => ChainKind.Sol)
						.with('base', () => ChainKind.Base)
						.exhaustive(),
					$recipientAddress$
				);
				const tokenAddress = omniAddress(ChainKind.Base, import.meta.env.VITE_JLU_TOKEN_ID_BASE);

				const fee = await api.getFee(sender, recipient, tokenAddress);
				return client.initTransfer({
					amount: BigInt(amount),
					fee: fee.transferred_token_fee ?? 0n,
					nativeFee: fee.native_token_fee ?? 0n,
					recipient,
					tokenAddress
				});
			})
			.exhaustive();

		console.log('[transferEvent]', rawTransferEvent);
		if (!rawTransferEvent) {
			throw new Error('Failed to initiate transfer');
		}

		const chain: Chain = match($sourceNetwork$)
			.with('near', () => 'Near' as const)
			.with('solana', () => 'Sol' as const)
			.with('base', () => 'Base' as const)
			.exhaustive();

		if (typeof rawTransferEvent === 'string') {
			// Wait for transaction to be indexed
			let data: Transfer | undefined;
			for (let i = 0; i < 20; i++) {
				// Try up to 10 times
				await new Promise((resolve) => setTimeout(resolve, 3_000)); // Wait 2s between attempts
				try {
					// First find the transfer to get the nonce
					const transfers = await api.findOmniTransfers({ transaction_id: rawTransferEvent });
					if (transfers.length > 0) {
						// Then get the full transfer data
						data = await api.getTransfer(
							transfers[0].id.origin_chain,
							transfers[0].id.origin_nonce
						);
						break;
					}
				} catch (err) {
					console.error('Failed to fetch transfer:', err);
					continue;
				}
			}

			if (!data) {
				throw new Error('Failed to fetch transfer data after multiple retries');
			}
			console.log('[data]', data);

			transfers.addTransfers([data]);
		} else {
			console.log('[rawTransferEvent]', rawTransferEvent);
			// For non-string transfer events, we need to wait for them to be indexed
			// This ensures we have the full transfer data structure
			let data: Transfer | undefined;
			for (let i = 0; i < 20; i++) {
				// Try up to 10 times
				await new Promise((resolve) => setTimeout(resolve, 3_000)); // Wait 2s between attempts
				try {
					data = await api.getTransfer(chain, rawTransferEvent.transfer_message.origin_nonce);
					if (data) {
						break;
					}
				} catch (err) {
					console.error('Failed to fetch transfer:', err);
					continue;
				}
			}

			if (!data) {
				throw new Error('Failed to fetch transfer data after multiple retries');
			}
			console.log('[data]', data);

			transfers.addTransfers([data]);
		}

		// Reset input fields after successful bridge
		$amountValue$ = undefined;
		$recipientAddress$ = '';
		return updateJluBalance();
	}

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
		.with('base', () => $evmWallet$.status === 'connected')
		.exhaustive();

	$: currentBalance = match($sourceNetwork$)
		.with('near', () => $jluBalance$.near?.valueOf() ?? 0n)
		.with('solana', () => ($jluBalance$.solana?.valueOf() ?? 0n) * 1000000000n)
		.with('base', () => $jluBalance$.base?.valueOf() ?? 0n)
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
		.with('base', () => $evmWallet$.status !== 'connected')
		.exhaustive();

	// Add these reactive statements for each wallet
	$: if ($accountId$) {
		loadNearTransfers($accountId$);
	} else {
		transfers.removeTransfersByChain('Near');
	}

	$: if ($publicKey$) {
		loadSolanaTransfers($publicKey$.toBase58());
	} else {
		transfers.removeTransfersByChain('Sol');
	}

	$: if ($evmWallet$.status === 'connected') {
		loadBaseTransfers($evmWallet$.address);
	} else {
		transfers.removeTransfersByChain('Base');
	}

	async function loadNearTransfers(accountId: string) {
		const api = new OmniBridgeAPI();
		try {
			const nearTransfers = await api.findOmniTransfers({
				sender: `near:${accountId}`,
				limit: 50
			});
			transfers.addTransfers(nearTransfers);
		} catch (err) {
			console.error('Failed to load NEAR transfers:', err);
		}
	}

	async function loadSolanaTransfers(publicKey: string) {
		const api = new OmniBridgeAPI();
		try {
			const solTransfers = await api.findOmniTransfers({
				sender: `sol:${publicKey}`,
				limit: 50
			});
			transfers.addTransfers(solTransfers);
		} catch (err) {
			console.error('Failed to load Solana transfers:', err);
		}
	}

	async function loadBaseTransfers(address: string) {
		const api = new OmniBridgeAPI();
		try {
			const baseTransfers = await api.findOmniTransfers({
				sender: `base:${address}`,
				limit: 50
			});
			transfers.addTransfers(baseTransfers);
		} catch (err) {
			console.error('Failed to load Base transfers:', err);
		}
	}

	let isLoadingMore = false;
	let visibleCount = 10;

	function handleLoadMore() {
		if (isLoadingMore) return;
		isLoadingMore = true;
		try {
			visibleCount += 10;
		} finally {
			isLoadingMore = false;
		}
	}

	$: visibleTransfers = $transfers.slice(0, visibleCount);
	$: hasMore = visibleCount < $transfers.length;

	// Load initial transfers when wallets change
	$: if ($accountId$ || $publicKey$ || $evmWallet$.status === 'connected') {
		transfers.clear();
		if ($accountId$) loadNearTransfers($accountId$);
		if ($publicKey$) loadSolanaTransfers($publicKey$.toBase58());
		if ($evmWallet$.status === 'connected') loadBaseTransfers($evmWallet$.address);
		visibleCount = 10;
	}
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
					{#if match($sourceNetwork$)
						.with('near', () => $jluBalance$.near)
						.with('solana', () => $jluBalance$.solana)
						.with('base', () => $jluBalance$.base)
						.exhaustive()}
						<div class="flex items-center gap-2 text-purple-200/70">
							<img src="/logo.webp" alt="JLU" class="w-4 h-4 rounded-full" />
							<span class="text-sm font-medium text-purple-100"
								>{match($sourceNetwork$)
									.with('near', () => $jluBalance$.near)
									.with('solana', () => $jluBalance$.solana)
									.with('base', () => $jluBalance$.base)
									.exhaustive()
									?.format({
										maximumSignificantDigits: 8
									})}
							</span>
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

			<Button onClick={handleBridge} disabled={!needsWalletConnection && !canBridge} class="w-full">
				{#if needsWalletConnection}
					Connect Wallet
				{:else if !$amount$}
					Enter Amount
				{:else}
					Bridge {$amount$.format({
						compactDisplay: 'short',
						notation: 'compact',
						maximumFractionDigits: 4,
						maximumSignificantDigits: 8
					})} JLU
				{/if}
			</Button>

			{#if $transfers.length > 0}
				<div class="flex flex-col gap-2">
					<div class="text-sm text-purple-200/70">Recent Transfers</div>
					<div class="flex flex-col gap-1.5">
						{#each visibleTransfers as transfer (transfer.id.origin_chain + ':' + transfer.id.origin_nonce)}
							<div in:slide|global class="flex flex-col">
								<TransferStatus {transfer} />
							</div>
						{/each}
						{#if hasMore}
							<button
								on:click={handleLoadMore}
								disabled={isLoadingMore}
								class="mt-2 px-4 py-2 rounded-lg bg-purple-900/20 hover:bg-purple-900/30 text-purple-200/70 hover:text-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
							>
								{#if isLoadingMore}
									<div class="i-mdi:loading animate-spin" />
									Loading...
								{:else}
									Load More
								{/if}
							</button>
						{/if}
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
