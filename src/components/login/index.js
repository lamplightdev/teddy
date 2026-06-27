import { client } from "../../client.js";
import { Store } from "../../store.js";

const html = String.raw;

class Login extends HTMLElement {
	store = new Store({
		blah: {
			count: 0,
		},
	});

	/**
	 * @type {(() => void) | null}
	 */
	unsubscribeClientStore = null;

	/**
	 * @type {(() => void) | null}
	 */
	unsubscribeStore = null;

	connectedCallback() {
		this.unsubscribeClientStore = client.store.subscribe(
			[(state) => state.profile],
			() => this.render(),
		);

		this.unsubscribeStore = this.store.subscribe(
			[(state) => state.blah.count],
			([count]) => this.onUpdateCount(count),
		);

		this.addEventListener("click", this);
	}

	disconnectedCallback() {
		this.removeEventListener("click", this);
		this.unsubscribeStore?.();
		this.unsubscribeClientStore?.();
	}

	/**
	 * @param {number} count
	 */
	onUpdateCount(count) {
		console.log("Store updated:", count);
		this.renderCount(count);
	}

	/**
	 * @param {MouseEvent} event
	 */
	handleEvent(event) {
		if (event.type === "click" && event.target instanceof HTMLElement) {
			const target = event.target;

			this.store.setState((prevState) => ({
				...prevState,
				blah: {
					...prevState.blah,
					count: prevState.blah.count + 1,
				},
			}));

			if (target.id === "loginButton") {
				client.login();

				return;
			}

			if (target.id === "logoutButton") {
				client.logout();

				return;
			}

			if (target.id === "postButton") {
				client.post();

				return;
			}
		}
	}

	async render() {
		const { agent, profile } = client.store.getState();

		let content = "";

		if (agent && profile) {
			content = html`
        <div>Logged in as ${profile.displayName} (${profile.handle})</div>
        <div>
          <button id="logoutButton">Logout</button>
        </div>
        <div>
          <button id="postButton">Post to Teddy</button>
        </div>
        <teddy-messages></teddy-messages>
      `;
		} else {
			content = html`
        <div>
          <button id="loginButton">Login with AT Protocol</button>
        </div>
      `;
		}
		this.innerHTML = `${content}<div id="count">Click count: ${this.store.getState().blah.count}</div>`;
	}

	/**
	 * @param {number} count
	 */
	renderCount(count) {
		const countElement = this.querySelector("#count");
		if (countElement) {
			countElement.textContent = `Click count: ${count}`;
		}
	}
}

export { Login };
