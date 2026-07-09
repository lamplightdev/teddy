import { App } from "./app.js";
import "./components/tracks.js";
import "./components/player.js";

const root = /** @type {HTMLElement} */ (document.querySelector("main"));

const app = new App({
	patterns: [
		{
			id: "home",
			pattern: new URLPattern({ pathname: "/" }),
			defaults: { page: "home" },
			roots: {
				page: () => root,
			},
		},
		{
			id: "player",
			pattern: new URLPattern({ pathname: "/player" }),
			defaults: { page: "player" },
			roots: {
				page: () => root,
			},
		},
	],
	update: (patternId, nextParams, previousParams) => {
		const { page } = nextParams;

		console.log(`Navigating to page: ${page}`);
	},
});

app.init();
