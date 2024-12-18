import { Hono, type Env } from 'hono';

import type { EnvBindings } from '../types';

import type { Tweet } from './do/tweets';
import type { TweetSearchData, TweetSearchResponse } from './tweet_types';

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

export async function searchNearTweets(env: EnvBindings, ctx: ExecutionContext) {
	const tweets = env.TWEET_SEARCH.idFromName('tweets');
	const tweetsDo = env.TWEET_SEARCH.get(tweets);

	ctx.waitUntil(tweetsDo.fetch(new Request('https://api.juicylucy.ai/search/near')));
}

export async function searchSimpsTweets(env: EnvBindings, ctx: ExecutionContext) {
	const tweets = env.TWEET_SEARCH.idFromName('tweets');
	const tweetsDo = env.TWEET_SEARCH.get(tweets);

	ctx.waitUntil(tweetsDo.fetch(new Request('https://api.juicylucy.ai/search/simps')));
}

export async function processReplies(env: EnvBindings, ctx: ExecutionContext) {
	const tweets = env.TWEET_SEARCH.idFromName('tweets');
	const tweetsDo = env.TWEET_SEARCH.get(tweets);

	ctx.waitUntil(tweetsDo.fetch(new Request('https://api.juicylucy.ai/replies')));
}

export async function pullThread(tweet: TweetSearchData, env: EnvBindings) {
	const searchParams = new URLSearchParams();
	searchParams.set('query', `conversation_id:${tweet.id} from:${tweet.author_id}`);
	searchParams.set('max_results', '100');
	searchParams.set('tweet.fields', 'referenced_tweets');
	searchParams.set('expansions', 'author_id');
	const res = await fetch(`https://api.x.com/2/tweets/search/recent?${searchParams.toString()}`, {
		headers: {
			Authorization: `Bearer ${env.TWITTER_BEARER_TOKEN}`
		}
	});

	const tweets = await res.json<TweetSearchResponse>();
	const thread: TweetSearchData[] = [];

	let currentTweet: TweetSearchData = tweet;
	if (tweets.data != null) {
		while (tweets.data.length > 0) {
			const referencedTweet = tweets.data.find((t) =>
				t.referenced_tweets?.find((rt) => rt.type === 'replied_to' && rt.id === currentTweet.id)
			);
			if (referencedTweet != null) {
				const author = tweets.includes.users.find((user) => user.id === tweet.author_id);
				if (author == null) {
					break;
				}
				thread.push(referencedTweet);
				currentTweet = referencedTweet;
			} else {
				break;
			}
		}
		return thread;
	}
}
