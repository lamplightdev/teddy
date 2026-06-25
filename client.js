import clientMetadata from './client-metadata.json' with { type: 'json' };

import {
  BrowserOAuthClient,
  OAuthSession,
} from '@atproto/oauth-client-browser';

const client = new BrowserOAuthClient({
  handleResolver: 'https://bsky.social',
  clientMetadata,
  // clientMetadata: undefined,
});

console.log('client', client);

const result = await client.init();
let session = null;

if (result) {
  const { session: newSession, state } = result;
  session = newSession;

  if (state != null) {
    console.log(
      `${session.sub} was successfully authenticated (state: ${state})`,
    );
  } else {
    console.log(`${session.sub} was restored (last active session)`);
  }
}

export { client, session };
