<script lang="ts">
	import XOauthButton from './XOauthButton.svelte';

	import { session$ } from '$lib/auth';

	$: isLoggedIn = $session$ != null;
</script>

<div
	class="flex flex-col border-r-4 gap-4 relative border border-white min-w-[20rem] max-w-full min-h-20rem max-w-fit p-2"
>
	<div class="flex flex-col flex-1 gap-2">Dialog</div>
	<input type="string" class="border-r-2" disabled={!isLoggedIn} />

	{#if !isLoggedIn}
		<div class="absolute top-0 left-0 w-full h-full flex items-center justify-center">
			<span>You are not logged in. In order to chat with Juicy Lucy, you need to be logged in.</span
			>

			<XOauthButton />
		</div>
	{/if}
</div>
