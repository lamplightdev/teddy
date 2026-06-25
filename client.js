import clientMetadata from './client-metadata.json' with { type: 'json' };

const isLocalDev = window.location.hostname === '127.0.0.1';

import {
  BrowserOAuthClient,
  OAuthSession,
} from '@atproto/oauth-client-browser';

/** * @typedef {Readonly<import('@atproto/oauth-types').OAuthClientMetadataInput>} OAuthMetadata
 */

const baseClientMetadata = /** @type {OAuthMetadata} */ (clientMetadata);

/** @type {OAuthMetadata} */
const localDevClientMetadata = {
  ...baseClientMetadata,
  client_id: `http://localhost?scope=${encodeURIComponent(clientMetadata.scope)}`,
  redirect_uris: ['http://127.0.0.1:3000/'],
};

const client = new BrowserOAuthClient({
  handleResolver: 'https://bsky.social',
  // https://atproto.com/specs/oauth#localhost-client-development
  clientMetadata: isLocalDev ? localDevClientMetadata : baseClientMetadata,
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

const COLLECTION = 'app.teddykins';
const COLLECTION_ALL = `${COLLECTION}.*`;
const COLLECTION_EVENT = `${COLLECTION}.event`;

export {
  client,
  getSession,
  isLocalDev,
  COLLECTION,
  COLLECTION_ALL,
  COLLECTION_EVENT,
};
