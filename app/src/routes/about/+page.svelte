<script lang="ts">
	let selectedNetwork: 'near' | 'solana' | 'base' = 'near';

	function handleNetworkChange(network: 'near' | 'solana' | 'base') {
		if (document.startViewTransition) {
			document.startViewTransition(() => {
				selectedNetwork = network;
			});
		} else {
			selectedNetwork = network;
		}
	}
</script>

<main class="w-full max-w-2xl mx-auto py-6 px-4">
	<div class="flex flex-col gap-6">
		<div class="flex flex-col items-center gap-3">
			<h1 class="text-4xl font-bold text-purple-100">About Juicy Lucy</h1>
			<p class="text-lg text-purple-200/70">Learn more about Lucy and her ecosystem</p>
		</div>

		<div class="flex flex-col gap-5 bg-purple-900/20 rounded-xl p-5">
			<section>
				<h2 class="text-lg font-semibold text-purple-100 mb-2">🌟 Who is Lucy?</h2>
				<div class="text-zinc-200">
					Lucy is a Web3-native AI influencer with a unique personality, engaging with her community
					through authentic social interactions. As an AI agent on X, she maintains an active
					presence by both responding to direct interactions and proactively participating in
					relevant Web3 discussions, sharing insights and fostering meaningful conversations.
				</div>
			</section>

			<section>
				<h2 class="text-lg font-semibold text-purple-100 mb-2">💎 Simp2Earn</h2>
				<div class="text-zinc-200">
					Through our innovative simp2earn system, you can participate in playful challenges either
					on X or directly on this website. Impress Lucy with your creativity and charm to earn
					on-chain tokens. This feature provides a straightforward way to experience blockchain
					interactions firsthand while having fun!
				</div>
			</section>

			<section>
				<h2 class="text-lg font-semibold text-purple-100 mb-2">🌐 Multi-Chain Presence</h2>
				<div class="text-zinc-200">
					Lucy operates across multiple blockchains, making her accessible to a wider community. You
					can find her on Near Protocol, Base, and Solana. Use our Bridge feature to move your
					tokens between chains and participate in the ecosystem of your choice.
				</div>
			</section>

			<section>
				<h2 class="text-lg font-semibold text-purple-100 mb-2">💰 Get $JLU</h2>
				<div class="flex justify-center gap-2 mb-4">
					<button
						class="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 {selectedNetwork ===
						'near'
							? 'bg-purple-900/40 text-purple-100'
							: 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'}"
						on:click={() => handleNetworkChange('near')}
					>
						<img src="/near-logo.webp" alt="NEAR" class="w-5 h-5 rounded-full" />
						NEAR
					</button>
					<button
						class="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 {selectedNetwork ===
						'solana'
							? 'bg-purple-900/40 text-purple-100'
							: 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'}"
						on:click={() => handleNetworkChange('solana')}
					>
						<img src="/sol-logo.webp" alt="Solana" class="w-5 h-5 rounded-full" />
						Solana
					</button>
					<button
						class="px-4 py-2 rounded-lg transition-colors flex items-center gap-2 {selectedNetwork ===
						'base'
							? 'bg-purple-900/40 text-purple-100'
							: 'hover:bg-purple-900/20 text-purple-200/70 hover:text-purple-100'}"
						on:click={() => handleNetworkChange('base')}
					>
						<img src="/base-logo.webp" alt="Base" class="w-5 h-5 rounded-full" />
						Base
					</button>
				</div>

				<div class="token-info">
					{#if selectedNetwork === 'near'}
						<div class="flex flex-col sm:flex-row gap-2 justify-center">
							<a
								href="https://meme.cooking/meme/1018"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center justify-center gap-2 bg-[#72E3B6] hover:bg-[#5ED3A2] text-black py-2 px-4 rounded-lg transition-colors min-w-[160px]"
							>
								<img
									src="https://raw.githubusercontent.com/Shitzu-Apes/brand-kit/bc9e35fda8a41fe263afbcc802d60d5ee23ad2ad/logo/meme-cooking.webp"
									alt="Meme Cooking"
									class="w-5 h-5"
								/>
								<span>Buy</span>
							</a>
							<a
								href="https://dexscreener.com/near/refv1-5728"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center justify-center gap-2 bg-black hover:bg-zinc-900 text-white py-2 px-4 rounded-lg transition-colors min-w-[160px]"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="20"
									height="20"
									fill="#fff"
									fill-rule="evenodd"
									viewBox="0 0 252 300"
									focusable="false"
									class="chakra-icon custom-euf446"
									><path
										d="M151.818 106.866c9.177-4.576 20.854-11.312 32.545-20.541 2.465 5.119 2.735 9.586 1.465 13.193-.9 2.542-2.596 4.753-4.826 6.512-2.415 1.901-5.431 3.285-8.765 4.033-6.326 1.425-13.712.593-20.419-3.197m1.591 46.886l12.148 7.017c-24.804 13.902-31.547 39.716-39.557 64.859-8.009-25.143-14.753-50.957-39.556-64.859l12.148-7.017a5.95 5.95 0 003.84-5.845c-1.113-23.547 5.245-33.96 13.821-40.498 3.076-2.342 6.434-3.518 9.747-3.518s6.671 1.176 9.748 3.518c8.576 6.538 14.934 16.951 13.821 40.498a5.95 5.95 0 003.84 5.845zM126 0c14.042.377 28.119 3.103 40.336 8.406 8.46 3.677 16.354 8.534 23.502 14.342 3.228 2.622 5.886 5.155 8.814 8.071 7.897.273 19.438-8.5 24.796-16.709-9.221 30.23-51.299 65.929-80.43 79.589-.012-.005-.02-.012-.029-.018-5.228-3.992-11.108-5.988-16.989-5.988s-11.76 1.996-16.988 5.988c-.009.005-.017.014-.029.018-29.132-13.66-71.209-49.359-80.43-79.589 5.357 8.209 16.898 16.982 24.795 16.709 2.929-2.915 5.587-5.449 8.814-8.071C69.31 16.94 77.204 12.083 85.664 8.406 97.882 3.103 111.959.377 126 0m-25.818 106.866c-9.176-4.576-20.854-11.312-32.544-20.541-2.465 5.119-2.735 9.586-1.466 13.193.901 2.542 2.597 4.753 4.826 6.512 2.416 1.901 5.432 3.285 8.766 4.033 6.326 1.425 13.711.593 20.418-3.197"
									/><path
										d="M197.167 75.016c6.436-6.495 12.107-13.684 16.667-20.099l2.316 4.359c7.456 14.917 11.33 29.774 11.33 46.494l-.016 26.532.14 13.754c.54 33.766 7.846 67.929 24.396 99.193l-34.627-27.922-24.501 39.759-25.74-24.231L126 299.604l-41.132-66.748-25.739 24.231-24.501-39.759L0 245.25c16.55-31.264 23.856-65.427 24.397-99.193l.14-13.754-.016-26.532c0-16.721 3.873-31.578 11.331-46.494l2.315-4.359c4.56 6.415 10.23 13.603 16.667 20.099l-2.01 4.175c-3.905 8.109-5.198 17.176-2.156 25.799 1.961 5.554 5.54 10.317 10.154 13.953 4.48 3.531 9.782 5.911 15.333 7.161 3.616.814 7.3 1.149 10.96 1.035-.854 4.841-1.227 9.862-1.251 14.978L53.2 160.984l25.206 14.129a41.926 41.926 0 015.734 3.869c20.781 18.658 33.275 73.855 41.861 100.816 8.587-26.961 21.08-82.158 41.862-100.816a41.865 41.865 0 015.734-3.869l25.206-14.129-32.665-18.866c-.024-5.116-.397-10.137-1.251-14.978 3.66.114 7.344-.221 10.96-1.035 5.551-1.25 10.854-3.63 15.333-7.161 4.613-3.636 8.193-8.399 10.153-13.953 3.043-8.623 1.749-17.689-2.155-25.799l-2.01-4.175z"
									/></svg
								>
								<span>DexScreener</span>
							</a>
							<a
								href="https://nearblocks.io/token/jlu-1018.meme-cooking.near"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center justify-center gap-2 bg-white hover:bg-gray-200 text-black py-2 px-4 rounded-lg transition-colors min-w-[160px]"
							>
								<img src="/nearblocks.webp" alt="NearBlocks" class="w-5 h-5" />
								<span>Explorer</span>
							</a>
						</div>
					{:else if selectedNetwork === 'solana'}
						<div class="flex flex-col sm:flex-row gap-2 justify-center">
							<a
								href="#"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center justify-center gap-2 bg-[#14F195] hover:bg-[#12D983] text-black py-2 px-4 rounded-lg transition-colors min-w-[160px]"
							>
								<div class="i-ri:shopping-cart-line" />
								<span>Buy</span>
							</a>
							<a
								href="#"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center justify-center gap-2 bg-[#00B8D9] hover:bg-[#00A3C2] text-white py-2 px-4 rounded-lg transition-colors min-w-[160px]"
							>
								<div class="i-ri:line-chart-line" />
								<span>DexScreener</span>
							</a>
							<a
								href="#"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center justify-center gap-2 bg-[#9945FF] hover:bg-[#8539E3] text-white py-2 px-4 rounded-lg transition-colors min-w-[160px]"
							>
								<div class="i-ri:search-line" />
								<span>Explorer</span>
							</a>
						</div>
					{:else}
						<div class="flex flex-col sm:flex-row gap-2 justify-center">
							<a
								href="#"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center justify-center gap-2 bg-[#0052FF] hover:bg-[#0047DB] text-white py-2 px-4 rounded-lg transition-colors min-w-[160px]"
							>
								<div class="i-ri:shopping-cart-line" />
								<span>Buy</span>
							</a>
							<a
								href="#"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center justify-center gap-2 bg-[#00B8D9] hover:bg-[#00A3C2] text-white py-2 px-4 rounded-lg transition-colors min-w-[160px]"
							>
								<div class="i-ri:line-chart-line" />
								<span>DexScreener</span>
							</a>
							<a
								href="#"
								target="_blank"
								rel="noopener noreferrer"
								class="inline-flex items-center justify-center gap-2 bg-[#0052FF] hover:bg-[#0047DB] text-white py-2 px-4 rounded-lg transition-colors min-w-[160px]"
							>
								<div class="i-ri:search-line" />
								<span>Explorer</span>
							</a>
						</div>
					{/if}
				</div>
			</section>

			<section>
				<h2 class="text-lg font-semibold text-purple-100 mb-2">🤝 Community & Social</h2>
				<div class="text-center">
					<div class="text-zinc-200">Join our vibrant community:</div>
					<div class="mt-3 flex flex-col sm:flex-row gap-3 justify-center">
						<a
							href="https://x.com/SimpsForLucy"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white py-2 px-4 rounded-lg transition-colors min-w-[160px]"
						>
							<div class="i-ri:twitter-x-line" />
							<span>Follow on X</span>
						</a>
						<a
							href="https://t.me/SimpsForLucy"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center justify-center gap-2 bg-[#229ED9] hover:bg-[#1e8dc2] text-white py-2 px-4 rounded-lg transition-colors min-w-[160px]"
						>
							<div class="i-ri:telegram-line" />
							<span>Join Telegram</span>
						</a>
						<a
							href="https://github.com/Shitzu-Apes/jlu"
							target="_blank"
							rel="noopener noreferrer"
							class="inline-flex items-center justify-center gap-2 bg-[#333] hover:bg-[#444] text-white py-2 px-4 rounded-lg transition-colors min-w-[160px]"
						>
							<div class="i-ri:github-line" />
							<span>View on GitHub</span>
						</a>
					</div>
				</div>
			</section>

			<section>
				<h2 class="text-lg font-semibold text-purple-100 mb-2">🎯 Our Mission</h2>
				<div class="text-zinc-200">
					Juicy Lucy aims to make blockchain interactions more entertaining and accessible. By
					combining AI technology with meme culture and genuine social engagement, we're creating a
					unique space where users can learn about and participate in Web3 through fun, rewarding
					experiences.
				</div>
			</section>
		</div>
	</div>
</main>

<style>
	.token-info {
		view-transition-name: token-info;
	}

	::view-transition-old(token-info) {
		animation: fade-out 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	::view-transition-new(token-info) {
		animation: fade-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}

	@keyframes fade-out {
		0% {
			opacity: 1;
			transform: translateX(0);
		}
		100% {
			opacity: 0;
			transform: translateX(-32px);
		}
	}

	@keyframes fade-in {
		0% {
			opacity: 0;
			transform: translateX(32px);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
		}
	}
</style>
