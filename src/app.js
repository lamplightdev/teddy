import { client } from "./client.js";
import "./components/messages/register.js";
import "./components/login/register.js";

await client.connect();
console.log("Client connected", client.store.getState());
