<script lang="ts">
	import Button from './Button.svelte';

	import { clickOutside } from '$lib/actions';
	import { showWalletSelector } from '$lib/auth';
	import { nearWallet } from '$lib/near';
	import { solanaWallet } from '$lib/solana/wallet';
	import { jluBalance$ } from '$lib/stores/jlu';

	const { accountId$, iconUrl$, walletName$, isLoading$ } = nearWallet;
	const { publicKey$, selectedWallet$, connected$ } = solanaWallet;

	let isOpen = false;

	function handleSignOut() {
		nearWallet.signOut();
		isOpen = false;
	}

	function handleSolanaDisconnect() {
		solanaWallet.disconnect();
		isOpen = false;
	}
</script>

{#if $accountId$ || $connected$}
	<div class="relative" use:clickOutside={() => (isOpen = false)}>
		<Button
			type="secondary"
			size="s"
			onClick={() => (isOpen = !isOpen)}
			class="!px-2"
			aria-label="Wallet menu"
		>
			{#if $accountId$}
				{#await Promise.all([$iconUrl$, $walletName$]) then [iconUrl, walletName]}
					<img
						src={iconUrl}
						alt={walletName}
						class="w-7 h-7 rounded-full {(walletName ?? '').replaceAll(' ', '-').toLowerCase()}"
					/>
					<div class="i-mdi:chevron-down text-lg text-purple-200/70" />
				{/await}
			{:else if $connected$ && $selectedWallet$}
				<img src={$selectedWallet$.icon} alt={$selectedWallet$.name} class="w-7 h-7 rounded-full" />
				<div class="i-mdi:chevron-down text-lg text-purple-200/70" />
			{/if}
		</Button>

		{#if isOpen}
			<div
				class="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-72 max-w-[20rem] bg-zinc-900 rounded-xl border border-purple-900/20 shadow-lg py-2 z-50"
			>
				<!-- NEAR Wallet Section -->
				<div class="px-4 py-2 border-b border-purple-900/20">
					<div class="text-sm text-purple-200/70 mb-2">NEAR Wallet</div>
					{#if $accountId$}
						{#await Promise.all( [$iconUrl$, $walletName$, $accountId$] ) then [iconUrl, walletName, accountId]}
							<div class="flex items-center gap-3">
								<img
									src={iconUrl}
									alt={walletName}
									class="w-10 h-10 rounded-full {(walletName ?? '')
										.replaceAll(' ', '-')
										.toLowerCase()}"
								/>
								<div class="flex-1 min-w-0">
									<div class="text-sm font-medium text-purple-100">{walletName}</div>
									<div class="text-sm text-purple-200/70 truncate">{accountId}</div>
									{#if $jluBalance$.near}
										<div class="flex items-center gap-2 text-sm text-purple-200/70 mt-1">
											<img src="/logo.webp" alt="JLU" class="w-4 h-4 rounded-full" />
											<span class="font-medium text-purple-100"
												>{$jluBalance$.near.format({
													compactDisplay: 'short',
													notation: 'compact',
													maximumFractionDigits: 2
												})}</span
											>
											<span>JLU</span>
										</div>
									{/if}
								</div>
							</div>
							<Button
								type="secondary"
								size="s"
								onClick={handleSignOut}
								class="w-full !justify-start !px-4 mt-2"
							>
								<div class="i-mdi:logout text-xl" />
								<span class="ml-2">Disconnect NEAR</span>
							</Button>
						{/await}
					{:else}
						<Button
							type="secondary"
							size="s"
							onClick={(e) => {
								e.preventDefault();
								isOpen = false;
								showWalletSelector('near');
							}}
							loading={$isLoading$}
							class="w-full"
						>
							Connect NEAR Wallet
						</Button>
					{/if}
				</div>

				<!-- Solana Wallet Section -->
				<div class="px-4 py-2">
					<div class="text-sm text-purple-200/70 mb-2">Solana Wallet</div>
					{#if $connected$ && $selectedWallet$}
						<div class="flex items-center gap-3">
							<img
								src={$selectedWallet$.icon}
								alt={$selectedWallet$.name}
								class="w-10 h-10 rounded-full"
							/>
							<div class="flex-1 min-w-0">
								<div class="text-sm font-medium text-purple-100">{$selectedWallet$.name}</div>
								<div class="text-sm text-purple-200/70 truncate">
									{$publicKey$?.toBase58().slice(0, 4)}...{$publicKey$?.toBase58().slice(-4)}
								</div>
								{#if $jluBalance$.solana}
									<div class="flex items-center gap-2 text-sm text-purple-200/70 mt-1">
										<img src="/logo.webp" alt="JLU" class="w-4 h-4 rounded-full" />
										<span class="font-medium text-purple-100"
											>{$jluBalance$.solana.format({
												compactDisplay: 'short',
												notation: 'compact',
												maximumFractionDigits: 2
											})}</span
										>
										<span>JLU</span>
									</div>
								{/if}
							</div>
						</div>
						<Button
							type="secondary"
							size="s"
							onClick={handleSolanaDisconnect}
							class="w-full !justify-start !px-4 mt-2"
						>
							<div class="i-mdi:logout text-xl" />
							<span class="ml-2">Disconnect Solana</span>
						</Button>
					{:else}
						<Button
							type="secondary"
							size="s"
							onClick={(e) => {
								e.preventDefault();
								isOpen = false;
								showWalletSelector('solana');
							}}
							class="w-full"
						>
							Connect Solana Wallet
						</Button>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{:else}
	<Button
		size="m"
		onClick={(e) => {
			e.preventDefault();
			isOpen = false;
			showWalletSelector($accountId$ ? 'solana' : 'near');
		}}
		loading={$isLoading$}
	>
		<span class="block md:hidden">Connect</span>
		<span class="hidden md:block">Connect Wallet</span>
	</Button>
{/if}

<style>
	:global(.bitte-wallet) {
		background: #1a1a1a;
		border-radius: 0.25rem;
	}
</style>
