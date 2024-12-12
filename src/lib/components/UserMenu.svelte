<script lang="ts">
	import { session$, logout } from '$lib/auth';

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
{/await}
