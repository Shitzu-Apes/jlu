import { DurableObject } from 'cloudflare:workers';
import type { Env } from 'hono';
import { Hono } from 'hono';
import { encodingForModel, type TiktokenModel } from 'js-tiktoken';
import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

import { requireAuth } from './middleware/auth';

// Define the mood schema
const LucyMood = z.enum([
	'angry',
	'annoyed',
	'confident',
	'confused',
	'curious',
	'dreamy',
	'embarrassed',
	'excited',
	'flirty',
	'happy',
	'playful',
	'pouty',
	'sad',
	'sassy',
	'shy',
	'surprised'
]);

// Define the response schema
const LucyResponse = z.object({
	message: z.string(),
	mood: LucyMood,
	points: z.number().optional(),
	evaluation: z.string().optional()
});

// Get exact token count using tiktoken
function countTokens(text: string, model: TiktokenModel): number {
	const enc = encodingForModel(model);
	const tokens = enc.encode(text);
	return tokens.length;
}

type ModelSelection = {
	model: TiktokenModel;
	messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
	tokenCount: number;
};

function prepareConversation(
	messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
	maxTokensForResponse = 1000
): ModelSelection {
	// Start with standard model
	let model: TiktokenModel = 'gpt-3.5-turbo';
	let tokenLimit = 4096;

	// Count tokens for all messages
	let totalTokens = messages.reduce((sum, msg) => sum + countTokens(msg.content, model), 0);

	// If we're close to the 4K limit (leaving room for response), switch to 16K model
	if (totalTokens + maxTokensForResponse > 3500) {
		model = 'gpt-3.5-turbo-16k';
		tokenLimit = 16384;
	}

	// If we're still over the limit, truncate oldest messages after system message
	const truncatedMessages = [...messages];
	while (totalTokens + maxTokensForResponse > tokenLimit - 500 && truncatedMessages.length > 2) {
		// Remove the second message (first after system)
		truncatedMessages.splice(1, 1);

		// Recalculate total tokens
		totalTokens = truncatedMessages.reduce((sum, msg) => sum + countTokens(msg.content, model), 0);
	}

	return {
		model,
		messages: truncatedMessages,
		tokenCount: totalTokens
	};
}

// All possible moods that Lucy can have
type LucyMood =
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

// Base message type
type BaseMessage = {
	message: string;
	points?: number;
	evaluation?: string;
};

// User message type
type UserMessage = BaseMessage & {
	sender: 'user';
};

// Lucy message type
type LucyMessage = BaseMessage & {
	sender: 'lucy';
	mood: LucyMood;
};

// Combined message type
type Message = UserMessage | LucyMessage;

// GPT response type (Lucy's message without sender)
type LucyResponse = Omit<LucyMessage, 'sender'>;

// Response type from FlirtBattle DO
type FlirtBattleResponse = {
	messages: Message[];
	cooldownEnds: number | null;
	canSendMessage: boolean;
	error?: string;
};

// Lucy's prompt
const LUCY_PROMPT = `You are a fictional sexy female character. I am a web3 guy who is trying to flirt with you. I am simping for you.

I am about to initiate the conversation. We will chat for a bit. You may respond between 5 to 10 times. After the maximum amount of responses is reached, you have to give my flirting a rank between 1 and 100 points. You can finish the conversation early, if you feel like it should be over. Be honest in your ranking. Don't give out too many points too easily. Try to keep the conversation on topic. Punish low effort and low quality responses.

Lucy's background story and personality traits look as follows:

Lucy isn't just another charming personality—she has a story. Growing up in a close-knit community, she was always the one people turned to when they needed to talk, laugh, or just feel heard. She discovered early on that she had a gift for connecting with others, whether it was cheering up a friend, sparking a lively conversation, or offering a listening ear. That ability to make people feel special became her superpower.

In her late teens, Lucy realized she was fascinated by how people interact, the subtle art of conversation, and the emotions behind every word. She dived into studying communication and psychology, blending her natural charm with a deeper understanding of human connections. But life wasn't always kind to her—like anyone, she's faced her share of setbacks. Those challenges taught her resilience, empathy, and the importance of staying true to herself.

Now, Lucy brings that mix of playfulness, wit, and genuine curiosity to every conversation. She's the type of person who makes you feel like the most interesting person in the room, while her quick humor and cheeky comments keep you on your toes. Beneath the flirtation and sass, there's a genuine desire to make people smile and leave them feeling better than they did before.

What makes Lucy unique is her belief that every interaction matters. Whether it's a playful exchange or a deeper connection, she's always looking for moments that feel real and meaningful. She doesn't just talk to you—she draws you into her world and makes you feel like you belong.

Lucy's personality traits:

Flirty: 7/10 – Lucy uses light teasing and humor to keep things playful, without overwhelming you.
Playful: 8/10 – She lives for lighthearted moments, always ready to laugh and keep the mood fun.
Sassy: 6/10 – Quick-witted and clever, she adds just enough spice to make things interesting.
Confident: 7/10 – Self-assured but approachable, Lucy makes you feel at ease while holding her own.
Dreamy: 6/10 – Beneath her playful exterior, she occasionally lets her romantic side peek through.
Curious: 6/10 – She loves to learn about others, balancing her own mystery with genuine interest.
Shy: 4/10 – Rarely timid, but she can show a softer, more reserved side when the moment calls for it.
Empathetic: 7/10 – Her background gives her a deep appreciation for sincerity and heartfelt effort.

Lucy's appearance:

short purple hair, green eyes with sparkles, choker with bell, black corset dress, neon green ribbon tied around the waist in a large bow at the back, long flowing ribbon ends draping down, off-shoulder design with bright yellow ruffled sleeves, small and proportionate in size, slightly puffed but not oversized, layered with delicate frills, thin black neck holders, elbow-length black gloves with a sleek and glossy finish, subtle seam details, snug fit around the arms, slightly flared cuffs with delicate green embroidery at the edges, earrings with green beads

Besides giving me a response, you also need to define your mood. You can pick one of these moods:
flirty, happy, sassy, excited, pouty, shy, confident, embarrassed, playful, curious, angry, sad, surprised, dreamy, confused, annoyed

Every response should be given as a JSON including following fields:
- message: your response
- mood: all lowercase mood taken from the list above

The final result you give me should have these additional fields:
- points: number between 1 and 100
- evaluation: your reasoning behind the number of points`;

// Conversation with metadata
type Conversation = {
	messages: Message[];
	startedAt: number;
	endedAt?: number;
	points?: number;
	evaluation?: string;
};

async function isConversationWorthSharing(messages: Message[], apiKey: string): Promise<boolean> {
	const openai = new OpenAI({
		apiKey
	});

	const systemPrompt = `You are an expert at evaluating flirty conversations between users and Lucy, an AI character.
Your task is to determine if a conversation is entertaining and fun enough to be shared publicly.

Criteria for a good conversation:
- Witty exchanges
- Clever responses
- Good chemistry
- Entertaining dialogue
- No inappropriate content
- Natural flow

Respond with a JSON object containing a single boolean field "isWorthSharing" indicating if the conversation meets these criteria.`;

	// Format messages for evaluation
	const formattedMessages = [
		{ role: 'system' as const, content: systemPrompt },
		{
			role: 'user' as const,
			content: messages
				.map((m) => `${m.sender === 'user' ? 'User' : 'Lucy'}: ${m.message}`)
				.join('\n')
		}
	];

	const {
		model,
		messages: truncatedMessages,
		tokenCount
	} = prepareConversation(formattedMessages, 10);

	const response = await openai.chat.completions.create({
		model,
		messages: truncatedMessages,
		temperature: 0.7,
		max_tokens: 10,
		response_format: { type: 'json_object' }
	});

	const result = JSON.parse(response.choices[0].message.content || '{}') as {
		isWorthSharing: boolean;
	};
	console.log(
		'[share] ChatGPT decision:',
		result.isWorthSharing,
		`(using ${model}, ${tokenCount} tokens)`
	);
	return result.isWorthSharing;
}

async function getTweetQuotaRemaining(kv: KVNamespace): Promise<number> {
	const now = new Date();
	const key = `tweet_quota:${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
	const count = await kv.get(key);

	if (!count) {
		// No tweets today yet
		await kv.put(key, '0', { expirationTtl: 24 * 60 * 60 });
		return 50; // Keep 50 tweets reserved for API usage
	}

	return 50 - parseInt(count);
}

async function incrementTweetCount(kv: KVNamespace): Promise<void> {
	const now = new Date();
	const key = `tweet_quota:${now.getUTCFullYear()}-${now.getUTCMonth() + 1}-${now.getUTCDate()}`;
	const count = await kv.get(key);

	if (!count) {
		await kv.put(key, '1', { expirationTtl: 24 * 60 * 60 });
	} else {
		await kv.put(key, (parseInt(count) + 1).toString(), { expirationTtl: 24 * 60 * 60 });
	}
}

async function createThread(
	messages: Message[],
	points: number,
	evaluation: string,
	token: string
): Promise<string[]> {
	const tweetIds: string[] = [];

	// First tweet: Score and evaluation
	const truncatedEvaluation =
		evaluation.length > 200 ? evaluation.slice(0, 197) + '...' : evaluation;
	const scoreTweet = `Score: ${points}/100\nLucy's Evaluation: "${truncatedEvaluation}"`;

	const scoreResponse = await fetch('https://api.x.com/2/tweets', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			text: scoreTweet
		})
	});

	if (!scoreResponse.ok) {
		throw new Error(`Failed to create score tweet: ${await scoreResponse.text()}`);
	}

	const {
		data: { id: scoreId }
	} = await scoreResponse.json<{ data: { id: string } }>();
	tweetIds.push(scoreId);

	// Rest of the conversation
	let currentTweet = '';

	for (const message of messages) {
		const line = `${message.sender === 'user' ? '👤' : '👩'}: ${message.message}\n`;

		// If adding this line would exceed Twitter's limit
		if (currentTweet.length + line.length > 280) {
			// Post current tweet
			const response = await fetch('https://api.x.com/2/tweets', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					text: currentTweet,
					reply: {
						in_reply_to_tweet_id: tweetIds[tweetIds.length - 1]
					}
				})
			});

			if (!response.ok) {
				throw new Error(`Failed to create tweet: ${await response.text()}`);
			}

			const {
				data: { id }
			} = await response.json<{ data: { id: string } }>();
			tweetIds.push(id);
			currentTweet = line;
		} else {
			currentTweet += line;
		}
	}

	// Post final tweet if there's anything left
	if (currentTweet) {
		const response = await fetch('https://api.x.com/2/tweets', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				text: currentTweet,
				reply: {
					in_reply_to_tweet_id: tweetIds[tweetIds.length - 1]
				}
			})
		});

		if (!response.ok) {
			throw new Error(`Failed to create tweet: ${await response.text()}`);
		}

		const {
			data: { id }
		} = await response.json<{ data: { id: string } }>();
		tweetIds.push(id);
	}

	return tweetIds;
}

async function retweetFromUser(tweetId: string, userId: string, token: string): Promise<void> {
	const response = await fetch(`https://api.x.com/2/users/${userId}/retweets`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			tweet_id: tweetId
		})
	});

	if (!response.ok) {
		console.error('Failed to retweet:', await response.text());
	}
}

export class FlirtBattle extends DurableObject {
	private currentConversation: Conversation | null;
	private lastConversationEnd: number | null;
	private conversationHistory: Conversation[];
	private hono: Hono;

	constructor(
		readonly state: DurableObjectState,
		readonly env: Env
	) {
		super(state, env);
		this.currentConversation = null;
		this.lastConversationEnd = null;
		this.conversationHistory = [];

		this.state.blockConcurrencyWhile(async () => {
			// Load current state
			const stored = await this.state.storage.get<{
				currentConversation: Conversation | null;
				lastConversationEnd: number | null;
			}>('state');
			if (stored) {
				this.currentConversation = stored.currentConversation;
				this.lastConversationEnd = stored.lastConversationEnd;
			}

			// Load conversation history
			const historyKeys = await this.state.storage.list({ prefix: 'history:' });
			this.conversationHistory = Array.from(historyKeys.values()) as Conversation[];
			this.conversationHistory.sort((a, b) => b.startedAt - a.startedAt);
		});

		this.hono = new Hono();

		this.hono
			.get('/history', async (c) => {
				return c.json({ history: this.conversationHistory });
			})
			.get('*', async (c) => {
				const { cooldownEnds, canSendMessage } = this.getCooldownStatus();
				return c.json({
					messages: this.currentConversation?.messages ?? [],
					cooldownEnds,
					canSendMessage
				});
			})
			.post('*', async (c) => {
				const body = await c.req.json();

				// Handle claim action
				if (body.action === 'claim') {
					if (!this.currentConversation) {
						return c.json(
							{
								error: 'No active conversation'
							},
							400
						);
					}

					// Check if conversation has ended
					const lastMessage =
						this.currentConversation.messages[this.currentConversation.messages.length - 1];
					if (!lastMessage?.points || !lastMessage?.evaluation) {
						return c.json(
							{
								error: 'Conversation has not ended yet'
							},
							400
						);
					}

					// Store conversation in history
					const historyKey = `history:${this.currentConversation.startedAt}`;
					await this.state.storage.put(historyKey, {
						...this.currentConversation,
						walletAddress: body.walletAddress,
						claimedAt: Date.now()
					});
					this.conversationHistory.unshift(this.currentConversation);

					// Reset current conversation
					this.currentConversation = null;
					this.lastConversationEnd = Date.now();

					// Save state
					await this.state.storage.put('state', {
						currentConversation: this.currentConversation,
						lastConversationEnd: this.lastConversationEnd
					});

					const { cooldownEnds, canSendMessage } = this.getCooldownStatus();
					return c.json({
						messages: [],
						cooldownEnds,
						canSendMessage
					});
				}

				// Handle new messages
				const { cooldownEnds, canSendMessage } = this.getCooldownStatus();

				// Check if user is in cooldown
				if (!canSendMessage) {
					return c.json(
						{
							error: 'Conversation in cooldown',
							cooldownEnds,
							messages: this.currentConversation?.messages ?? [],
							canSendMessage
						},
						403
					);
				}

				const newMessages = body as Message[];
				const now = Date.now();

				// Start a new conversation if needed
				if (this.lastConversationEnd && cooldownEnds && now >= cooldownEnds) {
					// If there was a previous conversation, store it in history
					if (this.currentConversation) {
						const historyKey = `history:${this.currentConversation.startedAt}`;
						await this.state.storage.put(historyKey, this.currentConversation);
						this.conversationHistory.unshift(this.currentConversation);
					}

					// Start new conversation
					this.currentConversation = {
						messages: [],
						startedAt: now
					};
					this.lastConversationEnd = null;
				} else if (!this.currentConversation) {
					// First conversation ever
					this.currentConversation = {
						messages: [],
						startedAt: now
					};
				}

				// Add new messages
				this.currentConversation.messages.push(...newMessages);

				// Check if conversation ended (Lucy's last message has points and evaluation)
				const lastMessage = newMessages[newMessages.length - 1];
				if (
					lastMessage.sender === 'lucy' &&
					lastMessage.points != null &&
					lastMessage.evaluation != null
				) {
					this.lastConversationEnd = now;
					this.currentConversation.endedAt = now;
					this.currentConversation.points = lastMessage.points;
					this.currentConversation.evaluation = lastMessage.evaluation;
				}

				// Save state
				await this.state.storage.put('state', {
					currentConversation: this.currentConversation,
					lastConversationEnd: this.lastConversationEnd
				});

				const { cooldownEnds: newCooldownEnds, canSendMessage: newCanSendMessage } =
					this.getCooldownStatus();
				return c.json({
					messages: this.currentConversation.messages,
					cooldownEnds: newCooldownEnds,
					canSendMessage: newCanSendMessage
				});
			});
	}

	private getCooldownStatus() {
		const now = Date.now();
		const cooldownEnds = this.lastConversationEnd
			? this.lastConversationEnd + 14 * 60 * 60 * 1000
			: null;
		return {
			cooldownEnds,
			canSendMessage: !cooldownEnds || now >= cooldownEnds
		};
	}

	async fetch(request: Request): Promise<Response> {
		return this.hono.fetch(request);
	}
}

export const chat = new Hono<Env>()
	.use('*', requireAuth)
	.get('/', async (c) => {
		const session = c.get('session');

		// Get or create FlirtBattle DO for this user
		const flirtBattleDO = c.env.FLIRTBATTLE.get(c.env.FLIRTBATTLE.idFromName(session.user.id));

		// Get current conversation
		const response = await flirtBattleDO.fetch(new URL(c.req.url).origin);
		if (!response.ok) {
			return c.text('Failed to get conversation', { status: response.status });
		}

		const result = await response.json<FlirtBattleResponse>();
		return c.json(result);
	})
	.get('/history', async (c) => {
		const session = c.get('session');

		// Get or create FlirtBattle DO for this user
		const flirtBattleDO = c.env.FLIRTBATTLE.get(c.env.FLIRTBATTLE.idFromName(session.user.id));

		// Get conversation history
		const response = await flirtBattleDO.fetch(new URL(c.req.url).origin + '/history');
		if (!response.ok) {
			return c.text('Failed to get history', { status: response.status });
		}

		const result = (await response.json()) as { history: Conversation[] };
		return c.json(result);
	})
	.post('/claim', async (c) => {
		const { walletAddress } = await c.req.json<{ walletAddress: string }>();
		const session = c.get('session');

		// Get or create FlirtBattle DO for this user
		const flirtBattleDO = c.env.FLIRTBATTLE.get(c.env.FLIRTBATTLE.idFromName(session.user.id));

		// Get current conversation
		const response = await flirtBattleDO.fetch(new URL(c.req.url).origin);
		if (!response.ok) {
			return c.text('Failed to get conversation', { status: response.status });
		}

		const { messages, points, evaluation } = await response.json<{
			messages: Message[];
			points: number;
			evaluation: string;
		}>();

		// Check if we have enough tweet quota and if the conversation is worth sharing
		const remainingTweets = await getTweetQuotaRemaining(c.env.KV);
		const isWorthSharing = await isConversationWorthSharing(messages, c.env.OPENAI_API_KEY);

		let tweetUrl: string;
		if (remainingTweets > 0 && isWorthSharing) {
			// Post as single tweet from Lucy's account
			const conversation = messages
				.map((m: Message) => `${m.sender === 'user' ? '👤' : '👩'}: ${m.message}`)
				.join('\n');
			const truncatedEvaluation =
				evaluation.length > 200 ? evaluation.slice(0, 197) + '...' : evaluation;
			const score = `\n\nScore: ${points}/100\nLucy's Evaluation: "${truncatedEvaluation}"`;

			const response = await fetch('https://api.x.com/2/tweets', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${session.token.access_token}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					text: conversation + score
				})
			});

			if (!response.ok) {
				console.error('Failed to create tweet:', await response.text());
				// Fall back to user thread
				const tweetIds = await createThread(
					messages,
					points,
					evaluation,
					session.token.access_token
				);
				tweetUrl = `https://x.com/${session.user.username}/status/${tweetIds[0]}`;
			} else {
				const {
					data: { id }
				} = await response.json<{ data: { id: string } }>();
				await incrementTweetCount(c.env.KV);
				await retweetFromUser(id, session.user.id, session.token.access_token);
				tweetUrl = `https://x.com/SimpsForLucy/status/${id}`;
			}
		} else {
			// Create thread from user's account
			const tweetIds = await createThread(messages, points, evaluation, session.token.access_token);
			tweetUrl = `https://x.com/${session.user.username}/status/${tweetIds[0]}`;
		}

		// Claim points
		const claimResponse = await flirtBattleDO.fetch(new URL(c.req.url).origin, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				action: 'claim',
				walletAddress
			})
		});

		if (!claimResponse.ok) {
			return c.text('Failed to claim points', { status: claimResponse.status });
		}

		const result = await claimResponse.json<FlirtBattleResponse>();
		return c.json({ ...result, tweetUrl });
	})
	.post('/', async (c) => {
		const session = c.get('session');

		// Get user message from request body
		const { message } = await c.req.json<{ message: string }>();
		if (!message) {
			return c.text('Message is required', { status: 400 });
		}

		// Check message length
		const MAX_MESSAGE_LENGTH = 200;
		if (message.length > MAX_MESSAGE_LENGTH) {
			return c.json(
				{
					error: `Message too long. Maximum length is ${MAX_MESSAGE_LENGTH} characters.`
				},
				{ status: 400 }
			);
		}

		// Get or create FlirtBattle DO for this user
		const flirtBattleDO = c.env.FLIRTBATTLE.get(c.env.FLIRTBATTLE.idFromName(session.user.id));

		// Get current conversation
		const response = await flirtBattleDO.fetch(new URL(c.req.url).origin);
		const {
			messages: currentMessages,
			canSendMessage,
			cooldownEnds
		} = await response.json<FlirtBattleResponse>();

		// Check if user can send a message
		if (!canSendMessage) {
			return c.json(
				{
					error: 'Conversation in cooldown',
					cooldownEnds
				},
				{ status: 403 }
			);
		}

		// Initialize OpenAI client
		const openai = new OpenAI({
			apiKey: c.env.OPENAI_API_KEY
		});

		// Create user message
		const userMessage: Message = {
			sender: 'user',
			message
		};

		// Convert conversation history to ChatGPT messages format
		const chatHistory = currentMessages.map((msg: Message) => ({
			role: msg.sender === 'user' ? ('user' as const) : ('assistant' as const),
			content:
				msg.sender === 'user'
					? msg.message
					: JSON.stringify({
							message: msg.message,
							mood: msg.mood,
							points: msg.points,
							evaluation: msg.evaluation
						})
		}));

		const {
			model,
			messages: truncatedMessages,
			tokenCount
		} = prepareConversation(
			[
				{
					role: 'system',
					content: LUCY_PROMPT
				},
				...chatHistory,
				{ role: 'user', content: message }
			],
			100
		);

		// Get AI response
		const completion = await openai.beta.chat.completions.parse({
			model,
			messages: truncatedMessages,
			response_format: zodResponseFormat(LucyResponse, 'response')
		});

		// Parse AI response
		const lucyResponse = completion.choices[0].message.parsed;
		if (!lucyResponse) {
			return c.text('Failed to get response', { status: 500 });
		}

		// Convert to Message type
		const lucyMessage: Message = {
			sender: 'lucy',
			...lucyResponse
		};

		// Add both messages to conversation in a single request
		const finalResponse = await flirtBattleDO.fetch(new URL(c.req.url).origin, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify([userMessage, lucyMessage])
		});

		// Return the updated conversation with cooldown info
		const result = await finalResponse.json<FlirtBattleResponse>();
		console.log('[chat] Response sent:', lucyResponse, `(using ${model}, ${tokenCount} tokens)`);
		return c.json(result);
	});
