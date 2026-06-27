import { html, render } from "lit-html";
import { client } from "../../client.js";
import { Store } from "../../store.js";

/** @import { TemplateResult } from 'lit-html' */

class Login extends HTMLElement {
	store = new Store({
		handle: localStorage.getItem("teddy-handle") || "",
	});

	/** @type {Record<string, HTMLElement>} */
	elements = {};

	connectedCallback() {
		this.unsubscribeClientStore = client.store.subscribe((store) => {
			if (store.client) {
				this.update();
			}
		});

		this.unsubscribeStore = this.store.subscribe(() => this.update());

		this.addEventListener("input", this);
		this.addEventListener("submit", this);
	}

	disconnectedCallback() {
		this.removeEventListener("input", this);
		this.removeEventListener("submit", this);

		this.unsubscribeStore?.();
		this.unsubscribeClientStore?.();
	}

	/**
	 * @param {Event} event
	 */
	handleEvent(event) {
		if (event.type === "submit") {
			event.preventDefault();

			const state = this.store.getState();

			if (event.target instanceof HTMLFormElement) {
				const target = event.target;

				if (target === this.elements.loginForm) {
					localStorage.setItem("teddy-handle", state.handle);

					client.login(state.handle);

					return;
				}
			}
		} else if (event.type === "input") {
			if (event.target instanceof HTMLInputElement) {
				const target = event.target;

				if (target === this.elements.handleInput) {
					this.store.setState({ handle: target.value });

					return;
				}
			}
		}
	}

	async update() {
		const { client: atClient, agent, profile } = client.store.getState();
		const { handle } = this.store.getState();

		/** @type {TemplateResult | null} */
		let content = null;

		if (!atClient) {
			content = html`
				<div style="display: flex; justify-content: center; align-items: center; flex-grow: 1;">Loading...</div>
			`;
		} else {
			if (agent && profile) {
				content = html`
        <div>Logged in as ${profile.displayName} (${profile.handle})</div>
        <form @submit=${() => client.logout()}>
          <button class="primary" type="submit">Logout</button>
        </form>
        <form  @submit=${() => client.post()}>
          <button class="secondary" type="submit">Post to Teddy</button>
        </form>
        <teddy-messages></teddy-messages>
      `;
			} else {
				content = html`
			<form id="loginForm">
        <div style="display: flex; flex-direction: row; align-items: center; gap: var(--spacing-2);">
					<input type="text" id="handleInput" placeholder="Enter your handle" value="${handle}" />
          <button id="loginButton" class="primary" type="submit" ${handle ? "" : "disabled"}>Login with AT Protocol</button>
        </div>
			</form>
      `;
			}
		}

		render(
			html`
			${content}
			`,
			this,
		);

		const allElementsWithIds = this.querySelectorAll("[id]");
		allElementsWithIds.forEach((element) => {
			if (element.id && element instanceof HTMLElement) {
				this.elements[element.id] = element;
			}
		});
	}
}

export { Login };
