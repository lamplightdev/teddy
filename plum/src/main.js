import { App } from "./app.js";
import "./components/leaf.js";

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
			id: "tree",
			pattern: new URLPattern({ pathname: "/tree" }),
			defaults: { page: "tree" },
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
