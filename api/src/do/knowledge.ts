import { DurableObject } from 'cloudflare:workers';
import dayjs from 'dayjs';
import { Hono } from 'hono';
import type { Context, Env } from 'hono';
import { Parser } from 'htmlparser2';
// eslint-disable-next-line import/no-named-as-default
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod.mjs';

import type { EnvBindings } from '../../types';
import {
	KnowledgeCategory,
	KnowledgePieces,
	NearProjects,
	type TweetKnowledge
} from '../definitions';
import { pullThread } from '../tweet';

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
					'(from:NEARWEEK OR from:NEARProtocol OR from:shitzuonnear OR from:memedotcooking OR from:NEARQuant) -(alpha telegram) -(follow back) -(binance coinbase) -(top growth) -(try free) -breaking -cardano -xrp -is:reply -giveaway -shill -pump -listing -launching -ca -ngl -fr -wen -movers -vibes -gainers -bro -explode -repricing -af -"#1" -reminder lang:en'
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
					data: (TweetKnowledge & {
						referenced_tweets?: { type: string; id: string }[];
						note_tweet?: { text: string };
					})[];
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
						const thread = await pullThread(tweet, this.env);
						tweets.push({
							id: tweet.id,
							text: tweet.text,
							author_id: tweet.author_id,
							created_at: tweet.created_at,
							thread: thread?.map((t) => t.text)
						});
					}
				}
				for (const tweet of includes.tweets) {
					const thread = await pullThread(tweet, this.env);
					tweets.push({
						id: tweet.id,
						text: tweet.text,
						author_id: tweet.author_id,
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
								`Tweet (created: ${dayjs(t.created_at).format('YYYY-MM-DD')}):\n${t.text}${t.thread != null ? `\n${t.thread.join('\n')}` : ''}`
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
				console.log('[links]', links);
				const link = links.find(
					(l) => Number(l.split('near-newsletter-')[1] ?? '0') > this.nearweekLatestId
				);
				if (link == null) {
					console.log('[no new link]');
					return new Response(null, { status: 204 });
				}
				console.log('[link]', link);
				this.nearweekLatestId = Number(link.split('near-newsletter-')[1] ?? '0');
				await this.state.storage.put('nearweekLatestId', this.nearweekLatestId);

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

				return new Response(null, { status: 204 });
			})
			.delete('/near/tweets', async () => {
				this.nearTweetLatestId = '';
				await this.state.storage.delete('nearTweetLatestId');
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

		const openai = new OpenAI({
			apiKey: c.env.OPENAI_API_KEY
		});
		const messages = [
			{
				role: 'system' as const,
				content: `Given following ${type}, extract knowledge from it in a concrete but detailed, unbiased and unopinionated way. Only provide the rewrite, no other text. The knowledge objects should have as many details as possible. Do not provide information about the ${type} itself, only the information that should be stored as a knowledge base. Deduplicate the knowledge objects, if their content is similar.
				Output as a JSON array of objects with the following fields:
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
		const gpt4ores = await openai.beta.chat.completions.parse({
			model: 'gpt-4o',
			messages,
			response_format: zodResponseFormat(KnowledgePieces, 'knowledge_pieces')
		});
		if (!gpt4ores || !gpt4ores.choices[0].message.parsed) {
			console.error('Failed to generate scheduled tweet');
			return c.json({ error: 'Failed to generate scheduled tweet' }, 500);
		}
		console.log('[usage]', gpt4ores.usage);
		const knowledgePieces = gpt4ores.choices[0].message.parsed;
		console.log('[knowledgePieces]', JSON.stringify(knowledgePieces, null, 2));

		return knowledgePieces;
	}

	private async storeKnowledgePieces(knowledgePieces: KnowledgePieces) {
		await Promise.all(
			knowledgePieces.pieces.map(async (piece) => {
				for (const project of piece.projects) {
					await this.env.KV.put(
						`knowledge:project:${project}:${simpleHash(piece.text)}`,
						piece.text,
						{
							expirationTtl: 60 * 60 * 24 * 365 // 1 year
						}
					);
				}
				for (const category of piece.categories) {
					await this.env.KV.put(
						`knowledge:category:${category}:${simpleHash(piece.text)}`,
						piece.text,
						{
							expirationTtl: 60 * 60 * 24 * 365 // 1 year
						}
					);
				}
			})
		);
	}
}

const simpleHash = (str: string) => {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
	}
	return (hash >>> 0).toString(36).padStart(7, '0');
};
