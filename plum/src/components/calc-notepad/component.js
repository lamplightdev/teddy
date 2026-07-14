// @ts-nocheck
import { Editor, Extension } from "https://esm.sh/@tiptap/core@2.6.6?bundle";
import DocumentExt from "https://esm.sh/@tiptap/extension-document@2.6.6?bundle";
import HistoryExt from "https://esm.sh/@tiptap/extension-history@2.6.6?bundle";
import ParagraphExt from "https://esm.sh/@tiptap/extension-paragraph@2.6.6?bundle";
import TextExt from "https://esm.sh/@tiptap/extension-text@2.6.6?bundle";
import {
	Plugin,
	PluginKey,
} from "https://esm.sh/@tiptap/pm@2.6.6/state?bundle";
import {
	Decoration,
	DecorationSet,
} from "https://esm.sh/@tiptap/pm@2.6.6/view?bundle";
import {
	buildDecorationSet,
	formatDisplay,
	formatInsert,
	parseDocument,
} from "./engine.js";
import { STYLES } from "./styles.js";

let lidCounter = 0;

/**
 * Give every paragraph line a stable id (lid) so we can track rename behavior
 * across edits without guessing by line number.
 */
const LineId = ParagraphExt.extend({
	addAttributes() {
		return {
			lid: {
				default: null,
				parseHTML: (el) => el.getAttribute("data-lid"),
				renderHTML: (attrs) => (attrs.lid ? { "data-lid": attrs.lid } : {}),
			},
		};
	},
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("calcnp-assign-lids"),
				appendTransaction(transactions, _oldState, newState) {
					if (!transactions.some((tr) => tr.docChanged)) {
						return null;
					}

					let tr = newState.tr;
					let changed = false;

					newState.doc.forEach((node, pos) => {
						if (node.type.name === "paragraph" && !node.attrs.lid) {
							tr = tr.setNodeMarkup(pos, undefined, {
								...node.attrs,
								lid: "l" + Date.now() + "-" + lidCounter++,
							});
							changed = true;
						}
					});

					return changed ? tr : null;
				},
			}),
		];
	},
});

/**
 * Recomputes syntax-highlight decorations whenever the document changes.
 */
const CalcHighlight = Extension.create({
	name: "calcHighlight",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: new PluginKey("calcnp-highlight"),
				props: {
					decorations(state) {
						return buildDecorationSet(state.doc, {
							inline: Decoration.inline,
							create: DecorationSet.create,
						});
					},
				},
			}),
		];
	},
});

/**
 * Add the component stylesheet to document.head once.
 */
function injectStylesOnce() {
	if (document.getElementById("calcnp-styles")) {
		return;
	}

	const style = document.createElement("style");
	style.id = "calcnp-styles";
	style.textContent = STYLES;
	document.head.appendChild(style);
}

/**
 * Create and wire a TipTap editor with the side result panel.
 *
 * This function owns all runtime behavior for:
 * - Rendering computed outputs per line.
 * - Click-to-insert result chips.
 * - Automatic downstream variable rename propagation.
 *
 * @param {HTMLElement} host
 * @param {HTMLElement} editorEl
 * @param {HTMLElement} resultsEl
 * @param {string} seedText
 */
function initEditor(host, editorEl, resultsEl, seedText) {
	let lastSelectionPos = null;
	const previousVarNameByLineId = new Map();

	/**
	 * Insert text at the last known cursor position.
	 * If we do not have one yet, append at the end.
	 *
	 * @param {string} text
	 */
	function insertAtCursor(text) {
		const size = editor.state.doc.content.size;
		const pos =
			lastSelectionPos != null ? Math.min(lastSelectionPos, size) : size;

		editor.chain().focus().insertContentAt(pos, text).run();
		lastSelectionPos = editor.state.selection.from;
	}

	/**
	 * Rebuild the result column from parsed line data.
	 *
	 * @param {{ lines: Array<{ lid: string | null, varName: string | null, result: number | null, currencySymbol: string | null }> }} parsed
	 */
	function renderResults(parsed) {
		resultsEl.innerHTML = "";

		for (const line of parsed.lines) {
			const row = document.createElement("div");
			row.className = "calcnp-result-row";

			if (line.varName) {
				const variableChip = document.createElement("button");
				variableChip.type = "button";
				variableChip.className = "calcnp-chip calcnp-chip-var";
				variableChip.textContent = line.varName;
				variableChip.title = "Insert " + line.varName;
				variableChip.addEventListener("click", () =>
					insertAtCursor(line.varName),
				);
				row.appendChild(variableChip);

				if (line.result !== null) {
					const muted = document.createElement("span");
					muted.className = "calcnp-muted-value";
					muted.textContent =
						"= " + formatDisplay(line.result, line.currencySymbol);
					row.appendChild(muted);
				}
			} else if (line.result !== null) {
				const valueChip = document.createElement("button");
				valueChip.type = "button";
				valueChip.className = "calcnp-chip calcnp-chip-value";
				valueChip.textContent = formatDisplay(line.result, line.currencySymbol);
				valueChip.title = "Insert value";
				valueChip.addEventListener("click", () =>
					insertAtCursor(formatInsert(line.result)),
				);
				row.appendChild(valueChip);
			} else {
				row.classList.add("calcnp-result-empty");
			}

			resultsEl.appendChild(row);
		}
	}

	/**
	 * Keep a line-id -> variable-name snapshot so we can detect renames.
	 *
	 * @param {{ lines: Array<{ lid: string | null, varName: string | null }> }} parsed
	 */
	function syncPreviousVarNameMap(parsed) {
		const seen = new Set();

		for (const line of parsed.lines) {
			if (!line.lid) {
				continue;
			}

			seen.add(line.lid);
			if (line.varName) {
				previousVarNameByLineId.set(line.lid, line.varName);
			} else {
				previousVarNameByLineId.delete(line.lid);
			}
		}

		for (const key of Array.from(previousVarNameByLineId.keys())) {
			if (!seen.has(key)) {
				previousVarNameByLineId.delete(key);
			}
		}
	}

	/**
	 * If the user renames an assignment variable on one line, update every
	 * later reference of the old variable name so dependent lines still work.
	 *
	 * This keeps the experience notebook-like instead of forcing manual rename.
	 *
	 * @param {{ lines: Array<{ lid: string | null, pos: number, text: string, varName: string | null }> }} parsed
	 */
	function maybeCascadeRename(parsed) {
		for (let i = 0; i < parsed.lines.length; i++) {
			const line = parsed.lines[i];
			if (!line.lid) {
				continue;
			}

			const previousName = previousVarNameByLineId.get(line.lid);
			const currentName = line.varName;

			if (!previousName || !currentName || previousName === currentName) {
				continue;
			}

			const escapedPrev = previousName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
			const search = new RegExp("\\b" + escapedPrev + "\\b", "g");
			const ranges = [];

			for (let j = i + 1; j < parsed.lines.length; j++) {
				let match = search.exec(parsed.lines[j].text);
				while (match) {
					ranges.push({
						from: parsed.lines[j].pos + match.index,
						to: parsed.lines[j].pos + match.index + previousName.length,
					});
					match = search.exec(parsed.lines[j].text);
				}
			}

			if (!ranges.length) {
				continue;
			}

			ranges.sort((a, b) => b.from - a.from);
			let tr = editor.state.tr;
			for (const range of ranges) {
				tr = tr.insertText(currentName, range.from, range.to);
			}

			tr.setMeta("rename-cascade", true);
			editor.view.dispatch(tr);
			return true;
		}

		return false;
	}

	/**
	 * Build paragraph-based initial content from seed plain text.
	 */
	const initialContent = {
		type: "doc",
		content: (seedText ? seedText.split("\n") : [""]).map((line) => ({
			type: "paragraph",
			content: line ? [{ type: "text", text: line }] : [],
		})),
	};

	const editor = new Editor({
		element: editorEl,
		extensions: [DocumentExt, LineId, TextExt, HistoryExt, CalcHighlight],
		content: initialContent,
		autofocus: false,
		onCreate({ editor }) {
			const parsed = parseDocument(editor.state.doc);
			renderResults(parsed);
			syncPreviousVarNameMap(parsed);
		},
		onUpdate({ editor, transaction }) {
			const parsed = parseDocument(editor.state.doc);
			renderResults(parsed);

			if (transaction.getMeta("rename-cascade")) {
				syncPreviousVarNameMap(parsed);
			} else if (!maybeCascadeRename(parsed)) {
				syncPreviousVarNameMap(parsed);
			}
		},
		onSelectionUpdate({ editor }) {
			lastSelectionPos = editor.state.selection.from;
		},
	});

	host._editor = editor;
}

class CalcNotepad extends HTMLElement {
	connectedCallback() {
		if (this._built) {
			return;
		}

		this._built = true;
		injectStylesOnce();

		const seedText = this.textContent.replace(/^\n+|\n+$/g, "");
		this.textContent = "";
		this.classList.add("calcnp-root");
		this.innerHTML = `
			<div class="calcnp-wrap">
				<div class="calcnp-editor-col">
					<div class="calcnp-col-label">Notepad</div>
					<div class="calcnp-editor"></div>
				</div>
				<div class="calcnp-divider" aria-hidden="true"></div>
				<div class="calcnp-results-col">
					<div class="calcnp-col-label">Result</div>
					<div class="calcnp-results"></div>
				</div>
			</div>
		`;

		const editorEl = this.querySelector(".calcnp-editor");
		const resultsEl = this.querySelector(".calcnp-results");
		if (!editorEl || !resultsEl) {
			throw new Error("calc-notepad failed to initialize required elements");
		}

		initEditor(this, editorEl, resultsEl, seedText);
	}
}

function defineCalcNotepad() {
	if (!customElements.get("calc-notepad")) {
		customElements.define("calc-notepad", CalcNotepad);
	}
}

export { CalcNotepad, defineCalcNotepad };
