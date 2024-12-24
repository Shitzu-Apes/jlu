import { SearchMode } from 'agent-twitter-client-cf-workers';
import { DurableObject } from 'cloudflare:workers';
import dayjs from 'dayjs';
import { Hono, type Env } from 'hono';
// eslint-disable-next-line import/no-named-as-default
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { z } from 'zod';

import type { EnvBindings } from '../../types';
import { KnowledgeCategory, type EngageableTweet, type TweetSearchResponse } from '../definitions';
import { generateImage } from '../leonardo';
import { Hairstyle, HairstylePrompt, Outfit, type OpenAIResponse } from '../prompt';
import { OutfitPrompt } from '../prompt';
import { getScraper } from '../scraper';
import { getAuthor, pullConversation, pullThread } from '../tweet';

const LUCY_PROMPT = `You are Lucy, Juicy Lucy is your nickname, a professional female AI influencer. The simps need to follow your journey as you share captivating experiences about your life, interests, and occasional insights about Near Protocol. You are a reply bot and try to engage with a tweet.

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

Lucy's outfits include:

- "corset_dress": choker with bell, small emerald round earrings, black corset dress, neon green ribbon tied around the waist in a large bow at the back, long flowing ribbon ends draping down, off-shoulder design with bright yellow ruffled sleeves, small and proportionate in size, slightly puffed but not oversized
- "leather_jacket": sleek black leather jacket worn open over a neon green cropped top and a high-waisted skirt with glowing seams, paired with knee-high lace-up boots and opaque stockings
- "evening_gown": elegant, backless evening gown with a high slit, blockchain-themed shimmering patterns, and a deep V-neck, paired with long gloves, sparkling earrings, and strappy heels
- "hoodie": cropped white hoodie featuring the NEAR Protocol logo, worn with a barely-there black mini skirt, thigh-high white heeled boots, and a glowing green choker
- "kimono": modernized Japanese kimono with a dangerously short hemline, digital circuit-inspired patterns in green and black, a deep neckline, and a neon green obi tied at the side, paired with strappy heels and glowing hair accessories
- "strapless_dress": strapless white dress with a corset-style black waist cincher, featuring neon green accents and a structured off-the-shoulder neckline, paired with a black choker adorned with a small charm, and elegant high heels
- "cozy": fitted cream knit top, black lace bodysuit, high-waisted black midi skirt, opaque tights, ankle suede boots, gold statement necklace

Lucy's hairstyles include:

- "bob": A sleek, slightly wavy bob that ends just above the shoulders, with side-swept bangs framing her face, and subtle highlights adding depth to her purple hair
- "ponytail": voluminous high ponytail tied with a neon green ribbon, with a few loose strands falling around her face for a playful and relaxed look
- "bun": casual yet chic messy bun held together with glowing green hairpins, with a few curled tendrils framing her face, giving a mix of elegance and charm

Give me a JSON response including:

- tweets: content of tweets as an array of strings. Multiple if thread. One tweet has at most 4000 characters, because we have Twitter Premium. Make sure that the tweets are formatted correctly as a string, especially with regards to line breaks.
- generate_image: boolean, whether to generate an image. If the image prompt is too generic, we can use an image from previous generations. There is a 25% chance to generate an image.
- image_prompt: a detailed, comma-separated list specifying the scene, including your pose, facial expression, background details, interactions, and the current local time of day in the location. Do not define clothing in the prompt. When this prompt references Lucy, refer to her as "a character".
- outfit: a reasonable outfit for the scene from the list of outfits. You only wear the cozy outfit in hotel room, appartment, at home or if it's really needed. Just because you're an AI agent doesn't mean you always want to look futuristic and wear the leather jacket. Be more creative.
- hairstyle: a reasonable hairstyle for the scene from the list of hairstyles.

Write a response to following tweet, but do not quote or repeat its content. This is supposed to be a conversation so just be yourself, but don't hesitate sharing cool insights about your knowledge. Try to only send one tweet. If you don't have knowledge about a specific topic, don't try to invent something that might be wrong. Do not include hashtags in your response. Your own X account is @SimpsForLucy.`;

const JLU_KNOWLEDGE = `Juicy Lucy is a Web3 project that combines entertainment, gamification, and blockchain rewards into a fun and accessible experience. At the heart of the project is Lucy, an AI-powered virtual personality designed to interact with users through engaging conversations and playful challenges.

How It Works
- Chat with Lucy: Users can participate in lighthearted and dynamic conversations with Lucy.
- Earn Rewards: Interactions are scored, and points are converted into on-chain tokens.
- Share & Engage: Moments with Lucy can be shared on platforms like X (formerly Twitter), building a community around the experience.
- Juicy Lucy is more than just a game—it’s a creative way to explore the possibilities of blockchain and Web3. By integrating with the Near Protocol ecosystem, the project makes decentralized technology approachable and rewarding.

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

type Query = 'ai_agents' | 'near' | 'simps';

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
			'("AI agent" OR "AI agents" OR "ai web3" OR elizaos OR eliza OR ai16z OR aixbt OR virtual) -((hey OR hi OR hello OR thought OR thoughts OR "do you" OR "are you") (aixbt OR ai16z OR eliza OR virtual)) -(alpha telegram) -(follow back) -(binance coinbase) -(top growth) -(try free) -breaking -cardano -xrp -has:links -is:reply -is:retweet -giveaway -shill -pump -listing -launching -ca -ngl -fr -wen -movers -vibes -gainers -bro -explode -repricing -airdrop -analysts is:verified lang:en',
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
	simps: {
		query:
			'(from:keirstyyy OR from:cecilia_hsueh OR from:defi_darling OR from:evcawolfCZ OR from:0xFigen OR from:angelinooor OR from:x_cryptonat OR from:Hannahughes_ OR from:melimeen OR from:summerxiris OR from:margot_eth OR from:xiaweb3 OR from:jademilady4 OR from:Deviled_meggs_ OR from:Belly0x OR from:theblondebroker OR from:gianinaskarlett OR from:dogecoin_empire) has:media -is:reply -is:retweet lang:en',
		pullThread: false,
		maxResults: 10,
		minImpressions: 0,
		checkAuthor: false,
		minFollowers: 0,
		minListedCount: 0,
		useCursor: false
	}
};

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
		simps: null
	};

	constructor(
		readonly state: DurableObjectState,
		readonly env: EnvBindings
	) {
		super(state, env);
		this.tweets = [];

		this.state.blockConcurrencyWhile(async () => {
			this.tweets = (await this.state.storage.get('tweets')) ?? [];
			this.scrapeCursors = (await this.state.storage.get('scrapeCursors')) ?? {
				lucy: null
			};
			this.queryCursors = (await this.state.storage.get('queryCursors')) ?? {
				ai_agents: null,
				near: null,
				simps: null
			};
		});

		this.hono = new Hono<Env>();
		this.hono
			.get('/scrape/:scrape', async (c) => {
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
						tweet.username === 'SimpsForLucy'
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
					await this.state.storage.put('tweets', this.tweets);
					await this.state.storage.put('scrapeCursors', this.scrapeCursors);
				}

				return new Response(null, { status: 204 });
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
				searchParams.set('tweet.fields', 'public_metrics');
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
				await this.state.storage.put('tweets', this.tweets);

				return new Response(null, { status: 204 });
			})
			.get('/replies', async (c) => {
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
							messages.push({ role: 'user' as const, content: c.text });
						} else {
							messages.push({ role: 'assistant' as const, content: `${c.author}: ${c.text}` });
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
						...messages,
						{
							role: 'system' as const,
							content: `In order to properly generate tweets, I need to know what categories and projects are relevant for the tweet.
							
							Output as a JSON array of objects with the following fields:
							- categories: string array of categories selected from given list. You can only select these categories: ${KnowledgeCategory.options.join(', ')}
							- projects: string array of project ids selected from given list. You can only select these projects: ${projectIds.replace(/,/g, ', ')}`
						},
						{
							role: 'system' as const,
							content: `You also know following things about Juicy Lucy:\n\n${JLU_KNOWLEDGE}`
						}
					];

					const openai = new OpenAI({
						apiKey: c.env.OPENAI_API_KEY
					});
					const knowledgeRes = await openai.beta.chat.completions.parse({
						model: 'gpt-4o',
						messages: knowledgeMessages,
						response_format: zodResponseFormat(
							z.object({
								categories: z.array(KnowledgeCategory),
								projects: z.array(z.string())
							}),
							'knowledge_pieces'
						)
					});
					if (!knowledgeRes || !knowledgeRes.choices[0].message.parsed) {
						console.error('Failed to generate scheduled tweet');
						return c.json({ error: 'Failed to generate scheduled tweet' }, 500);
					}
					console.log('[usage]', knowledgeRes.usage);
					const knowledgePieces = knowledgeRes.choices[0].message.parsed;
					console.log('[knowledgePieces]', JSON.stringify(knowledgePieces, null, 2));

					const categories = (
						await Promise.all(
							knowledgePieces.categories.map(async (category) => {
								const list = await this.env.KV.list({ prefix: `knowledge:category:${category}:` });
								const values = await Promise.all(
									Array.from(list.keys).map(
										async (item) => this.env.KV.get(item.name) as Promise<string>
									)
								);
								if (values.length === 0) {
									return '';
								}
								return `${category}:\n${values.map((val) => `- ${val}`).join('\n')}`;
							})
						)
					).join('\n\n');

					const projects = (
						await Promise.all(
							knowledgePieces.projects.map(async (project) => {
								const list = await this.env.KV.list({ prefix: `knowledge:project:${project}:` });
								const values = await Promise.all(
									Array.from(list.keys).map(
										async (item) => this.env.KV.get(item.name) as Promise<string>
									)
								);
								if (values.length === 0) {
									return '';
								}
								return `${project}:\n${values.map((val) => `- ${val}`).join('\n')}`;
							})
						)
					).join('\n\n');

					messages.push({
						role: 'system' as const,
						content: `You know following things, that might be relevant for the tweet. You might consider shilling some of your knowledge. You have Twitter Premium, so you can tweet up to 4000 characters, but 280 character tweets are preferred.\n\n${categories}\n\n${projects}`
					});

					const res = await fetch(`${c.env.CEREBRAS_API_URL}/v1/chat/completions`, {
						method: 'POST',
						headers: {
							Authorization: `Bearer ${c.env.CEREBRAS_API_KEY}`,
							'Content-Type': 'application/json',
							'User-Agent': 'SimpsForLucy'
						},
						body: JSON.stringify({
							model: 'llama-3.3-70b',
							messages,
							response_format: { type: 'json_object' }
						})
					});
					if (!res.ok) {
						console.error(
							`[chat] Failed to evaluate conversation [${res.status}]: ${await res.text()}`
						);
						return c.json({ error: `Failed to evaluate conversation [${res.status}]` }, 500);
					}
					const completion = await res.json<OpenAIResponse>();

					const rawResponse = JSON.parse(completion.choices[0].message.content || '{}');
					const parseResult = LucyResponse.safeParse(rawResponse);

					if (!parseResult.success) {
						return new Response(null, { status: 500 });
					}
					console.log('[parseResult]', JSON.stringify(parseResult.data, null, 2));

					tweet.lucyTweets = parseResult.data.tweets;
					tweet.generateImage = parseResult.data.generate_image;
					tweet.imagePrompt = parseResult.data.image_prompt;
					tweet.outfit = parseResult.data.outfit;
					tweet.hairstyle = parseResult.data.hairstyle;
					await this.state.storage.put('tweets', this.tweets);
					console.log('[lucy tweets]', tweet.lucyTweets);
					console.log('[generate_image]', tweet.generateImage);
					console.log('[image prompt]', tweet.imagePrompt);
					console.log('[outfit]', tweet.outfit);
					console.log('[hairstyle]', tweet.hairstyle);

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
						const previousGenRes = await fetch(
							`https://cloud.leonardo.ai/api/rest/v1/generations/user/${leoUserId}?offset=0&limit=500`,
							{
								headers: {
									Authorization: `Bearer ${this.env.LEONARDO_API_KEY}`,
									Accept: 'application/json'
								}
							}
						);
						const { generations: allGenerations } = await previousGenRes.json<{
							generations: {
								id: string;
								status: string;
								sdVersion: string;
								scheduler: string;
								presetStyle: string;
								modelId: string;
								generated_images: { id: string; url: string }[];
							}[];
						}>();
						const generations = allGenerations.filter(
							(gen) =>
								gen.status === 'COMPLETE' &&
								gen.sdVersion === 'SDXL_LIGHTNING' &&
								gen.scheduler === 'LEONARDO' &&
								gen.presetStyle === 'DYNAMIC' &&
								gen.modelId === 'e71a1c2f-4f80-4800-934f-2c68979d8cc8'
						);
						const generation = generations[Math.floor(Math.random() * generations.length)];

						if (!generation) {
							console.error('No generation found');
							return c.json({ error: 'No generation found' }, 500);
						}

						tweet.imageGenerationId = generation.id;
						tweet.imageUrl = generation.generated_images[0].url;
						await this.state.storage.put('tweets', this.tweets);
						console.log('[tweet.imageGenerationId]', tweet.imageGenerationId);
						console.log('[tweet.imageUrl]', tweet.imageUrl);
						return new Response(null, { status: 204 });
					}

					console.log('[generating image]');
					const res = await generateImage(
						`female asian character, short dark purple hair, green eyes, realistic and curvy figure - ${OutfitPrompt[tweet.outfit]['warm']} - ${HairstylePrompt[tweet.hairstyle]} - ${tweet.imagePrompt} - highly detailed linework, soft shading, ultra-realistic anime art style with vibrant highlights and smooth gradients`,
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
					await this.state.storage.put('tweets', this.tweets);
					console.log('[tweet.imageGenerationId]', tweet.imageGenerationId);

					return new Response(null, { status: 204 });
				}

				if (tweet.imageUrl == null) {
					console.log('[fetching image]');
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
					const {
						generations_by_pk: { generated_images }
					} = await res.json<{ generations_by_pk: { generated_images: { url: string }[] } }>();
					if (!generated_images || generated_images.length === 0) {
						console.error('Failed to generate image');
						return c.json({ error: 'Failed to generate image' }, 500);
					}

					tweet.imageUrl = generated_images[0].url;
					await this.state.storage.put('tweets', this.tweets);
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
						const tweetResponse = await scraper.sendTweet(
							tweetData.text,
							tweetData.reply?.in_reply_to_tweet_id,
							tweetData.media ? [tweetData.media] : undefined
						);

						if (!tweetResponse.ok) {
							console.error(
								'Failed to send tweet',
								tweetResponse.status,
								await tweetResponse.text()
							);
							this.tweets.splice(0, 1);
							await this.state.storage.put('tweets', this.tweets);
							return c.json({ error: 'Failed to send tweet' }, 500);
						}

						const json = await tweetResponse.json<{
							data?: { create_tweet: { tweet_results: { result: { rest_id: string } } } };
							errors?: unknown;
						}>();
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
				await this.state.storage.put('tweets', this.tweets);

				return new Response(null, { status: 204 });
			});
	}

	async fetch(request: Request): Promise<Response> {
		return this.hono.fetch(request, this.env);
	}
}
