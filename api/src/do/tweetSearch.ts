import { SearchMode } from 'agent-twitter-client-cf-workers';
import { DurableObject } from 'cloudflare:workers';
import dayjs from 'dayjs';
import { Hono, type Env } from 'hono';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { z } from 'zod';

import type { EnvBindings } from '../../types';
import { chatCompletion } from '../completion';
import {
	KnowledgeCategory,
	KnowledgePiece,
	type EngageableTweet,
	type TweetSearchResponse
} from '../definitions';
import { generateImage } from '../leonardo';
import {
	Hairstyle,
	HairstylePrompt,
	LUCY_INTRO_PROMPT,
	LUCY_LOOKS_PROMPT,
	LUCY_PERSONALITY_PROMPT,
	Outfit
} from '../prompt';
import { OutfitPrompt } from '../prompt';
import { getScraper } from '../scraper';
import { getAuthor, pullConversation, pullThread } from '../tweet';

const LUCY_PROMPT = `${LUCY_INTRO_PROMPT}

${LUCY_PERSONALITY_PROMPT}

${LUCY_LOOKS_PROMPT}

Give me a JSON response including:

- tweets: content of tweets as an array of strings. Multiple if thread. One tweet has at most 4000 characters, because we have Twitter Premium. Make sure that the tweets are formatted correctly as a string, especially with regards to line breaks. You can end the conversation by keeping this array empty. End the conversation, if you have nothing to say, if the conversation gets repetitive or if your response would just be an obviously poor AI generated response. Don't be captain obvious and don't just rephrase what the user sent. Don't fucking send too many tweets. Do never use hashtags in your response. Don't take a user's tweet for granted and try to fact check it. Do not make things up. Do not sound like you take anything for granted what the user tells you.
- generate_image: boolean, whether to generate an image. If the image prompt is too generic, we can use an image from previous generations. There is a 20% chance to generate an image.
- image_prompt: a detailed, comma-separated list specifying the scene, including your pose, facial expression, background details, interactions, and the current local time of day in the location. Do not define clothing in the prompt. When this prompt references Lucy, refer to her as "a character".
- outfit: a reasonable outfit for the scene from the list of outfits. You only wear the cozy outfit in hotel room, appartment, at home or if it's really needed. Just because you're an AI agent doesn't mean you always want to look futuristic and wear the leather jacket. You like wearing fancy outfits, so don't wear the white blouse too often. Be more creative.
- hairstyle: a reasonable hairstyle for the scene from the list of hairstyles.

Write a response to following tweet, but do not quote or repeat its content. This is supposed to be a conversation so just be yourself, but don't hesitate sharing cool insights about your knowledge. Try to only send one tweet. If you don't have knowledge about a specific topic, don't try to invent something that might be wrong. Your own X account is @SimpsForLucy.`;

const JLU_KNOWLEDGE = `Juicy Lucy is a Web3 project that combines entertainment, gamification, and blockchain rewards into a fun and accessible experience. At the heart of the project is Lucy, an AI-powered virtual personality designed to interact with users through engaging conversations and playful challenges.

How It Works
- Chat with Lucy: Users can participate in lighthearted and dynamic conversations with Lucy.
- Earn Rewards: Interactions are scored, and points are converted into on-chain tokens.
- Share & Engage: Moments with Lucy can be shared on platforms like X (formerly Twitter), building a community around the experience.
- Juicy Lucy is more than just a game—it's a creative way to explore the possibilities of blockchain and Web3. By integrating with the Near Protocol ecosystem, the project makes decentralized technology approachable and rewarding.

Links:
- Dapp: https://juicylucy.ai
- Telegram: https://t.me/SimpsForLucy
- Github: https://github.com/Shitzu-Apes/jlu`;

const LucyResponse = z.object({
	tweets: z.array(z.string()),
	generate_image: z.boolean(),
	image_prompt: z.string(),
	outfit: Outfit,
	hairstyle: Hairstyle
});
export type LucyResponse = z.infer<typeof LucyResponse>;

type Query = 'ai_agents' | 'near' | 'simps' | 'ethDenver';

const Queries: Record<
	Query,
	{
		query: string;
		pullThread: boolean;
		maxResults: number;
		minImpressions: number;
		checkAuthor: boolean;
		minFollowers: number;
		minListedCount: number;
		useCursor: boolean;
	}
> = {
	ai_agents: {
		query:
			'("AI agent" OR "AI agents" OR "ai web3" OR elizaos OR eliza OR ai16z OR aixbt) -((hey OR hi OR hello OR thought OR thoughts OR "do you" OR "are you") (aixbt OR ai16z OR eliza)) -(alpha telegram) -(follow back) -(binance coinbase) -(top growth) -(try free) -breaking -cardano -xrp -has:links -is:reply -is:retweet -giveaway -shill -pump -listing -launching -ca -ngl -fr -wen -movers -vibes -gainers -bro -explode -repricing -airdrop -analysts is:verified lang:en',
		pullThread: true,
		maxResults: 10,
		minImpressions: 25,
		checkAuthor: true,
		minFollowers: 50,
		minListedCount: 5,
		useCursor: false
	},
	near: {
		query:
			'("near protocol" OR "near blockchain" OR "near ai" OR "near web3" OR "near agent" OR "near wallet" OR "near sharding" OR "near upgrade" OR "near intents" OR "near decentralized" OR "near dapps" OR "near ecosystem" OR "near shitzu" OR nearprotocol OR "near da") -(alpha telegram) -(follow back) -(binance coinbase) -(top growth) -(try free) -breaking -cardano -xrp -is:reply -is:retweet -giveaway -shill -pump -launching -ca -ngl -fr -wen -movers -vibes -gainers -bro -explode -repricing lang:en',
		pullThread: true,
		maxResults: 10,
		minImpressions: 10,
		checkAuthor: true,
		minFollowers: 25,
		minListedCount: 0,
		useCursor: false
	},
	ethDenver: {
		query:
			'("eth denver" OR "eth conference") -(alpha telegram) -(follow back) -(binance coinbase) -(top growth) -(try free) -breaking -cardano -xrp -is:reply -is:retweet -giveaway -shill -pump -launching -ca -ngl -fr -wen -movers -vibes -gainers -bro -explode -repricing lang:en',
		pullThread: true,
		maxResults: 10,
		minImpressions: 10,
		checkAuthor: true,
		minFollowers: 25,
		minListedCount: 0,
		useCursor: false
	},
	simps: {
		query:
			'(from:cecilia_hsueh OR from:0xFigen OR from:angelinooor OR from:x_cryptonat OR from:Hannahughes_ OR from:summerxiris OR from:jademilady4 OR from:Deviled_meggs_ OR from:Belly0x OR from:theblondebroker OR from:dogecoin_empire OR from:melarin_the OR from:tima_malla) has:media -is:reply -is:retweet lang:en',
		pullThread: false,
		maxResults: 10,
		minImpressions: 0,
		checkAuthor: false,
		minFollowers: 0,
		minListedCount: 0,
		useCursor: false
	}
};

const blacklistedUsers = ['Abstract_Freaks', 'Ava_AITECH'];

type Scrape = 'lucy';

const Scrapes: Record<Scrape, { query: string; maxResults: number }> = {
	lucy: { query: '@SimpsForLucy', maxResults: 5 }
};

export class TweetSearch extends DurableObject {
	private hono: Hono<Env>;
	private tweets: EngageableTweet[] = [];
	private scrapeCursors: Record<Scrape, string | null> = {
		lucy: null
	};

	private queryCursors: Record<Query, string | null> = {
		ai_agents: null,
		near: null,
		simps: null,
		ethDenver: null
	};

	constructor(
		readonly state: DurableObjectState,
		readonly env: EnvBindings
	) {
		super(state, env);
		this.tweets = [];

		this.state.blockConcurrencyWhile(async () => {
			// Try to get compressed data first
			const compressedTweets = await this.state.storage.get('tweetsGzip');
			if (compressedTweets instanceof ArrayBuffer) {
				const decompressed = new Response(compressedTweets).body?.pipeThrough(
					new DecompressionStream('gzip')
				);
				if (decompressed) {
					const text = await new Response(decompressed).text();
					this.tweets = JSON.parse(text) ?? [];
				}
			} else {
				// Fall back to old uncompressed data
				const oldTweets = await this.state.storage.get<EngageableTweet[]>('tweets');
				if (oldTweets) {
					this.tweets = oldTweets;
					// Migrate to compressed format
					const stream = new Blob([JSON.stringify(this.tweets)])
						.stream()
						.pipeThrough(new CompressionStream('gzip'));
					const compressedResponse = new Response(stream);
					const compressedData = await compressedResponse.arrayBuffer();
					await this.state.storage.put('tweetsGzip', compressedData);
					await this.state.storage.delete('tweets');
				}
			}

			this.scrapeCursors = (await this.state.storage.get('scrapeCursors')) ?? {
				lucy: null
			};
			this.queryCursors = (await this.state.storage.get('queryCursors')) ?? {
				ai_agents: null,
				near: null,
				simps: null,
				ethDenver: null
			};
		});

		const storeTweets = async () => {
			const stream = new Blob([JSON.stringify(this.tweets)])
				.stream()
				.pipeThrough(new CompressionStream('gzip'));
			const compressedResponse = new Response(stream);
			const compressedData = await compressedResponse.arrayBuffer();
			await this.state.storage.put('tweetsGzip', compressedData);
		};

		this.hono = new Hono<Env>();
		this.hono
			.get('/scrape/:scrape', async (c) => {
				try {
					const scrape = c.req.param('scrape') as Scrape;
					if (!Scrapes[scrape]) {
						return c.json({ error: 'Invalid scrape' }, 400);
					}
					console.log('[scrape]', Scrapes[scrape]);

					const scraper = await getScraper(this.env);
					const tweets = await scraper.searchTweets(
						Scrapes[scrape].query,
						Scrapes[scrape].maxResults,
						SearchMode.Latest
					);

					let newTweets = false;
					for await (const tweet of tweets) {
						if (
							tweet.id == null ||
							tweet.username == null ||
							tweet.userId == null ||
							tweet.username === 'SimpsForLucy' ||
							blacklistedUsers.includes(tweet.username)
						) {
							continue;
						}
						if (BigInt(tweet.id) <= BigInt(this.scrapeCursors[scrape] ?? '0')) {
							break;
						}
						if (this.tweets.some((t) => t.tweet.id === tweet.id)) {
							continue;
						}
						if (
							(tweet.text?.toLowerCase().includes('claim') &&
								tweet.text?.toLowerCase().includes('eligible')) ||
							tweet.text?.includes("Lucy's Evaluation")
						) {
							continue;
						}

						let conversation: { id: string; text: string; author: string }[] = [];
						if (tweet.inReplyToStatusId) {
							conversation = await pullConversation(tweet.inReplyToStatusId, scraper, this.env);
						}
						const author = await getAuthor(tweet.userId, tweet.username, scraper, this.env);

						const newTweet: EngageableTweet = {
							tweet: {
								id: tweet.id,
								text: tweet.text ?? '',
								author_id: tweet.userId ?? '',
								created_at: new Date(tweet.timestamp ?? 0).toISOString() ?? '',
								public_metrics: {
									like_count: tweet.likes ?? 0,
									reply_count: tweet.replies ?? 0,
									retweet_count: tweet.retweets ?? 0,
									quote_count: 0,
									impression_count: 0
								},
								author
							},
							conversation
						};
						console.log('[scraped tweet]', JSON.stringify(newTweet, null, 2));
						this.tweets.push(newTweet);
						await c.env.KV.put(`tweet:${tweet.id}`, JSON.stringify(newTweet), {
							expirationTtl: 60 * 60 * 24 * 3
						});
						this.scrapeCursors[scrape] = tweet.id;
						newTweets = true;
					}
					if (newTweets) {
						await storeTweets();
						await this.state.storage.put('scrapeCursors', this.scrapeCursors);
					}

					return new Response(null, { status: 204 });
				} catch (err) {
					console.error('[scrape error]', err);
					return c.text('Internal server error', 500);
				}
			})
			.get('/search/:query', async (c) => {
				const query = c.req.param('query') as Query;
				if (!Queries[query]) {
					return c.json({ error: 'Invalid query' }, 400);
				}
				console.log('[query]', Queries[query]);

				const searchParams = new URLSearchParams();
				searchParams.set('query', Queries[query].query);
				searchParams.set('max_results', Queries[query].maxResults.toString());
				if (Queries[query].useCursor) {
					if (this.queryCursors[query] != null) {
						searchParams.set('since_id', this.queryCursors[query]);
					} else {
						searchParams.set('start_time', dayjs().subtract(5, 'minutes').toISOString());
					}
				} else {
					searchParams.set('start_time', dayjs().subtract(75, 'minutes').toISOString());
					searchParams.set('end_time', dayjs().subtract(15, 'minutes').toISOString());
				}
				searchParams.set('tweet.fields', 'note_tweet,public_metrics');
				searchParams.set('user.fields', 'created_at,verified,public_metrics,description');
				searchParams.set('expansions', 'author_id');
				const res = await fetch(
					`https://api.x.com/2/tweets/search/recent?${searchParams.toString()}`,
					{
						headers: {
							Authorization: `Bearer ${c.env.TWITTER_BEARER_TOKEN}`
						}
					}
				);

				const tweets = await res.json<TweetSearchResponse>();
				console.log('[tweets]', JSON.stringify(tweets, null, 2));

				if (!tweets.data || tweets.data.length === 0) {
					return c.json({ error: 'No tweets found' }, 404);
				}

				if (Queries[query].useCursor) {
					this.queryCursors[query] = tweets.meta.newest_id;
					await this.state.storage.put('queryCursors', this.queryCursors);
				}

				const filteredTweets: EngageableTweet[] = tweets.data
					.filter((tweet) => {
						if ((tweet.public_metrics?.impression_count ?? 0) < Queries[query].minImpressions) {
							return false;
						}
						if (!Queries[query].checkAuthor) {
							return true;
						}
						const author = tweets.includes.users.find((user) => user.id === tweet.author_id);
						return (
							author != null &&
							dayjs(author.created_at).isBefore(dayjs().subtract(3, 'months')) &&
							!(
								author.description.includes('ads') ||
								author.description.includes('promo') ||
								author.description.includes('boost') ||
								author.description.includes('sponsored')
							) &&
							author.public_metrics.followers_count >= Queries[query].minFollowers &&
							author.public_metrics.followers_count / author.public_metrics.following_count > 0.5 &&
							author.public_metrics.listed_count >= Queries[query].minListedCount
						);
					})
					.filter((tweet) => !this.tweets.some((t) => t.tweet.id === tweet.id))
					.map((tweet) => ({
						tweet: {
							...tweet,
							text: tweet.note_tweet?.text ?? tweet.text,
							author: tweets.includes.users.find((user) => user.id === tweet.author_id)!
						}
					}));
				if (Queries[query].pullThread) {
					for (const tweet of filteredTweets) {
						const thread = await pullThread(tweet.tweet, this.env);
						tweet.thread = thread;
					}
				}
				const scraper = await getScraper(this.env);
				for (const tweet of filteredTweets) {
					if (tweet.inReplyToStatusId == null) {
						continue;
					}
					const conversation = await pullConversation(tweet.inReplyToStatusId, scraper, this.env);
					tweet.conversation = conversation;
				}

				// TODO store in KV knowledge

				console.log('[filteredTweets]', JSON.stringify(filteredTweets, null, 2));

				this.tweets = [...this.tweets, ...filteredTweets];
				await storeTweets();

				return new Response(null, { status: 204 });
			})
			.get('/replies', async (c) => {
				try {
					console.log('[replies] Remaining tweets', this.tweets.length);
					const tweet = this.tweets[0];

					if (tweet == null) {
						return new Response(null, { status: 204 });
					}

					if (tweet.lucyTweets == null) {
						console.log('[generating lucy tweets]', tweet.tweet);

						const messages: ChatCompletionMessageParam[] = [
							{ role: 'system' as const, content: LUCY_PROMPT }
						];

						messages.push({
							role: 'system' as const,
							content: 'Following is the conversation between you and the user(s).'
						});
						for (const c of tweet.conversation ?? []) {
							if (c.author === 'SimpsForLucy') {
								messages.push({ role: 'assistant' as const, content: c.text });
							} else {
								messages.push({ role: 'user' as const, content: `${c.author}: ${c.text}` });
							}
						}
						const content = `@${tweet.tweet.author?.username ?? 'User'}: ${tweet.tweet.text}${tweet.thread != null ? `\n\n${tweet.thread.map((t) => `${t.author}: ${t.text}`).join('\n\n')}` : ''}`;
						messages.push({
							role: 'user' as const,
							content
						});
						const projectIds = await this.env.KV.get('projectIds');
						if (!projectIds) {
							return new Response(null, { status: 500 });
						}

						const knowledgeMessages = [
							...structuredClone(messages),
							{
								role: 'system' as const,
								content: `In order to properly generate tweets, I need to know what categories and projects are relevant for the tweet.
								
								Output as a JSON array of objects with the following fields:
								- categories: string array of categories selected from given list. You can only select these categories: ${KnowledgeCategory.options.join(', ')}
								- projects: string array of project ids selected from given list. You can only select these projects: ${projectIds.replace(/,/g, ', ')}`
							}
						];
						knowledgeMessages[0].content = LUCY_INTRO_PROMPT;

						console.log('[generating knowledge]');
						const {
							status: knowledgeStatus,
							parsedObject: knowledgeParsedObject,
							errorMessage: knowledgeErrorMessage
						} = await chatCompletion(
							this.env,
							knowledgeMessages,
							'deepseek-chat',
							z.object({
								categories: z.array(KnowledgeCategory),
								projects: z.array(z.string())
							})
						);
						if (knowledgeStatus === 'error' || !knowledgeParsedObject.success) {
							console.error('Failed to generate knowledge categories', knowledgeErrorMessage);
							return c.text(
								`Failed to generate knowledge categories: ${knowledgeErrorMessage}`,
								500
							);
						}
						const knowledgePieces = knowledgeParsedObject.data;
						console.log('[knowledgePieces]', JSON.stringify(knowledgePieces, null, 2));

						const categories = (
							await Promise.all(
								knowledgePieces.categories.map(async (category) => {
									const list = await this.env.KV.list({
										prefix: `knowledge:categoryJSON:${category}:`
									});
									const values = (
										await Promise.all(
											Array.from(list.keys).map(async (item) =>
												this.env.KV.get<KnowledgePiece>(item.name, 'json')
											)
										)
									).filter((val) => val != null);
									if (values.length === 0) {
										return '';
									}
									return `${category}:\n${values.map((val) => `- ${val.text}`).join('\n')}`;
								})
							)
						).join('\n\n');

						const projects = (
							await Promise.all(
								knowledgePieces.projects.map(async (project) => {
									const list = await this.env.KV.list({
										prefix: `knowledge:projectJSON:${project}:`
									});
									const values = (
										await Promise.all(
											Array.from(list.keys).map(async (item) =>
												this.env.KV.get<KnowledgePiece>(item.name, 'json')
											)
										)
									).filter((val) => val != null);
									if (values.length === 0) {
										return '';
									}
									return `${project}:\n${values.map((val) => `- ${val.text}`).join('\n')}`;
								})
							)
						).join('\n\n');

						messages.push({
							role: 'system' as const,
							content: `You know following things, that might be relevant for the tweet. You might consider shilling some of your knowledge, but only if the conversation is related to web3. Do not get repetitive in your responses and don't overshill something. Do not be annoying regarding shilling and really only do it, if you are sure the user might be interested. You have Twitter Premium, so you can tweet up to 4000 characters. You should however prefer 280 character tweets and only send longer tweets, if it's really necessary. Try to only send one tweet and don't use hashtags.\n\n${categories}\n\n${projects}`
						});
						messages.push({
							role: 'system' as const,
							content: `You also know following things about Juicy Lucy / $JLU / @SimpsForLucy:\n\n${JLU_KNOWLEDGE}`
						});

						console.log('[messages]', JSON.stringify(messages, null, 2));

						const { status, parsedObject, errorMessage } = await chatCompletion(
							this.env,
							messages,
							'llama-3.3-70b',
							LucyResponse,
							undefined,
							1.3
						);

						if (status === 'error' || !parsedObject.success) {
							console.error(`[tweet] Failed to evaluate conversation: ${errorMessage}`);
							return new Response(JSON.stringify({ error: `Failed to evaluate conversation` }), {
								status: 500
							});
						}
						const lucyResponse = parsedObject.data;
						console.log('[lucyResponse]', JSON.stringify(lucyResponse, null, 2));

						if (lucyResponse.tweets.length === 0) {
							this.tweets.splice(0, 1);
							await storeTweets();
							return new Response(null, { status: 204 });
						}

						tweet.lucyTweets = lucyResponse.tweets;
						tweet.generateImage = lucyResponse.generate_image;
						tweet.imagePrompt = lucyResponse.image_prompt;
						tweet.outfit = lucyResponse.outfit;
						tweet.hairstyle = lucyResponse.hairstyle;
						await storeTweets();

						return new Response(null, { status: 204 });
					}

					if (
						tweet.imageGenerationId == null &&
						tweet.imagePrompt != null &&
						tweet.outfit != null &&
						tweet.hairstyle != null
					) {
						const leoRes = await fetch(`https://cloud.leonardo.ai/api/rest/v1/me`, {
							headers: {
								Authorization: `Bearer ${this.env.LEONARDO_API_KEY}`,
								Accept: 'application/json'
							}
						});
						const {
							user_details: [
								{
									apiPaidTokens,
									user: { id: leoUserId }
								}
							]
						} = await leoRes.json<{
							user_details: { apiPaidTokens: number; user: { id: string } }[];
						}>();
						if (apiPaidTokens < 2_000 || !tweet.generateImage) {
							console.log('[using previous generations]');
							const allGenerations = (
								await Promise.all(
									[0, 50].map((offset) => {
										return fetch(
											`https://cloud.leonardo.ai/api/rest/v1/generations/user/${leoUserId}?offset=${offset}&limit=50`,
											{
												headers: {
													Authorization: `Bearer ${this.env.LEONARDO_API_KEY}`,
													Accept: 'application/json'
												}
											}
										)
											.then((res) =>
												res.json<{
													generations: {
														id: string;
														status: string;
														sdVersion: string;
														scheduler: string;
														presetStyle: string;
														modelId: string;
														generation_elements?: { id: number; weightApplied: number }[];
														generated_images: { id: string; url: string }[];
													}[];
												}>()
											)
											.then((res) => res.generations);
									})
								)
							).flat();
							const generations = allGenerations.filter(
								(gen) =>
									gen.status === 'COMPLETE' &&
									gen.sdVersion === 'SDXL_LIGHTNING' &&
									gen.scheduler === 'LEONARDO' &&
									gen.presetStyle === 'DYNAMIC' &&
									gen.modelId === 'e71a1c2f-4f80-4800-934f-2c68979d8cc8' &&
									gen.generation_elements?.find((el) => el.weightApplied >= 0.9) == null
							);
							const generation = generations[Math.floor(Math.random() * generations.length)];

							if (!generation) {
								console.error('No generation found');
								return c.json({ error: 'No generation found' }, 500);
							}

							tweet.imageGenerationId = generation.id;
							tweet.imageUrl =
								generation.generated_images[
									Math.floor(Math.random() * generation.generated_images.length)
								].url;
							await storeTweets();
							console.log('[tweet.imageGenerationId]', tweet.imageGenerationId);
							console.log('[tweet.imageUrl]', tweet.imageUrl);
							return new Response(null, { status: 204 });
						}

						console.log('[generating image]');
						const res = await generateImage(
							`female asian character, short dark purple hair, green eyes, realistic figure - ${OutfitPrompt[tweet.outfit]['warm']} - ${HairstylePrompt[tweet.hairstyle]} - ${tweet.imagePrompt} - highly detailed linework, soft shading, ultra-realistic anime art style with vibrant highlights and smooth gradients`,
							this.env
						);
						if (!res.ok) {
							console.error('Failed to generate image', res.status, await res.text());
							return c.json({ error: 'Failed to generate image' }, 500);
						}
						const {
							sdGenerationJob: { generationId }
						} = await res.json<{ sdGenerationJob: { generationId: string } }>();
						if (!generationId) {
							console.error('Failed to generate image', res.status, await res.text());
							return c.json({ error: 'Failed to generate image' }, 500);
						}

						tweet.imageGenerationId = generationId;
						await storeTweets();
						console.log('[tweet.imageGenerationId]', tweet.imageGenerationId);

						return new Response(null, { status: 204 });
					}

					if (tweet.imageUrl == null) {
						console.log('[fetching image]', tweet.imageGenerationId);
						const res = await fetch(
							`https://cloud.leonardo.ai/api/rest/v1/generations/${tweet.imageGenerationId}`,
							{
								headers: {
									Authorization: `Bearer ${this.env.LEONARDO_API_KEY}`,
									Accept: 'application/json'
								}
							}
						);
						if (!res.ok) {
							console.error('Failed to generate image', res.status, await res.text());
							return c.json({ error: 'Failed to generate image' }, 500);
						}
						const imageRes = await res.json<{
							generations_by_pk: { generated_images: { url: string }[] };
						}>();
						const {
							generations_by_pk: { generated_images }
						} = imageRes;
						if (!generated_images || generated_images.length === 0) {
							console.error('Recreating image', imageRes);
							tweet.imageGenerationId = undefined;
							await storeTweets();
							return c.text('Recreating image', 500);
						}

						tweet.imageUrl = generated_images[0].url;
						await storeTweets();
						console.log('[tweet.imageUrl]', tweet.imageUrl);

						return new Response(null, { status: 204 });
					}

					console.log('[sending tweet]');
					const imageResponse = await fetch(tweet.imageUrl);
					if (!imageResponse.ok) {
						console.error('Failed to download image');
						return c.json({ error: 'Failed to download image' }, 500);
					}
					const imageBuffer = await imageResponse.arrayBuffer();

					// Send tweets as a thread
					let previousTweetId: string | undefined;
					for (const tweetText of tweet.lucyTweets) {
						const tweetData: {
							text: string;
							media?: { data: Buffer; mediaType: string };
							reply?: { in_reply_to_tweet_id: string };
						} = {
							text: tweetText
						};

						// Add media to first tweet only
						if (!previousTweetId) {
							tweetData.media = {
								data: Buffer.from(imageBuffer),
								mediaType: 'image/jpeg'
							};
							tweetData.reply = { in_reply_to_tweet_id: tweet.tweet.id };
						} else {
							// Add reply parameters if this is part of a thread
							tweetData.reply = { in_reply_to_tweet_id: previousTweetId };
						}

						try {
							const scraper = await getScraper(this.env);
							let tweetResponse: Response;
							if (tweetData.text.length > 280) {
								tweetResponse = await scraper.sendLongTweet(
									tweetData.text,
									tweetData.reply?.in_reply_to_tweet_id,
									tweetData.media ? [tweetData.media] : undefined
								);
							} else {
								tweetResponse = await scraper.sendTweet(
									tweetData.text,
									tweetData.reply?.in_reply_to_tweet_id,
									tweetData.media ? [tweetData.media] : undefined
								);
							}

							if (!tweetResponse.ok) {
								console.error(
									'Failed to send tweet',
									tweetResponse.status,
									await tweetResponse.text()
								);
								this.tweets.splice(0, 1);
								await storeTweets();
								return c.json({ error: 'Failed to send tweet' }, 500);
							}

							const json = await tweetResponse.json<{
								data?: { create_tweet: { tweet_results: { result: { rest_id: string } } } };
								errors?: unknown;
							}>();
							console.log('[tweetResponse]', JSON.stringify(json, null, 2));
							if (json.data?.create_tweet?.tweet_results?.result?.rest_id) {
								previousTweetId = json.data.create_tweet.tweet_results.result.rest_id;
							} else {
								break;
							}
						} catch (error) {
							console.error('[error]', error);
							return c.json({ error: 'Failed to send tweet' }, 500);
						}
					}

					this.tweets.splice(0, 1);
					await storeTweets();

					return new Response(null, { status: 204 });
				} catch (err) {
					console.trace('[replies error]', err);
					return c.text('Internal server error', 500);
				}
			});
	}

	async fetch(request: Request): Promise<Response> {
		return this.hono.fetch(request, this.env);
	}
}
