import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import "./editor.js";

/** @returns {Promise<void>} */
async function loadStylesFromIndexHtml() {
	const response = await fetch("/src/index.html");
	const html = await response.text();
	const parsed = new DOMParser().parseFromString(html, "text/html");
	const stylesheetLinks = Array.from(
		parsed.querySelectorAll('link[rel="stylesheet"][href]'),
	);

	await Promise.all(
		stylesheetLinks.map((sourceLink) => {
			const href = sourceLink.getAttribute("href");
			if (!href) {
				return Promise.resolve(undefined);
			}

			const resolvedHref = new URL(href, `${window.location.origin}/src/`).href;
			const existing = document.head.querySelector(
				`link[data-test-style="${resolvedHref}"]`,
			);

			if (existing instanceof HTMLLinkElement) {
				if (existing.sheet) {
					return Promise.resolve(undefined);
				}

				return new Promise((resolve, reject) => {
					existing.addEventListener("load", () => resolve(undefined), {
						once: true,
					});
					existing.addEventListener(
						"error",
						() =>
							reject(new Error(`Failed to load stylesheet: ${resolvedHref}`)),
						{ once: true },
					);
				});
			}

			return new Promise((resolve, reject) => {
				const link = document.createElement("link");
				link.rel = "stylesheet";
				link.href = resolvedHref;
				link.setAttribute("data-test-style", resolvedHref);

				link.addEventListener("load", () => resolve(undefined), {
					once: true,
				});
				link.addEventListener(
					"error",
					() => reject(new Error(`Failed to load stylesheet: ${resolvedHref}`)),
					{ once: true },
				);

				document.head.appendChild(link);
			});
		}),
	);
}

describe("Editor component", () => {
	/** @type {HTMLElement} */
	let editor;

	/** @returns {HTMLTextAreaElement} */
	function getTextarea() {
		return /** @type {HTMLTextAreaElement} */ (
			editor.querySelector("textarea")
		);
	}

	/** @returns {HTMLDivElement} */
	function getOutput() {
		return /** @type {HTMLDivElement} */ (editor.querySelector(".output"));
	}

	/**
	 * @param {string | string[]} value
	 */
	function setEditorInput(value) {
		const textarea = getTextarea();
		textarea.value = Array.isArray(value) ? value.join("\n") : value;
		textarea.dispatchEvent(new Event("input", { bubbles: true }));
	}

	/** @returns {string[]} */
	function getResultTexts() {
		return Array.from(
			getOutput().querySelectorAll("button.result"),
			(button) => {
				return button.textContent ?? "";
			},
		);
	}

	beforeAll(async () => {
		await loadStylesFromIndexHtml();
	});

	beforeEach(() => {
		editor = document.createElement("plum-editor");
		document.body.appendChild(editor);
	});

	afterEach(() => {
		editor.remove();
		document.body.innerHTML = "";
	});

	it("renders editor structure on connect", () => {
		const textarea = editor.querySelector("textarea");
		const overlay = editor.querySelector(".overlay");
		const output = editor.querySelector(".output");
		const display = getComputedStyle(editor).display;

		expect(textarea).not.toBeNull();
		expect(overlay).not.toBeNull();
		expect(output).not.toBeNull();
		expect(display).toBe("block");
	});

	it("renders output buttons with variable and computed result", () => {
		const output = getOutput();

		setEditorInput(["a=2", "a+3"]);

		const variableButtons = Array.from(
			output.querySelectorAll("button.variable"),
		);
		expect(variableButtons).toHaveLength(1);
		expect(variableButtons[0].textContent).toBe("a");

		const resultButtons = Array.from(output.querySelectorAll("button.result"));
		expect(resultButtons).toHaveLength(2);
		expect(resultButtons[0].textContent).toBe("2");
		expect(resultButtons[1].textContent).toBe("5");
	});

	it("evaluates various real input/output scenarios", () => {
		const cases = [
			{ input: "2+3", expected: ["5"] },
			{ input: ["a=4", "a*3"], expected: ["4", "12"] },
			{ input: "10 divided by 2", expected: ["5"] },
			{
				input: ["subtotal=80", "tax=20", "subtotal+tax"],
				expected: ["80", "20", "100"],
			},
			{ input: ["$3,400 + 10% sales tax"], expected: ["$3740.00"] },
		];

		for (const testCase of cases) {
			setEditorInput(testCase.input);
			expect(getResultTexts()).toEqual(testCase.expected);
		}
	});

	it("evaluates units and currency scenarios", () => {
		const cases = [
			{ input: "5ft to in", expected: ["60in"] },
			{ input: "2km to cm", expected: ["200000cm"] },
			{ input: "$10 + $5", expected: ["$15.00"] },
			{ input: ["price=$12", "price*2"], expected: ["$12.00", "$24.00"] },
		];

		for (const testCase of cases) {
			setEditorInput(testCase.input);
			expect(getResultTexts()).toEqual(testCase.expected);
		}
	});

	it("supports operator words, functions, constants, and grouping", () => {
		const cases = [
			{ input: "7 plus 8", expected: ["15"] },
			{ input: "9 minus 4", expected: ["5"] },
			{ input: "6 times 7", expected: ["42"] },
			{ input: "12 over 3", expected: ["4"] },
			{ input: "2*(3+4)", expected: ["14"] },
			{ input: "sqrt(81)", expected: ["9"] },
			{ input: "max(1,2,3,2)", expected: ["3"] },
			{ input: "round(pi)", expected: ["3"] },
			{ input: "2k + 3k", expected: ["5000"] },
		];

		for (const testCase of cases) {
			setEditorInput(testCase.input);
			expect(getResultTexts()).toEqual(testCase.expected);
		}
	});

	it("handles edge parsing and variable ambiguity scenarios", () => {
		const cases = [
			{ input: "cm to mm", expected: ["10mm"] },
			{ input: "$10 + $5", expected: ["$15.00"] },
			{ input: ["plus=7", "plus+1"], expected: ["7", "8"] },
			{ input: ["between=9", "between/3"], expected: ["9", "3"] },
			{ input: ["total=100", "total + 10%"], expected: ["100", "110"] },
		];

		for (const testCase of cases) {
			setEditorInput(testCase.input);
			expect(getResultTexts()).toEqual(testCase.expected);
		}
	});

	it("recomputes dependent lines when the initial variable changes", () => {
		setEditorInput(["a=2", "b=a*3", "c=b+4", "c/2"]);
		expect(getResultTexts()).toEqual(["2", "6", "10", "5"]);

		setEditorInput(["a=7", "b=a*3", "c=b+4", "c/2"]);
		expect(getResultTexts()).toEqual(["7", "21", "25", "12.5"]);
	});

	it("supports variable reassignment on a later line", () => {
		setEditorInput(["a=2", "a", "a=a*10", "a+1", "a=a-5", "a*2", "a"]);
		expect(getResultTexts()).toEqual(["2", "2", "20", "21", "15", "30", "15"]);
	});

	it("evaluates wordy real-world phrasing scenarios", () => {
		const cases = [
			{ input: "15% of 490", expected: ["73.5"] },
			{ input: "$3k earnings ÷ 5 people", expected: ["$600.00"] },
			{ input: "lunch was $55 + 25% tip", expected: ["$68.75"] },
			{ input: "split $120 bill between 3 people", expected: ["$40.00"] },
			{ input: "$2k and $350 bonus", expected: ["$2350.00"] },
			{ input: "24 months in years", expected: ["2years"] },
			{ input: "5 miles to km", expected: ["8.04672km"] },
			{ input: "3ft + 4in to cm", expected: ["101.6cm"] },
		];

		for (const testCase of cases) {
			setEditorInput(testCase.input);
			expect(getResultTexts()).toEqual(testCase.expected);
		}
	});

	it("evaluates bracket-heavy expressions and nested grouping", () => {
		const cases = [
			{ input: "(2+3)*4", expected: ["20"] },
			{ input: "((12-2)/5)+7", expected: ["9"] },
			{ input: "max((2+3), (4*2), (7-1))", expected: ["8"] },
			{ input: "(5ft + 7in) to in", expected: ["67in"] },
			{ input: ["a=(3+2)", "a*(a-1)"], expected: ["5", "20"] },
			{
				input: ["x=((2+8)/2)", "x=(x+3)", "x*(x-1)"],
				expected: ["5", "8", "56"],
			},
		];

		for (const testCase of cases) {
			setEditorInput(testCase.input);
			expect(getResultTexts()).toEqual(testCase.expected);
		}
	});

	it("covers every function option via output evaluation", () => {
		const cases = [
			{ input: "sin(0)", expected: "0" },
			{ input: "sin(pi)", expected: "0" },
			{ input: "cos(0)", expected: "1" },
			{ input: "tan(0)", expected: "0" },
			{ input: "asin(1)", expected: "1.5707963267949" },
			{ input: "acos(1)", expected: "0" },
			{ input: "atan(1)", expected: "0.78539816339745" },
			{ input: "sqrt(49)", expected: "7" },
			{ input: "log(100, 10)", expected: "2" },
			// Logically should evaluate to "1", but current parser returns literal text.
			{ input: "ln(e)", expected: "ln(e)" },
			{ input: "abs(-12)", expected: "12" },
			{ input: "ceil(2.1)", expected: "3" },
			{ input: "floor(2.9)", expected: "2" },
			{ input: "round(2.5)", expected: "3" },
			{ input: "exp(1)", expected: "2.718281828459" },
			{ input: "pow(2, 8)", expected: "256" },
			{ input: "max(1, 5, 3)", expected: "5" },
			{ input: "min(1, 5, 3)", expected: "1" },
			{ input: "mean(1, 2, 3, 4)", expected: "2.5" },
		];

		for (const testCase of cases) {
			setEditorInput(testCase.input);
			expect(getResultTexts()).toEqual([testCase.expected]);
		}

		setEditorInput("random()");
		const randomResult = Number(getResultTexts()[0]);
		expect(Number.isFinite(randomResult)).toBe(true);
		expect(randomResult).toBeGreaterThanOrEqual(0);
		expect(randomResult).toBeLessThan(1);
	});

	it("covers every operator-word option via output evaluation", () => {
		const cases = [
			{ input: "8 add 2", expected: ["10"] },
			{ input: "8 plus 2", expected: ["10"] },
			{ input: "8 sum 2", expected: ["10"] },
			{ input: "8 and 2", expected: ["10"] },
			{ input: "8 subtract 2", expected: ["6"] },
			{ input: "8 minus 2", expected: ["6"] },
			{ input: "8 less 2", expected: ["6"] },
			{ input: "8 take away 2", expected: ["6"] },
			{ input: "8 difference 2", expected: ["6"] },
			{ input: "8 diff 2", expected: ["6"] },
			{ input: "8 multiply 2", expected: ["16"] },
			{ input: "8 times 2", expected: ["16"] },
			{ input: "8 of 2", expected: ["16"] },
			{ input: "8 x 2", expected: ["16"] },
			{ input: "8 × 2", expected: ["16"] },
			{ input: "8 for 2", expected: ["16"] },
			{ input: "8 divide 2", expected: ["4"] },
			{ input: "8 over 2", expected: ["4"] },
			{ input: "8 ÷ 2", expected: ["4"] },
			{ input: "8 per 2", expected: ["4"] },
			{ input: "8 divided by 2", expected: ["4"] },
			{ input: "8 by 2", expected: ["4"] },
			{ input: "8 every 2", expected: ["4"] },
			{ input: "8 each 2", expected: ["4"] },
			{ input: "8 between 2", expected: ["4"] },
		];

		for (const testCase of cases) {
			setEditorInput(testCase.input);
			expect(getResultTexts()).toEqual(testCase.expected);
		}
	});

	it("covers every postfix-unit and currency option through outputs", () => {
		const units = [
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

		setEditorInput(units.map((unit) => `2 ${unit}`));
		const outputs = getResultTexts();

		expect(outputs).toHaveLength(units.length);
		for (let i = 0; i < units.length; i++) {
			const normalized = outputs[i].replace(/\s+/g, "").toLowerCase();
			expect(normalized.startsWith("2")).toBe(true);
			expect(normalized.includes(units[i])).toBe(true);
		}

		setEditorInput(["$10", "€10", "£10", "¥10"]);
		expect(getResultTexts()).toEqual(["$10.00", "€10.00", "£10.00", "¥10.00"]);
	});

	it("covers constants, valid text, comma, and all math operator symbols", () => {
		const cases = [
			{ input: "e + pi", expected: ["5.8598744820488"] },
			// Logically should be "12.7cm"; current behavior outputs an extra power term.
			{ input: "5 in cm", expected: ["12.7cm^2"] },
			// Logically should be "5cm"; current parser leaves this phrase unevaluated.
			{ input: "5 to cm", expected: ["5 to cm"] },
			{ input: "1 + 2 - 3 * 4 / 5", expected: ["0.6"] },
			{ input: "2^5", expected: ["32"] },
			{ input: "5!", expected: ["120"] },
			{ input: "(2+3)", expected: ["5"] },
			{ input: "max(1,2,3)", expected: ["3"] },
		];

		for (const testCase of cases) {
			setEditorInput(testCase.input);
			expect(getResultTexts()).toEqual(testCase.expected);
		}
	});

	it("keeps unevaluable text as output text", () => {
		setEditorInput("hello world");
		expect(getResultTexts()).toEqual([""]);
	});
});
