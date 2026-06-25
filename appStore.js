import { Store } from './store.js';

const initialState = {
  /**
   * @type {import('@atproto/oauth-client-browser').BrowserOAuthClient | null}
   */
  client: null,
  /**
   * @type {import('@atproto/oauth-client-browser').OAuthSession | null}
   */
  session: null,
  /**
   * @type {import('@atproto/api').Agent | null}
   */
  agent: null,
  /**
   * @type {import('@atproto/api').AppBskyActorDefs.ProfileViewDetailed | null}
   */
  profile: null,
};

// Export the strictly typed store instance
export const appStore = new Store(initialState);
