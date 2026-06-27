import { html, render } from "lit-html";
import { client } from "../../client.js";
import { Store } from "../../store.js";

/** @import { TemplateResult } from 'lit-html' */

class Login extends HTMLElement {
	store = new Store({
		handle: localStorage.getItem("teddy-handle") || "",
	});

	connectedCallback() {
		this.unsubscribeClientStore = client.store.subscribe((store) => {
			if (store.client) {
				this.update();
			}
		});

		this.unsubscribeStore = this.store.subscribe(() => this.update());
	}

	disconnectedCallback() {
		this.unsubscribeStore?.();
		this.unsubscribeClientStore?.();
	}

	/**
	 * @param {Event} event
	 */
	onLogIn = async (event) => {
		event.preventDefault();
		const { handle } = this.store.getState();
		localStorage.setItem("teddy-handle", handle);
		client.login(handle);
	};

	/**
	 * @param {Event} event
	 */
	onLogOut = async (event) => {
		event.preventDefault();
		client.logout();
	};

	/**
	 * @param {Event} event
	 */
	onPost = async (event) => {
		event.preventDefault();
		client.post();
	};

	/**
	 * @param {Event} event
	 */
	onHandleInput(event) {
		if (event.target instanceof HTMLInputElement) {
			this.store.setState({ handle: event.target.value });
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
        <form @submit=${this.onLogOut}>
          <button class="primary" type="submit">Logout</button>
        </form>
        <form @submit=${this.onPost}>
          <button class="secondary" type="submit">Post to Teddy</button>
        </form>
        <teddy-messages></teddy-messages>
      `;
			} else {
				content = html`
			<form @submit=${this.onLogIn}>
        <div style="display: flex; flex-direction: row; align-items: center; gap: var(--spacing-2);">
					<input type="text" placeholder="Enter your handle" value=${handle} @input=${this.onHandleInput} />
          <button class="primary" type="submit" ?disabled=${!handle}>Login with AT Protocol</button>
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
	}
}

export { Login };
