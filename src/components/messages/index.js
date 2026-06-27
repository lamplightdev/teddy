import { html, render } from "lit-html";
import { client } from "../../client.js";

class Messages extends HTMLElement {
	connectedCallback() {
		this.unsubscribeClientStore = client.store.subscribe(
			[(state) => state.messages],
			([messages]) => this.update({ messages }),
		);
	}

	disconnectedCallback() {
		this.unsubscribeClientStore?.();
	}

	/**
	 * @param {{messages: import('../../client.js').Message[]}} param0
	 */
	update({ messages }) {
		render(
			html`
      <div>
        <h2>Messages</h2>
        <ul>
          ${messages.map((message) => html`<li>${message.text}</li>`)}
        </ul>
      </div>
    `,
			this,
		);
	}
}

export { Messages };
