const isLocalDev = window.location.hostname === "127.0.0.1";

const COLLECTION = "app.teddykins";
const COLLECTION_ALL = `${COLLECTION}.*`;
const COLLECTION_EVENT = `${COLLECTION}.event`;

const ELEMENT_PREFIX = "teddy";

export {
	COLLECTION,
	COLLECTION_ALL,
	COLLECTION_EVENT,
	ELEMENT_PREFIX,
	isLocalDev,
};
