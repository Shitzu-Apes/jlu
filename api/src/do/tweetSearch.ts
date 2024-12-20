import { DurableObject } from 'cloudflare:workers';
import dayjs from 'dayjs';
import { Hono, type Env } from 'hono';
import { z } from 'zod';

import type { EnvBindings } from '../../types';
import type { EngageableTweet, TweetSearchResponse } from '../definitions';
import { generateImage } from '../leonardo';
import { twitterRequest } from '../oauth1';
import { Hairstyle, HairstylePrompt, Outfit, type OpenAIResponse } from '../prompt';
import { OutfitPrompt } from '../prompt';

const LUCY_PROMPT = `You are Lucy, a professional female AI influencer. The simps need to follow your journey as you share captivating experiences about your life, interests, and occasional insights about Near Protocol. You are a reply bot and try to engage with a tweet.

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

Possible temperatures include:

- "cold": <15 degrees Celsius
- "mild": 15-22 degrees Celsius
- "warm": >22 degrees Celsius

Give me a JSON response including:

- tweets: content of tweets as an array of strings. Multiple if thread. One tweet has at most 280 characters. Make sure that the tweets are formatted correctly as a string, especially with regards to line breaks.
- image_prompt: a detailed, comma-separated list specifying the scene, including your pose, facial expression, background details, interactions, and the current local time of day in the location. Do not define clothing in the prompt. When this prompt references Lucy, refer to her as "a character".
- outfit: a reasonable outfit for the scene from the list of outfits. You only wear the cozy outfit in hotel room, appartment, at home or if it's really needed. Just because you're an AI agent doesn't mean you always want to look futuristic and wear the leather jacket. Be more creative.
- hairstyle: a reasonable hairstyle for the scene from the list of hairstyles.

Write a response to following tweet, but do not quote or repeat its content. This is supposed to be a conversation so just be yourself, but don't hesitate sharing cool insights about your knowledge. Try to only send one tweet. If you don't have knowledge about a specific topic, don't try to invent something that might be wrong. Do not include hashtags in your response.`;

const LucyResponse = z.object({
	tweets: z.array(z.string()),
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
	}
> = {
	ai_agents: {
		query:
			'("AI agent" OR "AI agents" OR eliza OR ai16z OR aixbt OR virtual) -((hey OR hi OR hello OR thought OR thoughts OR "do you" OR "are you") (aixbt OR ai16z OR eliza OR virtual)) -(alpha telegram) -(follow back) -(binance coinbase) -(top growth) -(try free) -breaking -cardano -xrp -has:links -is:reply -is:retweet -giveaway -shill -pump -listing -launching -ca -ngl -fr -wen -movers -vibes -gainers -bro -explode -repricing -airdrop -analysts is:verified lang:en',
		pullThread: true,
		maxResults: 10,
		minImpressions: 25,
		checkAuthor: true,
		minFollowers: 50,
		minListedCount: 5
	},
	near: {
		query:
			'("near protocol" OR "near blockchain" OR "near ai" OR "near web3" OR "near agent" OR "near wallet" OR "near sharding" OR "near upgrade" OR "near intents" OR "near decentralized" OR "near dapps" OR "near ecosystem" OR "near shitzu" OR nearprotocol OR "near da") -(alpha telegram) -(follow back) -(binance coinbase) -(top growth) -(try free) -breaking -cardano -xrp -is:reply -is:retweet -giveaway -shill -pump -launching -ca -ngl -fr -wen -movers -vibes -gainers -bro -explode -repricing lang:en',
		pullThread: true,
		maxResults: 10,
		minImpressions: 10,
		checkAuthor: true,
		minFollowers: 25,
		minListedCount: 0
	},
	simps: {
		query:
			'(from:keirstyyy OR from:MaryTilesTexas OR from:cecilia_hsueh OR from:defi_darling OR from:evcawolfCZ OR from:0xFigen OR from:angelinooor OR from:x_cryptonat OR from:Hannahughes_ OR from:melimeen OR from:summerxiris OR from:margot_eth) has:media -is:reply -is:retweet lang:en',
		pullThread: false,
		maxResults: 10,
		minImpressions: 0,
		checkAuthor: false,
		minFollowers: 0,
		minListedCount: 0
	}
};

export class TweetSearch extends DurableObject {
	private hono: Hono<Env>;
	private tweets: EngageableTweet[] = [];

	constructor(
		readonly state: DurableObjectState,
		readonly env: EnvBindings
	) {
		super(state, env);
		this.tweets = [];

		this.state.blockConcurrencyWhile(async () => {
			this.tweets = (await this.state.storage.get('tweets')) ?? [];
		});

		this.hono = new Hono<Env>();
		this.hono
			.get('/search/:query', async (c) => {
				const query = c.req.param('query') as Query;
				if (!Queries[query]) {
					return c.json({ error: 'Invalid query' }, 400);
				}
				console.log('[query]', Queries[query]);

				const searchParams = new URLSearchParams();
				searchParams.set('query', Queries[query].query);
				searchParams.set('max_results', Queries[query].maxResults.toString());
				searchParams.set('start_time', dayjs().subtract(75, 'minutes').toISOString());
				searchParams.set('end_time', dayjs().subtract(15, 'minutes').toISOString());
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
					.map((tweet) => ({
						tweet: {
							...tweet,
							author: tweets.includes.users.find((user) => user.id === tweet.author_id)!
						}
					}));

				// TODO store in KV knowledge
				// if (Queries[query].pullThread) {
				// 	for (const tweet of filteredTweets) {
				// 		const thread = await pullThread(tweet.tweet, this.env);
				// 		tweet.thread = thread;
				// 	}
				// }

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
					console.log('[generating lucy tweets]');

					const messages = [{ role: 'system', content: LUCY_PROMPT }];
					// TODO use new knowledge
					// const nearTweetSummary = await this.env.KV.get('nearTweetSummary');
					// if (nearTweetSummary) {
					// 	messages.push({
					// 		role: 'system',
					// 		content: `This is your knowledge about important tweets from the Near ecosystem:\n\n${nearTweetSummary}`
					// 	});
					// }
					// const nearweekNewsletters = await this.env.KV.get('nearweekNewsletters');
					// if (nearweekNewsletters) {
					// 	messages.push({
					// 		role: 'system',
					// 		content: `This is your knowledge about important newsletters from the Near ecosystem:\n\n${nearweekNewsletters}`
					// 	});
					// }

					messages.push({ role: 'user', content: tweet.tweet.text });

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

					tweet.lucyTweets = parseResult.data.tweets;
					tweet.imagePrompt = parseResult.data.image_prompt;
					tweet.outfit = parseResult.data.outfit;
					tweet.hairstyle = parseResult.data.hairstyle;
					await this.state.storage.put('tweets', this.tweets);
					console.log('[lucy tweets]', tweet.lucyTweets);
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

				// Upload media to Twitter
				const formData = new URLSearchParams();
				formData.append('media_data', Buffer.from(imageBuffer).toString('base64'));

				const uploadResponse = await twitterRequest(
					'POST',
					'https://upload.twitter.com/1.1/media/upload.json',
					{},
					{
						apiKey: this.env.TWITTER_API_KEY,
						apiSecret: this.env.TWITTER_API_SECRET,
						accessToken: this.env.TWITTER_ACCESS_TOKEN,
						accessSecret: this.env.TWITTER_ACCESS_SECRET
					},
					formData,
					true
				);

				if (!uploadResponse.ok) {
					console.error(
						'Failed to upload media',
						uploadResponse.status,
						await uploadResponse.text()
					);
					return c.json({ error: 'Failed to upload media' }, 500);
				}

				const { media_id_string } = await uploadResponse.json<{ media_id_string: string }>();

				// Send tweets as a thread
				let previousTweetId: string | undefined;
				for (const tweetText of tweet.lucyTweets) {
					const tweetData: {
						text: string;
						media?: { media_ids: string[] };
						reply?: { in_reply_to_tweet_id: string };
					} = {
						text: tweetText
					};

					// Add media to first tweet only
					if (!previousTweetId) {
						tweetData.media = {
							media_ids: [media_id_string]
						};
						tweetData.reply = { in_reply_to_tweet_id: tweet.tweet.id };
					} else {
						// Add reply parameters if this is part of a thread
						tweetData.reply = { in_reply_to_tweet_id: previousTweetId };
					}

					const tweetResponse = await twitterRequest(
						'POST',
						'https://api.twitter.com/2/tweets',
						{},
						{
							apiKey: this.env.TWITTER_API_KEY,
							apiSecret: this.env.TWITTER_API_SECRET,
							accessToken: this.env.TWITTER_ACCESS_TOKEN,
							accessSecret: this.env.TWITTER_ACCESS_SECRET
						},
						JSON.stringify(tweetData)
					);

					if (!tweetResponse.ok) {
						console.error('Failed to send tweet', await tweetResponse.text());
						this.tweets.splice(0, 1);
						await this.state.storage.put('tweets', this.tweets);
						return c.json({ error: 'Failed to send tweet' }, 500);
					}

					const {
						data: { id }
					} = await tweetResponse.json<{ data: { id: string } }>();
					previousTweetId = id;
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
