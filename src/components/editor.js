import { buildHTMLFromText, processHTML } from "./utils.js";

class Editor extends HTMLElement {
	/**
	 * @type {HTMLDivElement}
	 */
	container;

	/**
	 * @type {HTMLDivElement}
	 */
	input;

	/**
	 * @type {HTMLTextAreaElement}
	 */
	textarea;

	/**
	 * @type {HTMLDivElement}
	 */
	overlay;

	/**
	 * @type {HTMLDivElement}
	 */
	output;

	/**
	 * @type {string[]}
	 */

	constructor() {
		super();

		this.container = document.createElement("div");
		this.container.classList.add("container");

		this.input = document.createElement("div");
		this.input.classList.add("input");

		this.textarea = document.createElement("textarea");
		this.textarea.classList.add("textarea");
		this.textarea.name = "input";
		this.textarea.spellcheck = false;

		this.overlay = document.createElement("div");
		this.overlay.classList.add("overlay");

		this.output = document.createElement("div");
		this.output.classList.add("output");

		this.lines = [];
	}

	connectedCallback() {
		const initialContent = this.textContent.trim();

		this.textarea.value = initialContent;

		this.innerHTML = "";

		this.input.appendChild(this.textarea);
		this.input.appendChild(this.overlay);

		this.container.appendChild(this.input);
		this.container.appendChild(this.output);

		this.appendChild(this.container);

		this.textarea.addEventListener("input", this.updateHighlight.bind(this));
		this.textarea.addEventListener("scroll", this.syncScroll.bind(this));

		this.output.addEventListener(
			"mousedown",
			this.handleOutputEvent.bind(this),
		);

		this.updateHighlight();
	}

	/**
	 *
	 * @param {Event} event
	 */
	handleOutputEvent(event) {
		const target = /** @type {HTMLElement} */ (event.target);

		if (event.type === "mousedown") {
			if (
				target.classList.contains("variable") ||
				target.classList.contains("date") ||
				target.classList.contains("result")
			) {
				event.preventDefault();
				this.insertOutputText({ textToInsert: target.textContent || "" });
				this.updateHighlight();
			}
		}
	}

	insertOutputText({ textToInsert = "" }) {
		const isFocused = document.activeElement === this.textarea;

		if (isFocused) {
			// SCENARIO A: Textarea is focused. Insert exactly at the caret position.
			const startPos = this.textarea.selectionStart;
			const endPos = this.textarea.selectionEnd;
			const currentValue = this.textarea.value;

			this.textarea.value =
				currentValue.substring(0, startPos) +
				textToInsert +
				currentValue.substring(endPos);

			this.textarea.focus();
			const newCursorPos = startPos + textToInsert.length;
			this.textarea.setSelectionRange(newCursorPos, newCursorPos);
		} else {
			// SCENARIO B: Textarea is not focused.
			const currentValue = this.textarea.value;

			// If the textarea is empty, just insert the text.
			// Otherwise, append it on a new line.
			if (currentValue === "") {
				this.textarea.value = textToInsert;
			} else {
				this.textarea.value = `${currentValue}\n${textToInsert}`;
			}

			this.textarea.focus();

			// Move the cursor to the very end of the newly appended text
			const endOfText = this.textarea.value.length;
			this.textarea.setSelectionRange(endOfText, endOfText);
		}
	}

	updateHighlight() {
		/**
		 * @type {string[]}
		 */
		const variableIds = [];
		const texts = this.textarea.value.split("\n").map((text) => {
			return buildHTMLFromText(text, variableIds);
		});

		const ps = texts.map((line, index) => {
			const p = document.createElement("p");
			p.classList.add(`line-${index}`);
			p.classList.add(`linetype-${line.type}`);
			p.innerHTML = line.text || "\u00A0"; // non-breaking space
			return p;
		});

		this.overlay.replaceChildren(...ps);

		const parts = processHTML(ps);

		const newPs = parts.map((part) => {
			const p = document.createElement("p");
			p.innerHTML = "";

			if (part.variable) {
				const variableButton = document.createElement("button");
				variableButton.classList.add("variable");
				variableButton.textContent = part.variable;
				p.appendChild(variableButton);
			}

			if (part.dateStr) {
				if (part.variable) {
					const separator = document.createElement("span");
					separator.classList.add("separator");
					separator.textContent = " | ";
					p.appendChild(separator);
				}

				const dateButton = document.createElement("button");
				dateButton.classList.add("date");
				dateButton.textContent = part.dateStr;
				p.appendChild(dateButton);

				const separator = document.createElement("span");
				separator.classList.add("separator");
				separator.textContent = " | ";
				p.appendChild(separator);
			}

			const resultButton = document.createElement("button");
			resultButton.classList.add("result");
			resultButton.textContent = part.result;
			p.appendChild(resultButton);

			return p;
		});

		this.output.replaceChildren(...newPs);
	}

	// Keep the overlay scrolling perfectly synchronized with the textarea
	syncScroll() {
		this.overlay.scrollTop = this.textarea.scrollTop;
		this.overlay.scrollLeft = this.textarea.scrollLeft;
	}
}

customElements.define("plum-editor", Editor);
