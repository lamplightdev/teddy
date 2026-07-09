class Time extends HTMLElement {
	static get observedAttributes() {
		return ["action"];
	}

	connectedCallback() {
		this.update();

		this.intervalId = setInterval(() => this.update(), 1000);
	}

	/**
	 *
	 * @param {string} name
	 * @param {string | null} oldValue
	 * @param {string | null} newValue
	 */
	attributeChangedCallback(name, oldValue, newValue) {
		const actionElement = /** @type {HTMLElement} */ (
			this.querySelector(".time-action")
		);

		actionElement.textContent = newValue ? `Action: ${newValue}` : "";
	}

	update() {
		const timeElement = /** @type {HTMLElement} */ (
			this.querySelector(".time-current")
		);

		timeElement.textContent = new Date().toLocaleTimeString();
	}
}

customElements.define("teddykins-time", Time);
