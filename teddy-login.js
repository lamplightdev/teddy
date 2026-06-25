import { TID } from '@atproto/common-web';

import { agent } from './agent.js';
import { client, COLLECTION_ALL, COLLECTION_EVENT } from './client.js';

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

  async render() {
    if (agent) {
      const profile = await agent.getProfile({ actor: agent.assertDid });

      this.innerHTML = html`<div>
          Logged in as ${profile.data.displayName} (${profile.data.handle})
        </div>
        <div>
          <button id="postButton">Post to Teddy</button>
        </div>`;

      const socket = new WebSocket(
        `wss://jetstream1.us-east.bsky.network/subscribe?wantedCollections=${COLLECTION_EVENT}&wantedDids=${profile.data.did}&wantedCollections=${COLLECTION_EVENT}&cursor=${Date.now() * 1000}`,
      );

      socket.addEventListener('open', (event) => {
        console.log('Hello Jetstream!', new Date().toISOString(), event);
      });

      socket.addEventListener('close', (event) => {
        console.log('Bye Jetstream!', new Date().toISOString(), event);
      });

      socket.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.kind === 'commit') {
            console.log('RECEIVED', new Date().toISOString(), event);
          }
        } catch (error) {
          console.error('Error parsing message', error);
        }
      });
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

    // await agent.post({
    //   text: 'Hello from Teddy!',
    // });

    await agent.com.atproto.repo.putRecord({
      repo: agent.assertDid,
      collection: COLLECTION_EVENT,
      rkey: TID.nextStr(),
      record: {
        title: `Test Event ${new Date().toISOString()}`,
      },
    });
  }
}

customElements.define('teddy-login', TeddyLogin);
