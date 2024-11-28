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
	class="flex items-center gap-2 px-4 py-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white rounded-lg font-medium transition-colors"
>
	<div class="i-mdi:check-decagram text-lg"></div>
	<span>Login</span>
	<div class="i-mdi:twitter text-lg"></div>
	<span class="sr-only">with X (Twitter)</span>
</button>
