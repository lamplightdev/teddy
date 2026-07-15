/**
 * @typedef {Object} Pattern
 * @property {string} id
 * @property {URLPattern} pattern
 * @property {Record<string, string>} [defaults]
 * @property {Record<string, (target?: HTMLElement | null) => HTMLElement | null | undefined>} roots
 */

/**
 * @typedef {(patternId: string | null, nextParams: Record<string, string | null>, previousParams: Record<string, string | null>) => void} UpdateTemplateFunction
 */

/**
 * @typedef {Object} AppOptions
 * @property {Pattern[]} patterns
 * @property {UpdateTemplateFunction} update
 */

class App {
	initialLoad = true;

	parser = new DOMParser();

	/**
	 * @type {Map<string, HTMLTemplateElement>}
	 */
	templateCache = new Map();

	/**
	 * @type {Record<string, string | null> | null}
	 */
	lastParams = null;

	/**
	 * @type {Pattern[]}
	 */
	patterns;

	/**
	 * @type {UpdateTemplateFunction}
	 */
	updateTemplate;

	/**
	 * @param {AppOptions} options
	 */
	constructor(options) {
		this.patterns = options.patterns;

		this.updateTemplate = options.update;
	}

	/**
	 * @param {string} id
	 */
	loadTemplate = async (id) => {
		if (this.templateCache.has(id)) {
			return this.templateCache.get(id);
		}

		try {
			const response = await fetch(`./templates/${id}.thtml`);
			if (!response.ok) {
				throw new Error(`Failed to load template for id: ${id}`);
			}
			const htmlString = await response.text();

			const doc = this.parser.parseFromString(htmlString, "text/html");

			const template = doc.querySelector("template");

			if (!template) {
				throw new Error(`No template found in the fetched HTML for id: ${id}`);
			}

			const partials = template.content.querySelectorAll("[data-template]");
			for (const partial of partials) {
				const partialId = partial.getAttribute("data-template");
				if (partialId) {
					const partialTemplate = await this.loadTemplate(partialId);

					if (partialTemplate) {
						const clone = partialTemplate.content.cloneNode(true);
						partial.replaceWith(clone);
					}
				}
			}

			this.templateCache.set(id, template);

			return template;
		} catch (error) {
			console.error(error);
		}
	};

	/**
	 *
	 * @param {HTMLElement} target
	 * @param {HTMLElement} content
	 */
	renderTemplate = (target, content) => {
		target.replaceChildren(content);
	};

	/**
	 *
	 * @param {URL} url
	 */
	update = async (url) => {
		const firstMatchingPattern = this.patterns.find(({ pattern }) =>
			pattern.test(url),
		);

		const match = firstMatchingPattern?.pattern.exec(url);

		/**
		 * @type {Record<string, string | null>}
		 */
		const updatedParams = {};

		if (match) {
			const { groups } = match.pathname;

			for (const [key, value] of Object.entries(groups)) {
				updatedParams[key] = value ?? null;
			}

			for (const [key, value] of Object.entries(
				firstMatchingPattern?.defaults ?? {},
			)) {
				if (updatedParams[key] == null) {
					updatedParams[key] = value ?? null;
				}
			}
		}

		const previousParams = { ...this.lastParams };

		const nextParams = {
			...previousParams,
			...updatedParams,
		};

		this.lastParams = nextParams;

		document.startViewTransition(() => {
			this.go({
				pattern: firstMatchingPattern ?? null,
				nextParams: nextParams,
				previousParams: previousParams,
			});

			this.initialLoad = false;
		});
	};

	/**
	 *
	 * @param {{ pattern: Pattern | null, nextParams: Record<string, string|null>, previousParams: Record<string, string|null>}} options
	 */
	async go({ pattern, nextParams, previousParams }) {
		if (Object.values(nextParams).some((value) => value !== null)) {
			/**
			 * @type {HTMLElement | null | undefined}
			 */
			let root = null;

			let parentHasChanged = false;

			for (const [paramName, rootFn] of Object.entries(pattern?.roots ?? {})) {
				root = rootFn(root);

				if (!root) {
					continue;
				}

				if (
					nextParams[paramName] &&
					(parentHasChanged ||
						nextParams[paramName] !== previousParams[paramName])
				) {
					parentHasChanged = true;

					const template = await this.loadTemplate(nextParams[paramName]);

					if (!template) {
						throw new Error(
							`No template found for id: ${nextParams[paramName]}`,
						);
					}

					const newContent = /** @type {HTMLElement} */ (
						template.content.cloneNode(true)
					);

					this.renderTemplate(root, newContent);
				}
			}

			if (!root) {
				throw new Error(`No root element found for pattern: ${pattern?.id}`);
			}

			this.updateTemplate(pattern?.id ?? null, nextParams, previousParams);
		}
	}

	async init() {
		const update = this.update;

		await update(new URL(location.href));

		navigation.addEventListener("navigate", (event) => {
			if (!event.canIntercept) {
				return;
			}

			if (event.hashChange || event.downloadRequest !== null) {
				return;
			}

			const url = new URL(event.destination.url);

			if (url.pathname.startsWith("/")) {
				event.intercept({
					async handler() {
						update(url);
					},
				});
			}
		});
	}
}

export { App };
