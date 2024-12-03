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
	class="flex items-center gap-2 px-4 py-2 bg-black hover:bg-#222 text-white rounded-lg font-medium transition-colors"
>
	<span>Login with</span>
	<div class="i-ri:twitter-x-line text-lg"></div>
	<span class="sr-only">with X (Twitter)</span>
</button>
