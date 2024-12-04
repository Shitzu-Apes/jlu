<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';

	import type { LucyMood } from './Mood.svelte';
	import Mood from './Mood.svelte';
	import XOauthButton from './XOauthButton.svelte';

	import { session$ } from '$lib/auth';

	$: isLoggedIn = $session$.then((session) => session != null);
	const focusedMessage$ = writable<Message | undefined>();

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
				"Well, aren't you bold? I might have some juice, but only for those who earn it. What makes you think you're worthy of a taste?",
			mood: 'flirty'
		},
		{
			sender: 'user',
			message: 'idk, want to watch a movie together at my home?'
		},
		{
			sender: 'lucy',
			message:
				"Hmm, inviting me to your place already? That's quite the shortcut. What kind of movie are we talking about, Mr. Smooth-Talker? Better not be something boring.",
			mood: 'playful'
		},
		{
			sender: 'user',
			message: "idk, let's see when we are there"
		},
		{
			sender: 'lucy',
			message:
				"Oh, so you're a 'go with the flow' type? Tempting... but I hope your flow's not all talk and no charm.",
			mood: 'sassy'
		}
	];

	let conversationContainer: HTMLDivElement;

	function scrollToBottom() {
		if (conversationContainer) {
			conversationContainer.scrollTo({
				top: conversationContainer.scrollHeight,
				behavior: 'smooth'
			});
		}
	}

	onMount(() => {
		scrollToBottom();
	});

	$: if (conversation) {
		// Use setTimeout to ensure the DOM has updated
		setTimeout(scrollToBottom, 0);
	}
</script>

<div class="flex md:flex-row flex-col h-full w-full max-w-5xl">
	<div class="md:flex hidden flex-col items-center md:w-64 py-4 px-2 flex-shrink-0">
		<Mood
			mood={$focusedMessage$?.mood ?? conversation[conversation.length - 1]?.mood ?? 'happy'}
			size="md"
			className="md:w-48 md:h-80 w-32 h-52"
		/>
	</div>

	<div class="flex flex-col flex-1 min-h-0 relative">
		<!-- Mobile mood display -->
		<div class="md:hidden flex flex-col items-center py-4 flex-shrink-0">
			<Mood
				mood={$focusedMessage$?.mood ?? conversation[conversation.length - 1]?.mood ?? 'happy'}
				size="md"
				className="w-32 h-52"
			/>
		</div>

		<!-- Scrollable conversation area -->
		<div bind:this={conversationContainer} class="flex-1 overflow-y-auto min-h-0">
			<div class="max-w-3xl mx-auto py-4 px-4 flex flex-col gap-6">
				{#each conversation as message}
					<div
						class="flex gap-4 {message.sender === 'user' ? 'flex-row-reverse' : ''} group/message"
						role="listitem"
						on:mouseenter={() => {
							if (message.sender === 'lucy') {
								focusedMessage$.set(message);
							}
						}}
						on:mouseleave={() => {
							if (message.sender === 'lucy') {
								focusedMessage$.set(undefined);
							}
						}}
					>
						<div class="flex-shrink-0">
							{#if message.sender === 'lucy'}
								<div class="group-hover/message:scale-105 transition-transform duration-200">
									<Mood
										mood={message.mood ?? 'happy'}
										size="sm"
										className="size-10 rounded-full bg-purple-900/50"
									/>
								</div>
							{:else}
								<div class="group-hover/message:scale-105 transition-transform duration-200">
									<div
										class="size-10 rounded-full bg-purple-800/30 flex items-center justify-center"
									>
										<div class="i-mdi:account text-2xl" />
									</div>
								</div>
							{/if}
						</div>
						<div
							class="flex flex-col gap-1 max-w-[80%] {message.sender === 'user' ? 'items-end' : ''}"
						>
							<span class="text-sm text-purple-200">
								{message.sender === 'lucy' ? 'Lucy J.' : 'You'}
							</span>
							<div
								class="rounded-2xl px-4 py-2 {message.sender === 'user'
									? 'bg-purple-800/30 text-white'
									: 'bg-purple-900/30 text-white'} transition-colors duration-200 group-hover/message:bg-purple-800/50"
							>
								{message.message}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Fixed input area -->
		<div class="border-t border-purple-800/50 p-4 flex-shrink-0">
			<div class="max-w-3xl mx-auto">
				<div class="flex gap-2">
					<input
						type="text"
						class="flex-1 bg-zinc-900/50 text-white border border-purple-900/20 rounded-xl px-4 py-3 min-w-0 focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder:text-zinc-400"
						placeholder="Send a message..."
					/>
					<button
						class="bg-purple-600/80 hover:bg-purple-500/80 text-white rounded-xl px-6 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors"
						aria-label="Send"
					>
						<div class="i-mdi:send text-2xl" />
					</button>
				</div>
			</div>
		</div>

		{#if !isLoggedIn}
			<div
				class="absolute inset-0 flex items-center justify-center bg-purple-950/30 backdrop-blur-sm"
			>
				<div class="bg-purple-900/90 p-6 rounded-xl text-center max-w-md mx-4">
					<p class="text-purple-100 font-bold mb-4">You need to be logged in to chat with Lucy</p>
					<XOauthButton />
				</div>
			</div>
		{/if}
	</div>
</div>
