import { client, getSession } from './client.js';
import { agent } from './agent.js';

const html = String.raw;

class TeddyLogin extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.addEventListener('click', this);
    console.log(agent);
  }

  /**
   * @param {MouseEvent} event
   */
  handleEvent(event) {
    if (event.type === 'click' && event.target instanceof HTMLElement) {
      const target = event.target;

      if (target.id === 'loginButton') {
        this.login();

        return;
      }

      if (target.id === 'postButton') {
        this.post();

        return;
      }
    }
  }

  render() {
    if (agent) {
      const session = getSession();

      this.innerHTML = html`<div>Logged in as ${session?.sub}</div>
        <div>
          <button id="postButton">Post to AT Protocol</button>
        </div>`;

      if (session) {
        const socket = new WebSocket(
          `wss://jetstream2.us-east.bsky.network/subscribe?wantedDids=${session.sub}`,
        );

        // Connection opened
        socket.addEventListener('open', (event) => {
          console.log('Hello Jetstream!');
        });

        socket.addEventListener('message', (e) => {
          console.log(`RECEIVED: ${e.data}`);
        });
      }
    } else {
      this.innerHTML = html`
        <div>
          <button id="loginButton">Login with AT Protocol</button>
        </div>
      `;
    }
  }

  async login() {
    console.log('Login button clicked', client);

    try {
      await client.signIn('chrishaynes79.bsky.social', {
        state: 'some value needed later',
        signal: new AbortController().signal, // Optional, allows to cancel the sign in (and destroy the pending authorization, for better security)
      });
    } catch (error) {
      console.error(error);
    }
  }

  async post() {
    if (!agent) {
      console.error('Agent is not initialized. Please log in first.');
      return;
    }

    const profile = await agent.getProfile({ actor: agent.accountDid });

    console.log('Profile:', profile);
  }
}

customElements.define('teddy-login', TeddyLogin);
