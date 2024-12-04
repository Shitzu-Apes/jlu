<script lang="ts">
	import { Content } from '$lib/layout/BottomSheet';
	import { closeBottomSheet } from '$lib/layout/BottomSheet';

	function handleAccept() {
		localStorage.setItem('disclaimer_accepted', 'true');
		closeBottomSheet();
	}
</script>

<Content noClose>
	<div slot="header" class="w-full h-full flex items-center px-6">
		<h2 class="text-2xl font-bold text-purple-100">Important Notice</h2>
	</div>

	<div class="px-6 py-4 space-y-6 text-zinc-200">
		<section>
			<div class="space-y-4">
				<div>
					<strong class="text-purple-100">Lucy is a Fictional Character</strong>
					<div class="mt-1">
						Lucy J. is an AI-powered fictional character created for entertainment purposes. Any
						resemblance to real persons is purely coincidental.
					</div>
				</div>

				<div>
					<strong class="text-purple-100">Entertainment Only</strong>
					<div class="mt-1">
						This platform is designed for entertainment and gamification purposes. All interactions
						are simulated and should not be interpreted as real romantic or personal relationships.
					</div>
				</div>

				<div>
					<strong class="text-purple-100">Age Requirement</strong>
					<div class="mt-1">
						By using this service, you confirm that you are at least 18 years old or of legal age in
						your jurisdiction, whichever is higher.
					</div>
				</div>

				<div>
					<strong class="text-purple-100">Content Advisory</strong>
					<div class="mt-1">
						While we maintain appropriate content standards, interactions may include flirtatious
						themes. Users are expected to maintain respectful behavior at all times.
					</div>
				</div>

				<div>
					<strong class="text-purple-100">Token Rewards</strong>
					<div class="mt-1">
						The token rewards are issued on the NEAR blockchain and can be traded on supported
						exchanges. However, we do not guarantee any specific value or market performance of
						these tokens.
					</div>
				</div>
			</div>
		</section>

		<section>
			<button
				on:click={handleAccept}
				class="w-full bg-purple-600/80 hover:bg-purple-500/80 text-white rounded-xl px-6 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-colors font-medium"
			>
				I Understand & Accept
			</button>
		</section>
	</div>
</Content>
