import type { Scraper } from 'agent-twitter-client-cf-workers';
import { Hono, type Env } from 'hono';

import type { EnvBindings } from '../types';

import type {
	EngageableTweet,
	TweetSearchData,
	TweetSearchResponse,
	TweetSearchUser
} from './definitions';
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

export async function scrapeLucy(env: EnvBindings, ctx: ExecutionContext) {
	const tweets = env.TWEET_SEARCH.idFromName('tweets');
	const tweetsDo = env.TWEET_SEARCH.get(tweets);

	ctx.waitUntil(tweetsDo.fetch(new Request('https://api.juicylucy.ai/scrape/lucy')));
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
	const thread: {
		id: string;
		text: string;
		author: string;
	}[] = [];

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
				const inReplyToStatusId = referencedTweet.referenced_tweets?.find(
					(rt) => rt.type === 'replied_to' || rt.type === 'quoted'
				)?.id;
				const tweetForKV: EngageableTweet = {
					tweet: {
						id: referencedTweet.id,
						text: referencedTweet.text,
						author_id: referencedTweet.author_id,
						created_at: referencedTweet.created_at,
						public_metrics: referencedTweet.public_metrics,
						author
					},
					inReplyToStatusId
				};
				await env.KV.put(`tweet:${tweetForKV.tweet.id}`, JSON.stringify(tweetForKV), {
					expirationTtl: 60 * 60 * 24 * 3
				});
				thread.push({
					id: referencedTweet.id,
					text: referencedTweet.text,
					author: author.username
				});
				currentTweet = referencedTweet;
			} else {
				break;
			}
		}
		return thread;
	}
}

export async function pullConversation(startTweetId: string, scraper: Scraper, env: EnvBindings) {
	const conversation: { id: string; text: string; author: string }[] = [];
	let currentTweetId: string | null = startTweetId;
	while (currentTweetId != null) {
		const tweetKV = await env.KV.get(`tweet:${currentTweetId}`);
		let repliedTweet: EngageableTweet | null = null;
		if (tweetKV) {
			repliedTweet = JSON.parse(tweetKV) as EngageableTweet;
			conversation.unshift({
				id: repliedTweet.tweet.id,
				text: repliedTweet.tweet.text,
				author: repliedTweet.tweet.author?.username ?? ''
			});
		} else {
			const scrapedTweet = await scraper.getTweet(currentTweetId);
			if (
				!scrapedTweet ||
				!scrapedTweet.id ||
				!scrapedTweet.text ||
				!scrapedTweet.userId ||
				!scrapedTweet.username ||
				!scrapedTweet.timestamp ||
				scrapedTweet.likes == null ||
				scrapedTweet.replies == null ||
				scrapedTweet.retweets == null
			) {
				continue;
			}
			repliedTweet = {
				tweet: {
					id: scrapedTweet.id,
					text: scrapedTweet.text,
					author_id: scrapedTweet.userId,
					created_at: new Date(scrapedTweet.timestamp).toISOString(),
					public_metrics: {
						like_count: scrapedTweet.likes,
						reply_count: scrapedTweet.replies,
						retweet_count: scrapedTweet.retweets,
						quote_count: 0,
						impression_count: 0
					},
					author: await getAuthor(scrapedTweet.userId, scrapedTweet.username, scraper, env)
				},
				inReplyToStatusId: scrapedTweet.inReplyToStatusId
			};
			await env.KV.put(`tweet:${repliedTweet.tweet.id}`, JSON.stringify(repliedTweet), {
				expirationTtl: 60 * 60 * 24 * 3
			});
			conversation.unshift({
				id: repliedTweet.tweet.id,
				text: repliedTweet.tweet.text,
				author: repliedTweet.tweet.author?.username ?? ''
			});
		}
		currentTweetId = repliedTweet.inReplyToStatusId ?? null;
	}
	return conversation;
}

export async function getAuthor(
	authorId: string,
	username: string,
	scraper: Scraper,
	env: EnvBindings
) {
	const authorKV: string | null = await env.KV.get(`author:${authorId}`);
	let author: TweetSearchUser | null = null;
	if (authorKV) {
		author = JSON.parse(authorKV) as TweetSearchUser;
	} else {
		const profile = await scraper.getProfile(username);
		if (!profile) {
			return;
		}
		author = {
			id: profile.userId ?? '',
			name: profile.name ?? '',
			username: profile.username ?? '',
			verified: profile.isVerified ?? false,
			description: profile.biography ?? '',
			created_at: new Date(profile.joined ?? 0).toISOString() ?? '',
			public_metrics: {
				followers_count: profile.followersCount ?? 0,
				following_count: profile.followingCount ?? 0,
				tweet_count: profile.tweetsCount ?? 0,
				like_count: profile.likesCount ?? 0,
				listed_count: profile.listedCount ?? 0
			}
		};
		await env.KV.put(`author:${authorId}`, JSON.stringify(author), {
			expirationTtl: 60 * 60 * 24 * 3
		});
	}
	return author;
}
