import { client } from './client.js';

class TeddyLogin extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.render();
    this.addEventListener('click', this);
  }

  handleEvent(event) {
    if (event.type === 'click') {
      if (event.target.id === 'loginButton') {
        this.login();
      }
    }
  }

  render() {
    this.innerHTML = `
      <button id="loginButton">Login with AT Protocol</button>
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
}

customElements.define('teddy-login', TeddyLogin);
