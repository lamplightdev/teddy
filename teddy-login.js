import { TID } from '@atproto/common-web';

import { appStore } from './appStore.js';
import { COLLECTION_EVENT } from './client.js';
import { Store } from './store.js';

const html = String.raw;

class TeddyLogin extends HTMLElement {
  constructor() {
    super();

    /**
     * @type {WebSocket | null}
     */
    this.socket = null;

    /**
     * @type {(() => void) | null}
     */
    this.unsubscribeStore = null;

    this.store = new Store({
      blah: {
        count: 0,
      },
    });
  }

  connectedCallback() {
    this.render();

    this.unsubscribeStore = this.store.subscribe(
      [(state) => state.blah.count],
      ([count]) => this.onUpdateCount(count),
    );
    this.listen();
    this.addEventListener('click', this);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this);
    this.unlisten();
    this.unsubscribeStore?.();
  }

  /**
   * @param {number} count
   */
  onUpdateCount(count) {
    console.log('Store updated:', count);
    this.renderCount(count);
  }

  /**
   * @param {MouseEvent} event
   */
  handleEvent(event) {
    if (event.type === 'click' && event.target instanceof HTMLElement) {
      const target = event.target;

      this.store.setState((prevState) => ({
        ...prevState,
        blah: {
          ...prevState.blah,
          count: prevState.blah.count + 1,
        },
      }));

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
    const { agent, profile } = appStore.getState();

    let content = '';

    if (agent && profile) {
      content = html`<div>
          Logged in as ${profile.displayName} (${profile.handle})
        </div>
        <div>
          <button id="postButton">Post to Teddy</button>
        </div>`;
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
    const countElement = this.querySelector('#count');
    if (countElement) {
      countElement.textContent = `Click count: ${count}`;
    }
  }

  async listen() {
    const { profile } = appStore.getState();

    if (!profile) {
      console.error('Profile is not available. Please log in first.');
      return;
    }

    this.socket = new WebSocket(
      `wss://jetstream1.us-east.bsky.network/subscribe?wantedCollections=${COLLECTION_EVENT}&wantedDids=${profile.did}`,
    );

    this.socket.addEventListener('open', (event) => {
      console.log('Hello Jetstream!', new Date().toISOString(), event);
    });

    this.socket.addEventListener('close', (event) => {
      console.log('Bye Jetstream!', new Date().toISOString(), event);

      setTimeout(() => {
        console.log('Attempting to reconnect to Jetstream...');
        this.listen();
      }, 5000);
    });

    this.socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.kind === 'commit') {
          console.log('RECEIVED', new Date().toISOString(), event);
        }
      } catch (error) {
        console.error('Error parsing message', error);
      }
    });
  }

  async unlisten() {
    this.socket?.close();
    this.socket = null;
  }

  async login() {
    const { client } = appStore.getState();

    console.log('Login button clicked', client);

    if (!client) {
      console.error(
        'Client is not initialized. Please check your configuration.',
      );
      return;
    }

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
    const { agent } = appStore.getState();

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
