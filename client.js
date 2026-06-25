import clientMetadata from './client-metadata.json' with { type: 'json' };

import {
  BrowserOAuthClient,
  OAuthSession,
} from '@atproto/oauth-client-browser';

const isLocalDev = window.location.hostname === '127.0.0.1';

const client = new BrowserOAuthClient({
  handleResolver: 'https://bsky.social',
  clientMetadata: isLocalDev ? undefined : clientMetadata,
});

const result = await client.init();
let session = null;

if (result) {
  const { session: newSession, state } = result;
  /*
  The return value can be used to determine if the client was able to restore
  the last used session (session is defined) or if the current navigation is the
  result of an authorization redirect (both session and state are defined).
  */
  session = newSession;

  if (state != null) {
    console.log(
      `${session.sub} was successfully authenticated (state: ${state})`,
    );
  } else {
    console.log(`${session.sub} was restored (last active session)`);
  }
}

const getSession = () => session;

export { client, getSession };
