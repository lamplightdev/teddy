const STYLES = `
.calcnp-root {
  --row-h: 36px;
  --bg: #14171c;
  --panel: #1a1e25;
  --rule: #2a303a;
  --ink: #e9e7dd;
  --muted: #7d8496;
  --num: #7fd9c4;
  --op: #f2a65a;
  --var: #f0779a;
  --func: #8fb8ff;
  --gold: #ffd166;
  display: block;
  background: var(--bg);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset, 0 20px 40px -20px rgba(0,0,0,0.6);
  font-family: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}
.calcnp-wrap { display: grid; grid-template-columns: 1fr auto 220px; min-height: 260px; }
.calcnp-editor-col, .calcnp-results-col { display: flex; flex-direction: column; min-width: 0; }
.calcnp-col-label {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 12px 16px 8px;
}
.calcnp-results-col .calcnp-col-label { padding-left: 14px; }

.calcnp-editor { flex: 1; padding-bottom: 12px; }
.calcnp-editor .ProseMirror {
  outline: none;
  padding: 0 16px 8px;
  color: var(--ink);
  font-size: 14px;
  line-height: var(--row-h);
}
.calcnp-editor .ProseMirror p {
  margin: 0;
  min-height: var(--row-h);
  white-space: pre;
  overflow-x: auto;
}
.calcnp-editor .ProseMirror p::-webkit-scrollbar { display: none; }

.calc-num { color: var(--num); }
.calc-op { color: var(--op); font-weight: 600; }
.calc-var-def { color: var(--gold); font-weight: 600; }
.calc-var-ref { color: var(--var); font-weight: 600; }
.calc-func { color: var(--func); font-weight: 600; font-style: italic; }

.calcnp-divider {
  width: 1px;
  background: repeating-linear-gradient(to bottom, var(--rule) 0 6px, transparent 6px 12px);
  margin: 4px 0;
}

.calcnp-results { flex: 1; padding: 0 10px 12px 14px; }
.calcnp-result-row {
  min-height: var(--row-h);
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px dashed transparent;
}
.calcnp-result-empty::before {
  content: '';
  display: block;
  width: 10px;
  height: 1px;
  background: var(--rule);
}

.calcnp-chip {
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  color: var(--bg);
  background: var(--gold);
  border: none;
  border-radius: 7px;
  padding: 3px 9px;
  cursor: pointer;
  line-height: 1.4;
  transition: transform 0.08s ease, box-shadow 0.08s ease;
}
.calcnp-chip:hover { box-shadow: 0 0 0 3px rgba(255,209,102,0.22); }
.calcnp-chip:active { transform: scale(0.96); }
.calcnp-chip:focus-visible { outline: 2px solid var(--num); outline-offset: 2px; }
.calcnp-chip-var { background: var(--var); color: #241019; }
.calcnp-chip-var:hover { box-shadow: 0 0 0 3px rgba(240,119,154,0.22); }

.calcnp-muted-value { font-size: 12px; color: var(--muted); }

@media (prefers-reduced-motion: reduce) {
  .calcnp-chip { transition: none; }
}

@media (max-width: 640px) {
  .calcnp-wrap { grid-template-columns: 1fr auto 150px; }
}

body {
  margin: 0;
  background: #0b0d10;
  color: #e9e7dd;
  font-family: 'Space Grotesk', sans-serif;
}
.page { max-width: 760px; margin: 0 auto; padding: 56px 20px 80px; }
.page-head { margin-bottom: 28px; }
.page-eyebrow { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #7d8496; }
.page-head h1 { font-size: 28px; margin: 8px 0 10px; }
.page-head p { color: #a7adba; font-size: 14px; line-height: 1.6; max-width: 52ch; font-family: 'IBM Plex Mono', monospace; }
`;

export { STYLES };
