<script lang="ts">
	import { onMount } from 'svelte';

	import { browser } from '$app/environment';
	import Conversation from '$lib/components/Conversation.svelte';
	import Disclaimer from '$lib/components/Disclaimer.svelte';
	import { openBottomSheet } from '$lib/layout/BottomSheet';

	onMount(() => {
		if (browser) {
			const hasAcceptedDisclaimer = localStorage.getItem('disclaimer_accepted') === 'true';
			if (!hasAcceptedDisclaimer) {
				openBottomSheet(Disclaimer, {}, 'l', { closeOnClickOutside: false });
			}
		}
	});
</script>

<main class="flex-1 flex justify-center overflow-hidden">
	<Conversation />
</main>
