<script lang="ts">
	import { showToast } from './Toast.svelte';

	import { fetchApi } from '$lib/api';
	import { Content, closeBottomSheet } from '$lib/layout/BottomSheet';

	export let points: number;
	export let evaluation: string;
	export let onClaim: () => void;

	let walletAddress = '';
	let isSubmitting = false;

	async function handleClaim() {
		if (!walletAddress.trim() || isSubmitting) return;

		isSubmitting = true;
		try {
			const response = await fetchApi('/chat/claim', {
				method: 'POST',
				body: { walletAddress }
			});

			if (!response.ok) {
				if (response.status === 401) {
					showToast('Session expired. Please login again.');
					closeBottomSheet();
					return;
				}
				const error = await response.text();
				console.error('Failed to claim points:', error);
				showToast('Failed to claim points. Please try again later.');
				return;
			}

			const { tweetUrl } = await response.json<{ tweetUrl: string }>();
			showToast('Points claimed successfully! Check your wallet soon.', 'success');
			onClaim();
			closeBottomSheet();
			window.open(tweetUrl, '_blank');
		} catch (err) {
			console.error('Error claiming points:', err);
			showToast('Failed to claim points. Please try again later.');
		} finally {
			isSubmitting = false;
		}
	}
</script>

<Content>
	<div slot="header" class="w-full h-full flex items-center px-6">
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

		<section class="bg-purple-900/20 rounded-xl p-4 text-sm">
			<div class="flex items-start gap-3">
				<div class="i-mdi:information text-xl text-purple-200/70 mt-0.5" />
				<div>
					<div class="font-medium text-purple-100">Public Posting Notice</div>
					<div class="mt-1 text-purple-200/70">
						By claiming your points, your conversation with Lucy will be posted on <span
							class="inline-flex items-baseline"
							><div class="i-ri:twitter-x-line translate-y-[0.1em]" /></span
						>
						through our official account
						<a
							href="https://x.com/SimpsForLucy"
							target="_blank"
							rel="noopener noreferrer"
							class="text-purple-300 hover:text-purple-200 transition-colors">@SimpsForLucy</a
						>. This post will also be retweeted from your account to showcase your achievement.
					</div>
				</div>
			</div>
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

		<section class="text-sm space-y-2 text-purple-200/70">
			<div>
				Your points will be sent to your NEAR wallet as tokens. Make sure to provide a valid wallet
				address.
			</div>
		</section>
	</div>
</Content>
