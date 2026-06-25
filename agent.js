import { Agent } from '@atproto/api';
import { session } from './client.js';

let agent = null;

if (session) {
  agent = new Agent(session);
}

export { agent };
