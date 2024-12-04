<script lang="ts">
	import { Content } from '$lib/layout/BottomSheet';

	export let points: number;
	export let evaluation: string;

	let walletAddress = '';
	let isSubmitting = false;

	async function handleClaim() {
		if (!walletAddress.trim()) return;
		isSubmitting = true;
		// TODO: Implement claim logic
		isSubmitting = false;
	}
</script>

<Content>
	<div slot="header" class="w-full px-6 py-4">
		<h2 class="text-2xl font-bold text-purple-100">Claim Your Points</h2>
	</div>

	<div class="px-6 py-4 space-y-6 text-zinc-200">
		<section class="text-center">
			<div class="text-4xl font-bold text-purple-100 mb-2">
				{points} Points
			</div>
			<p class="text-lg text-purple-200/70">Lucy's Evaluation</p>
			<p class="mt-2 text-lg italic">"{evaluation}"</p>
		</section>

		<section class="space-y-4">
			<div class="space-y-2">
				<label for="wallet" class="block text-sm text-purple-200/70">NEAR Wallet Address</label>
				<input
					id="wallet"
					type="text"
					bind:value={walletAddress}
					placeholder="your-wallet.near"
					class="w-full bg-zinc-900/50 text-white border border-purple-900/20 rounded-xl px-4 py-3 min-w-0 focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder:text-zinc-400"
				/>
			</div>

			<button
				on:click={handleClaim}
				disabled={!walletAddress.trim() || isSubmitting}
				class="w-full bg-purple-600/80 hover:bg-purple-500/80 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl px-6 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors font-medium"
			>
				{#if isSubmitting}
					Claiming...
				{:else}
					Claim {points} Points
				{/if}
			</button>
		</section>

		<section class="text-sm text-purple-200/70">
			<p>
				Your points will be sent to your NEAR wallet as tokens. Make sure to provide a valid wallet
				address.
			</p>
		</section>
	</div>
</Content>
