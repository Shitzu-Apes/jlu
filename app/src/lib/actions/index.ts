import type { Action } from 'svelte/action';

// Declare and implement the action in one file
export const clickOutside: Action<HTMLElement, () => void> = (node, callback) => {
	const handleClick = (event: MouseEvent) => {
		if (!node.contains(event.target as Node)) {
			callback();
		}
	};

	document.addEventListener('click', handleClick, true);

	return {
		destroy() {
			document.removeEventListener('click', handleClick, true);
		}
	};
};
