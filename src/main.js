import { App } from "./app.js";
import "./components/editor.js";

const root = /** @type {HTMLElement} */ (document.querySelector("main"));

const subPath = "/teddy";

const app = new App({
	patterns: [
		{
			id: "home",
			pattern: new URLPattern({ pathname: `${subPath}/` }),
			defaults: { page: "home" },
			roots: {
				page: () => root,
			},
		},
		{
			id: "app",
			pattern: new URLPattern({ pathname: `${subPath}/app` }),
			defaults: { page: "app" },
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
