import { App } from "./app.js";

const root = /** @type {HTMLElement} */ (document.querySelector("main"));

const app = new App({
	patterns: [
		{
			id: "home",
			pattern: new URLPattern({ pathname: "/" }),
			defaults: { page: "home", section: "123", action: "a" },
			roots: {
				page: () => root,
				section: (target) => target?.querySelector("#section"),
			},
		},
		{
			id: "main",
			pattern: new URLPattern({ pathname: "/:page/:section?/:action?" }),
			defaults: { page: "home", section: "456", action: "a" },
			roots: {
				page: () => root,
				section: (target) => target?.querySelector("#section"),
			},
		},
	],
	update: (patternId, nextParams, previousParams) => {
		const { page, section, action } = nextParams;

		if (
			page !== previousParams.page ||
			section !== previousParams.section ||
			action !== previousParams.action
		) {
			root.querySelectorAll("teddykins-time").forEach((element) => {
				if (action) {
					element.setAttribute("action", action);
				} else {
					element.removeAttribute("action");
				}
			});
		}
	},
});

app.init();
