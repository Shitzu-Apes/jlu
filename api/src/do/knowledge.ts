import { DurableObject } from 'cloudflare:workers';
import dayjs from 'dayjs';
import { Hono } from 'hono';
import type { Context, Env } from 'hono';
import { Parser } from 'htmlparser2';

import type { EnvBindings } from '../../types';
import { chatCompletion } from '../completion';
import {
	KnowledgeCategory,
	KnowledgePieces,
	NearProjects,
	type TweetKnowledge,
	type TweetSearchData
} from '../definitions';
import { getScraper } from '../scraper';
import { getAuthor, pullThread } from '../tweet';
import { simpleHash } from '../utils';

export class Knowledge extends DurableObject {
	private hono: Hono<Env>;
	private nearTweetLatestId: string = '';
	private nearweekLatestId: number = 0;
	private projects: NearProjects[] = [];

	constructor(
		readonly state: DurableObjectState,
		readonly env: EnvBindings
	) {
		super(state, env);

		this.state.blockConcurrencyWhile(async () => {
			this.nearTweetLatestId = (await this.state.storage.get('nearTweetLatestId')) ?? '';
			this.nearweekLatestId = (await this.state.storage.get('nearweekLatestId')) ?? 0;
			this.projects = (await this.state.storage.get('projects')) ?? [];
		});

		this.hono = new Hono<Env>();
		this.hono
			.get('/near/projects', async (c) => {
				return c.json(this.projects);
			})
			.post('/near/projects', async () => {
				const res = await fetch('https://api.nearcatalog.xyz/projects');
				const json = await res.json<Record<string, { profile: { name: string } }>>();
				this.projects = Object.entries(json)
					.filter(([_, project]) => project?.profile?.name != null)
					.map(([id, project]) => ({
						id,
						name: project.profile.name
					}));
				await this.state.storage.put('projects', this.projects);

				const projectIds = this.projects.map((p) => p.id);
				const projectIdsString = projectIds.join(',');
				await this.env.KV.put('projectIds', projectIdsString);
				console.log('[projectIds]', projectIdsString);

				return new Response(null, { status: 204 });
			})
			.post('/near/tweets', async (c) => {
				const searchParams = new URLSearchParams();
				searchParams.set(
					'query',
					'(from:NEARWEEK OR from:NEARProtocol OR from:shitzuonnear OR from:memedotcooking OR from:NEARQuant OR from:NEARdevs OR from:near_ai OR from:NEARDevHub OR from:nearhorizon) -(alpha telegram) -(follow back) -(binance coinbase) -(top growth) -(try free) -breaking -cardano -xrp -is:reply -giveaway -shill -pump -listing -launching -ca -ngl -fr -wen -movers -vibes -gainers -bro -explode -repricing -af -"#1" -reminder lang:en'
				);
				searchParams.set('expansions', 'author_id,referenced_tweets.id');
				searchParams.set('tweet.fields', 'note_tweet,referenced_tweets,created_at');
				searchParams.set('max_results', '20');
				if (this.nearTweetLatestId) {
					searchParams.set('since_id', this.nearTweetLatestId);
				}

				const res = await fetch(
					`https://api.x.com/2/tweets/search/recent?${searchParams.toString()}`,
					{
						headers: {
							Authorization: `Bearer ${this.env.TWITTER_BEARER_TOKEN}`
						}
					}
				);
				if (!res.ok) {
					console.error('[res]', res.status, await res.text(), Array.from(res.headers));
					return new Response(null, { status: 500 });
				}
				const jsonRes = await res.json<{
					data: TweetSearchData[];
					includes: {
						tweets: TweetKnowledge[];
					};
				}>();
				const { data, includes } = jsonRes;
				if (data == null || data.length === 0) {
					console.log('[no tweets]');
					return new Response(null, { status: 204 });
				}
				console.log('[jsonRes]', JSON.stringify(jsonRes, null, 2));

				this.nearTweetLatestId = data[0].id;
				await this.state.storage.put('nearTweetLatestId', this.nearTweetLatestId);

				const tweets: TweetKnowledge[] = [];
				const scraper = await getScraper(this.env);
				for (const tweet of data) {
					const author = await getAuthor(tweet.author_id, '', scraper, this.env);
					if (tweet.note_tweet) {
						tweets.push({
							id: tweet.id,
							text: tweet.note_tweet.text,
							author_id: tweet.author_id,
							username: author?.username ?? 'User',
							created_at: tweet.created_at
						});
					} else if (tweet.referenced_tweets) {
						continue;
					} else {
						const thread = await pullThread(tweet, this.env);
						tweets.push({
							id: tweet.id,
							text: tweet.text,
							author_id: tweet.author_id,
							username: author?.username ?? 'User',
							created_at: tweet.created_at,
							thread: thread?.map((t) => t.text)
						});
					}
				}
				for (const tweet of includes.tweets) {
					const author = await getAuthor(tweet.author_id, tweet.username, scraper, this.env);
					const thread = await pullThread(tweet, this.env);
					tweets.push({
						id: tweet.id,
						text: tweet.text,
						author_id: tweet.author_id,
						username: author?.username ?? 'User',
						created_at: tweet.created_at,
						thread: thread?.map((t) => t.text)
					});
				}
				tweets.sort((a, b) => Number(BigInt(b.id) - BigInt(a.id)));

				const knowledgePieces = await this.extractKnowledgePieces(
					'tweet',
					tweets
						.map(
							(t) =>
								`Tweet from ${t.username} (created: ${dayjs(t.created_at).format('YYYY-MM-DD')}):\n${t.text}${t.thread != null ? `\n${t.thread.join('\n')}` : ''}`
						)
						.join('\n'),
					c
				);
				if (knowledgePieces instanceof Response) {
					return knowledgePieces;
				}

				await this.storeKnowledgePieces(knowledgePieces);

				return new Response(null, { status: 204 });
			})
			.post('/near/nearweek', async (c) => {
				const rssFeed = await fetch(
					'https://us1.campaign-archive.com/feed?u=ed13caf5cf7d37689d81ef60b&id=86d4e11a12'
				);
				const rssFeedText = await rssFeed.text();

				let links: string[] = [];
				let parser = new Parser(
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
				links.reverse();
				console.log('[links]', links, this.nearweekLatestId);
				const link = links.find(
					(l) => Number(l.split('near-newsletter-')[1] ?? '0') > this.nearweekLatestId
				);
				if (link == null) {
					console.log('[no new link]');
					return new Response(null, { status: 204 });
				}
				console.log('[link]', link);

				const res = await fetch(link);
				const newsletter = await res.text();

				let content = '';
				parser = new Parser(
					{
						ontext(text) {
							if (!text) return;
							if (text.match(/.*[{}].*/)) return;
							content += text;
						}
					},
					{
						decodeEntities: true
					}
				);
				parser.write(newsletter);
				parser.end();
				content = content.replace(/[ \t]+/g, ' ');
				content = content.replace(/(\n *)+/g, '\n\n');

				const knowledgePieces = await this.extractKnowledgePieces('newsletter', content, c);
				if (knowledgePieces instanceof Response) {
					return knowledgePieces;
				}

				await this.storeKnowledgePieces(knowledgePieces);
				this.nearweekLatestId = Number(link.split('near-newsletter-')[1] ?? '0');
				await this.state.storage.put('nearweekLatestId', this.nearweekLatestId);

				return new Response(null, { status: 204 });
			})
			.delete('/near/tweets', async () => {
				this.nearTweetLatestId = '';
				await this.state.storage.delete('nearTweetLatestId');
				return new Response(null, { status: 204 });
			})
			.delete('/near/nearweek', async () => {
				this.nearweekLatestId = 0;
				await this.state.storage.delete('nearweekLatestId');
				return new Response(null, { status: 204 });
			});
	}

	async fetch(request: Request): Promise<Response> {
		return this.hono.fetch(request, this.env);
	}

	private async extractKnowledgePieces(
		type: 'newsletter' | 'tweet',
		content: string,
		c: Context<Env>
	) {
		const projectIds = await this.env.KV.get('projectIds');
		if (!projectIds) {
			return new Response(null, { status: 500 });
		}

		const messages = [
			{
				role: 'system' as const,
				content: `Given following ${type}, extract knowledge from it in a concrete but detailed, unbiased and unopinionated way. Only provide the rewrite, no other text. The knowledge objects should have as many details as possible. Do not provide information about the ${type} itself, only the information that should be stored as a knowledge base. Deduplicate the knowledge objects, if their content is similar. If the ${type} contains irrelevant information, ignore it.
				Output as a JSON object with the field "pieces".
				pieces is an array of objects with the following fields:
				- created_at: date of the ${type} in YYYY-MM-DD format
				- text: full sentence string of the information
				- categories: string array of categories selected from given list. You can only select these categories: ${KnowledgeCategory.options.join(', ')}
				- projects: string array of project ids selected from given list. You can only select these projects: ${projectIds.replace(/,/g, ', ')}
				- importance: number between 0 and 100, where 0 is the least important and 100 is the most important. The age of the information is also a factor, the older the information, the less important it is. Today is ${dayjs().format('YYYY-MM-DD')}`
			},
			{
				role: 'user' as const,
				content
			}
		];
		const { status, parsedObject, errorMessage, rawResponse } = await chatCompletion(
			this.env,
			messages,
			'deepseek-chat',
			KnowledgePieces
		);
		if (status === 'error' || !parsedObject.success) {
			console.error(
				'Failed to generate knowledge pieces',
				errorMessage,
				rawResponse,
				parsedObject?.error?.errors
			);
			return c.text(`Failed to generate knowledge pieces: ${errorMessage}`, 500);
		}
		const knowledgePieces = parsedObject.data;
		console.log('[knowledgePieces]', JSON.stringify(knowledgePieces, null, 2));

		return knowledgePieces;
	}

	private async storeKnowledgePieces(knowledgePieces: KnowledgePieces) {
		await Promise.all(
			knowledgePieces.pieces.map(async (piece) => {
				for (const project of piece.projects) {
					await this.env.KV.put(
						`knowledge:projectJSON:${project}:${simpleHash(piece.text)}`,
						JSON.stringify(piece),
						{
							expirationTtl: 60 * 60 * 24 * 365 // 1 year
						}
					);
				}
				for (const category of piece.categories) {
					await this.env.KV.put(
						`knowledge:categoryJSON:${category}:${simpleHash(piece.text)}`,
						JSON.stringify(piece),
						{
							expirationTtl: 60 * 60 * 24 * 365 // 1 year
						}
					);
				}
			})
		);
	}
}
