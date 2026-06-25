import { client, session } from './client.js';
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

  handleEvent(event) {
    if (event.type === 'click') {
      if (event.target.id === 'loginButton') {
        this.login();

        return;
      }

      if (event.target.id === 'postButton') {
        this.post();

        return;
      }
    }
  }

  render() {
    this.innerHTML = html`
      ${agent
        ? html`<div>Logged in as ${session?.sub}</div>
            <div>
              <button id="postButton">Post to AT Protocol</button>
            </div>`
        : html` <div>
            <button id="loginButton">Login with AT Protocol</button>
          </div>`}
    `;
  }

  async login() {
    console.log('Login button clicked', client);

    try {
      await client.signIn('lamplightdev.com', {
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
