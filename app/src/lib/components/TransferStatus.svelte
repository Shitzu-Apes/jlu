<script lang="ts">
	import { OmniBridgeAPI, type Transfer } from 'omni-bridge-sdk';
	import { onDestroy, onMount } from 'svelte';
	import { match } from 'ts-pattern';

	import { updateJluBalance } from '$lib/stores/jlu';
	import { transfers } from '$lib/stores/transfers';
	import { FixedNumber } from '$lib/util';

	export let transfer: Transfer;
	const {
		transfer_message: { amount }
	} = transfer;

	let pollInterval: ReturnType<typeof setInterval>;

	const formattedAmount = match(transfer.id.origin_chain)
		.with('Near', () => new FixedNumber(String(amount), 18))
		.with('Sol', () => new FixedNumber(String(amount), 9))
		.with('Base', () => new FixedNumber(String(amount), 18))
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

	function getExplorerUrl(
		chain: string,
		address: string,
		type: 'address' | 'tx' = 'address'
	): string {
		return match(chain.toLowerCase())
			.with(
				'near',
				() =>
					`https://${import.meta.env.VITE_NETWORK_ID === 'mainnet' ? '' : 'testnet.'}nearblocks.io/${type === 'address' ? 'address' : 'txns'}/${address}`
			)
			.with(
				'sol',
				() =>
					`https://explorer.solana.com/${type}/${address}${import.meta.env.VITE_NETWORK_ID === 'mainnet' ? '' : '?cluster=devnet'}`
			)
			.with(
				'base',
				() =>
					`https://${import.meta.env.VITE_NETWORK_ID === 'mainnet' ? '' : 'sepolia.'}basescan.org/${type === 'address' ? 'address' : 'tx'}/${address}`
			)
			.otherwise(() => '');
	}

	function formatHash(hash: string): string {
		return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
	}

	function getTransactionHash(transfer: Transfer): { chain: string; hash: string } | null {
		if (transfer.finalised?.NearReceipt?.transaction_hash) {
			return { chain: 'near', hash: transfer.finalised.NearReceipt.transaction_hash };
		}
		if (transfer.finalised?.Solana?.signature) {
			return { chain: 'sol', hash: transfer.finalised.Solana.signature };
		}
		if (transfer.finalised?.EVMLog?.transaction_hash) {
			return { chain: 'base', hash: transfer.finalised.EVMLog.transaction_hash };
		}
		return null;
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
			const updatedTransfer = await api.getTransfer(
				transfer.id.origin_chain,
				transfer.id.origin_nonce
			);

			transfers.updateTransfer({ event: updatedTransfer, chain: transfer.id.origin_chain });

			if (updatedTransfer.finalised != null) {
				clearInterval(pollInterval);
				await updateJluBalance();
			}
		} catch (err) {
			console.error(
				`[Transfer ${transfer.id.origin_chain}:${transfer.id.origin_nonce}] Error:`,
				err
			);
		}
	}

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
				{new Date(
					(transfer.initialized?.NearReceipt?.block_timestamp_seconds ??
						transfer.initialized?.EVMLog?.block_timestamp_seconds ??
						transfer.initialized?.Solana?.block_timestamp_seconds ??
						Date.now() / 1_000) * 1_000
				).toLocaleString()}
			</div>
		</div>
		<div class="flex items-center gap-2 text-sm">
			{#if transfer.finalised != null}
				<div class="i-mdi:check-circle text-green-500 text-xl" />
				<span class="text-green-500">Transfer completed</span>
			{:else}
				<div class="i-mdi:loading animate-spin text-purple-200/70 text-xl" />
				<span class="text-purple-200/70">Transfer in progress...</span>
			{/if}
		</div>
	</div>

	<!-- Transaction Hash -->
	{#if transfer.finalised != null}
		{@const txInfo = getTransactionHash(transfer)}
		{#if txInfo}
			<div class="flex items-center gap-2 text-sm">
				<span class="text-purple-200/70">Tx:</span>
				<div class="flex items-center gap-1.5">
					<img src={getChainIcon(txInfo.chain)} alt={txInfo.chain} class="w-4 h-4 rounded-full" />
					<a
						href={getExplorerUrl(txInfo.chain, txInfo.hash, 'tx')}
						target="_blank"
						rel="noopener noreferrer"
						class="text-purple-100 hover:text-purple-300 transition-colors flex items-center gap-1 font-mono text-xs"
					>
						<span>{formatHash(txInfo.hash)}</span>
						<div class="i-mdi:open-in-new text-sm opacity-70" />
					</a>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Sender and Recipient -->
	<div class="flex flex-col gap-1.5 text-sm">
		{#if transfer.transfer_message.sender}
			{@const [senderChain, senderAddress] = transfer.transfer_message.sender.split(':')}
			<div class="flex items-center gap-2">
				<span class="text-purple-200/70">From:</span>
				<div class="flex items-center gap-1.5">
					<img src={getChainIcon(senderChain)} alt={senderChain} class="w-4 h-4 rounded-full" />
					<a
						href={getExplorerUrl(senderChain, senderAddress)}
						target="_blank"
						rel="noopener noreferrer"
						class="text-purple-100 hover:text-purple-300 transition-colors flex items-center gap-1"
					>
						<span>{formatAddress(senderAddress)}</span>
						<div class="i-mdi:open-in-new text-sm opacity-70" />
					</a>
				</div>
			</div>
		{/if}
		{#if transfer.transfer_message.recipient}
			{@const [recipientChain, recipientAddress] = transfer.transfer_message.recipient.split(':')}
			<div class="flex items-center gap-2">
				<span class="text-purple-200/70">To:</span>
				<div class="flex items-center gap-1.5">
					<img
						src={getChainIcon(recipientChain)}
						alt={recipientChain}
						class="w-4 h-4 rounded-full"
					/>
					<a
						href={getExplorerUrl(recipientChain, recipientAddress)}
						target="_blank"
						rel="noopener noreferrer"
						class="text-purple-100 hover:text-purple-300 transition-colors flex items-center gap-1"
					>
						<span>{formatAddress(recipientAddress)}</span>
						<div class="i-mdi:open-in-new text-sm opacity-70" />
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
