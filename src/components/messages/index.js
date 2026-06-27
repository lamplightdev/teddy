import { client } from "../../client.js";
import { html } from "../../utils.js";

class Messages extends HTMLElement {
	connectedCallback() {
		this.unsubscribeClientStore = client.store.subscribe(
			[(state) => state.messages],
			([messages]) => this.render({ messages }),
		);
	}

	disconnectedCallback() {
		this.unsubscribeClientStore?.();
	}

	/**
	 * @param {{messages: import('../../client.js').Message[]}} param0
	 */
	render({ messages }) {
		this.innerHTML = html`
      <div>
        <h2>Messages</h2>
        <ul>
          ${html`${messages.map((message) => html`<li>${message.text}</li>`)}`}
        </ul>
      </div>
    `;
	}
}

export { Messages };
