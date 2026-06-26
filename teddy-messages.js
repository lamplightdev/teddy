import { client } from './client.js';

const html = String.raw;

class TeddyMessages extends HTMLElement {
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
   * @param {{messages: import('./client').Message[]}} param0
   */
  render({ messages }) {
    this.innerHTML = html`
      <div>
        <h2>Messages</h2>
        <ul>
          ${messages.map((message) => html`<li>${message.text}</li>`).join('')}
        </ul>
      </div>
    `;
  }
}

customElements.define('teddy-messages', TeddyMessages);
