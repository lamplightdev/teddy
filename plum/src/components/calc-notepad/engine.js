// @ts-nocheck
import { evaluate as mathEvaluate } from "https://esm.sh/mathjs@13?bundle";

/**
 * Token patterns are evaluated in order.
 * The first regex that matches at the current cursor position wins.
 *
 * This lets us parse "natural language math" linearly while still keeping
 * enough token type information to style values/operators/functions later.
 */
const TOKEN_PATTERNS = [
	["num", /^[£$€]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:\s*(?:bn|k|m|b))?%?/i],
	["wordop", /^(?:divided\s+by|multiplied\s+by|plus|minus|times|of)\b/i],
	["sym", /^(?:x|×|✕|÷|\+|-|\*|\/|\^|\(|\)|,|%|!)/],
	["ident", /^[A-Za-z_][A-Za-z0-9_]*/],
	["ws", /^\s+/],
	["skip", /^./],
];

/**
 * Word operators are rewritten into mathjs operators.
 * Example: "15% of 670" becomes "0.15 * 670".
 */
const WORD_OP_MAP = {
	"divided by": "/",
	"multiplied by": "*",
	plus: "+",
	minus: "-",
	times: "*",
	of: "*",
};

/**
 * Symbol aliases for people who type with calculator-style symbols.
 */
const SYM_OP_MAP = { x: "*", "×": "*", "✕": "*", "÷": "/", "%": "mod" };

/**
 * Identifiers that should pass through to mathjs as functions/constants.
 * Unknown words are treated as note text and removed.
 */
const MATH_FUNCTIONS = new Set([
	"sqrt",
	"cbrt",
	"abs",
	"round",
	"ceil",
	"floor",
	"trunc",
	"sign",
	"sin",
	"cos",
	"tan",
	"asin",
	"acos",
	"atan",
	"atan2",
	"log",
	"log2",
	"log10",
	"ln",
	"exp",
	"pow",
	"min",
	"max",
	"mean",
	"median",
	"mod",
	"gcd",
	"lcm",
	"factorial",
	"pi",
	"e",
	"tau",
]);

/**
 * Matches assignment expressions like:
 *   a=10
 *   revenue = 6 * cost
 * But avoids matching double equals (==).
 */
const ASSIGN_RE = /^(\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*)=(?!=)(\s*)([\s\S]*)$/;

/**
 * Convert a line of text into typed tokens with source ranges.
 * We keep ranges because decorations need absolute start/end positions.
 *
 * @param {string} text
 */
function tokenize(text) {
	let cursor = 0;
	const tokens = [];

	while (cursor < text.length) {
		const slice = text.slice(cursor);
		let matched = null;

		for (const [type, re] of TOKEN_PATTERNS) {
			const match = slice.match(re);
			if (match) {
				matched = [type, match[0]];
				break;
			}
		}

		if (!matched) {
			break;
		}

		const [type, raw] = matched;
		if (type !== "ws" && type !== "skip") {
			tokens.push({
				type,
				raw,
				from: cursor,
				to: cursor + raw.length,
			});
		}

		cursor += raw.length;
	}

	return tokens;
}

/**
 * Resolve raw tokens into a mathjs expression string.
 *
 * Responsibilities in this phase:
 * 1) Normalize number formats (commas, currency, k/m/b suffixes, percentages).
 * 2) Convert natural-language operators to symbolic operators.
 * 3) Inline known variable values from previously computed lines.
 * 4) Keep math functions/constants for mathjs.
 * 5) Drop unknown words (treated as documentation).
 *
 * @param {{ type: string, raw: string, from: number, to: number }[]} rawTokens
 * @param {Record<string, number>} vars
 */
function resolveTokens(rawTokens, vars) {
	const exprParts = [];
	const decorations = [];
	let currencySymbol = null;
	let hasValue = false;

	for (const token of rawTokens) {
		if (token.type === "num") {
			let raw = token.raw;
			let currency = null;

			if (/^[£$€]/.test(raw)) {
				currency = raw[0];
				raw = raw.slice(1);
			}

			let isPercent = false;
			if (raw.endsWith("%")) {
				isPercent = true;
				raw = raw.slice(0, -1);
			}

			const suffixMatch = raw.match(/\s*(bn|k|m|b)$/i);
			let suffix = null;
			if (suffixMatch) {
				suffix = suffixMatch[1].toLowerCase();
				raw = raw.slice(0, raw.length - suffixMatch[0].length);
			}

			let value = parseFloat(raw.replace(/,/g, ""));
			if (suffix === "k") value *= 1e3;
			else if (suffix === "m") value *= 1e6;
			else if (suffix === "b" || suffix === "bn") value *= 1e9;
			if (isPercent) value /= 100;

			if (currency && !currencySymbol) {
				currencySymbol = currency;
			}

			exprParts.push(String(value));
			decorations.push({ from: token.from, to: token.to, cls: "calc-num" });
			hasValue = true;
			continue;
		}

		if (token.type === "wordop" || token.type === "sym") {
			const wordKey = token.raw.toLowerCase().replace(/\s+/g, " ").trim();
			const operator =
				WORD_OP_MAP[wordKey] || SYM_OP_MAP[token.raw] || token.raw;
			exprParts.push(operator);

			if (token.raw !== ",") {
				decorations.push({ from: token.from, to: token.to, cls: "calc-op" });
			}
			continue;
		}

		if (token.type === "ident") {
			if (Object.hasOwn(vars, token.raw)) {
				exprParts.push(String(vars[token.raw]));
				decorations.push({
					from: token.from,
					to: token.to,
					cls: "calc-var-ref",
				});
				hasValue = true;
				continue;
			}

			if (MATH_FUNCTIONS.has(token.raw.toLowerCase())) {
				exprParts.push(token.raw);
				decorations.push({ from: token.from, to: token.to, cls: "calc-func" });
				hasValue = true;
			}
		}
	}

	return {
		expr: exprParts.join(" "),
		decos: decorations,
		currencySymbol,
		hasValue,
	};
}

/**
 * Evaluate a prepared math expression string.
 * Returns null if expression is empty, invalid, or non-numeric.
 *
 * @param {string} expr
 */
function evaluateExpr(expr) {
	if (!expr.trim()) {
		return null;
	}

	try {
		const raw = mathEvaluate(expr, {});

		if (typeof raw === "number" && Number.isFinite(raw)) {
			return Math.round(raw * 1e6) / 1e6;
		}

		if (raw && typeof raw.toNumber === "function") {
			const n = raw.toNumber();
			if (Number.isFinite(n)) {
				return Math.round(n * 1e6) / 1e6;
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Parse the editor document top-to-bottom and compute line outputs.
 *
 * Important behavior:
 * - Variables become available only after the line that defines them.
 * - Assignment lines can still contain normal expressions on the right side.
 * - We keep each line's source positions for syntax highlighting.
 *
 * @param {import("https://esm.sh/@tiptap/pm@2.6.6/model?bundle").Node} doc
 */
function parseDocument(doc) {
	const lines = [];
	const vars = {};

	doc.forEach((node, offset) => {
		if (node.type.name !== "paragraph") {
			return;
		}

		const startPos = offset + 1;
		const text = node.textContent;
		const lid = node.attrs.lid;

		let exprText = text;
		let exprOffset = 0;
		let varName = null;
		let varRange = null;

		const assignment = text.match(ASSIGN_RE);
		if (assignment) {
			const [, lead, name, , , rest] = assignment;
			varName = name;
			exprText = rest;
			exprOffset = text.length - rest.length;
			varRange = {
				from: startPos + lead.length,
				to: startPos + lead.length + name.length,
			};
		}

		const rawTokens = tokenize(exprText);
		const { expr, decos, currencySymbol, hasValue } = resolveTokens(
			rawTokens,
			vars,
		);

		const absoluteDecos = decos.map((deco) => ({
			from: startPos + exprOffset + deco.from,
			to: startPos + exprOffset + deco.to,
			cls: deco.cls,
		}));

		if (varRange && varRange.to > varRange.from) {
			absoluteDecos.push({ ...varRange, cls: "calc-var-def" });
		}

		const result = hasValue ? evaluateExpr(expr) : null;
		if (varName && result !== null) {
			vars[varName] = result;
		}

		lines.push({
			lid,
			pos: startPos,
			text,
			varName,
			result,
			currencySymbol,
			decos: absoluteDecos,
		});
	});

	return { lines, vars };
}

/**
 * Flatten parsed line decorations into a single DecorationSet.
 *
 * @param {import("https://esm.sh/@tiptap/pm@2.6.6/model?bundle").Node} doc
 * @param {{ inline: Function, create: Function }} decorationApi
 */
function buildDecorationSet(doc, decorationApi) {
	const { lines } = parseDocument(doc);
	const decorations = [];

	for (const line of lines) {
		for (const deco of line.decos) {
			if (deco.to > deco.from) {
				decorations.push(
					decorationApi.inline(deco.from, deco.to, {
						class: deco.cls,
					}),
				);
			}
		}
	}

	return decorationApi.create(doc, decorations);
}

/**
 * Render a number with separators and a compact decimal tail.
 *
 * @param {number | null} n
 */
function formatNumber(n) {
	if (n === null || !Number.isFinite(n)) {
		return "—";
	}

	const isNegative = n < 0;
	const [intPart, decPart] = Math.abs(n).toString().split(".");
	let out = Number(intPart).toLocaleString("en-US");
	if (decPart) {
		out += "." + decPart.slice(0, 4);
	}

	return (isNegative ? "-" : "") + out;
}

/**
 * @param {number | null} n
 * @param {string | null} currency
 */
function formatDisplay(n, currency) {
	return (currency || "") + formatNumber(n);
}

/**
 * @param {number} n
 */
function formatInsert(n) {
	return String(Math.round(n * 1e6) / 1e6);
}

export {
	ASSIGN_RE,
	buildDecorationSet,
	formatDisplay,
	formatInsert,
	parseDocument,
};
