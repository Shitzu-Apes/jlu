<script lang="ts">
	import User from './User.svelte';

	import { session$, logout, showWalletSelector } from '$lib/auth';
	import { wallet } from '$lib/near';

	const { accountId$, iconUrl$, walletName$ } = wallet;

	function handleLogout() {
		logout();
	}

	let profileImageUrl = '';

	// Update profile image URL whenever session changes
	$: {
		$session$.then((session) => {
			profileImageUrl = session ? `https://unavatar.io/twitter/${session.user.username}` : '';
		});
	}
</script>

{#await $session$ then session}
	{#if session}
		<button
			class="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-purple-900/20 transition-colors"
			on:click={handleLogout}
		>
			<img src={profileImageUrl} alt="Profile" class="w-8 h-8 rounded-full" />
			<span class="text-sm text-purple-200/70">Logout</span>
		</button>
	{/if}

	<!-- Account Section -->
	<div class="flex-shrink-1">
		{#if $accountId$}
			<div class="flex items-center gap-2">
				{#await Promise.all([$iconUrl$, $walletName$]) then [iconUrl, walletName]}
					<div class="flex items-center gap-2 px-3 py-2 rounded-full bg-gray-800">
						<User account={$accountId$} class="text-sm">
							<img
								src={iconUrl}
								alt={walletName}
								class={`w-5 max-h-5 rounded-full ${(walletName ?? '').replaceAll(' ', '-').toLowerCase()}`}
							/>
						</User>
						<button
							class="text-gray-300 hover:text-white text-sm"
							on:click={wallet.signOut}
							aria-label="Logout"
						>
							<div class="i-mdi:logout text-xl" />
						</button>
					</div>
				{/await}
			</div>
		{:else}
			<button
				class="px-4 py-2 rounded-xl bg-purple-600/80 hover:bg-purple-500/80 text-white font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
				on:click={showWalletSelector}
			>
				<span class="block md:hidden">Connect</span>
				<span class="hidden md:block">Connect Wallet</span>
			</button>
		{/if}
	</div>
{/await}
