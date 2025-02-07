<script lang="ts">
	import { OmniBridgeAPI } from 'omni-bridge-sdk';
	import { onDestroy, onMount } from 'svelte';
	import { match } from 'ts-pattern';

	import { updateJluBalance } from '$lib/stores/jlu';
	import { transfers, type Transfer } from '$lib/stores/transfers';
	import { FixedNumber } from '$lib/util';

	export let transfer: Transfer;
	const { chain, nonce, amount } = transfer;

	let pollInterval: ReturnType<typeof setInterval>;

	const formattedAmount = match(chain)
		.with('Near', () => new FixedNumber(amount, 18))
		.with('Sol', () => new FixedNumber(amount, 9))
		.with('Base', () => new FixedNumber(amount, 18))
		.otherwise(() => {
			throw new Error('Invalid chain');
		});

	async function pollStatus() {
		const api = new OmniBridgeAPI();
		const transferStatus = await api.getTransferStatus(chain, nonce);
		transfers.updateTransfer(chain, nonce, transferStatus);

		switch (transferStatus) {
			case 'Finalised':
				clearInterval(pollInterval);
				// Update JLU balance when transfer is finalized
				await updateJluBalance();
				break;
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

<div class="flex items-center justify-between p-3 bg-purple-900/20 rounded-lg">
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
		{#if $transfers.find((t) => t.chain === chain && t.nonce === nonce)?.status === 'Finalised'}
			<div class="i-mdi:check-circle text-green-500 text-xl" />
			<span class="text-green-500">Transfer completed</span>
		{:else}
			<div class="i-mdi:loading animate-spin text-purple-200/70 text-xl" />
			<span class="text-purple-200/70">Transfer in progress...</span>
		{/if}
	</div>
</div>
