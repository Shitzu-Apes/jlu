import type { Env } from 'hono';
import { Hono } from 'hono';

import type { EnvBindings } from '../types';

import type { NearweekNewsletter, TweetKnowledge } from './tweet_types';

export const knowledge = new Hono<Env>()
	.get('/near/tweets', async (c) => {
		const knowledge = c.env.KNOWLEDGE.idFromName('knowledge');
		const knowledgeDo = c.env.KNOWLEDGE.get(knowledge);

		const response = await knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/tweets'));
		if (!response.ok) {
			return c.text('', { status: response.status });
		}

		const result = await response.json<{ tweets: TweetKnowledge[]; summary: string }>();
		return c.json(result);
	})
	.post('/near/tweets', async (c) => {
		const auth = c.req.header('Authorization');
		if (auth !== `Bearer ${c.env.TWITTER_BEARER_TOKEN}`) {
			return c.text('Unauthorized', 401);
		}

		const knowledge = c.env.KNOWLEDGE.idFromName('knowledge');
		const knowledgeDo = c.env.KNOWLEDGE.get(knowledge);
		c.executionCtx.waitUntil(
			knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/tweets', { method: 'POST' }))
		);
		return new Response('', { status: 204 });
	})
	.delete('/near/tweets', async (c) => {
		const auth = c.req.header('Authorization');
		if (auth !== `Bearer ${c.env.TWITTER_BEARER_TOKEN}`) {
			return c.text('Unauthorized', 401);
		}

		const knowledge = c.env.KNOWLEDGE.idFromName('knowledge');
		const knowledgeDo = c.env.KNOWLEDGE.get(knowledge);
		await knowledgeDo.fetch(
			new Request('https://api.juicylucy.ai/near/tweets', { method: 'DELETE' })
		);
		return new Response('', { status: 204 });
	})
	.get('/near/nearweek', async (c) => {
		const knowledge = c.env.KNOWLEDGE.idFromName('knowledge');
		const knowledgeDo = c.env.KNOWLEDGE.get(knowledge);

		const response = await knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/nearweek'));
		if (!response.ok) {
			return c.text('', { status: response.status });
		}

		const result = await response.json<NearweekNewsletter[]>();
		return c.json(result);
	})
	.post('/near/nearweek', async (c) => {
		const auth = c.req.header('Authorization');
		if (auth !== `Bearer ${c.env.TWITTER_BEARER_TOKEN}`) {
			return c.text('Unauthorized', 401);
		}

		const knowledge = c.env.KNOWLEDGE.idFromName('knowledge');
		const knowledgeDo = c.env.KNOWLEDGE.get(knowledge);
		c.executionCtx.waitUntil(
			knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/nearweek', { method: 'POST' }))
		);
		return new Response('', { status: 204 });
	})
	.delete('/near/nearweek', async (c) => {
		const auth = c.req.header('Authorization');
		if (auth !== `Bearer ${c.env.TWITTER_BEARER_TOKEN}`) {
			return c.text('Unauthorized', 401);
		}

		const knowledge = c.env.KNOWLEDGE.idFromName('knowledge');
		const knowledgeDo = c.env.KNOWLEDGE.get(knowledge);

		await knowledgeDo.fetch(
			new Request('https://api.juicylucy.ai/near/nearweek', {
				method: 'DELETE'
			})
		);
		return new Response('', { status: 204 });
	});

export async function updateNearKnowledge(env: EnvBindings, ctx: ExecutionContext) {
	const knowledge = env.KNOWLEDGE.idFromName('knowledge');
	const knowledgeDo = env.KNOWLEDGE.get(knowledge);

	ctx.waitUntil(
		knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/tweets', { method: 'POST' }))
	);

	ctx.waitUntil(
		knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/nearweek', { method: 'POST' }))
	);
}
