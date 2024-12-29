import dayjs from 'dayjs';
import { Hono, type Env } from 'hono';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';

import type { EnvBindings } from '../types';

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
		const res = await fetch(`${env.CEREBRAS_API_URL}/v1/chat/completions`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${env.CEREBRAS_API_KEY}`,
				'Content-Type': 'application/json',
				'User-Agent': 'SimpsForLucy'
			},
			body: JSON.stringify({
				model: 'llama-3.3-70b',
				messages: [...messages, { role: 'user', content: LUCY_MEMORY_PROMPT }],
				response_format: { type: 'json_object' }
			})
		});
		if (!res.ok) {
			console.error(`[chat] Failed to evaluate conversation [${res.status}]: ${await res.text()}`);
			return new Response(
				JSON.stringify({ error: `Failed to evaluate conversation [${res.status}]` }),
				{
					status: 500
				}
			);
		}

		const rawMemories = await res.json<Memory[]>();
		const memories = Memory.array()
			.parse(rawMemories)
			.map((memory) => ({
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
