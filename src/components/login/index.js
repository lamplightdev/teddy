import { html, render } from "lit-html";
import { createRef, ref } from "lit-html/directives/ref.js";
import { atProto } from "../../atproto.js";
import { Store } from "../../store.js";

/** @import {Ref} from 'lit-html/directives/ref.js' */
/** @import { TemplateResult } from 'lit-html' */

class Login extends HTMLElement {
	store = new Store({
		initialHandle: localStorage.getItem("teddy-handle") || "",
		currentMessage: "",
		signingIn: false,
		signingOut: false,
		posting: false,
		errors: {
			handle: "",
			message: "",
		},
	});

	/** @type {Ref<HTMLInputElement>} */
	messageRef = createRef();

	connectedCallback() {
		this.unsubscribeClientStore = atProto.store.subscribe((store) => {
			if (store.ready) {
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
	 * @param {SubmitEvent & { target: HTMLFormElement }} event
	 */
	onLogIn = async (event) => {
		event.preventDefault();

		const handleInput = /** @type {HTMLInputElement} */ (
			event.target.elements.namedItem("handle")
		);

		if (handleInput.validity.valid) {
			this.store.setState({
				errors: { ...this.store.getState().errors, handle: "" },
			});
		} else {
			this.store.setState({
				errors: {
					...this.store.getState().errors,
					handle: "Handle cannot be empty.",
				},
			});
		}

		const formData = new FormData(event.target);
		const handle = formData.get("handle");
		const handleString = typeof handle === "string" ? handle.trim() : "";

		if (handleString) {
			this.store.setState({ signingIn: true });
			localStorage.setItem("teddy-handle", handleString);
			try {
				await atProto.login(handleString);
			} finally {
				this.store.setState({ signingIn: false });
			}
		}
	};

	/**
	 * @param {SubmitEvent} event
	 */
	onLogOut = async (event) => {
		event.preventDefault();
		this.store.setState({ signingOut: true });
		try {
			await atProto.logout();
		} finally {
			this.store.setState({ signingOut: false });
		}
	};

	/**
	 * @param {SubmitEvent & { target: HTMLFormElement }} event
	 */
	onPost = async (event) => {
		event.preventDefault();

		const messageInput = /** @type {HTMLInputElement} */ (
			event.target.elements.namedItem("message")
		);

		if (messageInput?.validity.valid) {
			this.store.setState({
				errors: { ...this.store.getState().errors, message: "" },
			});
		} else {
			this.store.setState({
				errors: {
					...this.store.getState().errors,
					message: "Message cannot be empty.",
				},
			});
		}

		const formData = new FormData(event.target);
		const message = formData.get("message");
		const messageString = typeof message === "string" ? message.trim() : "";

		if (messageString) {
			this.store.setState({ posting: true });
			try {
				await atProto.post(messageString);
				if (this.messageRef.value) {
					this.messageRef.value.value = "";
				}
			} finally {
				this.store.setState({ posting: false });
			}
		}
	};

	async update() {
		const { ready, agent, did, profile } = atProto.store.getState();
		const { initialHandle, signingIn, signingOut, posting, errors } =
			this.store.getState();

		/** @type {TemplateResult | null} */
		let content = null;

		if (!ready) {
			content = html`
				<div style="display: flex; justify-content: center; align-items: center; flex-grow: 1;">Loading...</div>
			`;
		} else {
			if (agent && did) {
				const displayName = profile?.displayName
					? `${profile.displayName} (${profile.handle})`
					: profile?.handle || "Unknown";
				content = html`
        <div>Logged in as ${displayName}</div>
        <form @submit=${this.onLogOut}>
					<fieldset class="ghost" ?disabled=${signingOut}>
          <button class="primary" type="submit">Logout</button>
					</fieldset>
        </form>
        <form @submit=${this.onPost} novalidate>
					<fieldset class="ghost" ?disabled=${posting}>
					<input name="message" type="text" placeholder="Write a message..." required ${ref(this.messageRef)}/>
					<span class="formError" aria-live="polite">${errors.message}</span>
          <button class="secondary" type="submit">Post to Teddy</button>
					</fieldset>
        </form>
        <teddy-messages></teddy-messages>
      `;
			} else {
				content = html`
			<form @submit=${this.onLogIn} novalidate>
				<fieldset class="ghost" ?disabled=${signingIn}>
        <div style="display: flex; flex-direction: row; align-items: center; gap: var(--spacing-2);">
					<input name="handle" type="text" placeholder="Enter your handle" required value=${initialHandle}/>
					<span class="formError" aria-live="polite">${errors.handle}</span>
          <button class="primary" type="submit">Login with AT Protocol</button>
        </div>
				</fieldset>
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
