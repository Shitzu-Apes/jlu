<script lang="ts">
	import Conversation from '$lib/components/Conversation.svelte';
	import HowItWorks from '$lib/components/HowItWorks.svelte';
	import { openBottomSheet } from '$lib/layout/BottomSheet';

	function handleOpenHowItWorks() {
		openBottomSheet(HowItWorks);
	}
</script>

<div class="flex flex-col w-full h-screen overflow-hidden bg-zinc-950 text-white">
	<header
		class="border-b border-purple-900/20 py-3 px-4 flex items-center justify-between flex-shrink-0"
	>
		<div class="w-10" />
		<h1 class="text-xl font-bold text-purple-100">Chat with Lucy J.</h1>
		<button
			class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-purple-900/20 transition-colors"
			on:click={handleOpenHowItWorks}
			aria-label="How it works"
		>
			<div class="i-mdi:help text-2xl text-purple-200/70" />
		</button>
	</header>
	<main class="flex-1 flex justify-center overflow-hidden">
		<Conversation />
	</main>
</div>
