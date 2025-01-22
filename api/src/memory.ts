import dayjs from 'dayjs';
import { Hono, type Env } from 'hono';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';

import type { EnvBindings } from '../types';

import { chatCompletion } from './completion';
import { Memory } from './definitions';
import { LUCY_MEMORY_PROMPT } from './prompt';
import { simpleHash } from './utils';

export const memory = new Hono<Env>();

memory.get('/:id', async (c) => {
	const memoryId = c.req.param('id');
	const memoryList = await c.env.KV.list({ prefix: `memory:${memoryId}:` });
	const memories = await Promise.all(
		memoryList.keys.map(async (key) => {
			return c.env.KV.get<Memory>(key.name, 'json');
		})
	);
	return c.json(memories);
});

export async function storeMemory(messages: ChatCompletionMessageParam[], env: EnvBindings) {
	try {
		const { status, parsedObject, errorMessage } = await chatCompletion(
			env,
			[...messages, { role: 'user', content: LUCY_MEMORY_PROMPT }],
			'llama-3.3-70b',
			Memory.array()
		);
		if (status === 'error' || !parsedObject.success) {
			console.error(`[memory] Failed to evaluate conversation: ${errorMessage}`);
			return new Response(JSON.stringify({ error: `Failed to evaluate conversation` }), {
				status: 500
			});
		}

		const memories = parsedObject.data.map((memory) => ({
			...memory,
			created_at: dayjs().toISOString()
		}));
		for (const memory of memories) {
			await env.KV.put(`memory:lucy:${simpleHash(memory.memory)}`, JSON.stringify(memory), {
				expirationTtl: memory.duration
			});
		}
	} catch (err) {
		console.error('[memory error]', err);
	}
}
