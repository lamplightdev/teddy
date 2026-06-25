import { Agent } from '@atproto/api';
import { getSession } from './client.js';

let agent = null;

const session = getSession();

if (session) {
  agent = new Agent(session);
}

export { agent };
