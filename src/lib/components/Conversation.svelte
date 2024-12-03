<script lang="ts">
	import { writable } from 'svelte/store';

	import Mood, { type LucyMood } from './Mood.svelte';
	import XOauthButton from './XOauthButton.svelte';

	import { session$ } from '$lib/auth';

	$: isLoggedIn = $session$ != null;
	console.log('[isLoggedIn]', isLoggedIn);

	let focusedMessage$ = writable<Message | undefined>(undefined);

	type Message = {
		sender: 'user' | 'lucy';
		message: string;
		mood?: LucyMood;
		points?: number;
	};

	const conversation: Message[] = [
		{
			sender: 'user',
			message: 'Hey babe, got some of them juice for me?'
		},
		{
			sender: 'lucy',
			message:
				'Well, aren’t you bold? I might have some juice, but only for those who earn it. What makes you think you’re worthy of a taste?',
			mood: 'flirty'
		},
		{
			sender: 'user',
			message: 'idk, want to watch a movie together at my home?'
		},
		{
			sender: 'lucy',
			message:
				'Hmm, inviting me to your place already? That’s quite the shortcut. What kind of movie are we talking about, Mr. Smooth-Talker? Better not be something boring.',
			mood: 'playful'
		},
		{
			sender: 'user',
			message: "idk, let's see when we are there"
		},
		{
			sender: 'lucy',
			message:
				'Oh, so you’re a ‘go with the flow’ type? Tempting... but I hope your flow’s not all talk and no charm.',
			mood: 'sassy'
		}
	];
</script>

<div
	class="flex md:flex-row flex-col flex-1 h-0 gap-4 p-2 w-full sm:max-w-md md:max-w-2xl lg:max-w-3xl xl:max-w-4xl rounded-md"
>
	<div class="flex justify-center flex-col items-center mb-4">
		<Mood
			mood={$focusedMessage$?.mood ?? conversation[conversation.length - 1]?.mood ?? 'happy'}
			size="md"
			className="md:w-48 md:h-80 w-24 h-40"
		/>
		<h1 class="font-bold text-l">Lucy J.</h1>
	</div>

	<div class="flex flex-col flex-1 h-0 md:h-full content relative">
		<div class="flex flex-col flex-1 gap-6 overflow-y-auto pb-4">
			{#each conversation as message}
				<div
					class="flex flex-col gap-2 px-2 {message.sender === 'user'
						? 'items-end'
						: 'items-start'} {$focusedMessage$ === message ? 'bg-purple-900/40' : ''}"
					role="listitem"
					on:mouseenter={() => {
						if (message.sender === 'lucy') {
							$focusedMessage$ = message;
						}
					}}
					on:mouseleave={() => {
						if (message.sender === 'lucy') {
							$focusedMessage$ = undefined;
						}
					}}
				>
					<span class="text-sm text-gray-200 flex items-center gap-2">
						{#if message.sender === 'lucy'}
							<Mood mood={message.mood ?? 'happy'} size="sm" className="size-12" />
							Lucy J.
						{:else}
							You
						{/if}
					</span>
					<span
						class="text-base bg-gray-500/20 rounded-md p-2 {message.sender === 'user'
							? 'ml-4'
							: 'mr-4'}">{message.message}</span
					>
				</div>
			{/each}
		</div>
		<div class="flex items-center gap-2">
			<input
				type="text"
				class="flex-1 text-black border border-gray-300 rounded-full px-4 py-2 min-w-0 focus:outline-none focus:ring-2 focus:ring-purple-500"
				placeholder="Chat with Lucy..."
				disabled={!isLoggedIn}
			/>
			<button
				class="bg-purple-500 text-white rounded-full px-4 py-2 focus:outline-none hover:bg-purple-600"
				disabled={!isLoggedIn}
				aria-label="Send"
				><div class="i-mdi:send size-6"></div>
			</button>
		</div>

		{#if !isLoggedIn}
			<div
				class="absolute inset-0 flex items-center justify-center bg-purple-900/30 backdrop-blur-sm flex flex-col gap-4"
			>
				<span class="text-purple-100 font-bold text-center p-4 rounded bg-purple-900/90 mx-4">
					You are not logged in. In order to chat with Juicy Lucy, you need to be logged in.
				</span>
				<XOauthButton />
			</div>
		{/if}
	</div>
</div>
