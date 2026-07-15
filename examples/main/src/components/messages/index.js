import { html, render } from "lit-html";
import { atProto } from "../../atproto.js";
import { Store } from "../../store.js";

class Messages extends HTMLElement {
	store = new Store({
		/** @type {Record<string, boolean>} */
		deleting: {},
	});

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
	 * @param {SubmitEvent} event
	 * @param {string} messageId
	 */
	onDelete = async (event, messageId) => {
		event.preventDefault();

		this.store.setState({
			deleting: { ...this.store.getState().deleting, [messageId]: true },
		});

		try {
			await atProto.delete(messageId);
		} catch (error) {
			console.error("Error deleting message:", error);
		} finally {
			this.store.setState({
				deleting: { ...this.store.getState().deleting, [messageId]: false },
			});
		}
	};

	update() {
		const { messages } = atProto.store.getState();

		render(
			html`
        <ul class="messagesList">
          ${messages.map((message) => {
						const isDeleting =
							this.store.getState().deleting[message.id] || false;

						return html`
						<li style="display: flex; align-items: center; justify-content: space-between;">
							<span>${message.text}${message.synced ? "" : "*"}</span>
							<form @submit=${(/** @type {SubmitEvent} */ event) => this.onDelete(event, message.id)}>
							<fieldset class="ghost" ?disabled=${isDeleting}>
								<button class="secondary">Delete</button>
							</fieldset>
							</form>
						</li>`;
					})}
        </ul>
    `,
			this,
		);
	}
}

export { Messages };
