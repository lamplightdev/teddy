import { client } from './client.js';
import './teddy-login.js';

await client.connect();
console.log('Client connected', client.store.getState());
