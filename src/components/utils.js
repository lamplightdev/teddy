import { evaluate, Unit, unit } from "mathjs";

/**
 * @type {Record<string, number | Unit>}
 */
const evaluateScope = { k: 1_000, M: 1_000_000, G: 1_000_000_000 };

const sanitizeRegex = /[&<>"']/g;

const textRegex = /([a-zA-Z\s_0-9-]+)/g;
const commaRegex = /(,)/g;

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
		ids: [
			"divide",
			"over",
			"÷",
			"per",
			"divided by",
			"by",
			"every",
			"each",
			"between",
		],
		symbol: "/",
	},
];

const allMathOperatorWords = mathOperatorWords.flatMap((op) => op.ids);

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

const numberRegex = /((?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?[kMG]?)/g;

const numberWords = ["e", "pi"];
const numberWordsRegex = new RegExp(`\\b(${numberWords.join("|")})\\b`, "g");

const currencyUnit = ["\\$", "€", "£", "¥"];

// only match currency units if they are not preceded or followed by a letter (to avoid matching words like "in" in "tin")
const currencyUnitRegex = new RegExp(
	`(?<![a-zA-Z])(${currencyUnit.join("|")})(?![a-zA-Z])`,
	"g",
);

const postfixUnits = [
	"inch",
	"inches",
	"foot",
	"feet",
	"yard",
	"yards",
	"mile",
	"miles",
	"centimeter",
	"centimeters",
	"meter",
	"meters",
	"kilometer",
	"kilometers",
	"millimeter",
	"millimeters",
	"pound",
	"pounds",
	"ounce",
	"ounces",
	"minutes",
	"hour",
	"day",
	"days",
	"week",
	"weeks",
	"month",
	"months",
	"year",
	"years",
	"second",
	"seconds",
	"cm",
	"mm",
	"km",
	"in",
	"ft",
	"yd",
	"mi",
	"kg",
	"lb",
	"oz",
	"ms",
	"min",
	"g",
	"s",
];
// only match postfix units if they are not preceded or followed by a letter (to avoid matching words like "in" in "input")
const postfixUnitsRegex = new RegExp(
	`(?<![a-zA-Z])(${postfixUnits.join("|")})(?![a-zA-Z])`,
	"g",
);

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

const validText = ["to", "in"];
const validTextRegex = new RegExp(`\\b(${validText.join("|")})\\b`, "g");

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
function substituteInText({ input, regex, substitution }) {
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
/**
 *
 * @param {string} text
 */
export function buildHTMLFromText(text) {
	let newText = sanitize(text);

	newText = [
		{
			class: "validText",
			regex: validTextRegex,
			isMath: false,
		},
		{
			class: "variable",
			regex: variableRegex,
			isMath: false,
		},
		{
			class: "function",
			regex: validFunctionRegex,
			isMath: true,
		},
		{
			class: "postfixUnit",
			regex: postfixUnitsRegex,
			isMath: false,
		},
		{
			class: "currencyUnit",
			regex: currencyUnitRegex,
			isMath: false,
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
			class: "comma",
			regex: commaRegex,
			isMath: false,
		},
		{
			class: "operatorWord",
			regex: mathOperatorWordsRegex,
			isMath: false,
		},

		{
			class: "text",
			regex: textRegex,
			isMath: false,
		},
	].reduce((acc, { class: className, regex, isMath }) => {
		return substituteInText({
			input: acc,
			regex,
			substitution: `<span class="${className} ${isMath ? "math" : ""}">$1</span>`,
		});
	}, text);

	return newText;
}

/**
 * @param {HTMLParagraphElement[]} ps
 */
export function processHTML(ps) {
	/**
	 * @type {Record<string, {name: string, value: number | Unit, currencyUnit?: string}>}
	 */
	const variables = {};
	const evaluateScopeWithVars = { ...evaluateScope };

	const ambiguousOperators = new Set();

	const parts = ps.map((p) => {
		let result = "";
		let str = "";
		let variable = "";
		let bracketCount = 0;

		try {
			const allSpans = Array.from(p.querySelectorAll("span"));
			const variableSpans = allSpans.filter(
				(span) =>
					span.classList.contains("text") &&
					Object.keys(variables).includes(span.textContent?.trim() ?? ""),
			);
			const spanVariableNames = variableSpans.reduce((acc, span) => {
				const name = span.textContent?.trim() ?? "";
				if (name) {
					acc.add(name);
				}
				return acc;
			}, new Set());

			const filtered = allSpans.filter((span) => {
				return (
					span.classList.contains("math") ||
					span.classList.contains("comma") ||
					span.classList.contains("operatorWord") ||
					// span.classList.contains("currencyUnit") || // not supported by mathjs
					span.classList.contains("postfixUnit") ||
					variableSpans.includes(span) ||
					span.classList.contains("validText")
				);
			});

			const currencyUnits = allSpans
				.filter((span) => span.classList.contains("currencyUnit"))
				.map((span) => span.textContent?.trim() ?? "");

			const variableCurrencyUnits = /** @type {string[]} */ (
				spanVariableNames.size
					? Array.from(spanVariableNames)
							.map((name) => variables[name]?.currencyUnit)
							.filter(Boolean)
					: []
			);

			const allCurrencyUnits = [...currencyUnits, ...variableCurrencyUnits];
			const consistentCurrencyUnit =
				allCurrencyUnits.length > 0
					? allCurrencyUnits.every((unit) => unit === allCurrencyUnits[0])
						? allCurrencyUnits[0]
						: undefined
					: undefined;

			// if a postfix unit is not preceded by a number,
			// insert a number span with a value of 1 before it
			// (e.g. "cm" becomes "1cm")
			// unless the previous span is validText (to allow 5ft to mm)
			for (let i = 0; i < filtered.length; i++) {
				const span = filtered[i];
				const prevSpan = filtered[i - 1];

				if (
					span.classList.contains("postfixUnit") &&
					!prevSpan?.classList.contains("validText")
				) {
					const prevSpan = filtered[i - 1];
					if (!prevSpan?.classList.contains("number")) {
						const numberSpan = document.createElement("span");
						numberSpan.classList.add("number", "math");
						numberSpan.textContent = "1";
						filtered.splice(i, 0, numberSpan);
					}
				}
			}

			str = filtered
				.map((span) => {
					const text = span.textContent?.trim() ?? "";

					if (span.classList.contains("operator")) {
						if (text === "(") {
							bracketCount++;
						} else if (text === ")") {
							bracketCount--;
						}
					}

					if (span.classList.contains("comma")) {
						if (text === ",") {
							if (bracketCount < 1) {
								return "";
							}
						}
					}

					if (span.classList.contains("validText")) {
						return ` ${text} `;
					}

					if (span.classList.contains("operatorWord")) {
						const lowerText = text.toLowerCase();

						if (ambiguousOperators.has(lowerText)) {
							return text;
						}

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
			} else {
				result = `${result}`.replace(/\s+/g, "").trim();
			}

			const currencyUnit = consistentCurrencyUnit;

			if (variable) {
				const resultIsNumber = !Number.isNaN(Number(result));

				variables[variable] = {
					name: variable,
					value: resultIsNumber ? Number(result) : unit(result),
					currencyUnit,
				};

				evaluateScopeWithVars[variable] = variables[variable].value;

				const variableLower = variable.toLowerCase();

				if (allMathOperatorWords.includes(variableLower)) {
					ambiguousOperators.add(variableLower);
				}
			}

			if (currencyUnit) {
				result = `${currencyUnit}${result}`;
			}
		} catch (error) {
			console.log(`Error evaluating line ${p.textContent}:`, error);
			result = p.textContent?.trim() ?? "";
		}

		console.log(`Line ${str}: ${result}`, variable, evaluateScopeWithVars);
		return { result, str, variable };
	});

	return parts;
}
