<script lang="ts">
	import type { MouseEventHandler } from 'svelte/elements';
	import { P, match } from 'ts-pattern';

	export let type: 'primary' | 'secondary' | 'custom' = 'primary';
	export let onClick: MouseEventHandler<HTMLButtonElement> | undefined = undefined;
	export let href: string | undefined = undefined;
	export let disabled: boolean | undefined = undefined;
	export let spinnerColor = 'text-white';

	let className: string = '';
	export { className as class };

	export let loading = false;
</script>

{#if href != null}
	<a
		{href}
		class:rounded-xl={!className.includes('rounded') && type !== 'custom'}
		class="{className} {match(type)
			.with('primary', () => 'bg-purple-600 text-white hover:bg-purple-500')
			.with(
				'secondary',
				() => 'bg-purple-900/20 text-purple-200/70 hover:bg-purple-900/40 hover:text-purple-100'
			)
			.with('custom', () => '')
			.exhaustive()} {match(type)
			.with(
				P.union('primary', 'secondary'),
				() =>
					'font-medium flex justify-center items-center decoration-none px-6 py-3 relative disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
			)
			.with('custom', () => 'relative disabled:opacity-50 disabled:cursor-not-allowed')
			.exhaustive()}"
	>
		<slot />
	</a>
{:else}
	<button
		on:click={async (event) => {
			if (!onClick) return;
			loading = true;
			try {
				await onClick(event);
			} catch (err) {
				console.error(err);
			} finally {
				loading = false;
			}
		}}
		{disabled}
		class:rounded-xl={!className.includes('rounded') && type !== 'custom'}
		class="{className} {match(type)
			.with('primary', () => 'bg-purple-600 text-white hover:bg-purple-500')
			.with(
				'secondary',
				() => 'bg-purple-900/20 text-purple-200/70 hover:bg-purple-900/40 hover:text-purple-100'
			)
			.with('custom', () => '')
			.exhaustive()} {match(type)
			.with(
				P.union('primary', 'secondary'),
				() =>
					'font-medium flex justify-center items-center decoration-none px-6 py-3 relative disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
			)
			.with('custom', () => 'relative disabled:opacity-50 disabled:cursor-not-allowed')
			.exhaustive()}"
	>
		<div class="invisible flex items-center justify-center">
			<slot />
		</div>
		<div
			class="flex items-center justify-center absolute w-full h-full top-0 left-0 bg-inherit rounded-xl"
		>
			{#if loading}
				<div class="i-svg-spinners:6-dots-rotate text-size-6 {spinnerColor}" />
			{:else}
				<slot />
			{/if}
		</div>
	</button>
{/if}
