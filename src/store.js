/**
 * @typedef {Object} ListenerAll
 * @property {'all'} type
 * @property {Function} callback
 */

/**
 * @typedef {Object} ListenerSingle
 * @property {'single'} type
 * @property {Function} selector
 * @property {Function} callback
 */

/**
 * @typedef {Object} ListenerMultiple
 * @property {'multiple'} type
 * @property {Function[]} selectors
 * @property {Function} callback
 */

/**
 * @typedef {ListenerAll | ListenerSingle | ListenerMultiple} Listener
 */

/**
 * A lightweight, type-safe, vanilla JS reactive store.
 * @template T
 */
class Store {
	/**
	 * @param {T} initialState
	 */
	constructor(initialState) {
		/** @type {T} */
		this.state = initialState;

		/** @type {Set<Listener>} */
		this.listeners = new Set();
	}

	/**
	 * Returns a snapshot of the current state.
	 * @returns {T}
	 */
	getState() {
		return this.state;
	}

	/**
	 * Updates the state immutably.
	 * @param {Partial<T> | ((prev: T) => Partial<T>)} updater
	 */
	setState(updater) {
		const nextState = {
			...this.state,
			...(typeof updater === "function" ? updater(this.state) : updater),
		};

		const prevState = this.state;
		this.state = nextState;

		this.listeners.forEach((listener) => {
			this.runListener(listener, prevState);
		});
	}

	/**
	 * @param {Listener} listener
	 * @param {T} prevState
	 */
	runListener(listener, prevState, isInitialRun = false) {
		if (listener.type === "all") {
			listener.callback(this.state, prevState);
		} else if (listener.type === "single") {
			const newVal = listener.selector(this.state);
			if (newVal !== listener.selector(prevState) || isInitialRun) {
				listener.callback(newVal);
			}
		} else if (listener.type === "multiple") {
			const hasChanged = listener.selectors.some(
				(sel) => sel(this.state) !== sel(prevState),
			);

			if (hasChanged || isInitialRun) {
				const newValues = listener.selectors.map((sel) => sel(this.state));
				listener.callback(newValues);
			}
		}
	}

	/**
	 * Listen to ALL state changes.
	 * @overload
	 * @param {(state: T, prevState: T) => void} callback
	 * @returns {() => void}
	 */
	/**
	 * Listen to a SINGLE field. (Perfect type inference!)
	 * @template U
	 * @overload
	 * @param {(state: T) => U} selector
	 * @param {(value: U) => void} callback
	 * @returns {() => void}
	 */
	/**
	 * Listen to MULTIPLE fields.
	 * @overload
	 * @param {Array<(state: T) => any>} selectors
	 * @param {(values: any[]) => void} callback
	 * @returns {() => void}
	 */
	/**
	 * Actual implementation signature.
	 * @param {Function | Function[]} selectorOrSelectors
	 * @param {Function} [callback]
	 * @returns {() => void}
	 */
	subscribe(selectorOrSelectors, callback) {
		/** @type {Listener} */
		let listener;

		if (!callback) {
			// TYPE GUARD: If there's no callback, the first argument MUST be a function.
			// This immediately removes the TypeScript error and provides runtime safety.
			if (typeof selectorOrSelectors !== "function") {
				throw new Error("You must provide a callback function.");
			}
			listener = { type: "all", callback: selectorOrSelectors };
		} else if (Array.isArray(selectorOrSelectors)) {
			listener = { type: "multiple", selectors: selectorOrSelectors, callback };
		} else {
			// TYPE GUARD: We can optionally add one here too just for strictness
			if (typeof selectorOrSelectors !== "function") {
				throw new Error("Selector must be a function.");
			}
			listener = { type: "single", selector: selectorOrSelectors, callback };
		}

		this.listeners.add(listener);

		// fire the callback immediately with the current state
		this.runListener(listener, this.state, true);

		return () => this.listeners.delete(listener);
	}
}

export { Store };
