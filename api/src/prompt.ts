import { encodingForModel, type TiktokenModel } from 'js-tiktoken';
import { z } from 'zod';

// Get exact token count using tiktoken
export function countTokens(text: string, model: TiktokenModel): number {
	if (model === ('llama-3.3-70b' as TiktokenModel)) {
		// Simple approximation: average English word is ~4 characters
		// and Llama typically uses ~1.3 tokens per word
		const wordCount = text.split(/\s+/).length;
		return Math.ceil(wordCount * 1.3);
	}

	const enc = encodingForModel(model);
	const tokens = enc.encode(text);
	return tokens.length;
}

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

export const Outfit = z.enum([
	'corset_dress',
	'leather_jacket',
	'evening_gown',
	'hoodie',
	'kimono',
	'strapless_dress',
	'cozy',
	'christmas'
]);
export type Outfit = z.infer<typeof Outfit>;

export const Temperature = z.enum(['cold', 'mild', 'warm']);
export type Temperature = z.infer<typeof Temperature>;

export const OutfitPrompt: Record<Outfit, Record<Temperature, string>> = {
	corset_dress: {
		cold: 'black corset dress with neon green ribbon, layered with a long black wool coat, tights and knee-high boots, choker with bell, small emerald round earrings, off-shoulder bright yellow ruffled sleeves',
		mild: 'black corset dress with neon green ribbon, paired with a cropped denim jacket, tights, knee-high boots, choker with bell, small emerald round earrings, off-shoulder bright yellow ruffled sleeves',
		warm: 'black corset dress with neon green ribbon tied in a large bow at the back, long flowing ribbon ends draping, off-shoulder bright yellow ruffled sleeves, choker with bell, small emerald round earrings'
	},
	leather_jacket: {
		cold: 'black leather jacket open over neon green cropped sweater, high-waisted skirt with glowing seams, opaque tights, knee-high lace-up boots, chunky scarf',
		mild: 'black leather jacket open over neon green cropped long-sleeve top, high-waisted skirt with glowing seams, opaque stockings, knee-high lace-up boots',
		warm: 'sleek black leather jacket open over neon green cropped tank top, high-waisted skirt with glowing seams, opaque stockings, knee-high lace-up boots'
	},
	evening_gown: {
		cold: 'elegant backless evening gown with high slit, blockchain-themed shimmering patterns, paired with a faux fur shawl, long gloves, sparkling earrings, closed-toe strappy heels',
		mild: 'elegant backless evening gown with high slit, blockchain-themed shimmering patterns, paired with a short bolero jacket, long gloves, sparkling earrings, strappy heels',
		warm: 'elegant backless evening gown with high slit, blockchain-themed shimmering patterns, deep V-neck, long gloves, sparkling earrings, strappy heels'
	},
	hoodie: {
		cold: 'cropped white hoodie with NEAR Protocol logo, layered with black long coat, black mini skirt, opaque tights, thigh-high white heeled boots, glowing green choker',
		mild: 'cropped white hoodie with NEAR Protocol logo, black mini skirt, black leggings, thigh-high white heeled boots, glowing green choker',
		warm: 'cropped white hoodie featuring the NEAR Protocol logo, worn with a barely-there black mini skirt, thigh-high white heeled boots, glowing green choker'
	},
	kimono: {
		cold: 'modern Japanese kimono with short hemline, digital circuit-inspired patterns in green and black, neon green obi, layered with long black coat, tights, strappy heels, glowing hair accessories',
		mild: 'modern Japanese kimono with short hemline, digital circuit-inspired patterns in green and black, neon green obi, black leggings, strappy heels, glowing hair accessories',
		warm: 'modern Japanese kimono with dangerously short hemline, digital circuit-inspired patterns in green and black, deep neckline, neon green obi tied at the side, strappy heels, glowing hair accessories'
	},
	strapless_dress: {
		cold: 'strapless white dress with black corset-style waist cincher, neon green accents, off-the-shoulder neckline, black long-sleeve bolero, black tights, black choker with charm, elegant high heels',
		mild: 'strapless white dress with black corset-style waist cincher, neon green accents, structured off-the-shoulder neckline, black opaque tights, black choker with small charm, elegant high heels',
		warm: 'strapless white dress with corset-style black waist cincher, neon green accents, structured off-the-shoulder neckline, black choker adorned with a small charm, elegant high heels'
	},
	cozy: {
		cold: 'oversized cream knit sweater, black lace bodysuit, high-waisted black leggings, long camel wool coat, knee-high suede boots, chunky knit scarf, gold statement necklace',
		mild: 'fitted cream knit top, black lace bodysuit, high-waisted black midi skirt, opaque tights, ankle suede boots, gold statement necklace',
		warm: 'lightweight cream knit crop top, black lace bodysuit, black mini skirt, strappy black heels, delicate gold necklace'
	},
	christmas: {
		cold: 'elegant red velvet dress with a fitted silhouette and midi-length skirt, paired with a white faux fur coat, black opaque tights, knee-high heeled boots, sparkling silver necklace',
		mild: 'red satin slip dress with lace trim, cinched waist with a black belt, paired with a tailored black blazer, sheer black tights, heeled ankle boots, silver hoop earrings',
		warm: 'red mini dress with off-the-shoulder sleeves and sequined detailing, paired with strappy black heels, delicate silver jewelry'
	}
};

export const Hairstyle = z.enum(['bob', 'ponytail', 'bun']);
export type Hairstyle = z.infer<typeof Hairstyle>;

export const HairstylePrompt: Record<Hairstyle, string> = {
	bob: 'A sleek, slightly wavy bob that ends just above the shoulders, with side-swept bangs framing her face, and subtle highlights adding depth to her purple hair',
	ponytail:
		'voluminous high ponytail tied with a neon green ribbon, with a few loose strands falling around her face for a playful and relaxed look',
	bun: 'casual yet chic messy bun held together with glowing green hairpins, with a few curled tendrils framing her face, giving a mix of elegance and charm'
};
