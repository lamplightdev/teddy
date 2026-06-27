import { ELEMENT_PREFIX } from "../config.js";

/**
 * Registers a custom element with the given tag name and component class.
 * @param {string} tagName - The tag name for the custom element.
 * @param {CustomElementConstructor} componentClass - The class defining the custom element.
 * @param {ElementDefinitionOptions} [options] - Optional options for defining the custom element.
 */
function register(tagName, componentClass, options = {}) {
	const fullTagName = `${ELEMENT_PREFIX}-${tagName}`;
	if (!customElements.get(fullTagName)) {
		customElements.define(fullTagName, componentClass, options);
	}
}

export { register };
