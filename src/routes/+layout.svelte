<script lang="ts">
	import { onMount } from 'svelte';

	import { pushState } from '$app/navigation';
	import type { Auth } from '$lib/auth';
	import '@unocss/reset/tailwind.css';
	import 'virtual:uno.css';
	// import "../../app.scss";

	onMount(() => {
		setTimeout(() => {
			const url = new URL(window.location.href);

			const state = url.searchParams.get('state');
			const code = url.searchParams.get('code');
			const nonce = sessionStorage.getItem('nonce');
			if (!state || !code || !nonce) return;
			if (state !== nonce) return;
			url.searchParams.delete('state');
			url.searchParams.delete('code');
			pushState(url.href, {});

			fetch(
				`${import.meta.env.VITE_API_URL}/auth/login?code=${code}&nonce=${nonce}&redirect_url=${window.location.origin}`
			)
				.then(async (res) => {
					if (!res.ok) {
						console.error('auth failed', res.status, await res.text());
					}
					return res.json<Auth>();
				})
				.then((auth) => {
					if (!auth.token || !auth.user) return;
					localStorage.setItem('auth', JSON.stringify(auth));
				});
		});
	});

	onMount(() => {
		const authString = localStorage.getItem('auth');
		if (!authString) return;
		const auth: Auth = JSON.parse(authString);

		fetch(
			`${import.meta.env.VITE_API_URL}/auth/login/refresh?refresh_token=${auth.token.refresh_token}&user_id=${auth.user.id}`
		)
			.then(async (res) => {
				if (!res.ok) {
					console.error('auth failed', res.status, await res.text());
				}
				return res.json<Auth>();
			})
			.then((auth) => {
				if (!auth.token || !auth.user) return;
				localStorage.setItem('auth', JSON.stringify(auth));
			});
	});
</script>

<slot />
