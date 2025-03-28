<script lang="ts" context="module">
	export type ToastType =
		| {
				type: 'simple';
				data: {
					title: string;
					description: string;
					type?: 'error' | 'success';
				};
		  }
		| {
				type: 'tx';
				canClose: boolean;
				props: {
					txPromise:
						| Promise<FinalExecutionOutcome>
						| Promise<void | FinalExecutionOutcome | FinalExecutionOutcome[]>;
				};
				success?: boolean;
		  };

	const {
		elements: { content, title, description, close },
		helpers,
		states: { toasts },
		actions: { portal }
	} = createToaster<ToastType>();

	export const showToast = helpers.addToast;

	export function showTxToast(
		txPromise:
			| Promise<void | FinalExecutionOutcome | FinalExecutionOutcome[]>
			| Promise<FinalExecutionOutcome>
	) {
		const toast = helpers.addToast({
			data: {
				type: 'tx',
				canClose: false,
				props: {
					txPromise
				}
			},
			closeDelay: 0
		});
		txPromise
			.then((outcome) => {
				if (!(outcome instanceof Object)) return;
				let success = true;
				if (Array.isArray(outcome)) {
					if (outcome.find((o) => !isOutcomeSuccess(o))) {
						success = false;
					}
				} else {
					success = isOutcomeSuccess(outcome);
				}
				helpers.updateToast(toast.id, {
					type: 'tx',
					canClose: true,
					props: { txPromise },
					success
				});
			})
			.catch(() => {
				helpers.updateToast(toast.id, {
					type: 'tx',
					canClose: true,
					props: { txPromise },
					success: false
				});
			})
			.finally(() => {
				setTimeout(() => {
					try {
						helpers.removeToast(toast.id);
					} catch (_err) {
						// already removed
					}
				}, 8_000);
			});
	}

	function isOutcomeSuccess(outcome: FinalExecutionOutcome): boolean {
		const outcomeStatus = outcome.transaction_outcome.outcome.status as ExecutionStatus;
		if (!outcomeStatus.SuccessValue && !outcomeStatus.SuccessReceiptId) {
			return false;
		}

		for (const receiptsOutcome of outcome.receipts_outcome) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const receiptStatus = receiptsOutcome.outcome.status as any;
			if (receiptStatus.Failure) {
				return false;
			}
		}
		return true;
	}
</script>

<script lang="ts">
	import { createToaster, melt } from '@melt-ui/svelte';
	import type { ExecutionStatus } from '@near-js/types';
	import type { FinalExecutionOutcome } from '@near-wallet-selector/core';
	import { fly, slide } from 'svelte/transition';

	import TxSnackbar from './TxSnackbar.svelte';
</script>

<div use:portal class="fixed left-1/2 top-4 z-50 -translate-x-1/2 flex flex-col items-center gap-2">
	{#each $toasts as { id, data } (id)}
		<div
			use:melt={$content(id)}
			in:fly={{ y: '-100%', duration: 300 }}
			out:slide
			class="relative rounded-lg bg-gray-800 text-white border border-gray-700 shadow-lg"
		>
			<div class="relative flex w-80 items-center gap-3 p-3">
				{#if data.type === 'simple'}
					<div>
						<h3
							use:melt={$title(id)}
							class="flex items-center gap-2 text-sm font-semibold"
							class:text-red-500={data.data.type === 'error'}
							class:text-green-500={data.data.type === 'success'}
						>
							{data.data.title}
						</h3>
						<div use:melt={$description(id)} class="text-sm text-gray-300">
							{data.data.description}
						</div>
					</div>
				{:else if data.type === 'tx'}
					<TxSnackbar {...data.props} />
				{/if}
				{#if data.type === 'simple' || data.canClose}
					<button
						use:melt={$close(id)}
						class="absolute right-2 top-2 grid size-5 place-items-center rounded-md text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
						aria-label="Close"
					>
						<div class="i-mdi:close size-3" />
					</button>
				{/if}
			</div>
		</div>
	{/each}
</div>
