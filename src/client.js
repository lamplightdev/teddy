import { Agent } from "@atproto/api";
import { TID } from "@atproto/common-web";
import {
	BrowserOAuthClient,
	OAuthSession,
} from "@atproto/oauth-client-browser";
import clientMetadata from "./client-metadata.json" with { type: "json" };
import { COLLECTION_EVENT, isLocalDev } from "./config.js";
import { Store } from "./store.js";

/** @import { OAuthClientMetadataInput } from '@atproto/oauth-types' */
/** @import { AppBskyActorDefs } from '@atproto/api' */

/**
 * A message object.
 * @typedef {Object} Message
 * @property {string} id - Message ID.
 * @property {string} text - Message text.
 */

class Client {
	static baseClientMetadata = /** @type {OAuthClientMetadataInput} */ (
		clientMetadata
	);

	store = new Store({
		/**
		 * @type {BrowserOAuthClient | null}
		 */
		client: null,
		/**
		 * @type {OAuthSession | null}
		 */
		session: null,
		/**
		 * @type {Agent | null}
		 */
		agent: null,
		/**
		 * @type {AppBskyActorDefs.ProfileViewDetailed | null}
		 */
		profile: null,
		/**
		 * @type {Message[]}
		 */
		messages: [],
	});

	/**
	 * @type {WebSocket | null}
	 */
	socket = null;

	/**
	 * @type {number | null}
	 */
	cursor = null;

	constructor() {
		this.store.subscribe([(state) => state.profile], ([profile]) =>
			this.listen(profile),
		);
	}

	async connect() {
		/** @type {OAuthClientMetadataInput} */
		const localDevClientMetadata = {
			...Client.baseClientMetadata,
			client_id: `http://localhost?scope=${encodeURIComponent(Client.baseClientMetadata.scope ?? "")}`,
			redirect_uris: ["http://127.0.0.1:3000/"],
		};

		const client = new BrowserOAuthClient({
			handleResolver: "https://bsky.social",
			// https://atproto.com/specs/oauth#localhost-client-development
			clientMetadata: isLocalDev
				? localDevClientMetadata
				: Client.baseClientMetadata,
		});

		const result = await client.init();

		/**
		 * @type {OAuthSession | null}
		 */
		let session = null;

		/**
		 * @type {Agent | null}
		 */
		let agent = null;

		/**
		 * @type {AppBskyActorDefs.ProfileViewDetailed | null}
		 */
		let profile = null;

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

			agent = new Agent(session);
			const profileResponse = await agent.getProfile({
				actor: agent.assertDid,
			});
			profile = profileResponse.success ? (profileResponse.data ?? null) : null;
		}

		this.store.setState({ client, session, agent, profile });

		this.list();
	}

	/**
	 * @param {AppBskyActorDefs.ProfileViewDetailed | null} profile
	 */
	async listen(profile) {
		if (!profile) {
			console.error("Profile is not available. Please log in first.");
			this.unlisten();
			return;
		}

		const cursorParam = this.cursor != null ? `&cursor=${this.cursor}` : "";

		this.socket = new WebSocket(
			`wss://jetstream1.us-east.bsky.network/subscribe?wantedCollections=${COLLECTION_EVENT}&wantedDids=${profile.did}${cursorParam}`,
		);

		this.socket.addEventListener("open", (event) => {
			console.log("Hello Jetstream!", new Date().toISOString(), event);
		});

		this.socket.addEventListener("close", (event) => {
			console.log("Bye Jetstream!", new Date().toISOString(), event);

			setTimeout(() => {
				console.log("Attempting to reconnect to Jetstream...");
				this.listen(profile);
			}, 5000);
		});

		this.socket.addEventListener("message", (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.kind === "commit") {
					this.store.setState((prevState) => ({
						...prevState,
						messages: [
							{
								id: data.commit.cid,
								text: data.commit.record.title ?? "No title",
							},
							...prevState.messages,
						],
					}));
					console.log("New event received", new Date().toISOString(), data);

					this.cursor = data.time_us - 5_000_000;
				}
			} catch (error) {
				console.error("Error parsing message", error);
			}
		});
	}

	async unlisten() {
		this.socket?.close();
		this.socket = null;
		this.cursor = null;
	}

	async login() {
		const { client } = this.store.getState();

		if (!client) {
			console.error(
				"Client is not initialized. Please check your configuration.",
			);
			return;
		}

		try {
			await client.signIn("chrishaynes79.bsky.social", {
				state: "some value needed later",
				signal: new AbortController().signal, // Optional, allows to cancel the sign in (and destroy the pending authorization, for better security)
			});
		} catch (error) {
			console.error(error);
		}
	}

	async logout() {
		const { client, session } = this.store.getState();

		if (!client || !session) {
			console.error(
				"Client is not initialized or session is not available. Please check your configuration.",
			);
			return;
		}

		try {
			await client.revoke(session.sub);
			this.unlisten();
			this.store.setState({
				session: null,
				agent: null,
				profile: null,
				messages: [],
			});
		} catch (error) {
			console.error(error);
		}
	}

	async list() {
		const { agent } = this.store.getState();

		if (!agent) {
			console.error("Agent is not initialized. Please log in first.");
			return;
		}

		const data = await agent.com.atproto.repo.listRecords({
			repo: agent.assertDid,
			collection: COLLECTION_EVENT,
		});

		if (data.success) {
			const messages = data.data.records.map((record) => ({
				id: record.cid,
				text: /** @type {string} */ (record.value.title),
			}));
			this.store.setState({ messages });
		} else {
			console.error("Failed to fetch messages:", data);
		}
	}

	async post() {
		const { agent } = this.store.getState();

		if (!agent) {
			console.error("Agent is not initialized. Please log in first.");
			return;
		}

		// await agent.post({
		//   text: 'Hello from Teddy!',
		// });

		await agent.com.atproto.repo.putRecord({
			repo: agent.assertDid,
			collection: COLLECTION_EVENT,
			rkey: TID.nextStr(),
			record: {
				title: `Test Event ${new Date().toISOString()}`,
			},
		});
	}
}

const client = new Client();

export { client };
