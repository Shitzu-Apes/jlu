<script lang="ts">
	import type { MouseEventHandler } from 'svelte/elements';
	import { P, match } from 'ts-pattern';

	export let type: 'primary' | 'secondary' | 'custom' = 'primary';
	export let size: 's' | 'm' | 'l' = 'l';
	export let onClick: MouseEventHandler<HTMLButtonElement> | undefined = undefined;
	export let href: string | undefined = undefined;
	export let disabled: boolean | undefined = undefined;
	export let spinnerColor = 'text-white';

	let className: string = '';
	export { className as class };

	export let loading = false;

	function getBaseStyles(type: 'primary' | 'secondary' | 'custom') {
		return match(type)
			.with('primary', () => 'bg-purple-600 text-white hover:bg-purple-500')
			.with(
				'secondary',
				() => 'bg-purple-900/20 text-purple-200/70 hover:bg-purple-900/40 hover:text-purple-100'
			)
			.with('custom', () => '')
			.exhaustive();
	}

	function getLayoutStyles(type: 'primary' | 'secondary' | 'custom', size: 's' | 'm' | 'l') {
		const baseStyles =
			'font-medium flex justify-center items-center decoration-none relative disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

		const sizeStyles = match(size)
			.with('s', () => 'px-3 py-1.5 text-sm')
			.with('m', () => 'px-4 py-2 text-sm')
			.with('l', () => 'px-6 py-2.5')
			.exhaustive();

		return match(type)
			.with(P.union('primary', 'secondary'), () => `${baseStyles} ${sizeStyles}`)
			.with('custom', () => 'relative disabled:opacity-50 disabled:cursor-not-allowed')
			.exhaustive();
	}

	let element: HTMLButtonElement | HTMLAnchorElement;
</script>

{#if href != null}
	<a
		bind:this={element}
		{href}
		class:rounded-xl={!className.includes('rounded') && type !== 'custom'}
		class="{className} {getBaseStyles(type)} {getLayoutStyles(type, size)}"
		{...$$restProps}
	>
		<slot />
	</a>
{:else}
	<button
		bind:this={element}
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
		disabled={disabled || loading}
		class:rounded-xl={!className.includes('rounded') && type !== 'custom'}
		class="{className} {getBaseStyles(type)} {getLayoutStyles(type, size)}"
		{...$$restProps}
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
