import { App } from "./app.js";

const app = new App({
	patterns: [
		{
			id: "home",
			pattern: new URLPattern({ pathname: "/" }),
			defaults: { page: "home", action: "a" },
		},
		{
			id: "main",
			pattern: new URLPattern({ pathname: "/:page/:action?" }),
			defaults: { page: "home", action: "a" },
		},
	],
	update: (patternId, target, nextParams, previousParams) => {
		const { page, action } = nextParams;

		if (action) {
			if (page !== previousParams.page || action !== previousParams.action) {
				target.querySelectorAll("teddykins-time").forEach((element) => {
					element.setAttribute("action", action);
				});
			}
		}
	},
});

app.init();
