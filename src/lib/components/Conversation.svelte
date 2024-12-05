<script lang="ts">
	import dayjs from 'dayjs';
	import { onDestroy } from 'svelte';
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

	type ConversationResponse = {
		messages: Message[];
		cooldownEnds: number | null;
		canSendMessage: boolean;
		error?: string;
	};

	let conversation: Message[] = [];
	let cooldownEnds: number | null = null;
	let canSendMessage = true;
	let isLoading = false;
	let newMessage = '';

	let cooldownInterval: ReturnType<typeof setInterval> | null = null;
	let now = Date.now();

	function updateCooldownText() {
		now = Date.now();
		if (!cooldownEnds || now >= cooldownEnds) {
			cooldownText = '';
			if (cooldownInterval) {
				clearInterval(cooldownInterval);
				cooldownInterval = null;
				canSendMessage = true;
			}
			return;
		}

		const diff = cooldownEnds - now;
		const dur = dayjs.duration(diff);

		if (dur.asHours() >= 24) {
			cooldownText = `${Math.floor(dur.asDays())} days ${dur.hours()} hours`;
		} else if (dur.asMinutes() >= 60) {
			cooldownText = `${dur.hours()} hours ${dur.minutes()} minutes`;
		} else {
			cooldownText = `${dur.minutes()} minutes ${dur.seconds()} seconds`;
		}
	}

	$: if (cooldownEnds && now < cooldownEnds) {
		canSendMessage = false;
		if (!cooldownInterval) {
			cooldownInterval = setInterval(updateCooldownText, 1000);
			updateCooldownText();
		}
	}

	$: showCooldown = cooldownEnds != null && now < cooldownEnds;

	onDestroy(() => {
		if (cooldownInterval) {
			clearInterval(cooldownInterval);
		}
	});

	async function loadConversation() {
		const session = await $session$;
		if (!session) {
			console.log('[conversation] No session, skipping load');
			return;
		}

		console.log('[conversation] Loading conversation...');
		try {
			const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
				headers: {
					Authorization: `Bearer ${session.token.access_token}`,
					'X-User-Id': session.user.id
				}
			});

			if (!response.ok) {
				const error = await response.text();
				console.error('[conversation] Failed to load:', response.status, error);
				return;
			}

			const data: ConversationResponse = await response.json();
			console.log('[conversation] Loaded successfully:', data);
			conversation = data.messages;
			cooldownEnds = data.cooldownEnds;
			canSendMessage = data.canSendMessage;
		} catch (err) {
			console.error('[conversation] Error loading conversation:', err);
		}
	}

	// Load conversation whenever session changes and is not null
	$: $session$.then((session) => {
		if (session) {
			console.log('[conversation] Session changed, loading conversation');
			loadConversation();
		}
	});

	async function sendMessage() {
		if (!newMessage.trim() || isLoading) return;

		const session = await $session$;
		if (!session) return;

		const userMessageText = newMessage.trim();
		newMessage = '';
		isLoading = true;

		// Add user message immediately
		conversation = [
			...conversation,
			{
				sender: 'user',
				message: userMessageText
			}
		];

		const response = await fetch(`${import.meta.env.VITE_API_URL}/chat`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${session.token.access_token}`,
				'X-User-Id': session.user.id,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ message: userMessageText })
		});

		if (!response.ok) {
			console.error('Failed to send message:', await response.text());
			isLoading = false;
			return;
		}

		const data: ConversationResponse = await response.json();
		conversation = data.messages;
		cooldownEnds = data.cooldownEnds;
		canSendMessage = data.canSendMessage;
		isLoading = false;
	}

	let conversationContainer: HTMLDivElement;

	function scrollToBottom() {
		if (conversationContainer) {
			conversationContainer.scrollTo({
				top: conversationContainer.scrollHeight,
				behavior: 'smooth'
			});
		}
	}

	$: if (conversation) {
		// Use setTimeout to ensure the DOM has updated
		setTimeout(scrollToBottom, 0);
	}

	$: lastMessage = conversation[conversation.length - 1];
	$: hasEnded = lastMessage?.points != null && lastMessage?.evaluation != null;

	$: cooldownText = cooldownEnds ? dayjs(cooldownEnds).fromNow(true) : '';

	function handleOpenClaimPoints() {
		if (!hasEnded || !lastMessage.points || !lastMessage.evaluation) return;
		openBottomSheet(ClaimPoints, {
			points: lastMessage.points,
			evaluation: lastMessage.evaluation
		});
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
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
		<div class="flex flex-col w-full h-full overflow-hidden">
			{#await isLoggedIn}
				<div class="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
					<div class="flex flex-col items-center gap-4">
						<XOauthButton />
						<p class="text-sm text-purple-200/70">Sign in to start chatting with Lucy</p>
					</div>
				</div>
			{:then loggedIn}
				{#if !loggedIn}
					<div class="absolute inset-0 bg-black/80 flex items-center justify-center z-10">
						<div class="flex flex-col items-center gap-4">
							<XOauthButton />
							<p class="text-sm text-purple-200/70">Sign in to start chatting with Lucy</p>
						</div>
					</div>
				{/if}
			{/await}

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
								class="flex flex-col gap-1 max-w-[80%] {message.sender === 'user'
									? 'items-end'
									: ''}"
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
					{#if isLoading}
						<div class="flex gap-4">
							<div class="flex-shrink-0">
								<div class="size-10 rounded-full bg-purple-900/50 flex items-center justify-center">
									<div class="i-mdi:loading animate-spin text-2xl" />
								</div>
							</div>
							<div class="flex flex-col gap-1">
								<span class="text-sm text-purple-200">Lucy J.</span>
								<div class="rounded-2xl px-4 py-2 bg-purple-900/30 text-white">
									<div class="flex gap-2">
										<div
											class="w-2 h-2 rounded-full bg-purple-200/70 animate-bounce"
											style="animation-delay: 0ms;"
										/>
										<div
											class="w-2 h-2 rounded-full bg-purple-200/70 animate-bounce"
											style="animation-delay: 100ms;"
										/>
										<div
											class="w-2 h-2 rounded-full bg-purple-200/70 animate-bounce"
											style="animation-delay: 200ms;"
										/>
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>

			<!-- Fixed input area -->
			<div class="border-t border-purple-800/50 p-4 flex-shrink-0">
				<div class="max-w-3xl mx-auto">
					{#if hasEnded}
						<button
							on:click={handleOpenClaimPoints}
							class="w-full bg-purple-600/80 hover:bg-purple-500/80 text-white rounded-xl px-6 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors"
						>
							Claim {lastMessage.points} Points
						</button>
					{:else if showCooldown}
						<div class="text-center text-purple-200/70">
							<p>Conversation in cooldown</p>
							<p class="text-sm mt-1">Try again in {cooldownText}</p>
						</div>
					{:else}
						<div class="flex gap-2">
							<input
								type="text"
								bind:value={newMessage}
								on:keydown={handleKeyDown}
								disabled={isLoading || !canSendMessage}
								class="flex-1 bg-zinc-900/50 text-white border border-purple-900/20 rounded-xl px-4 py-3 min-w-0 focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed"
								placeholder="Send a message..."
							/>
							<button
								on:click={sendMessage}
								disabled={isLoading || !canSendMessage || !newMessage.trim()}
								class="bg-purple-600/80 hover:bg-purple-500/80 text-white rounded-xl px-6 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
								aria-label="Send"
							>
								{#if isLoading}
									<div class="i-mdi:loading animate-spin text-2xl" />
								{:else}
									<div class="i-mdi:send text-2xl" />
								{/if}
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
</div>
