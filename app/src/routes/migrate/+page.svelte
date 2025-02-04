<script lang="ts">
	import { session$ } from '$lib/auth';
	import { showWalletSelector } from '$lib/auth';
</script>

<main class="flex-1 flex flex-col items-center justify-center p-4">
	<div class="w-full max-w-2xl space-y-8">
		<div class="text-center space-y-4">
			<h1 class="text-4xl font-bold text-purple-100">Token Migration</h1>
			<p class="text-lg text-purple-200/70">Migrate your existing tokens to the new contract</p>
		</div>

		{#await $session$ then session}
			{#if session}
				<div class="bg-purple-900/20 rounded-xl p-6 space-y-6">
					<div class="space-y-2">
						<h2 class="text-xl font-semibold">Your Balance</h2>
						<p class="text-purple-200/70">Loading your token balance...</p>
					</div>

					<div class="space-y-4">
						<div class="flex justify-between items-center">
							<span class="text-purple-200/70">Available to Migrate</span>
							<span class="font-medium">0.00 TOKENS</span>
						</div>

						<button
							class="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
							disabled={true}
						>
							Migrate Tokens
						</button>
					</div>

					<div class="text-sm text-purple-200/70">
						<p>Note: Migration requires you to:</p>
						<ul class="list-disc list-inside mt-2 space-y-1">
							<li>Have NEAR tokens for transaction fees</li>
							<li>Approve the migration contract</li>
							<li>Sign the migration transaction</li>
						</ul>
					</div>
				</div>
			{:else}
				<div class="bg-purple-900/20 rounded-xl p-6 text-center">
					<p class="text-lg mb-4">Connect your wallet to start the migration process</p>
					<button
						on:click={showWalletSelector}
						class="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-xl font-medium transition-colors"
					>
						Connect Wallet
					</button>
				</div>
			{/if}
		{/await}
	</div>
</main>
