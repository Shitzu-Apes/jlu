// eslint-disable-next-line import/no-named-as-default
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod.mjs';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions.mjs';
import { match, P } from 'ts-pattern';
import type { z } from 'zod';

import type { EnvBindings } from '../types';

export type AiModel = 'llama-3.3-70b' | 'deepseek-chat' | 'deepseek-reasoner';

export type OpenAIResponse = {
	choices: Array<{
		message: {
			content: string;
		};
	}>;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
};

// Get exact token count using tiktoken
export function countTokens(text: string, model: AiModel): number {
	return match(model)
		.with('llama-3.3-70b', () => {
			// Simple approximation: average English word is ~4 characters
			// and Llama typically uses ~1.3 tokens per word
			const wordCount = text.split(/\s+/).length;
			return Math.ceil(wordCount * 1.4);
		})
		.with(P.union('deepseek-chat', 'deepseek-reasoner'), () => {
			return text.length * 0.3;
		})
		.exhaustive();
}

export function prepareConversation(
	messages: ChatCompletionMessageParam[],
	model: AiModel,
	maxTokensForResponse = 1000
): ChatCompletionMessageParam[] {
	const tokenLimit = match(model)
		.with('llama-3.3-70b', () => 33_000)
		// TODO check token limit
		.with(P.union('deepseek-chat', 'deepseek-reasoner'), () => 33_000)
		.exhaustive();

	// Count tokens for all messages
	let totalTokens = messages.reduce(
		(sum, msg) => (typeof msg.content === 'string' ? sum + countTokens(msg.content, model) : sum),
		0
	);

	// If we're still over the limit, truncate oldest messages after system message
	const truncatedMessages = [...messages];
	while (totalTokens + maxTokensForResponse > tokenLimit - 500 && truncatedMessages.length > 2) {
		// Remove the second message (first after system)
		truncatedMessages.splice(1, 1);

		// Recalculate total tokens
		totalTokens = truncatedMessages.reduce(
			(sum, msg) => (typeof msg.content === 'string' ? sum + countTokens(msg.content, model) : sum),
			0
		);
	}

	return truncatedMessages;
}

export async function chatCompletion<
	TSchema extends z.ZodObject<z.ZodRawShape> | z.ZodArray<z.ZodObject<z.ZodRawShape>>
>(
	env: EnvBindings,
	messages: ChatCompletionMessageParam[],
	model: AiModel,
	zodObject: TSchema,
	maxTokens?: number,
	temperature?: number,
	responseFormat = { type: 'json_object' }
) {
	const tokens = messages.reduce(
		(sum, msg) => (typeof msg.content === 'string' ? sum + countTokens(msg.content, model) : sum),
		0
	);
	if (tokens > 8192) {
		model = 'deepseek-chat';
	}
	const response = await match(model)
		.with('llama-3.3-70b', () =>
			fetch(`${env.CEREBRAS_API_URL}/v1/chat/completions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.CEREBRAS_API_KEY}`,
					'Content-Type': 'application/json',
					'User-Agent': 'SimpsForLucy'
				},
				body: JSON.stringify({
					model,
					messages,
					max_tokens: maxTokens,
					temperature,
					response_format: responseFormat
				})
			})
		)
		.with(P.union('deepseek-chat', 'deepseek-reasoner'), () =>
			fetch(`${env.DEEPSEEK_API_URL}/chat/completions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
					'Content-Type': 'application/json',
					'User-Agent': 'SimpsForLucy'
				},
				body: JSON.stringify({
					model,
					messages,
					max_tokens: maxTokens,
					temperature,
					response_format: responseFormat
				})
			})
		)
		.exhaustive();
	if (!response.ok) {
		return { status: 'error' as const, errorMessage: await response.text() } as const;
	}

	const completion = await response.json<OpenAIResponse>();
	try {
		const rawResponse = JSON.parse(completion.choices[0].message.content || '{}');
		let parsedObject = zodObject.safeParse(rawResponse) as z.SafeParseReturnType<
			z.infer<TSchema>,
			z.infer<TSchema>
		>;

		if (!parsedObject.success) {
			const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
			const response = await openai.beta.chat.completions.parse({
				model: 'gpt-4o-mini',
				messages,
				response_format: zodResponseFormat(zodObject, 'json_object')
			});
			parsedObject = zodObject.safeParse(
				response.choices[0].message.parsed
			) as z.SafeParseReturnType<z.infer<TSchema>, z.infer<TSchema>>;
		}

		return {
			status: 'success' as const,
			parsedObject,
			rawResponse: completion.choices[0].message.content
		};
	} catch (error) {
		return {
			status: 'error' as const,
			errorMessage: `Unknown error: ${JSON.stringify(error)}`,
			rawResponse: completion.choices[0].message.content
		};
	}
}
