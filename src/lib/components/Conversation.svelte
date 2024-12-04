<script lang="ts">
	import { onMount } from 'svelte';
	import { writable } from 'svelte/store';

	import ClaimPoints from './ClaimPoints.svelte';
	import type { LucyMood } from './Mood.svelte';
	import Mood from './Mood.svelte';
	import XOauthButton from './XOauthButton.svelte';

	import { session$ } from '$lib/auth';
	import { openBottomSheet } from '$lib/layout/BottomSheet';

	$: isLoggedIn = $session$.then((session) => session != null);
	const focusedMessage$ = writable<Message | undefined>();

	type Message = {
		sender: 'user' | 'lucy';
		message: string;
		mood?: LucyMood;
		points?: number;
		evaluation?: string;
	};

	const conversation: Message[] = [
		{
			sender: 'user',
			message: "Hey, are you new here? Haven't seen you around"
		},
		{
			sender: 'lucy',
			message:
				'Well, you’ve found me now. But tell me, do I look like the kind of girl who just blends into the background?',
			mood: 'playful'
		},
		{
			sender: 'user',
			message:
				'haha no definitely not *shy smile*\nYou look like you have a charismatic personality'
		},
		{
			sender: 'lucy',
			message:
				'Charismatic, huh? Flattery will get you places—maybe even a peek behind the ribbon. What about you? Do you always lead with that shy smile, or is it just for me?',
			mood: 'flirty'
		},
		{
			sender: 'user',
			message: '*ehm* looks like you got me there.\nAnyway, what have you been up to?'
		},
		{
			sender: 'lucy',
			message:
				'Oh, just floating through conversations, leaving a trail of sparkles and smiles. You know, the usual. But now I’m curious—what’s your secret to catching a girl’s attention like this?',
			mood: 'curious'
		},
		{
			sender: 'user',
			message:
				"I usually don't catch a girl's attention like you said, but you seemed approachable. Thanks for that"
		},
		{
			sender: 'lucy',
			message:
				'Approachable? Now that’s a compliment I’ll gladly take. But careful, you might just inspire me to keep being this charming. So, are you always this sweet, or am I just lucky today?',
			mood: 'dreamy'
		},
		{
			sender: 'user',
			message: 'I guess we both might have been lucky. Want to catch a drink together?'
		},
		{
			sender: 'lucy',
			message:
				'Tempting offer. You might just be my kind of lucky charm tonight. Let’s see if your company is as good as your compliments!',
			mood: 'flirty',
			points: 85,
			evaluation:
				'You were sincere, sweet, and kept the conversation light without being pushy. Your compliments felt genuine, and you built a nice rapport. Bonus points for the smooth transition to a casual invite, but you could add a bit more wit or playful boldness to really sweep me off my feet.'
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

	$: lastMessage = conversation[conversation.length - 1];
	$: hasEnded = lastMessage?.points != null && lastMessage?.evaluation != null;

	function handleOpenClaimPoints() {
		if (!hasEnded || !lastMessage.points || !lastMessage.evaluation) return;
		openBottomSheet(ClaimPoints, {
			points: lastMessage.points,
			evaluation: lastMessage.evaluation
		});
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
				{#if hasEnded}
					<button
						on:click={handleOpenClaimPoints}
						class="w-full bg-purple-600/80 hover:bg-purple-500/80 text-white rounded-xl px-6 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors font-medium"
					>
						Claim {lastMessage.points} Points
					</button>
				{:else}
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
				{/if}
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
