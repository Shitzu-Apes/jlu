<script lang="ts">
	import { page } from '$app/stores';
	import UserMenu from '$lib/components/UserMenu.svelte';
	import { jluBalance$ } from '$lib/near/jlu';
</script>

<header
	class="border-b border-purple-900/20 py-3 px-4 flex items-center justify-between flex-shrink-0"
>
	<div class="flex items-center gap-2 sm:gap-4">
		<h1 class="hidden sm:inline text-xl font-bold text-purple-100">Chat with Lucy J.</h1>
		<h1 class="sm:hidden inline text-xl font-bold text-purple-100">Lucy J.</h1>
		<nav class="flex items-center gap-1 sm:gap-2">
			<a
				href="/"
				class="px-3 sm:px-4 py-1.5 rounded-lg {$page.url.pathname === '/'
					? 'bg-purple-900/40 text-purple-100'
					: 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'} transition-colors text-sm"
			>
				Chat
			</a>
			<a
				href="/migrate"
				class="px-3 sm:px-4 py-1.5 rounded-lg {$page.url.pathname === '/migrate'
					? 'bg-purple-900/40 text-purple-100'
					: 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'} transition-colors text-sm"
			>
				Migrate
			</a>
		</nav>
	</div>
	<div class="flex items-center gap-2 sm:gap-4">
		{#if $jluBalance$}
			<div class="flex items-center gap-2 text-sm text-purple-200/70">
				<img src="/logo.webp" alt="JLU" class="w-5 h-5 rounded-full" />
				<span class="font-medium text-purple-100"
					>{$jluBalance$.format({
						compactDisplay: 'short',
						notation: 'compact',
						maximumFractionDigits: 2
					})}</span
				>
			</div>
		{/if}
		<UserMenu />
	</div>
</header>
