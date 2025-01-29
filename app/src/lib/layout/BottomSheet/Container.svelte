<script context="module" lang="ts">
	import { derived, writable, type Writable } from 'svelte/store';

	import { browser } from '$app/environment';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type AnyComponent = any;

	const open = writable(false);
	const component = writable<{
		component: AnyComponent;
		props: Record<string, unknown>;
		options?: {
			closeOnClickOutside?: boolean;
		};
	} | null>(null);
	const size$: Writable<'m' | 'l'> = writable('m');

	export const isBottomSheetOpen$ = derived(open, (a) => a);

	export function openBottomSheet(
		newComponent: AnyComponent,
		props: Record<string, unknown> = {},
		size?: 'm' | 'l',
		options?: {
			closeOnClickOutside?: boolean;
		}
	) {
		open.set(true);
		component.set({ component: newComponent, props, options });
		size$.set(size ?? 'm');
		if (browser) {
			document.body.style.overflow = 'hidden';
		}
	}

	export function closeBottomSheet() {
		open.set(false);
		component.set(null);
		if (browser) {
			document.body.style.overflow = '';
		}
	}
</script>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	let mounted = false;

	onMount(() => {
		mounted = true;
	});

	onDestroy(() => {
		if (browser) {
			document.body.style.overflow = '';
		}
	});

	function handleClickOutside() {
		if ($component?.options?.closeOnClickOutside !== false) {
			closeBottomSheet();
		}
	}
</script>

{#if $open && mounted}
	<button
		class="fixed inset-0 bg-black/80 z-30 cursor-auto"
		on:click={handleClickOutside}
		aria-label="Close"
	/>
{/if}

{#if mounted}
	<div
		class="fixed bottom-0 left-0 right-0 w-full max-w-[min(30rem,100%)] mx-auto {$size$ === 'm'
			? 'h-[90svh]'
			: 'h-[95svh]'} z-40 transform {$open
			? 'translate-y-0 '
			: 'translate-y-full opacity-0'} transition ease-out duration-200 rounded-t-xl border-3 border-b-0 bg-zinc-900 lg:rounded-xl lg:border-3"
	>
		<div class="h-full">
			{#if $component?.options?.closeOnClickOutside !== false}
				<button
					class="absolute top-3 right-3 rounded-full flex justify-center items-center px-1 py-1 text-zinc-400 hover:text-zinc-200 transition-colors"
					aria-label="Close"
					on:click={closeBottomSheet}
				>
					<div class="block i-mdi:close size-6 ml-auto" />
				</button>
			{/if}
			{#if $component}
				<svelte:component this={$component.component} {...$component.props} />
			{/if}
		</div>
	</div>
{/if}
