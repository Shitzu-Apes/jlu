<script lang="ts">
	import { createPopover } from '@melt-ui/svelte';
	import { melt } from '@melt-ui/svelte';
	import dayjs from 'dayjs';
	import { onDestroy } from 'svelte';
	import { writable } from 'svelte/store';

	import ClaimPoints from './ClaimPoints.svelte';
	import HowItWorks from './HowItWorks.svelte';
	import type { LucyMood } from './Mood.svelte';
	import Mood from './Mood.svelte';
	import { showToast } from './Toast.svelte';
	import XOauthButton from './XOauthButton.svelte';

	import { fetchApi } from '$lib/api';
	import { session$ } from '$lib/auth';
	import { openBottomSheet } from '$lib/layout/BottomSheet';

	$: isLoggedIn = $session$.then((session) => session != null);
	const focusedMessage$ = writable<Message | undefined>();

	const defaultMood = 'curious';

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

	type HistoryResponse = {
		history: Conversation[];
	};

	let conversation: Message[] = [];
	let cooldownEnds: number | null = null;
	let canSendMessage = true;
	let isLoading = false;
	let newMessage = '';
	let conversationHistory: Conversation[] = [];
	let selectedHistoryId: number | null = null;

	type Conversation = {
		messages: Message[];
		startedAt: number;
		endedAt?: number;
		points?: number;
		evaluation?: string;
	};

	let cooldownInterval: ReturnType<typeof setInterval> | null = null;
	let now = Date.now();

	let inputRef: HTMLInputElement;

	const emojis = [
		'😊',
		'😂',
		'🥰',
		'😍',
		'😘',
		'😉',
		'😋',
		'🤗',
		'🥺',
		'😳',
		'🤔',
		'😅',
		'😌',
		'😏',
		'😎',
		'🤩',
		'❤️',
		'🔥',
		'✨',
		'💫',
		'💕',
		'💖',
		'💝',
		'💯'
	];

	const {
		elements: { trigger, content, arrow },
		states: { open }
	} = createPopover({
		positioning: { placement: 'top-start' },
		closeOnOutsideClick: true
	});

	function insertEmoji(emoji: string) {
		const cursorPosition = inputRef?.selectionStart ?? newMessage.length;
		newMessage = newMessage.slice(0, cursorPosition) + emoji + newMessage.slice(cursorPosition);
		// Set focus back to input and move cursor after emoji
		setTimeout(() => {
			inputRef?.focus();
			inputRef?.setSelectionRange(cursorPosition + emoji.length, cursorPosition + emoji.length);
		}, 0);
		open.set(false);
	}

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
			const response = await fetchApi('/chat');

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

	async function loadHistory() {
		if (!showCooldown) return;

		console.log('[history] Loading conversation history...');
		try {
			const response = await fetchApi('/chat/history');
			if (!response.ok) {
				console.error('[history] Failed to load:', await response.text());
				return;
			}

			const { history } = (await response.json()) as HistoryResponse;
			console.log('[history] Loaded:', history);
			conversationHistory = history;
			// Auto-select the most recent conversation
			if (history.length > 0) {
				selectedHistoryId = history[0].startedAt;
			}
		} catch (err) {
			console.error('[history] Error loading history:', err);
		}
	}

	const MAX_MESSAGE_LENGTH = 200;
	$: isMessageTooLong = (newMessage?.length ?? 0) > MAX_MESSAGE_LENGTH;

	let pastedInput = false;
	async function sendMessage() {
		if (!newMessage.trim() || isLoading) return;

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

		try {
			const response = await fetchApi('/chat', {
				method: 'POST',
				body: { message: userMessageText, pastedInput }
			});

			if (!response.ok) {
				const reason = await response.text();
				showToast({
					data: {
						type: 'simple',
						data: {
							title: 'Error',
							description: reason,
							type: 'error'
						}
					}
				});
				console.error('Failed to send message:', reason);
				return;
			}

			const data: ConversationResponse = await response.json();
			conversation = data.messages;
			cooldownEnds = data.cooldownEnds;
			canSendMessage = data.canSendMessage;
			setTimeout(() => {
				inputRef.focus();
			}, 0);
		} catch (err) {
			console.error('Error sending message:', err);
		} finally {
			isLoading = false;
			pastedInput = false;
		}
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

	$: lastLucyMessage = conversation.findLast((m) => m.sender === 'lucy');
	$: lastMessage = conversation[conversation.length - 1];
	$: hasEnded = lastMessage?.points != null && lastMessage?.evaluation != null;

	$: cooldownText = cooldownEnds ? dayjs(cooldownEnds).fromNow(true) : '';

	function handleOpenHowItWorks() {
		openBottomSheet(HowItWorks);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function handlePaste(event: ClipboardEvent) {
		const text = event.clipboardData?.getData('text');
		if (text) {
			pastedInput = true;
		}
	}

	$: selectedConversation = conversationHistory.find((c) => c.startedAt === selectedHistoryId);

	// Load history when cooldown starts
	$: if (showCooldown) {
		loadHistory();
	}

	$: $session$.then((session) => {
		if (session) {
			loadHistory();
		}
	});

	$: hasEnoughWords = conversation.length === 0 || newMessage.trim().split(/\s+/).length >= 2;
</script>

<div class="flex md:flex-row flex-col h-full w-full max-w-5xl">
	<div class="md:flex hidden flex-col items-center md:w-64 py-4 px-2 flex-shrink-0 z-20">
		<Mood
			mood={$focusedMessage$?.mood ?? lastLucyMessage?.mood ?? defaultMood}
			size="md"
			className="md:w-48 md:h-80 w-32 h-52"
		/>
	</div>

	<div class="flex flex-col flex-1 min-h-0 relative">
		<div class="flex flex-col w-full h-full overflow-hidden">
			{#await isLoggedIn}
				<div
					class="absolute inset-0 flex items-center justify-center bg-purple-950/30 backdrop-blur-sm"
				>
					<div class="i-svg-spinners:180-ring-with-bg text-purple-200/70 text-4xl" />
				</div>
			{:then loggedIn}
				{#if !loggedIn}
					<div
						class="absolute inset-0 flex items-end md:items-center justify-center bg-purple-950/30 backdrop-blur-sm z-10"
					>
						<div class="flex flex-col items-center gap-4 p-4 w-full md:w-auto">
							<div
								class="bg-purple-900/90 p-6 mb-8 rounded-xl text-center w-full max-w-md flex flex-col items-center"
							>
								<p class="text-purple-100 font-bold mb-4">
									You need to be logged in to chat with Lucy
								</p>
								<XOauthButton />
							</div>

							<button
								on:click={handleOpenHowItWorks}
								class="w-full max-w-md flex flex-col items-center gap-2 md:gap-4 px-4 md:px-8 py-3 md:py-6 bg-purple-900/90 hover:bg-purple-900/80 rounded-xl transition-colors"
							>
								<div
									class="i-mdi:lightbulb text-2xl md:text-4xl text-purple-200/70 group-hover:text-purple-200 transition-colors"
								/>
								<div class="text-center">
									<div class="text-base md:text-lg font-medium text-purple-100">
										New to Simp2Earn?
									</div>
									<div class="text-xs md:text-sm text-purple-200/70 mt-0.5 md:mt-1 hidden md:block">
										Learn how to earn tokens by chatting with Lucy
									</div>
								</div>
							</button>
						</div>
					</div>
				{/if}
			{/await}

			<!-- Mobile mood display -->
			<div class="md:hidden flex flex-col items-center py-4 flex-shrink-0 z-20">
				<Mood
					mood={$focusedMessage$?.mood ?? lastLucyMessage?.mood ?? defaultMood}
					size="md"
					className="w-28 h-46"
				/>
			</div>

			<!-- Scrollable conversation area -->
			<div bind:this={conversationContainer} class="flex-1 overflow-y-auto min-h-0">
				<div class="max-w-3xl mx-auto py-4 px-4 flex flex-col gap-6">
					{#if showCooldown && !hasEnded}
						<div class="text-center text-purple-200/70 mb-4">
							<div class="text-lg font-medium text-purple-100">Lucy needs some alone time</div>
							<div class="text-sm mt-1">Come back and try your luck again in {cooldownText}</div>
						</div>

						{#if conversationHistory.length > 0}
							<div class="flex flex-col gap-6">
								<div class="flex flex-col gap-3">
									<div class="text-base text-purple-200/70 mb--2">Past Conversations</div>
									<select
										bind:value={selectedHistoryId}
										class="w-full bg-zinc-900/50 text-white border border-purple-900/20 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
									>
										{#each conversationHistory as conv}
											<option
												value={conv.startedAt}
												selected={conv.startedAt === selectedHistoryId}
											>
												{dayjs(conv.startedAt).format('MMM D, YYYY h:mm A')} - {conv.points} Points
											</option>
										{/each}
									</select>

									{#if selectedConversation}
										<div class="flex flex-col gap-2">
											<div class="flex items-baseline gap-2">
												<div class="text-sm text-purple-200/70">Lucy's Evaluation</div>
												<div class="text-sm font-medium text-purple-100">
													{selectedConversation.points} Points
												</div>
											</div>
											<div class="text-sm italic">"{selectedConversation.evaluation}"</div>
										</div>
									{/if}
								</div>

								{#if selectedConversation}
									<div class="border-t border-purple-900/20 pt-6 flex flex-col gap-6">
										{#each selectedConversation.messages as message}
											<div
												class="flex gap-4 {message.sender === 'user'
													? 'flex-row-reverse'
													: ''} group/message"
												role="listitem"
												on:mouseenter={() => {
													if (message.sender === 'lucy') {
														focusedMessage$.set(message);
													}
												}}
											>
												<div class="flex-shrink-0">
													{#if message.sender === 'lucy'}
														<div
															class="group-hover/message:scale-105 transition-transform duration-200"
														>
															<Mood
																mood={message.mood ?? defaultMood}
																size="sm"
																className="size-10 rounded-full bg-purple-900/50"
															/>
														</div>
													{:else}
														<div
															class="group-hover/message:scale-105 transition-transform duration-200"
														>
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
													<div class="text-sm text-purple-200">
														{message.sender === 'lucy' ? 'Lucy J.' : 'You'}
													</div>
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
								{/if}
							</div>
						{:else}
							<div class="flex flex-col items-center justify-center py-12">
								<button
									on:click={handleOpenHowItWorks}
									class="flex flex-col items-center gap-2 md:gap-4 px-4 md:px-8 py-3 md:py-6 bg-purple-900/20 hover:bg-purple-900/30 rounded-2xl transition-colors group"
								>
									<div
										class="i-mdi:lightbulb text-2xl md:text-4xl text-purple-200/70 group-hover:text-purple-200 transition-colors"
									/>
									<div class="text-center">
										<div class="text-base md:text-lg font-medium text-purple-100">
											New to Simp2Earn?
										</div>
										<div
											class="text-xs md:text-sm text-purple-200/70 mt-0.5 md:mt-1 hidden md:block"
										>
											Learn how to earn tokens by chatting with Lucy
										</div>
									</div>
								</button>
							</div>
						{/if}
					{:else}
						{#await isLoggedIn}
							<!-- Loading state -->
						{:then loggedIn}
							{#if loggedIn && conversation.length === 0 && !hasEnded}
								<div class="flex flex-col items-center justify-center py-12">
									<button
										on:click={handleOpenHowItWorks}
										class="flex flex-col items-center gap-2 md:gap-4 px-4 md:px-8 py-3 md:py-6 bg-purple-900/20 hover:bg-purple-900/30 rounded-2xl transition-colors group"
									>
										<div
											class="i-mdi:lightbulb text-2xl md:text-4xl text-purple-200/70 group-hover:text-purple-200 transition-colors"
										/>
										<div class="text-center">
											<div class="text-base md:text-lg font-medium text-purple-100">
												New to Simp2Earn?
											</div>
											<div
												class="text-xs md:text-sm text-purple-200/70 mt-0.5 md:mt-1 hidden md:block"
											>
												Learn how to earn tokens by chatting with Lucy
											</div>
										</div>
									</button>
								</div>
							{/if}
						{/await}
					{/if}

					{#if conversation.length > 0}
						{#each conversation as message}
							<div
								class="flex gap-4 {message.sender === 'user'
									? 'flex-row-reverse'
									: ''} group/message"
								role="listitem"
								on:mouseenter={() => {
									if (message.sender === 'lucy') {
										focusedMessage$.set(message);
									}
								}}
							>
								<div class="flex-shrink-0">
									{#if message.sender === 'lucy'}
										<div class="group-hover/message:scale-105 transition-transform duration-200">
											<Mood
												mood={message.mood ?? defaultMood}
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
									<div class="text-sm text-purple-200">
										{message.sender === 'lucy' ? 'Lucy J.' : 'You'}
									</div>
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
					{/if}

					{#if isLoading}
						<div class="flex gap-4">
							<div class="flex-shrink-0">
								<div class="size-10 rounded-full bg-purple-900/50 flex items-center justify-center">
									<div class="i-mdi:loading animate-spin text-2xl" />
								</div>
							</div>
							<div class="flex flex-col gap-1">
								<div class="text-sm text-purple-200">Lucy J.</div>
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
							on:click={() =>
								openBottomSheet(ClaimPoints, {
									points: lastMessage.points,
									evaluation: lastMessage.evaluation,
									onClaim: () => {
										conversation = [];
										loadHistory();
									}
								})}
							class="w-full bg-purple-600/80 hover:bg-purple-500/80 text-white rounded-xl px-6 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors"
						>
							Claim {lastMessage.points} Points
						</button>
					{:else if showCooldown}
						<div class="text-center text-purple-200/70">
							<p>Try again in {cooldownText}</p>
						</div>
					{:else}
						<div class="flex gap-1 sm:gap-2 items-center">
							<div class="relative">
								<button
									use:melt={$trigger}
									class="bg-zinc-900/50 text-white border border-purple-900/20 rounded-xl sm:px-4 px-1 py-3 hover:bg-purple-900/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									disabled={isLoading || !canSendMessage}
									aria-label="Add emoji"
								>
									<div class="i-mdi:emoticon-happy-outline text-lg sm:text-2xl" />
								</button>
								<div
									use:melt={$content}
									class="z-50 bg-zinc-900/95 border border-purple-900/20 rounded-xl p-3 shadow-lg backdrop-blur-sm"
								>
									<div
										use:melt={$arrow}
										class="absolute bg-zinc-900/95 w-[0.75rem] h-[0.75rem] rotate-45 border border-purple-900/20 border-t-0 border-l-0"
									/>
									<div class="grid grid-cols-8 gap-2">
										{#each emojis as emoji}
											<button
												on:click={() => insertEmoji(emoji)}
												class="w-8 h-8 flex items-center justify-center hover:bg-purple-900/20 rounded-lg transition-colors text-lg"
											>
												{emoji}
											</button>
										{/each}
									</div>
								</div>
							</div>
							<div class="flex-1 flex flex-col gap-1">
								<input
									type="text"
									bind:value={newMessage}
									bind:this={inputRef}
									on:keydown={handleKeyDown}
									on:paste={handlePaste}
									disabled={isLoading || !canSendMessage}
									class="w-full bg-zinc-900/50 text-white border border-purple-900/20 rounded-xl px-4 py-3 min-w-0 focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed {isMessageTooLong
										? 'border-red-500'
										: ''}"
									placeholder="Send a message..."
								/>
								{#if isMessageTooLong}
									<div class="text-sm text-red-500">
										Message too long (max {MAX_MESSAGE_LENGTH} characters)
									</div>
								{/if}
							</div>
							<button
								on:click={sendMessage}
								disabled={isLoading ||
									!canSendMessage ||
									!newMessage.trim() ||
									isMessageTooLong ||
									!hasEnoughWords}
								class="bg-purple-600/80 hover:bg-purple-500/80 text-white rounded-xl sm:px-6 px-2 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
					<div
						class="bg-purple-900/90 p-6 rounded-xl text-center max-w-md mx-4 flex flex-col items-center"
					>
						<p class="text-purple-100 font-bold mb-4">You need to be logged in to chat with Lucy</p>
						<XOauthButton />
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
