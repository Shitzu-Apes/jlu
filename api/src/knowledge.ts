import type { EnvBindings } from '../types';

export async function updateNearKnowledge(env: EnvBindings, ctx: ExecutionContext) {
	const knowledge = env.KNOWLEDGE.idFromName('knowledge');
	const knowledgeDo = env.KNOWLEDGE.get(knowledge);

	ctx.waitUntil(knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/tweets/update')));

	ctx.waitUntil(knowledgeDo.fetch(new Request('https://api.juicylucy.ai/near/nearweek/update')));
}
