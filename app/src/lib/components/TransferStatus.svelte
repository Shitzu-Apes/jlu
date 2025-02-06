<script lang="ts">
	import { OmniBridgeAPI, type Chain } from 'omni-bridge-sdk';
	import { onDestroy, onMount } from 'svelte';

	import { transfers } from '$lib/stores/transfers';

	export let chain: Chain;
	export let nonce: number;
	export let amount: string;

	let pollInterval: ReturnType<typeof setInterval>;

	async function pollStatus() {
		const api = new OmniBridgeAPI(import.meta.env.VITE_NETWORK_ID as 'mainnet' | 'testnet');
		const transferStatus = await api.getTransferStatus(chain, nonce);
		transfers.updateTransfer(chain, nonce, transferStatus);

		switch (transferStatus) {
			case 'Finalised':
				clearInterval(pollInterval);
				break;
		}
	}

	onMount(() => {
		// Add the transfer to the store if it's not already there
		if (!transfers.getTransfer(chain, nonce)) {
			transfers.addTransfer({
				chain,
				nonce,
				amount,
				status: 'Initialized',
				timestamp: Date.now()
			});
		}

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

<div class="flex items-center gap-2 text-sm">
	{#if $transfers.find((t) => t.chain === chain && t.nonce === nonce)?.status === 'Finalised'}
		<div class="i-mdi:check-circle text-green-500 text-xl" />
		<span class="text-green-500">Transfer completed</span>
	{:else}
		<div class="i-mdi:loading animate-spin text-purple-200/70 text-xl" />
		<span class="text-purple-200/70">Transfer in progress...</span>
	{/if}
</div>
