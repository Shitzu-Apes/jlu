<script lang="ts">
	import { page } from '$app/stores';
	import HowItWorks from '$lib/components/HowItWorks.svelte';
	import UserMenu from '$lib/components/UserMenu.svelte';
	import { openBottomSheet } from '$lib/layout/BottomSheet';

	function handleOpenHowItWorks() {
		openBottomSheet(HowItWorks);
	}
</script>

<header
	class="border-b border-purple-900/20 py-3 px-4 flex items-center justify-between flex-shrink-0"
>
	<div class="flex items-center gap-4">
		<h1 class="hidden sm:inline text-xl font-bold text-purple-100">Chat with Lucy J.</h1>
		<h1 class="sm:hidden inline text-xl font-bold text-purple-100">Lucy J.</h1>
		<nav class="flex items-center gap-2">
			<a
				href="/"
				class="px-4 py-1.5 rounded-lg {$page.url.pathname === '/'
					? 'bg-purple-900/40 text-purple-100'
					: 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'} transition-colors text-sm"
			>
				Chat
			</a>
			<a
				href="/migrate"
				class="px-4 py-1.5 rounded-lg {$page.url.pathname === '/migrate'
					? 'bg-purple-900/40 text-purple-100'
					: 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'} transition-colors text-sm"
			>
				Migrate
			</a>
		</nav>
	</div>
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
