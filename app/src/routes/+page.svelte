<script lang="ts">
	import { onMount } from 'svelte';

	import { browser } from '$app/environment';
	import Conversation from '$lib/components/Conversation.svelte';
	import Disclaimer from '$lib/components/Disclaimer.svelte';
	import HowItWorks from '$lib/components/HowItWorks.svelte';
	import UserMenu from '$lib/components/UserMenu.svelte';
	import { openBottomSheet } from '$lib/layout/BottomSheet';

	function handleOpenHowItWorks() {
		openBottomSheet(HowItWorks);
	}

	onMount(() => {
		if (browser) {
			const hasAcceptedDisclaimer = localStorage.getItem('disclaimer_accepted') === 'true';
			if (!hasAcceptedDisclaimer) {
				openBottomSheet(Disclaimer, {}, 'l', { closeOnClickOutside: false });
			}
		}
	});
</script>

<div class="flex flex-col w-full h-screen overflow-hidden bg-zinc-950 text-white">
	<header
		class="border-b border-purple-900/20 py-3 px-4 flex items-center justify-between flex-shrink-0"
	>
		<div class="w-0" />
		<h1 class="hidden sm:inline text-xl font-bold text-purple-100">Chat with Lucy J.</h1>
		<h1 class="sm:hidden inline text-xl font-bold text-purple-100">Lucy J.</h1>
		<div class="flex items-center gap-2">
			<button
				class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-purple-900/20 transition-colors"
				on:click={handleOpenHowItWorks}
				aria-label="How it works"
			>
				<div class="i-mdi:help text-2xl text-purple-200/70" />
			</button>
			<UserMenu />
		</div>
	</header>
	<main class="flex-1 flex justify-center overflow-hidden">
		<Conversation />
	</main>
</div>
