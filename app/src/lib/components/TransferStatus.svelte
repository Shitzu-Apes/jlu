<script lang="ts">
	import { OmniBridgeAPI } from 'omni-bridge-sdk';
	import { onDestroy, onMount } from 'svelte';
	import { match } from 'ts-pattern';

	import { updateJluBalance } from '$lib/stores/jlu';
	import { transfers, type Transfer } from '$lib/stores/transfers';
	import { FixedNumber } from '$lib/util';

	export let transfer: Transfer;
	const { amount } = transfer;

	let pollInterval: ReturnType<typeof setInterval>;

	const formattedAmount = match(transfer.chain)
		.with('Near', () => new FixedNumber(amount, 18))
		.with('Sol', () => new FixedNumber(amount, 9))
		.with('Base', () => new FixedNumber(amount, 18))
		.otherwise(() => {
			throw new Error('Invalid chain');
		});

	function getChainIcon(chainId: string): string {
		return match(chainId.toLowerCase())
			.with('near', () => '/near-logo.webp')
			.with('sol', () => '/sol-logo.webp')
			.with('base', () => '/base-logo.webp')
			.otherwise(() => '');
	}

	function formatAddress(address: string): string {
		if (address.length > 24) {
			return `${address.slice(0, 12)}...${address.slice(-4)}`;
		}
		return address;
	}

	async function pollStatus() {
		const api = new OmniBridgeAPI();
		try {
			const transferStatus = await api.getTransferStatus(transfer.chain, transfer.nonce);

			// Only update JLU balance if status is changing to Finalised
			const oldStatus = $transfers.find(
				(t) => t.chain === transfer.chain && t.nonce === transfer.nonce
			)?.status;

			transfers.updateTransfer(transfer.chain, transfer.nonce, transferStatus);

			if (transferStatus === 'Finalised') {
				clearInterval(pollInterval);
			}
			if (oldStatus !== 'Finalised' && transferStatus === 'Finalised') {
				await updateJluBalance();
			}
		} catch (err) {
			console.error(`[Transfer ${transfer.chain}:${transfer.nonce}] Error:`, err);
		}
	}

	$: currentStatus = $transfers.find(
		(t) => t.chain === transfer.chain && t.nonce === transfer.nonce
	)?.status;

	onMount(() => {
		// Start polling
		pollInterval = setInterval(pollStatus, 5000);
		pollStatus(); // Initial check
	});

	onDestroy(() => {
		if (pollInterval) {
			clearInterval(pollInterval);
		}
	});
</script>

<div class="flex flex-col gap-3 p-3 bg-purple-900/20 rounded-lg">
	<div class="flex items-center justify-between">
		<div class="flex flex-col gap-1">
			<div class="text-sm font-medium">
				{formattedAmount.format({
					compactDisplay: 'short',
					notation: 'compact',
					maximumFractionDigits: 3,
					maximumSignificantDigits: 8
				})} JLU
			</div>
			<div class="text-xs text-purple-200/70">
				{new Date(transfer.timestamp).toLocaleString()}
			</div>
		</div>
		<div class="flex items-center gap-2 text-sm">
			{#if currentStatus === 'Finalised'}
				<div class="i-mdi:check-circle text-green-500 text-xl" />
				<span class="text-green-500">Transfer completed</span>
			{:else}
				<div class="i-mdi:loading animate-spin text-purple-200/70 text-xl" />
				<span class="text-purple-200/70">Transfer in progress...</span>
			{/if}
		</div>
	</div>

	<!-- Sender and Recipient -->
	<div class="flex flex-col gap-1.5 text-sm">
		{#if transfer.sender}
			{@const [senderChain, senderAddress] = transfer.sender.split(':')}
			<div class="flex items-center gap-2">
				<span class="text-purple-200/70">From:</span>
				<div class="flex items-center gap-1.5">
					<img src={getChainIcon(senderChain)} alt={senderChain} class="w-4 h-4 rounded-full" />
					<span class="text-purple-100">{formatAddress(senderAddress)}</span>
				</div>
			</div>
		{/if}
		{#if transfer.recipient}
			{@const [recipientChain, recipientAddress] = transfer.recipient.split(':')}
			<div class="flex items-center gap-2">
				<span class="text-purple-200/70">To:</span>
				<div class="flex items-center gap-1.5">
					<img
						src={getChainIcon(recipientChain)}
						alt={recipientChain}
						class="w-4 h-4 rounded-full"
					/>
					<span class="text-purple-100">{formatAddress(recipientAddress)}</span>
				</div>
			</div>
		{/if}
	</div>
</div>
