import type { Env } from 'hono';
import { Hono } from 'hono';

import type { EnvBindings } from '../types';

import { KnowledgeCategory, KnowledgePiece, type NearProjects } from './definitions';

export const knowledge = new Hono<Env>()
	.get('/projects', async (c) => {
		const projectIds = await c.env.KV.get('projectIds');
		return c.json(projectIds);
	})
	.get('/categories', async (c) => {
		return c.json(KnowledgeCategory.options);
	})
	.get('/project/:project', async (c) => {
		const project = c.req.param('project');

		const list = await c.env.KV.list({ prefix: `knowledge:projectJSON:${project}` });
		const knowledge = await Promise.all(
			list.keys.map((key) => c.env.KV.get<KnowledgePiece>(key.name, 'json'))
		);
		return c.json(knowledge);
	})
	.get('/category/:category', async (c) => {
		const category = c.req.param('category');

		const list = await c.env.KV.list({ prefix: `knowledge:categoryJSON:${category}` });
		const knowledge = await Promise.all(
			list.keys.map((key) => c.env.KV.get<KnowledgePiece>(key.name, 'json'))
		);
		return c.json(knowledge);
	})
	.get('/near/projects', async (c) => {
		const knowledge = c.env.KNOWLEDGE.idFromName('knowledge');
		const knowledgeDo = c.env.KNOWLEDGE.get(knowledge);

		const response = await knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/projects'));
		if (!response.ok) {
			return c.text('', { status: response.status });
		}

		const result = await response.json<NearProjects[]>();
		return c.json(result);
	})
	.post('/near/projects', async (c) => {
		const auth = c.req.header('Authorization');
		if (auth !== `Bearer ${c.env.TWITTER_BEARER_TOKEN}`) {
			return c.text('Unauthorized', 401);
		}

		const knowledge = c.env.KNOWLEDGE.idFromName('knowledge');
		const knowledgeDo = c.env.KNOWLEDGE.get(knowledge);
		c.executionCtx.waitUntil(
			knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/projects', { method: 'POST' }))
		);
		return new Response(null, { status: 204 });
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
		c.executionCtx.waitUntil(
			knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/tweets', { method: 'DELETE' }))
		);
		return new Response('', { status: 204 });
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
		c.executionCtx.waitUntil(
			knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/nearweek', { method: 'DELETE' }))
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
