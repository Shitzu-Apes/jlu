<script>
	import Conversation from '$lib/components/Conversation.svelte';
</script>

<div class="flex flex-col w-full h-screen overflow-hidden bg-zinc-950 text-white">
	<header
		class="border-b border-purple-900/20 py-3 px-4 flex items-center justify-center flex-shrink-0"
	>
		<h1 class="text-xl font-bold text-purple-100">Chat with Lucy J.</h1>
	</header>
	<main class="flex-1 flex justify-center overflow-hidden">
		<Conversation />
	</main>
</div>
