import clientMetadata from './client-metadata.json' with { type: 'json' };

import {
  BrowserOAuthClient,
  OAuthSession,
} from '@atproto/oauth-client-browser';
import { Agent } from '@atproto/api';

const client = await BrowserOAuthClient.load({
  clientId: clientMetadata.client_id,
  handleResolver: 'https://bsky.social',
});

console.log('client', client);

const result = await client.init();

if (result) {
  const { session, state } = result;
  if (state != null) {
    console.log(
      `${session.sub} was successfully authenticated (state: ${state})`,
    );
  } else {
    console.log(`${session.sub} was restored (last active session)`);
  }
}

export { client };
