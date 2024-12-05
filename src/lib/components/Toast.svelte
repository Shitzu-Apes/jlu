<script context="module" lang="ts">
	import { createToaster } from '@melt-ui/svelte';

	type ToastData = {
		title: string;
		description: string;
		type: 'error' | 'success';
	};

	const {
		elements: { content, title, description, close },
		states: { toasts },
		helpers: { addToast }
	} = createToaster<ToastData>();

	export function showToast(message: string, type: 'error' | 'success' = 'error') {
		addToast({
			data: {
				title: type === 'error' ? 'Error' : 'Success',
				description: message,
				type
			}
		});
	}
</script>

<script lang="ts">
	import { melt } from '@melt-ui/svelte';
	import { slide } from 'svelte/transition';
</script>

<div
	use:melt={$content}
	class="fixed top-4 right-4 flex flex-col gap-4 w-[400px] max-w-[100vw-2rem] z-[100]"
>
	{#each $toasts as { id, data } (id)}
		<div
			transition:slide={{ duration: 150 }}
			class="bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700"
		>
			<div class="flex items-start gap-4">
				<div class="flex-1">
					<div
						use:melt={$title(id)}
						class:text-red-500={data.type === 'error'}
						class:text-green-500={data.type === 'success'}
						class="font-semibold"
					>
						{data.title}
					</div>
					<div use:melt={$description(id)} class="text-zinc-600 dark:text-zinc-300 text-sm mt-1">
						{data.description}
					</div>
				</div>
				<button
					use:melt={$close(id)}
					type="button"
					aria-label="Close notification"
					class="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg
					>
				</button>
			</div>
		</div>
	{/each}
</div>
