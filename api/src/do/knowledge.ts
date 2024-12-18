import { DurableObject } from 'cloudflare:workers';
import { Hono } from 'hono';
import type { Env } from 'hono';
import { Parser } from 'htmlparser2';
import { z } from 'zod';

import type { EnvBindings } from '../../types';
import type { OpenAIResponse } from '../prompt';

type TweetKnowledge = {
	id: string;
	text: string;
	author_id: string;
	created_at: string;
};

const NearweekNewsletterResponse = z.object({
	summary: z.array(z.string()),
	date: z.string()
});
type NearweekNewsletterResponse = z.infer<typeof NearweekNewsletterResponse>;

type NearweekNewsletter = {
	link: string;
} & NearweekNewsletterResponse;

export class Knowledge extends DurableObject {
	private hono: Hono<Env>;
	private nearTweetKnowledge: TweetKnowledge[] = [];
	private nearTweetSummary: string = '';
	private nearTweetLatestId: string = '';

	private nearweekNewsletters: NearweekNewsletter[] = [];

	constructor(
		readonly state: DurableObjectState,
		readonly env: EnvBindings
	) {
		super(state, env);
		this.nearTweetKnowledge = [];

		this.state.blockConcurrencyWhile(async () => {
			this.nearTweetKnowledge = (await this.state.storage.get('nearTweetKnowledge')) ?? [];
			this.nearTweetSummary = (await this.state.storage.get('nearTweetSummary')) ?? '';
			this.nearTweetLatestId = (await this.state.storage.get('nearTweetLatestId')) ?? '';
			this.nearweekNewsletters = (await this.state.storage.get('nearweekNewsletters')) ?? [];
		});

		this.hono = new Hono<Env>();
		this.hono
			.get('/near/tweets/update', async (c) => {
				const searchParams = new URLSearchParams();
				searchParams.set(
					'query',
					'(from:NEARWEEK OR from:NEARProtocol OR from:shitzuonnear OR from:memedotcooking) -(alpha telegram) -(follow back) -(binance coinbase) -(top growth) -(try free) -breaking -cardano -xrp -is:reply -giveaway -shill -pump -listing -launching -ca -ngl -fr -wen -movers -vibes -gainers -bro -explode -repricing -af -"#1" -reminder lang:en'
				);
				searchParams.set('expansions', 'author_id,referenced_tweets.id');
				searchParams.set('tweet.fields', 'note_tweet,referenced_tweets,created_at');
				searchParams.set('max_results', '100');
				if (this.nearTweetLatestId) {
					searchParams.set('since_id', this.nearTweetLatestId);
				}

				let res = await fetch(
					`https://api.x.com/2/tweets/search/recent?${searchParams.toString()}`,
					{
						headers: {
							Authorization: `Bearer ${this.env.TWITTER_BEARER_TOKEN}`
						}
					}
				);
				if (!res.ok) {
					console.error('[res]', res.status, await res.text());
					return new Response(null, { status: 500 });
				}
				const jsonRes = await res.json<{
					data: (TweetKnowledge & {
						referenced_tweets?: { id: string }[];
						note_tweet?: { text: string };
					})[];
					includes: {
						tweets: TweetKnowledge[];
					};
				}>();
				const { data, includes } = jsonRes;
				if (data == null || data.length === 0) {
					return new Response(null, { status: 204 });
				}
				console.log('[jsonRes]', JSON.stringify(jsonRes, null, 2));

				this.nearTweetLatestId = data[0].id;
				await this.state.storage.put('nearTweetLatestId', this.nearTweetLatestId);

				const tweets: TweetKnowledge[] = [];
				for (const tweet of data) {
					if (tweet.note_tweet) {
						tweets.push({
							id: tweet.id,
							text: tweet.note_tweet.text,
							author_id: tweet.author_id,
							created_at: tweet.created_at
						});
					} else if (tweet.referenced_tweets) {
						continue;
					} else {
						tweets.push({
							id: tweet.id,
							text: tweet.text,
							author_id: tweet.author_id,
							created_at: tweet.created_at
						});
					}
				}
				for (const tweet of includes.tweets) {
					tweets.push({
						id: tweet.id,
						text: tweet.text,
						author_id: tweet.author_id,
						created_at: tweet.created_at
					});
				}
				tweets.sort((a, b) => Number(BigInt(b.id) - BigInt(a.id)));

				this.nearTweetKnowledge = [...tweets, ...this.nearTweetKnowledge];
				this.nearTweetKnowledge.splice(500);
				await this.state.storage.put('nearTweetKnowledge', this.nearTweetKnowledge);

				res = await fetch(`${c.env.CEREBRAS_API_URL}/v1/chat/completions`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${c.env.CEREBRAS_API_KEY}`,
						'Content-Type': 'application/json',
						'User-Agent': 'SimpsForLucy'
					},
					body: JSON.stringify({
						model: 'llama-3.3-70b',
						messages: [
							{
								role: 'system',
								content:
									'Given following tweets, summarize the content. Only provide the summary, no other text. The summary should have as many details as possible and important information should be included. The summary should be a list of bullet points. The tweets are sorted chronologically.'
							},
							{
								role: 'user',
								content: this.nearTweetKnowledge.map((t) => `Tweet:\n${t.text}`).join('\n\n')
							}
						]
					})
				});
				if (!res.ok) {
					console.error(
						`[chat] Failed to evaluate conversation [${res.status}]: ${await res.text()}`
					);
					return c.json({ error: `Failed to evaluate conversation [${res.status}]` }, 500);
				}
				const completion = await res.json<OpenAIResponse>();

				this.nearTweetSummary = completion.choices[0].message.content || '';
				await this.state.storage.put('nearTweetSummary', this.nearTweetSummary);
				console.log('[nearTweetSummary]', this.nearTweetSummary);

				await this.env.KV.put('nearTweetSummary', this.nearTweetSummary);

				return new Response(null, { status: 204 });
			})
			.get('/near/nearweek/update', async (c) => {
				const rssFeed = await fetch(
					'https://us1.campaign-archive.com/feed?u=ed13caf5cf7d37689d81ef60b&id=86d4e11a12'
				);
				const rssFeedText = await rssFeed.text();

				let links: string[] = [];
				const parser = new Parser(
					{
						ontext(text) {
							if (text.includes('https://mailchi.mp/nearweek.com/')) {
								links.push(text);
							}
						}
					},
					{
						decodeEntities: true
					}
				);
				parser.write(rssFeedText);
				parser.end();
				links = Array.from(new Set(links));
				links.splice(3);
				links = links.filter((link) => !this.nearweekNewsletters.some((n) => n.link === link));
				console.log('[links]', links);

				const summaries: NearweekNewsletter[] = [];
				for (const link of links) {
					let res = await fetch(link);
					const newsletter = await res.text();

					let content = '';
					const parser = new Parser(
						{
							ontext(text) {
								if (!text) return;
								content += text;
							}
						},
						{
							decodeEntities: true
						}
					);
					parser.write(newsletter);
					parser.end();

					res = await fetch(`${c.env.CEREBRAS_API_URL}/v1/chat/completions`, {
						method: 'POST',
						headers: {
							Authorization: `Bearer ${c.env.CEREBRAS_API_KEY}`,
							'Content-Type': 'application/json',
							'User-Agent': 'SimpsForLucy'
						},
						body: JSON.stringify({
							model: 'llama-3.3-70b',
							messages: [
								{
									role: 'system',
									content: `Given following newsletter, summarize the content. Only provide the summary, no other text. The summary should have as many details as possible and important information should be included. The summary should be a list of bullet points, but only full sentences.
									Output as a JSON object with the following fields:
									- summary: summary of the newsletter as an array of strings,
									- date: date of the newsletter in YYYY-MM-DD format`
								},
								{
									role: 'user',
									content
								}
							],
							response_format: {
								type: 'json_object'
							}
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
					const parseResult = NearweekNewsletterResponse.safeParse(rawResponse);

					if (!parseResult.success) {
						console.error('[parseResult]', parseResult.error);
						return new Response(null, { status: 500 });
					}

					console.log('[summary]', parseResult.data);
					summaries.push({ ...parseResult.data, link });
				}

				this.nearweekNewsletters = [...summaries, ...this.nearweekNewsletters];
				this.nearweekNewsletters.splice(3);
				await this.state.storage.put('nearweekNewsletters', this.nearweekNewsletters);

				await this.env.KV.put(
					'nearweekNewsletters',
					this.nearweekNewsletters
						.map((n) => `Date: ${n.date}\n\n${n.summary.join('\n')}\n\n---\n\n`)
						.join('')
				);

				return new Response(null, { status: 204 });
			});
	}

	async fetch(request: Request): Promise<Response> {
		return this.hono.fetch(request, this.env);
	}
}
