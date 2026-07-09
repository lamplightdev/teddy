import "./components/time.js";

class App {
	initialLoad = true;
	root = /** @type {HTMLElement} */ (document.querySelector("main"));

	/**
	 * @type {Array<{ id: string, pattern: URLPattern, defaults?: Record<string, string> }>}
	 */
	patterns = [];

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
	 * @type {((patternId: string | null, target: HTMLElement, nextParams: Record<string, string | null>, previousParams: Record<string, string | null>) => void) | null}
	 */
	updateTemplate = null;

	/**
	 * @param {{
	 *  patterns: Array<{ id: string, pattern: URLPattern, defaults?: Record<string, string> }>,
	 *  update: ((patternId: string | null, target: HTMLElement, nextParams: Record<string, string | null>, previousParams: Record<string, string | null>) => void) | null}} options
	 */
	constructor({ patterns = [], update = null }) {
		this.patterns = patterns;

		this.updateTemplate = update;
	}

	/**
	 * @param {string} id
	 */
	loadTemplate = async (id) => {
		if (this.templateCache.has(id)) {
			return this.templateCache.get(id);
		}

		try {
			const response = await fetch(`/templates/${id}.thtml`);
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
	 * @param {Node} content
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

		this.lastParams = {
			...previousParams,
			...updatedParams,
		};

		this.go({
			patternId: firstMatchingPattern?.id ?? null,
			nextParams: this.lastParams,
			previousParams: previousParams,
		});
	};

	/**
	 *
	 * @param {{ patternId: string | null, nextParams: Record<string, string|null>, previousParams: Record<string, string|null>}} options
	 */
	async go({ patternId, nextParams, previousParams }) {
		/**
		 * @type {HTMLElement | null}
		 */
		let content = null;

		if (nextParams.page && nextParams.page !== previousParams.page) {
			const template = await this.loadTemplate(nextParams.page);

			if (!template) {
				throw new Error(`No template found for id: ${nextParams.page}`);
			}

			content = /** @type {HTMLElement} */ (template.content.cloneNode(true));
		}

		if (Object.values(nextParams).some((value) => value !== null)) {
			this.updateTemplate?.(
				patternId,
				content ?? this.root,
				nextParams,
				previousParams,
			);

			if (content) {
				if (this.initialLoad) {
					this.initialLoad = false;
					this.renderTemplate(this.root, content);
				} else {
					document.startViewTransition(() => {
						this.renderTemplate(this.root, content);
					});
				}
			}
		}
	}

	async init() {
		const update = this.update;

		await update(new URL(location.href));

		navigation.addEventListener("navigate", (event) => {
			// We can't intercept some navigations, e.g. cross-origin navigations.
			// Return early and let the browser handle them normally.
			if (!event.canIntercept) {
				return;
			}

			// We shouldn't intercept fragment navigations or downloads.
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
