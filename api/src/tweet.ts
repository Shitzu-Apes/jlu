import { Hono, type Env } from 'hono';

import type { EnvBindings } from '../types';

import type { Tweet } from './do/tweets';

export const tweet = new Hono<Env>()
	.get('/history', async (c) => {
		const tweets = c.env.TWEETS.idFromName('tweets');
		const tweetsDo = c.env.TWEETS.get(tweets);

		const response = await tweetsDo.fetch(new Request('https://api.juicylucy.ai/history'));
		if (!response.ok) {
			return c.text('', { status: response.status });
		}

		const result = await response.json<Tweet>();
		return c.json(result);
	})
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
	.get('/next', async (c) => {
		const tweets = c.env.TWEETS.idFromName('tweets');
		const tweetsDo = c.env.TWEETS.get(tweets);

		const response = await tweetsDo.fetch(new Request('https://api.juicylucy.ai/next'));
		if (!response.ok) {
			return c.text('', { status: response.status });
		}

		const result = await response.json<Tweet>();
		return c.json(result);
	})
	.get('/schedule', async (c) => {
		const tweets = c.env.TWEETS.idFromName('tweets');
		const tweetsDo = c.env.TWEETS.get(tweets);

		const response = await tweetsDo.fetch(new Request('https://api.juicylucy.ai/schedule'));
		if (!response.ok) {
			return c.text('', { status: response.status });
		}

		const result = await response.json<Tweet>();
		return c.json(result);
	})
	.get('/next-location', async (c) => {
		const tweets = c.env.TWEETS.idFromName('tweets');
		const tweetsDo = c.env.TWEETS.get(tweets);

		const response = await tweetsDo.fetch(new Request('https://api.juicylucy.ai/next-location'));
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

export async function searchAiAgentsTweets(env: EnvBindings, ctx: ExecutionContext) {
	const tweets = env.TWEET_SEARCH.idFromName('tweets');
	const tweetsDo = env.TWEET_SEARCH.get(tweets);

	ctx.waitUntil(tweetsDo.fetch(new Request('https://api.juicylucy.ai/search/ai_agents')));
}

export async function processReplies(env: EnvBindings, ctx: ExecutionContext) {
	const tweets = env.TWEET_SEARCH.idFromName('tweets');
	const tweetsDo = env.TWEET_SEARCH.get(tweets);

	ctx.waitUntil(tweetsDo.fetch(new Request('https://api.juicylucy.ai/replies')));
}
