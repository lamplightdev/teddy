import * as chrono from "chrono-node";
import { createUnit, evaluate, format, Unit } from "mathjs";

const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const customChrono = chrono.casual.clone();
customChrono.refiners.push({
	refine: (context, results) => {
		// all dates should at least have a start date that explicitly has a day
		return results
			.filter((result) => {
				return (
					result.start.isCertain("day") || result.start.isCertain("weekday")
				);
			})
			.map((result) => {
				result.start.date().setSeconds(0, 0);
				result.start.imply("hour", 0);
				result.start.imply("minute", 0);
				result.start.imply("second", 0);
				result.start.imply("millisecond", 0);

				result.end?.date().setSeconds(0, 0);
				result.end?.imply("hour", 0);
				result.end?.imply("minute", 0);
				result.end?.imply("second", 0);
				result.end?.imply("millisecond", 0);

				return result;
			});
	},
});

console.log(
	customChrono.parse("2 days ago", {
		timezone,
	}),
);

/**
 * @type {Record<string, number | Unit>}
 */
const evaluateScope = {
	k: 1_000,
	M: 1_000_000,
	G: 1_000_000_000,
	USD: createUnit("USD", {
		prefixes: "short",
	}),
	EUR: createUnit("EUR", "1 USD"),
	GBP: createUnit("GBP", "1 USD"),
	JPY: createUnit("JPY", "1 USD"),
};

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
		ids: ["multiply", "times", "of", "x", "×", "for", "at"],
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

const currencyUnit = [
	{
		symbol: "$",
		symbolRegex: "\\$",
		unit: "USD",
	},
	{
		symbol: "€",
		symbolRegex: "€",
		unit: "EUR",
	},
	{
		symbol: "£",
		symbolRegex: "£",
		unit: "GBP",
	},
	{
		symbol: "¥",
		symbolRegex: "¥",
		unit: "JPY",
	},
];

// only match currency units if they are not preceded or followed by a letter (to avoid matching words like "in" in "tin")
const currencyUnitRegex = new RegExp(
	`(?<![a-zA-Z])(${currencyUnit.map((c) => c.symbolRegex).join("|")})(?![a-zA-Z])`,
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
	"hours",
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
	"deg",
	"rad",
	"USD",
	"EUR",
	"GBP",
	"JPY",
].sort((a, b) => b.length - a.length); // Sort by length to match longer units first

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

const numberDecimalPoints = 14;
const currencyDecimalPoints = 2;

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
 * @param {{input: string; regex: RegExp; substitutionStart: string; substitutionEnd: string; tryDate: boolean}} param0
 */
function substituteRegexInText({
	input,
	regex,
	substitutionStart,
	substitutionEnd,
	tryDate,
}) {
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

		if (originalText) {
			if (regex.test(originalText)) {
				regex.lastIndex = 0; // Reset regex state

				const newHTML = originalText.replace(regex, (match) => {
					if (tryDate) {
						const { input: dateSubstituted, dateFound } = substituteDateInText({
							input: match,
						});

						if (dateFound) {
							return dateSubstituted;
						}
					}

					return `${substitutionStart}${match}${substitutionEnd}`;
				});

				const range = doc.createRange();
				range.selectNode(textNode);
				const fragment = range.createContextualFragment(newHTML);

				textNode.replaceWith(fragment);
			}
		}
	}

	return doc.body.innerHTML;
}
/**
 * @param {{input: string}} param0
 */
function substituteDateInText({ input }) {
	const date = customChrono.parse(input, {
		timezone,
	});

	const dateFound = date.length > 0;

	for (const result of date) {
		const { text: dateText, start, end } = result;
		const startDate = start.date();
		const endDate = end ? end.date() : null;

		const span = document.createElement("span");
		span.classList.add("date");
		span.setAttribute("data-start", startDate.toISOString());
		span.setAttribute("data-end", endDate ? endDate.toISOString() : "");
		span.textContent = dateText;

		input = input.replace(dateText, span.outerHTML);
	}

	return {
		input,
		dateFound,
	};
}

/**
 *
 * @param {string} text
 */
export function buildHTMLFromText(text) {
	let newText = sanitize(text);

	// newText = substituteDateInText({
	newText = [
		{
			class: "validText",
			regex: validTextRegex,
			isMath: false,
			tryDate: false,
		},
		{
			class: "variable",
			regex: variableRegex,
			isMath: false,
			tryDate: false,
		},
		{
			class: "function",
			regex: validFunctionRegex,
			isMath: true,
			tryDate: false,
		},
		{
			class: "postfixUnit",
			regex: postfixUnitsRegex,
			isMath: false,
			tryDate: false,
		},
		{
			class: "currencyUnit",
			regex: currencyUnitRegex,
			isMath: false,
			tryDate: false,
		},
		{
			class: "number",
			regex: numberRegex,
			isMath: true,
			tryDate: false,
		},
		{
			class: "numberWord",
			regex: numberWordsRegex,
			isMath: true,
			tryDate: false,
		},
		{
			class: "operator",
			regex: mathOperatorRegex,
			isMath: true,
			tryDate: false,
		},
		{
			class: "comma",
			regex: commaRegex,
			isMath: false,
			tryDate: false,
		},
		{
			class: "operatorWord",
			regex: mathOperatorWordsRegex,
			isMath: false,
			tryDate: false,
		},
		{
			class: "text",
			regex: textRegex,
			isMath: false,
			tryDate: true,
		},
	].reduce((acc, { class: className, regex, isMath, tryDate }) => {
		return substituteRegexInText({
			input: acc,
			regex,
			substitutionStart: `<span class="${className} ${isMath ? "math" : ""}">`,
			substitutionEnd: `</span>`,
			tryDate,
		});
	}, newText);

	return {
		text: newText,
	};
}

/**
 *
 * @param {number} value
 */
function makeZeroIfCloseToZero(value) {
	if (Math.abs(value) < 10 ** -numberDecimalPoints) {
		return 0;
	}
	return value;
}

/**
 * @param {Date} date
 */
function formatDate(date) {
	// get date in timezone
	const options = {
		timeZone: timezone,
		year: /** @type {const} */ ("numeric"),
		month: /** @type {const} */ ("2-digit"),
		day: /** @type {const} */ ("2-digit"),
		hour: /** @type {const} */ ("2-digit"),
		minute: /** @type {const} */ ("2-digit"),
		second: /** @type {const} */ ("2-digit"),
		hour12: false,
	};

	const formatter = new Intl.DateTimeFormat("en-GB", options);
	const parts = formatter.formatToParts(date);

	/**
	 * @type {Record<string, string>}
	 */
	const dateParts = {};
	for (const part of parts) {
		if (part.type !== "literal") {
			dateParts[part.type] = part.value;
		}
	}

	let formattedDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

	if (dateParts.minute === "00" && dateParts.hour === "00") {
		return formattedDate; // YYYY-MM-DD
	}

	formattedDate += ` ${dateParts.hour}:${dateParts.minute}`; // YYYY-MM-DD HH:MM

	return formattedDate;
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
		const str = p.textContent?.trim() ?? "";

		const allSpans = Array.from(p.querySelectorAll("span"));
		const variableSpans = allSpans
			.filter(
				(span) =>
					span.classList.contains("text") &&
					Object.keys(variables).includes(span.textContent?.trim() ?? ""),
			)
			.map((span) => {
				span.setAttribute("data-variable", span.textContent?.trim() ?? "");
				return span;
			});

		const filteredMath = allSpans.filter((span) => {
			return (
				span.classList.contains("math") ||
				span.classList.contains("comma") ||
				span.classList.contains("operatorWord") ||
				span.classList.contains("currencyUnit") ||
				span.classList.contains("postfixUnit") ||
				// variableSpans.includes(span) ||
				span.classList.contains("validText") ||
				span.classList.contains("date") ||
				(span.classList.contains("text") && span.textContent?.trim() !== "")
			);
		});

		// if a postfix unit is not preceded by a number,
		// insert a number span with a value of 1 before it
		// (e.g. "cm" becomes "1cm")
		// unless the previous span is validText (to allow 5ft to mm)
		for (let i = 0; i < filteredMath.length; i++) {
			const span = filteredMath[i];
			const prevSpan = filteredMath[i - 1];

			if (
				span.classList.contains("postfixUnit") &&
				!prevSpan?.classList.contains("validText")
			) {
				const prevSpan = filteredMath[i - 1];

				if (
					prevSpan &&
					!prevSpan.classList.contains("number") &&
					!variableSpans.includes(prevSpan)
				) {
					const numberSpan = document.createElement("span");
					numberSpan.classList.add("number", "math");
					numberSpan.textContent = "1";
					filteredMath.splice(i, 0, numberSpan);

					if (prevSpan?.classList.contains("operator")) {
						if (prevSpan.textContent?.trim() === ")") {
							// If the previous span is a closing parenthesis, insert a multiplication operator before the number
							const multiplicationSpan = document.createElement("span");
							multiplicationSpan.classList.add("operator", "math");
							multiplicationSpan.textContent = "*";

							filteredMath.splice(i, 0, multiplicationSpan);
						}
					}
				}
			}
		}

		// remove any commas that are not inside brackets (e.g. "1,000" becomes "1000")
		let bracketCount = 0;
		for (let i = 0; i < filteredMath.length; i++) {
			const span = filteredMath[i];

			if (span.classList.contains("comma")) {
				if (span.textContent?.trim() === ",") {
					if (bracketCount < 1) {
						filteredMath.splice(i, 1);
						i--;
					}
				}
			}

			if (span.classList.contains("operator")) {
				const text = span.textContent?.trim() ?? "";
				if (text === "(") {
					bracketCount++;
				} else if (text === ")") {
					bracketCount--;
				}
			}
		}

		// if there are any currency units followed by a number, swap them so that the number comes first (e.g. "$5" becomes "5$")
		for (let i = 0; i < filteredMath.length - 1; i++) {
			const span = filteredMath[i];
			const nextSpan = filteredMath[i + 1];

			if (
				span.classList.contains("currencyUnit") &&
				nextSpan.classList.contains("number")
			) {
				filteredMath.splice(i, 2, nextSpan, span);
			}
		}

		const adjusted = filteredMath.map((span) => {
			const clonedSpan = /** @type {HTMLSpanElement} */ (span.cloneNode(true));

			const text = clonedSpan.textContent;
			const trimmedText = text.trim();

			let newText = text;

			if (clonedSpan.classList.contains("currencyUnit")) {
				const unitObj = currencyUnit.find((c) => c.symbol === trimmedText);
				if (unitObj) {
					newText = unitObj.unit;
				}
			} else if (clonedSpan.classList.contains("validText")) {
				newText = ` ${trimmedText} `;
			} else if (clonedSpan.classList.contains("operatorWord")) {
				const lowerText = trimmedText.toLowerCase();

				if (ambiguousOperators.has(lowerText)) {
					newText = trimmedText;
				} else {
					const operator = mathOperatorWords.find((op) =>
						op.ids.includes(trimmedText.toLowerCase()),
					);

					if (operator) {
						span.classList.remove("operatorWord");
						span.classList.add("operator");
						span.classList.add("math");
						newText = operator.symbol;
					}
				}
			}

			clonedSpan.textContent = newText;

			return clonedSpan;
		});

		let currentIndex = 0;
		let dateAndMathString = "";
		/**
		 * @type {Record<number, string>}
		 */
		const mathStrings = {};
		let hasDate = false;

		// split the adjusted spans into the sections between date or test spans
		for (const span of adjusted.values()) {
			if (span.classList.contains("date")) {
				dateAndMathString += span.getAttribute("data-start");
				hasDate = true;
				currentIndex++;
			} else if (!span.classList.contains("text") || span.dataset.variable) {
				if (!mathStrings[currentIndex]) {
					mathStrings[currentIndex] = "";
					dateAndMathString += ` __${currentIndex}__ `;
				}

				mathStrings[currentIndex] += span.textContent;
			}
		}

		const mathResults = {};
		Object.entries(mathStrings).forEach(([index, str]) => {
			const newStr = str.replace(`/*`, "*").replace(`*/`, "*");

			let stringResult = newStr;

			try {
				// special case multiplication and division together (i.e for 34 per month * 12 months, we want to evaluate as 34 * 12)

				console.log(`Evaluating line:`, newStr, evaluateScopeWithVars);
				let originalResult = evaluate(newStr, evaluateScopeWithVars) ?? null;

				if (originalResult !== null) {
					if (typeof originalResult === "number") {
						originalResult = makeZeroIfCloseToZero(originalResult);
					} else if (originalResult instanceof Unit) {
						originalResult.value = makeZeroIfCloseToZero(originalResult.value);
					}

					const isCurrency = currencyUnit.find(
						(c) => c.unit === originalResult?.units?.[0]?.unit?.name,
					);
					if (isCurrency) {
						stringResult = format(originalResult.value, {
							notation: "fixed",
							precision: currencyDecimalPoints,
						});
						stringResult = `${isCurrency.symbol}${stringResult}`;
					} else {
						stringResult = format(originalResult, {
							precision: numberDecimalPoints,
							upperExp: 8,
							lowerExp: -8,
						});
					}
					stringResult = `${stringResult}`.replace(/\s+/g, "").trim();
				}

				mathResults[index] = {
					stringResult,
					originalResult,
				};
			} catch (error) {
				console.log(`Error evaluating line ${p.textContent}:`, error);
				mathResults[index] = {
					stringResult: newStr,
					originalResult: null,
				};
			}
		});

		console.log(mathStrings, mathResults);

		let originalResult = null;
		let stringResult = null;

		if (!hasDate && Object.keys(mathResults).length === 1) {
			originalResult = mathResults[0].originalResult;
			stringResult = mathResults[0].stringResult;
		}

		if (hasDate) {
			dateAndMathString = dateAndMathString.replace(/__\d+__/g, (match) => {
				const index = parseInt(match.replace(/__/g, ""), 10);
				return mathResults[index]?.stringResult
					? `+ ${mathResults[index].stringResult}`
					: "";
			});

			console.log(`Parsing date and math string:`, dateAndMathString);

			const date = customChrono.parse(dateAndMathString, {
				timezone,
			});

			const dateFound = date.length > 0;

			if (dateFound) {
				originalResult = date[0].start.date();
				stringResult = formatDate(originalResult);
			}
		}

		const variable =
			p.querySelector("span.variable")?.textContent?.slice(0, -1)?.trim() ?? "";

		if (variable) {
			variables[variable] = {
				name: variable,
				value: originalResult,
			};

			console.log(variables);

			evaluateScopeWithVars[variable] = variables[variable].value;

			const variableLower = variable.toLowerCase();

			if (allMathOperatorWords.includes(variableLower)) {
				ambiguousOperators.add(variableLower);
			}
		}

		// substitute the results back into the original string, and try parsing as date

		// 		const date = customChrono.parse(dateAndMathString, {
		// 	timezone,
		// });

		// const dateFound = date.length > 0;

		// if (dateFound) {
		// 	originalResult = date[0].start.date();
		// 	stringResult = formatDate(originalResult);
		// }

		console.log(
			`Line ${str}: ${originalResult} : ${stringResult}`,
			variable,
			evaluateScopeWithVars,
		);

		return {
			result: stringResult,
			str,
			variable,
		};
	});

	return parts;
}
