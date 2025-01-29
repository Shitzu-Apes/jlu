<script context="module" lang="ts">
	export type LucyMood =
		| 'angry'
		| 'annoyed'
		| 'confident'
		| 'confused'
		| 'curious'
		| 'dreamy'
		| 'embarrassed'
		| 'excited'
		| 'flirty'
		| 'happy'
		| 'playful'
		| 'pouty'
		| 'sad'
		| 'sassy'
		| 'shy'
		| 'surprised';
</script>

<script lang="ts">
	import { fade } from 'svelte/transition';
	import { match } from 'ts-pattern';

	import { browser } from '$app/environment';
	import Angry from '$lib/assets/angry.webp';
	import AngrySquare from '$lib/assets/angry_square.webp';
	import Annoyed from '$lib/assets/annoyed.webp';
	import AnnoyedSquare from '$lib/assets/annoyed_square.webp';
	import Confident from '$lib/assets/confident.webp';
	import ConfidentSquare from '$lib/assets/confident_square.webp';
	import Confused from '$lib/assets/confused.webp';
	import ConfusedSquare from '$lib/assets/confused_square.webp';
	import Curious from '$lib/assets/curious.webp';
	import CuriousSquare from '$lib/assets/curious_square.webp';
	import Dreamy from '$lib/assets/dreamy.webp';
	import DreamySquare from '$lib/assets/dreamy_square.webp';
	import Embarrassed from '$lib/assets/embarrassed.webp';
	import EmbarrassedSquare from '$lib/assets/embarrassed_square.webp';
	import Excited from '$lib/assets/excited.webp';
	import ExcitedSquare from '$lib/assets/excited_square.webp';
	import Flirty from '$lib/assets/flirty.webp';
	import FlirtySquare from '$lib/assets/flirty_square.webp';
	import Happy from '$lib/assets/happy.webp';
	import HappySquare from '$lib/assets/happy_square.webp';
	import Playful from '$lib/assets/playful.webp';
	import PlayfulSquare from '$lib/assets/playful_square.webp';
	import Pouty from '$lib/assets/pouty.webp';
	import PoutySquare from '$lib/assets/pouty_square.webp';
	import Sad from '$lib/assets/sad.webp';
	import SadSquare from '$lib/assets/sad_square.webp';
	import Sassy from '$lib/assets/sassy.webp';
	import SassySquare from '$lib/assets/sassy_square.webp';
	import Shy from '$lib/assets/shy.webp';
	import ShySquare from '$lib/assets/shy_square.webp';
	import Surprised from '$lib/assets/surprised.webp';
	import SurprisedSquare from '$lib/assets/surprised_square.webp';

	export let mood: LucyMood;
	export let size: 'sm' | 'md' = 'md';
	export let className: string;

	let moodImage: string = '';
	let isLoading = true;

	function loadImage(src: string): Promise<string> {
		if (!browser) {
			return Promise.resolve(src);
		}
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => resolve(src);
			img.src = src;
		});
	}

	$: if (mood || size) {
		isLoading = true;
		moodImage = '';
		const newImage = match([mood, size])
			.with(['angry', 'sm'], () => AngrySquare)
			.with(['angry', 'md'], () => Angry)
			.with(['annoyed', 'sm'], () => AnnoyedSquare)
			.with(['annoyed', 'md'], () => Annoyed)
			.with(['confident', 'sm'], () => ConfidentSquare)
			.with(['confident', 'md'], () => Confident)
			.with(['confused', 'sm'], () => ConfusedSquare)
			.with(['confused', 'md'], () => Confused)
			.with(['curious', 'sm'], () => CuriousSquare)
			.with(['curious', 'md'], () => Curious)
			.with(['dreamy', 'sm'], () => DreamySquare)
			.with(['dreamy', 'md'], () => Dreamy)
			.with(['embarrassed', 'sm'], () => EmbarrassedSquare)
			.with(['embarrassed', 'md'], () => Embarrassed)
			.with(['excited', 'sm'], () => ExcitedSquare)
			.with(['excited', 'md'], () => Excited)
			.with(['flirty', 'sm'], () => FlirtySquare)
			.with(['flirty', 'md'], () => Flirty)
			.with(['happy', 'sm'], () => HappySquare)
			.with(['happy', 'md'], () => Happy)
			.with(['playful', 'sm'], () => PlayfulSquare)
			.with(['playful', 'md'], () => Playful)
			.with(['pouty', 'sm'], () => PoutySquare)
			.with(['pouty', 'md'], () => Pouty)
			.with(['sad', 'sm'], () => SadSquare)
			.with(['sad', 'md'], () => Sad)
			.with(['sassy', 'sm'], () => SassySquare)
			.with(['sassy', 'md'], () => Sassy)
			.with(['shy', 'sm'], () => ShySquare)
			.with(['shy', 'md'], () => Shy)
			.with(['surprised', 'sm'], () => SurprisedSquare)
			.with(['surprised', 'md'], () => Surprised)
			.exhaustive();

		loadImage(newImage).then((loadedImage) => {
			setTimeout(() => {
				moodImage = loadedImage;
				isLoading = false;
			}, 150);
		});
	}
</script>

<div class="relative {className} group">
	{#if isLoading}
		<div
			class="absolute inset-0 bg-purple-800/30 animate-pulse rounded-full"
			transition:fade={{ duration: 200 }}
		/>
	{/if}
	{#if moodImage}
		<div
			class="absolute inset-0 rounded-full ring-2 ring-purple-500/0 group-hover:ring-purple-500/50 transition-all duration-200 group-hover:ring-offset-2 ring-offset-purple-950 group-hover:scale-105"
		/>
		<img
			transition:fade={{ duration: 200 }}
			src={moodImage}
			alt="Lucy"
			class="rounded-full w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
		/>
	{/if}
</div>
