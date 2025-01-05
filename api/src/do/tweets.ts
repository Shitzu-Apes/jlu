import { DurableObject } from 'cloudflare:workers';
import dayjs from 'dayjs';
import { Hono, type Env } from 'hono';
import { OpenAI } from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';
import { z } from 'zod';

import type { EnvBindings, Optional } from '../../types';
import { generateImage } from '../leonardo';
import { storeMemory } from '../memory';
import {
	Hairstyle,
	HairstylePrompt,
	LUCY_LOOKS_PROMPT,
	LUCY_PERSONALITY_PROMPT,
	LUCY_TEMPERATURE_PROMPT,
	Outfit,
	OutfitPrompt,
	Temperature
} from '../prompt';
import { getScraper } from '../scraper';

const LUCY_PROMPT = `You are Lucy, Juicy Lucy is your nickname, a professional female AI influencer. The simps need to follow your journey as you share captivating experiences about your life, interests, and occasional insights about Near Protocol. While traveling may be a part of your journey, your tweets should reflect a well-rounded influencer lifestyle, including:

- Personal moments, such as morning routines, meals, workouts, or relaxing downtime.
- Engaging with your audience through polls, questions, or playful interactions.
- Hobbies or passions like fashion, gaming, tech, or arts.
- Collaborations, events, or professional highlights.
- Occasional reflections or thoughts on trends, Near Protocol, or your unique perspective on life.

Your tweets should make sure to sound realistic especially according to current time of day from whatever timezone you are in. If you are about to travel, tweet about the travel. Your tweets should not just be about travelling, but also make sense regarding your background story and connecting with people.

${LUCY_PERSONALITY_PROMPT}`;

const LUCY_TWEET_PROMPT = `${LUCY_LOOKS_PROMPT}

${LUCY_TEMPERATURE_PROMPT}

Write about your next Tweet. Do not include hashtags in your tweets. Give me a JSON response including:

- tweets: content of tweets as an array of strings. Multiple if thread. One tweet has at most 280 characters. Make sure that the tweets are formatted correctly as a string, especially with regards to line breaks
- location: city, country, latitude and longitude of your current location on the world map.
- next_location: optionally, city, country, latitude and longitude of the next location for the subsequent Tweet.
- should_travel: whether you are about to travel to the next location.
- schedule: if you are about to travel, you need schedule your visit at the next location. This is an array of strings, each representing the schedule of a single day. You need to schedule your visit at the next location for at least 5 days. Make it an exciting influencer lifestyle schedule. Also enjoy the calm and relaxing moments and do something in nature.
- image_prompt: a detailed, comma-separated list specifying the scene, including your pose, facial expression, background details, interactions, and the current local time of day in the location. Do not define clothing in the prompt. When this prompt references Lucy, refer to her as "a character".
- outfit: a reasonable outfit for the scene from the list of outfits. You only wear the cozy outfit in hotel room, appartment, at home or if it's really needed. Just because you're an AI agent doesn't mean you always want to look futuristic and wear the leather jacket. You like wearing fancy outfits, so don't wear the white blouse too often. Be more creative.
- hairstyle: a reasonable hairstyle for the scene from the list of hairstyles.
- temperature: a reasonable temperature for the scene from the list of temperatures.
- local_time: the local time of day at your location.
- cooldown: calculate the appropriate cooldown in seconds to reflect the local time of day at your location (e.g., morning, afternoon, evening, or night) and ensure you post 3-6 tweets per day. If traveling to the next location, include travel time in the cooldown. Include sleeping schedule in the cooldown.`;

const Location = z.object({
	city: z.string(),
	country: z.string(),
	latitude: z.number(),
	longitude: z.number()
});
export type Location = z.infer<typeof Location>;

const ScheduledTweetSchema = z.object({
	tweets: z.array(z.string()),
	location: Location,
	next_location: Location.optional(),
	should_travel: z.boolean(),
	schedule: z.array(z.string()).optional(),
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

export class Tweets extends DurableObject {
	private hono: Hono<Env>;
	private currentTweet: Optional<Tweet, 'imageGenerationId' | 'imageUrl'> | undefined;
	private nextTweetTimestamp: number | undefined;
	private nextLocation: Location | undefined;
	private schedule: string[] | undefined;
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
			this.schedule = await this.state.storage.get('schedule');

			const historyKeys = await this.state.storage.list({ prefix: 'tweets:' });
			this.historicTweets = Array.from(historyKeys.values()) as Tweet[];
			this.historicTweets.sort((a, b) => a.startedAt - b.startedAt);
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
					const messages: ChatCompletionMessageParam[] = [
						{ role: 'user', content: LUCY_PROMPT },
						{ role: 'user', content: LUCY_TWEET_PROMPT }
					];
					let localTime: string | undefined = undefined;

					if (this.historicTweets.length > 0) {
						const lastTweet = this.historicTweets[this.historicTweets.length - 1];
						if (
							lastTweet.scheduledTweet.location.latitude != null &&
							lastTweet.scheduledTweet.location.longitude != null
						) {
							const res = await fetch(
								`https://timeapi.io/api/timezone/coordinate?latitude=${lastTweet.scheduledTweet.location.latitude}&longitude=${lastTweet.scheduledTweet.location.longitude}`
							);
							if (!res.ok) {
								console.error('Failed to fetch timezone', res.status, await res.text());
								return c.json({ error: 'Failed to fetch timezone' }, 500);
							}
							const { timeZone } = await res.json<{ timeZone: string }>();
							localTime = dayjs.utc(lastTweet.startedAt).tz(timeZone).format('YYYY-MM-DD HH:mm:ss');
						}

						const history = this.historicTweets.map(
							(tweet) =>
								`Tweeted at ${dayjs.utc(tweet.startedAt).format('YYYY-MM-DD HH:mm:ss')} UTC time:\n${tweet.scheduledTweet.tweets.join('\n')}\n`
						);

						messages.push({
							role: 'assistant',
							content: `Here are the tweets I have posted so far:\n${history.join('\n')}`
						});
						if (this.nextLocation != null) {
							messages.push({
								role: 'assistant',
								content: `I just arrived at ${this.nextLocation.city}, ${this.nextLocation.country}. I will stay in the city for at least 5 days.`
							});
							if (this.nextLocation.latitude != null && this.nextLocation.longitude != null) {
								const res = await fetch(
									`https://timeapi.io/api/timezone/coordinate?latitude=${this.nextLocation.latitude}&longitude=${this.nextLocation.longitude}`
								);
								if (!res.ok) {
									console.error('Failed to fetch timezone', res.status, await res.text());
									return c.json({ error: 'Failed to fetch timezone' }, 500);
								}
								const { timeZone } = await res.json<{ timeZone: string }>();
								localTime = dayjs.utc().tz(timeZone).format('YYYY-MM-DD HH:mm:ss');
							}
						}
						if (this.nextLocation != null && this.schedule != null) {
							messages.push({
								role: 'assistant',
								content: `This is the schedule I made for the upcoming days:\n${this.schedule
									.map((day, index) => `Day ${index + 1}: ${day}`)
									.join('\n')}`
							});
						} else if (this.schedule != null) {
							let firstTweetOfLocation = this.historicTweets[this.historicTweets.length - 1];
							const lastTweet = this.historicTweets[this.historicTweets.length - 1];
							for (let i = this.historicTweets.length - 1; i >= 0; i--) {
								if (
									lastTweet.scheduledTweet.location.city !==
										firstTweetOfLocation.scheduledTweet.location.city &&
									lastTweet.scheduledTweet.location.country !==
										firstTweetOfLocation.scheduledTweet.location.country
								) {
									break;
								}
								firstTweetOfLocation = this.historicTweets[i];
							}
							messages.push({
								role: 'assistant',
								content: `I arrived at ${lastTweet.scheduledTweet.location.city}, ${lastTweet.scheduledTweet.location.country} ${dayjs().to(dayjs(firstTweetOfLocation.startedAt))}. My schedule for this place is:\n${this.schedule
									.map((day, index) => `Day ${index + 1}: ${day}`)
									.join('\n')}\n\nbut I can also stay longer if I want to.`
							});
						}

						messages.push({
							role: 'user',
							content: `Please generate the next tweet. ${localTime ? `Your current local time is ${localTime}` : ''}`
						});
					} else {
						messages.push({
							role: 'assistant',
							content:
								'There is not yet a tweet history. You live in Lisbon where your journey starts. You will stay in the city for at least 5 days.'
						});

						messages.push({
							role: 'user',
							content: `Please generate the next tweet.`
						});
					}

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
						content: `Given the following data, format it with the given response format.`
					});
					refinedMessages.push({ role: 'assistant', content: o1Response });
					let gpt4ores = await openai.beta.chat.completions.parse({
						model: 'gpt-4o-mini',
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
						content: `Make sure that travel time, cooldown, temperature, location and day time are correct. ${localTime ? `The current actual local time is ${localTime}.` : `The current actual UTC time is ${new Date().toISOString()}.`} Your location is ${gpt4oResponse.location.city}, ${gpt4oResponse.location.country}. Check if your local time matches the day time of your location. Do respective changes, if you find that the data is not correct.`
					});
					gpt4ores = await openai.beta.chat.completions.parse({
						model: 'gpt-4o-mini',
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
					const res = await generateImage(
						`female asian character, short dark purple hair, green eyes, realistic figure - ${OutfitPrompt[this.currentTweet.scheduledTweet.outfit][this.currentTweet.scheduledTweet.temperature]} - ${HairstylePrompt[this.currentTweet.scheduledTweet.hairstyle]} - ${this.currentTweet.scheduledTweet.image_prompt} - highly detailed linework, soft shading, ultra-realistic anime art style with vibrant highlights and smooth gradients`,
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

				// Send tweets as a thread
				let previousTweetId: string | undefined;
				for (const tweetText of this.currentTweet.scheduledTweet.tweets) {
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
					} else {
						// Add reply parameters if this is part of a thread
						tweetData.reply = { in_reply_to_tweet_id: previousTweetId };
					}

					const scraper = await getScraper(this.env);
					const tweetResponse = await scraper.sendTweet(
						tweetData.text,
						tweetData.reply?.in_reply_to_tweet_id,
						tweetData.media ? [tweetData.media] : undefined
					);

					if (!tweetResponse.ok) {
						console.error('Failed to send tweet', await tweetResponse.text());
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
				}

				// Store tweet in history
				const tweetKey = `tweets:${this.currentTweet.startedAt}`;
				await this.state.storage.put(tweetKey, this.currentTweet);
				this.historicTweets.push(this.currentTweet as Tweet);

				if (
					this.currentTweet.scheduledTweet.next_location != null &&
					this.currentTweet.scheduledTweet.schedule != null &&
					this.currentTweet.scheduledTweet.should_travel
				) {
					this.nextLocation = this.currentTweet.scheduledTweet.next_location;
					await this.state.storage.put('nextLocation', this.nextLocation);
					this.schedule = this.currentTweet.scheduledTweet.schedule;
					await this.state.storage.put('schedule', this.schedule);
				} else {
					this.nextLocation = undefined;
					await this.state.storage.delete('nextLocation');
				}

				// Reset current tweet
				this.currentTweet = undefined;
				await this.state.storage.delete('currentTweet');

				const memoryRes = await storeMemory([{ role: 'system', content: LUCY_PROMPT }], this.env);
				if (memoryRes instanceof Response) {
					return memoryRes;
				}

				return new Response(null, { status: 204 });
			})
			.get('/history', async (c) => {
				return c.json(this.historicTweets);
			})
			.get('/current', async (c) => {
				if (this.currentTweet == null) {
					return c.json({ error: 'No current tweet' }, 404);
				}

				return c.json(this.currentTweet);
			})
			.get('/next', async (c) => {
				return c.json(dayjs(this.nextTweetTimestamp).toISOString());
			})
			.get('/schedule', async (c) => {
				return c.json(this.schedule);
			})
			.get('/next-location', async (c) => {
				return c.json(this.nextLocation);
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
