import { client } from './client.js';
import './teddy-login.js';
import './teddy-messages.js';

await client.connect();
console.log('Client connected', client.store.getState());
