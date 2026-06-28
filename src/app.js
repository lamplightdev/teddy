import { atProto } from "./atproto.js";
import "./components/messages/register.js";
import "./components/login/register.js";

await atProto.connect();
console.log("AtProto connected", atProto.store.getState());
