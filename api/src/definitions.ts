import { z } from 'zod';

import type { Hairstyle } from './prompt';
import type { Outfit } from './prompt';

export type TweetSearchData = {
	id: string;
	text: string;
	author_id: string;
	created_at: string;
	public_metrics?: {
		like_count: number;
		reply_count: number;
		retweet_count: number;
		quote_count: number;
		impression_count: number;
	};
	referenced_tweets?: {
		type: string;
		id: string;
	}[];
};

export type TweetSearchUser = {
	id: string;
	name: string;
	username: string;
	verified: boolean;
	description: string;
	created_at: string;
	public_metrics: {
		followers_count: number;
		following_count: number;
		tweet_count: number;
		like_count: number;
		listed_count: number;
	};
};

export type TweetSearchResponse = {
	data: TweetSearchData[];
	includes: {
		users: TweetSearchUser[];
	};
	meta: {
		newest_id: string;
	};
};

export type EngageableTweet = {
	tweet: TweetSearchData & {
		author: TweetSearchUser;
	};
	thread?: TweetSearchData[];
	lucyTweets?: string[];
	generateImage?: boolean;
	imagePrompt?: string;
	outfit?: Outfit;
	hairstyle?: Hairstyle;
	imageGenerationId?: string;
	imageUrl?: string;
};

export type TweetKnowledge = {
	id: string;
	text: string;
	author_id: string;
	created_at: string;
	thread?: string[];
};

export const KnowledgeCategory = z.enum([
	'defi',
	'gaming',
	'nft',
	'social',
	'security',
	'ethereum',
	'solana',
	'near',
	'bitcoin',
	'sui',
	'ai',
	'funding',
	'development',
	'chain_abstraction',
	'event',
	'meme'
]);
export type KnowledgeCategory = z.infer<typeof KnowledgeCategory>;

export const NearProjects = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().optional(),
	links: z
		.object({
			dapp: z.string().optional(),
			website: z.string().optional(),
			twitter: z.string().optional(),
			discord: z.string().optional(),
			telegram: z.string().optional(),
			github: z.string().optional(),
			medium: z.string().optional()
		})
		.optional()
});
export type NearProjects = z.infer<typeof NearProjects>;

export const KnowledgePiece = z.object({
	created_at: z.string(),
	text: z.string(),
	categories: z.array(KnowledgeCategory),
	projects: z.array(z.string()),
	importance: z.number()
});
export type KnowledgePiece = z.infer<typeof KnowledgePiece>;

export const KnowledgePieces = z.object({ pieces: z.array(KnowledgePiece) });
export type KnowledgePieces = z.infer<typeof KnowledgePieces>;
