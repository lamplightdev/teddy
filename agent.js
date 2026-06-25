import { Agent } from '@atproto/api';
import { getSession } from './client.js';

/**
 * @type {Agent | null}
 */
let agent = null;

const session = getSession();

if (session) {
  agent = new Agent(session);
}

export { agent };
