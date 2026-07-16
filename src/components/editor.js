import { evaluate } from "mathjs";

/**
 * @type {Record<string, number>}
 */
const evaluateScope = { k: 1000, M: 1000000, G: 1000000000 };

const sanitizeRegex = /[&<>"']/g;

const mathOperators = ["+", "*", "-", "/", "%", "!", "(", ")", "^"];
const mathOperatorRegex = new RegExp(
	`([${mathOperators.map((op) => `\\${op}`).join("")}])`,
	"g",
);

const mathOperatorWords = [
	{
		ids: ["add", "plus", "sum", "and"],
		symbol: "+",
	},
	{
		ids: ["subtract", "minus", "less", "take away", "difference", "diff"],
		symbol: "-",
	},
	{
		ids: ["multiply", "times", "of", "x", "×", "for"],
		symbol: "*",
	},
	{
		ids: ["divide", "over", "÷", "per", "divided by", "by", "every"],
		symbol: "/",
	},
];

// Wrap alphabetic words in word boundaries, but leave symbols free
const mathOperatorWordsRegexParts = mathOperatorWords
	.flatMap((op) => op.ids)
	.map((id) => {
		// If it starts/ends with a word character, enforce word boundaries
		const startBoundary = /^\w/.test(id) ? "\\b" : "";
		const endBoundary = /\w$/.test(id) ? "\\b" : "";

		return `${startBoundary}${id}${endBoundary}`;
	});

// Join them with the OR (|) pipe
const mathOperatorWordsRegex = new RegExp(
	`(${mathOperatorWordsRegexParts.join("|")})`,
	"gi",
);

const numberRegex = /((?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?[kMGkmg]?)/g;

const numberWords = ["e", "pi"];
const numberWordsRegex = new RegExp(`\\b(${numberWords.join("|")})\\b`, "g");

const validFunctions = [
	"sin",
	"cos",
	"tan",
	"asin",
	"acos",
	"atan",
	"sqrt",
	"log",
	"ln",
	"abs",
	"ceil",
	"floor",
	"round",
	"exp",
	"pow",
	"max",
	"min",
	"random",
	"mean",
];
const validFunctionRegex = new RegExp(
	`\\b(${validFunctions.join("|")})(?=\\()`,
	"g",
);

const variableRegex = /^([^=]+?\s*=)/g;

/**
 * @param {string} input - The input string to sanitize.
 */
function sanitize(input) {
	return input.replace(sanitizeRegex, (match) => {
		switch (match) {
			case "&":
				return "&amp;";
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case '"':
				return "&quot;";
			case "'":
				return "&#39;";
			default:
				return match;
		}
	});
}

/**
 * Replaces text inside HTML using DOMParser, allowing HTML in the substitution
 * without it being escaped.
 *
 * @param {{input: string; regex: RegExp; substitution: string}} param0
 */
function replace({ input, regex, substitution }) {
	const parser = new DOMParser();
	const doc = parser.parseFromString(`<body>${input}</body>`, "text/html");

	// 1. Find all text nodes
	const textNodes = [];
	const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT, null);

	/**
	 * @type {Element | null}
	 */
	let currentNode = /** @type {Element | null} */ (walker.currentNode);
	while (currentNode) {
		textNodes.push(currentNode);
		currentNode = /** @type {Element | null} */ (walker.nextNode());
	}

	// 2. Loop and replace
	for (const textNode of textNodes) {
		// CRITICAL FIX: If this text node is no longer attached to the document
		// (because a previous replacement split or replaced it), skip it!
		if (!textNode.isConnected || !textNode.parentNode) {
			continue;
		}

		const parentNode = /** @type {Element | null} */ (textNode.parentNode);

		// Safety check: Ensure we aren't inside an already processed highlight span
		if (parentNode?.tagName === "SPAN") {
			continue;
		}

		const originalText = textNode.nodeValue;

		if (originalText && regex.test(originalText)) {
			regex.lastIndex = 0; // Reset regex state

			const newHTML = originalText.replace(regex, substitution);

			const range = doc.createRange();
			range.selectNode(textNode);
			const fragment = range.createContextualFragment(newHTML);

			textNode.replaceWith(fragment);
		}
	}

	return doc.body.innerHTML;
}

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
				this.textarea.value = currentValue + "\n" + textToInsert;
			}

			this.textarea.focus();

			// Move the cursor to the very end of the newly appended text
			const endOfText = this.textarea.value.length;
			this.textarea.setSelectionRange(endOfText, endOfText);
		}
	}

	updateHighlight() {
		const texts = this.textarea.value.split("\n").map((text) => {
			text = sanitize(text);

			text = [
				{
					class: "function",
					regex: validFunctionRegex,
					isMath: true,
				},
				{
					class: "number",
					regex: numberRegex,
					isMath: true,
				},
				{
					class: "numberWord",
					regex: numberWordsRegex,
					isMath: true,
				},
				{
					class: "operator",
					regex: mathOperatorRegex,
					isMath: true,
				},
				{
					class: "variable",
					regex: variableRegex,
					isMath: false,
				},
				{
					class: "comma",
					regex: /(,)/g,
					isMath: false,
				},
				{
					class: "operatorWord",
					regex: mathOperatorWordsRegex,
					isMath: false,
				},
				{
					class: "text",
					regex: /([a-zA-Z ]+)/g,
					isMath: false,
				},
			].reduce((acc, { class: className, regex, isMath }) => {
				return replace({
					input: acc,
					regex,
					substitution: `<span class="${className} ${isMath ? "math" : ""}">$1</span>`,
				});
			}, text);

			return text;
		});

		const text = texts
			.map((line, index) => `<p class="line-${index}">${line || "&nbsp;"}</p>`)
			.join("");

		this.overlay.innerHTML = text;

		const evaluateScopeWithVars = { ...evaluateScope };

		const parts = Array.from(this.overlay.querySelectorAll("p")).map((p) => {
			let result = "";
			let str = "";
			let variable = "";

			let bracketCount = 0;

			try {
				const filtered = Array.from(
					p.querySelectorAll(".math, .comma, .operatorWord, .text"),
				).filter((span) => {
					return (
						span.classList.contains("math") ||
						span.classList.contains("comma") ||
						span.classList.contains("operatorWord") ||
						(span.classList.contains("text") &&
							Object.keys(evaluateScopeWithVars).includes(
								span.textContent?.trim() ?? "",
							))
					);
				});

				str = filtered
					.map((span) => {
						const text = span.textContent?.trim() ?? "";

						if (text === "(") {
							bracketCount++;
						} else if (text === ")") {
							bracketCount--;
						}

						if (text === ",") {
							if (bracketCount < 1) {
								return "";
							}
						}

						if (span.classList.contains("operatorWord")) {
							const operator = mathOperatorWords.find((op) =>
								op.ids.includes(text.toLowerCase()),
							);
							if (operator) {
								return operator.symbol;
							}
						}

						return span.textContent;
					})
					.join("");

				// special case multiplication and division together (i.e for 34 per month * 12 months, we want to evaluate as 34 * 12)
				str = str.replace(`/*`, "*").replace(`*/`, "*");

				variable =
					p.querySelector("span.variable")?.textContent?.slice(0, -1)?.trim() ??
					"";

				result = evaluate(str, evaluateScopeWithVars) ?? null;

				if (result === null) {
					result = p.textContent?.trim() ?? "";
				}

				if (variable) {
					evaluateScopeWithVars[variable] = Number(result);
				}
			} catch (error) {
				console.log(`Error evaluating line ${p.textContent}:`, error);
				result = p.textContent?.trim() ?? "";
			}

			console.log(`Line ${str}: ${result}`);
			return { result, str, variable };
		});

		this.output.innerHTML = parts
			.map(
				(result) =>
					`<p>${result.variable ? `<button class="variable">${result.variable}</button>=` : ""}<button class="result">${result.result}</button></p>`,
			)
			.join("");
	}

	// Keep the overlay scrolling perfectly synchronized with the textarea
	syncScroll() {
		this.overlay.scrollTop = this.textarea.scrollTop;
		this.overlay.scrollLeft = this.textarea.scrollLeft;
	}
}

customElements.define("plum-editor", Editor);
