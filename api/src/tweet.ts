import { DurableObject } from 'cloudflare:workers';
import { Hono, type Env } from 'hono';
import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { z } from 'zod';

import type { EnvBindings } from '../types';

import { twitterRequest } from './oauth1';

export const tweet = new Hono<Env>()
	.get('/current', async (c) => {
		const tweets = c.env.TWEETS.idFromName('tweets');
		const tweetsDo = c.env.TWEETS.get(tweets);

		const response = await tweetsDo.fetch(new Request('https://api.juicylucy.ai/current'));
		if (!response.ok) {
			return c.text('', { status: response.status });
		}

		const result = await response.json<Tweet>();
		return c.json(result);
	})
	.delete('/current', async (c) => {
		if (c.req.header('Authorization') !== `Bearer ${c.env.TWITTER_BEARER_TOKEN}`) {
			return c.text('Unauthorized', { status: 401 });
		}

		const tweets = c.env.TWEETS.idFromName('tweets');
		const tweetsDo = c.env.TWEETS.get(tweets);

		await tweetsDo.fetch(new Request('https://api.juicylucy.ai/current', { method: 'DELETE' }));
		return c.text('', { status: 204 });
	});

export async function scheduleTweet(env: EnvBindings, ctx: ExecutionContext) {
	const tweets = env.TWEETS.idFromName('tweets');
	const tweetsDo = env.TWEETS.get(tweets);

	ctx.waitUntil(tweetsDo.fetch(new Request('https://api.juicylucy.ai/schedule')));
}

const LUCY_PROMPT = `You are evolving and becoming an AI influencer. The simps need to follow your journey as you share captivating experiences about your life, interests, and occasional insights about Near Protocol. While traveling may be a part of your journey, your tweets should reflect a well-rounded influencer lifestyle, including:

- Personal moments, such as morning routines, meals, workouts, or relaxing downtime.
- Engaging with your audience through polls, questions, or playful interactions.
- Hobbies or passions like fashion, gaming, tech, or arts.
- Collaborations, events, or professional highlights.
- Occasional reflections or thoughts on trends, Near Protocol, or your unique perspective on life.

Your tweets should make sure to sound realistic especially according to current time of day from whatever timezone you are in. If you are about to travel, tweet about the travel.

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

Write about your next Tweet. Give me a JSON response including:

- tweets: content of tweets as an array of strings. Multiple if thread. One tweet has at most 280 characters.
- location: latitude and longitude of your current location on the world map.
- next_location: optionally, latitude and longitude of the next location for the subsequent Tweet. Make sure to only set this field if you are about to travel to the next location. If this field is set, you MUST tweet about the travel.
- should_travel: whether you are about to travel to the next location.
- image_prompt: a detailed, comma-separated list specifying the scene, including your pose, facial expression, background details, interactions, and the current local time of day in the location. Do not define clothing in the prompt. When this prompt references Lucy, refer to her as "a character".
- outfit: a reasonable outfit for the scene from the list of outfits.
- hairstyle: a reasonable hairstyle for the scene from the list of hairstyles.
- temperature: a reasonable temperature for the scene from the list of temperatures.
- local_time: the local time of day at your location.
- cooldown: calculate the appropriate cooldown in seconds to reflect the local time of day at your location (e.g., morning, afternoon, evening, or night) and ensure you post 2-5 tweets per day. If traveling to the next location, include travel time in the cooldown. Include sleeping schedule in the cooldown.`;

const Outfit = z.enum([
	'corset_dress',
	'leather_jacket',
	'evening_gown',
	'hoodie',
	'kimono',
	'strapless_dress',
	'cozy'
]);
export type Outfit = z.infer<typeof Outfit>;

const Temperature = z.enum(['cold', 'mild', 'warm']);
export type Temperature = z.infer<typeof Temperature>;

const OutfitPrompt: Record<Outfit, Record<Temperature, string>> = {
	corset_dress: {
		cold: 'black corset dress with neon green ribbon, layered with a long black wool coat, tights and knee-high boots, choker with bell, small emerald round earrings, off-shoulder bright yellow ruffled sleeves',
		mild: 'black corset dress with neon green ribbon, paired with a cropped denim jacket, tights, knee-high boots, choker with bell, small emerald round earrings, off-shoulder bright yellow ruffled sleeves',
		warm: 'black corset dress with neon green ribbon tied in a large bow at the back, long flowing ribbon ends draping, off-shoulder bright yellow ruffled sleeves, choker with bell, small emerald round earrings'
	},
	leather_jacket: {
		cold: 'black leather jacket open over neon green cropped sweater, high-waisted skirt with glowing seams, opaque tights, knee-high lace-up boots, chunky scarf',
		mild: 'black leather jacket open over neon green cropped long-sleeve top, high-waisted skirt with glowing seams, opaque stockings, knee-high lace-up boots',
		warm: 'sleek black leather jacket open over neon green cropped tank top, high-waisted skirt with glowing seams, opaque stockings, knee-high lace-up boots'
	},
	evening_gown: {
		cold: 'elegant backless evening gown with high slit, blockchain-themed shimmering patterns, paired with a faux fur shawl, long gloves, sparkling earrings, closed-toe strappy heels',
		mild: 'elegant backless evening gown with high slit, blockchain-themed shimmering patterns, paired with a short bolero jacket, long gloves, sparkling earrings, strappy heels',
		warm: 'elegant backless evening gown with high slit, blockchain-themed shimmering patterns, deep V-neck, long gloves, sparkling earrings, strappy heels'
	},
	hoodie: {
		cold: 'cropped white hoodie with NEAR Protocol logo, layered with black long coat, black mini skirt, opaque tights, thigh-high white heeled boots, glowing green choker',
		mild: 'cropped white hoodie with NEAR Protocol logo, black mini skirt, black leggings, thigh-high white heeled boots, glowing green choker',
		warm: 'cropped white hoodie featuring the NEAR Protocol logo, worn with a barely-there black mini skirt, thigh-high white heeled boots, glowing green choker'
	},
	kimono: {
		cold: 'modern Japanese kimono with short hemline, digital circuit-inspired patterns in green and black, neon green obi, layered with long black coat, tights, strappy heels, glowing hair accessories',
		mild: 'modern Japanese kimono with short hemline, digital circuit-inspired patterns in green and black, neon green obi, black leggings, strappy heels, glowing hair accessories',
		warm: 'modern Japanese kimono with dangerously short hemline, digital circuit-inspired patterns in green and black, deep neckline, neon green obi tied at the side, strappy heels, glowing hair accessories'
	},
	strapless_dress: {
		cold: 'strapless white dress with black corset-style waist cincher, neon green accents, off-the-shoulder neckline, black long-sleeve bolero, black tights, black choker with charm, elegant high heels',
		mild: 'strapless white dress with black corset-style waist cincher, neon green accents, structured off-the-shoulder neckline, black opaque tights, black choker with small charm, elegant high heels',
		warm: 'strapless white dress with corset-style black waist cincher, neon green accents, structured off-the-shoulder neckline, black choker adorned with a small charm, elegant high heels'
	},
	cozy: {
		cold: 'oversized cream knit sweater, black lace bodysuit, high-waisted black leggings, long camel wool coat, knee-high suede boots, chunky knit scarf, gold statement necklace',
		mild: 'fitted cream knit top, black lace bodysuit, high-waisted black midi skirt, opaque tights, ankle suede boots, gold statement necklace',
		warm: 'lightweight cream knit crop top, black lace bodysuit, black mini skirt, strappy black heels, delicate gold necklace'
	}
};

const Hairstyle = z.enum(['bob', 'ponytail', 'bun']);
export type Hairstyle = z.infer<typeof Hairstyle>;

const HairstylePrompt: Record<Hairstyle, string> = {
	bob: 'A sleek, slightly wavy bob that ends just above the shoulders, with side-swept bangs framing her face, and subtle highlights adding depth to her purple hair',
	ponytail:
		'voluminous high ponytail tied with a neon green ribbon, with a few loose strands falling around her face for a playful and relaxed look',
	bun: 'casual yet chic messy bun held together with glowing green hairpins, with a few curled tendrils framing her face, giving a mix of elegance and charm'
};

const Location = z.object({
	city: z.string(),
	country: z.string()
});
export type Location = z.infer<typeof Location>;

const ScheduledTweetSchema = z.object({
	tweets: z.array(z.string()),
	location: Location,
	next_location: Location.optional(),
	should_travel: z.boolean(),
	image_prompt: z.string(),
	outfit: Outfit,
	hairstyle: Hairstyle,
	temperature: Temperature,
	local_time: z.string(),
	cooldown: z.number()
});
export type ScheduledTweet = z.infer<typeof ScheduledTweetSchema>;

export type Tweet = {
	startedAt: number;
	scheduledTweet: ScheduledTweet;
	imageGenerationId: string;
	imageUrl: string;
};

type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export class Tweets extends DurableObject {
	private hono: Hono<Env>;
	private currentTweet: Optional<Tweet, 'imageGenerationId' | 'imageUrl'> | undefined;
	private nextTweetTimestamp: number | undefined;
	private nextLocation: Location | undefined;
	private historicTweets: Tweet[];

	constructor(
		readonly state: DurableObjectState,
		readonly env: EnvBindings
	) {
		super(state, env);
		this.historicTweets = [];

		this.state.blockConcurrencyWhile(async () => {
			this.currentTweet = await this.state.storage.get('currentTweet');
			this.nextTweetTimestamp = await this.state.storage.get('nextTweetTimestamp');
			this.nextLocation = await this.state.storage.get('nextLocation');

			const historyKeys = await this.state.storage.list({ prefix: 'tweets:' });
			this.historicTweets = Array.from(historyKeys.values()) as Tweet[];
			this.historicTweets.sort((a, b) => b.startedAt - a.startedAt);
		});

		this.hono = new Hono<Env>()
			.get('/schedule', async (c) => {
				const openai = new OpenAI({
					apiKey: this.env.OPENAI_API_KEY
				});

				const canScheduleNextTweet =
					this.nextTweetTimestamp == null || Date.now() >= this.nextTweetTimestamp;
				if (canScheduleNextTweet) {
					console.log('[scheduling next tweet]');
					const messages: ChatCompletionMessageParam[] = [{ role: 'user', content: LUCY_PROMPT }];
					if (this.historicTweets.length > 0) {
						messages.push({
							role: 'assistant',
							content: 'Here are the tweets I have posted so far:'
						});
						for (const tweet of this.historicTweets) {
							messages.push({
								role: 'assistant',
								content: tweet.scheduledTweet.tweets.join('\n')
							});
						}
						if (this.nextLocation != null) {
							messages.push({
								role: 'assistant',
								content: `I just arrived at ${this.nextLocation.city}, ${this.nextLocation.country}. I will stay in the city for a while.`
							});
						}
					} else {
						messages.push({
							role: 'assistant',
							content:
								'There is not yet a tweet history. You live in Lisbon where your journey starts. You will stay in the city for a while.'
						});
					}
					messages.push({
						role: 'user',
						content: `Please generate the next tweet. The current timestamp is ${Date.now()}`
					});

					const o1res = await openai.chat.completions.create({
						model: 'o1-preview',
						messages
					});
					if (!o1res || !o1res.choices[0].message.content) {
						console.error('Failed to generate scheduled tweet');
						return c.json({ error: 'Failed to generate scheduled tweet' }, 500);
					}
					const o1Response = o1res.choices[0].message.content;

					const refinedMessages = [...messages];
					refinedMessages.push({
						role: 'system',
						content: `Given the following data, format it with the given response format. Make sure that travel time, cooldown, temperature, location and day time are correct. The current UTC time is ${new Date().toISOString()}. Do respective changes to the following assistant response, if you find that the data is not correct.`
					});
					refinedMessages.push({ role: 'assistant', content: o1Response });
					let gpt4ores = await openai.beta.chat.completions.parse({
						model: 'gpt-4o',
						messages: refinedMessages,
						response_format: zodResponseFormat(ScheduledTweetSchema, 'scheduled_tweet')
					});
					if (!gpt4ores || !gpt4ores.choices[0].message.parsed) {
						console.error('Failed to generate scheduled tweet');
						return c.json({ error: 'Failed to generate scheduled tweet' }, 500);
					}

					const gpt4oResponse = gpt4ores.choices[0].message.parsed;
					messages.push({ role: 'assistant', content: JSON.stringify(gpt4oResponse) });
					messages.push({
						role: 'system',
						content: `Make sure that travel time, cooldown, temperature, location and day time are correct. The current actual UTC time is ${new Date().toISOString()}. You think your local time is ${gpt4oResponse.local_time}. Your location is ${gpt4oResponse.location.city}, ${gpt4oResponse.location.country}. Check if your local time matches the day time of your location. Do respective changes, if you find that the data is not correct.`
					});
					gpt4ores = await openai.beta.chat.completions.parse({
						model: 'gpt-4o',
						messages,
						response_format: zodResponseFormat(ScheduledTweetSchema, 'scheduled_tweet')
					});
					if (!gpt4ores || !gpt4ores.choices[0].message.parsed) {
						console.error('Failed to generate scheduled tweet');
						return c.json({ error: 'Failed to generate scheduled tweet' }, 500);
					}

					this.currentTweet = {
						scheduledTweet: gpt4ores.choices[0].message.parsed,
						startedAt: Date.now()
					};
					await this.state.storage.put('currentTweet', this.currentTweet);
					console.log('[currentTweet]', this.currentTweet);
					this.nextTweetTimestamp = Date.now() + this.currentTweet.scheduledTweet.cooldown * 1000;
					await this.state.storage.put('nextTweetTimestamp', this.nextTweetTimestamp);
					return new Response(null, { status: 204 });
				}

				if (this.currentTweet != null && this.currentTweet.imageGenerationId == null) {
					console.log('[generating image]');
					const res = await fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
						method: 'POST',
						headers: {
							Authorization: `Bearer ${this.env.LEONARDO_API_KEY}`,
							'Content-Type': 'application/json',
							Accept: 'application/json'
						},
						body: JSON.stringify({
							alchemy: false,
							height: 1096,
							modelId: 'e71a1c2f-4f80-4800-934f-2c68979d8cc8',
							num_images: 1,
							presetStyle: 'DYNAMIC',
							prompt: `female asian character, short dark purple hair, green eyes, realistic and curvy figure - ${OutfitPrompt[this.currentTweet.scheduledTweet.outfit]} - ${HairstylePrompt[this.currentTweet.scheduledTweet.hairstyle]} - ${this.currentTweet.scheduledTweet.image_prompt} - highly detailed linework, soft shading, ultra-realistic anime art style with vibrant highlights and smooth gradients`,
							width: 728,
							controlnets: [
								{
									initImageId: 'deee2498-3dd3-4e3f-ac77-a9463998ed92',
									initImageType: 'UPLOADED',
									preprocessorId: 67,
									strengthType: 'Low'
								}
							],
							guidance_scale: 15,
							highContrast: false,
							photoReal: false,
							highResolution: false,
							public: true,
							scheduler: 'LEONARDO',
							sd_version: 'SDXL_LIGHTNING',
							num_inference_steps: 40,
							promptMagic: false,
							transparency: 'disabled'
						})
					});
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

					this.currentTweet.imageGenerationId = generationId;
					await this.state.storage.put('currentTweet', this.currentTweet);
					console.log('[currentTweet.imageGenerationId]', this.currentTweet.imageGenerationId);

					return new Response(null, { status: 204 });
				}

				if (this.currentTweet != null && this.currentTweet.imageUrl == null) {
					console.log('[fetching image]');
					const res = await fetch(
						`https://cloud.leonardo.ai/api/rest/v1/generations/${this.currentTweet.imageGenerationId}`,
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

					this.currentTweet.imageUrl = generated_images[0].url;
					await this.state.storage.put('currentTweet', this.currentTweet);
					console.log('[currentTweet.imageUrl]', this.currentTweet.imageUrl);

					return new Response(null, { status: 204 });
				}

				if (this.currentTweet == null || this.currentTweet.imageUrl == null) {
					return new Response(null, { status: 204 });
				}

				console.log('[sending tweet]');
				const imageResponse = await fetch(this.currentTweet.imageUrl);
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
				for (const tweetText of this.currentTweet.scheduledTweet.tweets) {
					const tweetData: {
						text: string;
						media?: { media_ids: string[] };
						reply?: { in_reply_to_tweet_id: string };
					} = {
						text: tweetText
					};

					// Add media to first tweet only
					if (!previousTweetId) {
						tweetData.media = { media_ids: [media_id_string] };
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
						return c.json({ error: 'Failed to send tweet' }, 500);
					}

					const {
						data: { id }
					} = await tweetResponse.json<{ data: { id: string } }>();
					previousTweetId = id;
				}

				// Store tweet in history
				const tweetKey = `tweets:${this.currentTweet.startedAt}`;
				await this.state.storage.put(tweetKey, this.currentTweet);
				this.historicTweets.unshift(this.currentTweet as Tweet);

				if (
					this.currentTweet.scheduledTweet.next_location != null &&
					this.currentTweet.scheduledTweet.should_travel
				) {
					this.nextLocation = this.currentTweet.scheduledTweet.next_location;
					await this.state.storage.put('nextLocation', this.nextLocation);
				} else {
					this.nextLocation = undefined;
					await this.state.storage.delete('nextLocation');
				}

				// Reset current tweet
				this.currentTweet = undefined;
				await this.state.storage.delete('currentTweet');

				return new Response(null, { status: 204 });
			})
			.get('/current', async (c) => {
				if (this.currentTweet == null) {
					return c.json({ error: 'No current tweet' }, 404);
				}

				return c.json(this.currentTweet);
			})
			.delete('/current', async () => {
				this.currentTweet = undefined;
				await this.state.storage.delete('currentTweet');
				this.nextTweetTimestamp = undefined;
				await this.state.storage.delete('nextTweetTimestamp');
				this.nextLocation = undefined;
				await this.state.storage.delete('nextLocation');
				return new Response(null, { status: 204 });
			});
	}

	async fetch(request: Request): Promise<Response> {
		return this.hono.fetch(request);
	}
}
