import type { EnvBindings } from '../types';

export function generateImage(prompt: string, env: EnvBindings) {
	return fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${env.LEONARDO_API_KEY}`,
			'Content-Type': 'application/json',
			Accept: 'application/json'
		},
		body: JSON.stringify({
			alchemy: true,
			height: 768,
			modelId: 'e71a1c2f-4f80-4800-934f-2c68979d8cc8',
			num_images: 1,
			presetStyle: 'DYNAMIC',
			prompt,
			width: 512,
			controlnets: [
				{
					initImageId: 'deee2498-3dd3-4e3f-ac77-a9463998ed92',
					initImageType: 'UPLOADED',
					preprocessorId: 67,
					strengthType: 'Low'
				}
			],
			// userElements: [
			// 	{ userLoraId: 12129, weight: 0.8 },
			// 	{ userLoraId: 12233, weight: 0.3 }
			// ],
			guidance_scale: 15,
			highContrast: false,
			photoReal: false,
			highResolution: false,
			public: false,
			scheduler: 'LEONARDO',
			sd_version: 'SDXL_LIGHTNING',
			num_inference_steps: 20,
			promptMagic: false,
			transparency: 'disabled'
		})
	});
}
