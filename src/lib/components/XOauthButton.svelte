<script lang="ts">
	async function handleSignIn() {
		const nonce = await fetch(`${import.meta.env.VITE_API_URL}/auth/nonce`).then((res) =>
			res.text()
		);
		sessionStorage.setItem('nonce', nonce);

		window.location.href = `${import.meta.env.VITE_API_URL}/auth/authorize?nonce=${nonce}&redirect_url=${window.location.origin}`;
	}
</script>

<button
	on:click={handleSignIn}
	class="flex items-center gap-2 px-6 py-2.5 bg-zinc-800/50 hover:bg-purple-900/20 text-white rounded-xl font-medium transition-colors border border-purple-900/20"
>
	<span
		>Login with <div class="i-ri:twitter-x-line inline-block translate-y-[0.1em]" /></span
	>
</button>
