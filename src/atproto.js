import { Client, isXRPCErrorPayload } from "@atcute/client";
import {
	CompositeDidDocumentResolver,
	LocalActorResolver,
	PlcDidDocumentResolver,
	WebDidDocumentResolver,
	XrpcHandleResolver,
} from "@atcute/identity-resolver";
import { JetstreamSubscription } from "@atcute/jetstream";
import {
	configureOAuth,
	createAuthorizationUrl,
	deleteStoredSession,
	finalizeAuthorization,
	getSession,
	OAuthUserAgent,
} from "@atcute/oauth-browser-client";
import * as TID from "@atcute/tid";
import clientMetadata from "./client-metadata.json" with { type: "json" };
import { COLLECTION_EVENT, isLocalDev } from "./config.js";
import { Store } from "./store.js";

/** @import {Session} from '@atcute/oauth-browser-client' */
/** @import {ActorIdentifier, Did} from '@atcute/lexicons' */

/**
 * A message object.
 * @typedef {Object} Message
 * @property {string} id - Message ID.
 * @property {string} text - Message text.
 * @property {boolean} synced - Whether the message has been synced with the server.
 */

class AtProto {
	store = new Store({
		/**
		 * @type {boolean}
		 */
		ready: false,
		/**
		 * @type {Client | null}
		 */
		client: null,
		/**
		 * @type {Session | null}
		 */
		session: null,
		/**
		 * @type {OAuthUserAgent | null}
		 */
		agent: null,
		/**
		 * @type {Did | null}
		 */
		did: null,
		/**
		 * @type {Message[]}
		 */
		messages: [],
	});

	/**
	 * @type {JetstreamSubscription | null}
	 */
	subscription = null;

	/**
	 * @type {number | null}
	 */
	cursor = null;

	constructor() {
		this.store.subscribe([(state) => state.did], ([did]) => this.listen(did));
	}

	async connect() {
		const clientId = isLocalDev
			? `http://localhost?scope=${encodeURIComponent(
					clientMetadata.scope ?? "",
				)}`
			: clientMetadata.client_id;
		const redirectUri = isLocalDev
			? "http://127.0.0.1:3000/"
			: clientMetadata.redirect_uris[0];

		configureOAuth({
			metadata: {
				client_id: clientId,
				redirect_uri: redirectUri,
			},
			identityResolver: new LocalActorResolver({
				handleResolver: new XrpcHandleResolver({
					serviceUrl: "https://public.api.bsky.app",
				}),
				didDocumentResolver: new CompositeDidDocumentResolver({
					methods: {
						plc: new PlcDidDocumentResolver(),
						web: new WebDidDocumentResolver(),
					},
				}),
			}),
		});

		/**
		 * @type {Client | null}
		 */
		let client = null;

		/**
		 * @type {Session | null}
		 */
		let session = null;

		/**
		 * @type {OAuthUserAgent | null}
		 */
		let agent = null;

		/**
		 * @type {Did | null}
		 */
		let did = null;

		const storedDid = /** @type {Did | null} */ (
			localStorage.getItem("teddy-did")
		);

		try {
			if (
				`${window.location.origin}${window.location.pathname}` ===
					redirectUri &&
				window.location.hash
			) {
				const params = new URLSearchParams(location.hash.slice(1));

				// scrub params from URL to prevent replay
				history.replaceState(null, "", location.pathname + location.search);

				({ session } = await finalizeAuthorization(params));
			} else {
				if (storedDid) {
					session = await getSession(storedDid, {
						allowStale: true,
					});
				}
			}

			if (session) {
				agent = new OAuthUserAgent(session);
				client = new Client({ handler: agent });

				did = session.info.sub;
				localStorage.setItem("teddy-did", did);
			}
		} catch (error) {
			console.error("Error during AtProto connection:", error);
			localStorage.removeItem("teddy-did");
		}

		this.store.setState({ ready: true, client, session, agent, did });

		this.list();
	}

	/**
	 * @param {String} handle
	 */
	async login(handle) {
		const cleanHandle = handle.trim();
		if (cleanHandle === "") {
			console.error("Handle cannot be empty.");
			return;
		}

		const authUrl = await createAuthorizationUrl({
			target: {
				type: "account",
				identifier: /** @type {ActorIdentifier} */ (cleanHandle),
			},
			scope: "atproto transition:generic",
		});

		await /** @type {Promise<void>} */ (
			new Promise((resolve) => {
				setTimeout(() => {
					window.location.assign(authUrl);
					resolve();
				}, 200);
			})
		);
	}

	async logout() {
		const storedDid = /** @type {Did | null} */ (
			localStorage.getItem("teddy-did")
		);

		if (storedDid) {
			try {
				const session = await getSession(storedDid, { allowStale: true });
				const agent = new OAuthUserAgent(session);
				await agent.signOut();

				this.unlisten();
				this.store.setState({
					session: null,
					agent: null,
					did: null,
					messages: [],
				});
			} catch {
				deleteStoredSession(storedDid); // fallback if signOut fails
			} finally {
				localStorage.removeItem("teddy-did");
			}
		}
	}

	/**
	 * @param {Did | null} did
	 */
	async listen(did) {
		if (!did) {
			console.error("DID is not available. Please log in first.");
			this.unlisten();
			return;
		}

		this.subscription = new JetstreamSubscription({
			url: [
				"wss://jetstream2.us-east.bsky.network",
				"wss://jetstream1.us-east.bsky.network",
				"wss://jetstream1.us-west.bsky.network",
				"wss://jetstream2.us-west.bsky.network",
			],
			wantedCollections: [COLLECTION_EVENT],
			wantedDids: [did],
			cursor: this.cursor ?? Date.now() * 1000 - 5_000_000, // convert to microseconds
			onConnectionOpen(event) {
				console.log("Hello Jetstream!", new Date().toISOString(), event);
			},
			onConnectionClose(event) {
				console.log("Bye Jetstream!", new Date().toISOString(), event);
			},
			onConnectionError(event) {
				console.log("Oh oh Jetstream!", new Date().toISOString(), event);
			},
		});

		for await (const event of this.subscription) {
			if (event.kind === "commit") {
				const uri = `at://${event.did}/${event.commit.collection}/${event.commit.rkey}`;

				const record = /** @type {Message} */ (event.commit.record);

				this.store.setState((prevState) => {
					const existingMessageIndex = prevState.messages.findIndex(
						(msg) => msg.id === uri,
					);

					if (existingMessageIndex !== -1) {
						// Update the existing message
						const updatedMessages = [...prevState.messages];
						updatedMessages[existingMessageIndex] = {
							...updatedMessages[existingMessageIndex],
							text: record.text ?? "No title",
							synced: true,
						};

						return {
							...prevState,
							messages: updatedMessages,
						};
					}

					return {
						...prevState,
						messages: [
							{
								id: uri,
								text: record.text ?? "No title",
								synced: true,
							},
							...prevState.messages,
						],
					};
				});
				console.log("New event received", new Date().toISOString(), event);

				this.cursor = event.time_us - 5_000_000;
			}
		}
	}

	async unlisten() {
		this.subscription = null;
		this.cursor = null;
	}

	async list() {
		const { did, client } = this.store.getState();

		if (!did || !client) {
			console.error("Did or Client is not initialized. Please log in first.");
			return;
		}

		const { data } = await client.get("com.atproto.repo.listRecords", {
			params: {
				repo: did,
				collection: COLLECTION_EVENT,
				limit: 10,
			},
		});

		if (!isXRPCErrorPayload(data)) {
			const messages = data.records.map((record) => ({
				id: record.uri,
				text: /** @type {string} */ (record.value.text),
				synced: true,
			}));
			this.store.setState({ messages });
		} else {
			console.error("Failed to fetch messages:", data);
		}
	}

	/**
	 * @param {string} message
	 */
	async post(message) {
		const cleanMessage = message.trim();
		if (cleanMessage === "") {
			console.error("Message cannot be empty.");
			return;
		}

		const { did, client } = this.store.getState();

		if (!did || !client) {
			console.error("Did or Client is not initialized. Please log in first.");
			return;
		}

		const newId = TID.now();

		this.store.setState((prevState) => ({
			...prevState,
			messages: [
				{
					id: `at://${did}/${COLLECTION_EVENT}/${newId}`,
					text: cleanMessage,
					synced: false,
				},
				...prevState.messages,
			],
		}));

		await client.post("com.atproto.repo.putRecord", {
			input: {
				repo: did,
				collection: COLLECTION_EVENT,
				rkey: newId,
				record: {
					text: cleanMessage,
				},
			},
		});
	}
}

const atProto = new AtProto();

export { atProto };
