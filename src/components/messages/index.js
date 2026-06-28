import { html, render } from "lit-html";
import { atProto } from "../../atproto.js";

class Messages extends HTMLElement {
	connectedCallback() {
		this.unsubscribeClientStore = atProto.store.subscribe(
			[(state) => state.messages],
			([messages]) => this.update({ messages }),
		);
	}

	disconnectedCallback() {
		this.unsubscribeClientStore?.();
	}

	/**
	 * @param {{messages: import('../../atproto.js').Message[]}} param0
	 */
	update({ messages }) {
		render(
			html`
      <div>
        <h2>Messages</h2>
        <ul>
          ${messages.map((message) => html`<li>${message.text}${message.synced ? "" : "*"}</li>`)}
        </ul>
      </div>
    `,
			this,
		);
	}
}

export { Messages };
