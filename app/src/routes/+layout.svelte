<script lang="ts">
	import dayjs from 'dayjs';
	import duration from 'dayjs/plugin/duration';
	import relativeTime from 'dayjs/plugin/relativeTime';
	import { setNetwork } from 'omni-bridge-sdk';
	import { onMount } from 'svelte';

	import { goto } from '$app/navigation';
	import { fetchApi } from '$lib/api';
	import { session$, type Auth } from '$lib/auth';
	import Toast, { showToast } from '$lib/components/Toast.svelte';
	import { BottomSheet } from '$lib/layout/BottomSheet';
	import Header from '$lib/layout/Header.svelte';

	// eslint-disable-next-line import/no-named-as-default-member
	dayjs.extend(relativeTime);
	// eslint-disable-next-line import/no-named-as-default-member
	dayjs.extend(duration);

	setNetwork(import.meta.env.VITE_NETWORK_ID);

	import '@unocss/reset/tailwind.css';
	import 'virtual:uno.css';
	import '../app.css';

	onMount(() => {
		setTimeout(() => {
			const url = new URL(window.location.href);

			const error = url.searchParams.get('error');
			if (error) {
				showToast({
					data: {
						type: 'simple',
						data: {
							title: 'Login failed',
							description: error,
							type: 'error'
						}
					}
				});
				url.searchParams.delete('error');
				url.searchParams.delete('state');
				goto(url.href, { replaceState: true, noScroll: true });
				$session$ = Promise.resolve(undefined);
				return;
			}

			const state = url.searchParams.get('state');
			const code = url.searchParams.get('code');
			if (!state || !code) return;

			// Clean up URL params
			url.searchParams.delete('state');
			url.searchParams.delete('code');
			goto(url.href, { replaceState: true, noScroll: true });

			fetch(
				`${import.meta.env.VITE_API_URL}/auth/login?code=${code}&nonce=${state}&redirect_url=${window.location.origin}`
			)
				.then(async (res) => {
					if (!res.ok) {
						const error = await res.text();
						console.error('auth failed', res.status, error);
						showToast({
							data: {
								type: 'simple',
								data: {
									title: 'Login failed',
									description: 'Please try again later.',
									type: 'error'
								}
							}
						});
						return;
					}
					return res.json<Auth>();
				})
				.then((auth) => {
					if (!auth) return;
					if (!auth.token || !auth.user) {
						showToast({
							data: {
								type: 'simple',
								data: {
									title: 'Login failed',
									description: 'Please try again later.',
									type: 'error'
								}
							}
						});
						return;
					}
					localStorage.setItem('auth', JSON.stringify(auth));
					$session$ = Promise.resolve(auth);
				})
				.catch((err) => {
					console.error('Login error:', err);
				});
		});
	});

	onMount(() => {
		const authString = localStorage.getItem('auth');
		if (!authString) {
			const url = new URL(window.location.href);
			const state = url.searchParams.get('state');
			const code = url.searchParams.get('code');
			if (!state && !code) {
				$session$ = Promise.resolve(undefined);
			}
			return;
		}

		try {
			const auth: Auth = JSON.parse(authString);
			console.log('[auth] Loaded session:', auth);
			$session$ = Promise.resolve(auth);

			// Check if token has expired
			const now = Date.now();
			if (
				!auth?.token?.access_token ||
				!auth?.user?.id ||
				!auth.expires_at ||
				auth.expires_at < now
			) {
				console.log('[auth] Invalid or expired session, clearing');
				localStorage.removeItem('auth');
				$session$ = Promise.resolve(undefined);
				return;
			}

			// Validate session with backend
			fetchApi('/chat')
				.then((res) => {
					if (!res.ok) {
						console.log('[auth] Backend validation failed, clearing session');
						localStorage.removeItem('auth');
						$session$ = Promise.resolve(undefined);
						return;
					}
					$session$ = Promise.resolve(auth);
				})
				.catch(() => {
					// Network error, but don't clear session yet
					$session$ = Promise.resolve(auth);
				});
		} catch (err) {
			console.error('[auth] Failed to parse session:', err);
			localStorage.removeItem('auth');
			$session$ = Promise.resolve(undefined);
		}
	});
</script>

<div class="flex flex-col w-full h-screen overflow-hidden bg-zinc-950 text-white">
	<Header />
	<div class="flex flex-1 overflow-y-auto">
		<slot />
	</div>
</div>

<Toast />

<BottomSheet />
