# Security

## Reporting a problem

Please report security problems privately through GitHub: open the **Security** tab of this
repository and choose **Report a vulnerability** (GitHub private security advisories). Do not open a
public issue for a security problem. You should get an answer within a few days.

Wrong answers, typos and unclear questions are not security problems: use a normal issue for those.

## What this site is

A static site (HTML, CSS, vanilla JavaScript) served by GitHub Pages. There is no server-side code,
no account, no cookie, no analytics and no third-party request. The only data stored is your own
progress, in your browser's `localStorage`, under keys that start with `cep:nplus:`.

## Protections in place

- **Strict Content Security Policy** in a meta tag on every page:
  `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; manifest-src 'self'`.
  No `unsafe-inline`, no `unsafe-eval`, no external origin.
- **No inline code**: no inline script, no inline style, no `style` attribute, no event-handler
  attribute. Dynamic styles go through the CSSOM (`element.style.setProperty`) only.
- **No HTML sinks**: the code never uses `innerHTML`, `outerHTML`, `insertAdjacentHTML`,
  `document.write`, `eval`, `new Function` or string timers. Every piece of question text is
  rendered with `createElement` and `textContent`. The only formatting (`` `code` `` and `**bold**`)
  is handled by a small parser that builds elements, never markup strings, so a question that
  contained `<img onerror=...>` would simply be displayed as text.
- **Data is data**: the question bank is fetched from the same origin, parsed with `JSON.parse`,
  checked item by item against an allowlist of keys, types, lengths and identifiers, copied into
  fresh objects and deeply frozen. Invalid items are dropped (the rest still loads and a notice is
  shown). Element names, attributes and grading logic never come from the data.
- **Validator in the repository**: `Network+-Exam-Practice/scripts/validate_bank.py` (standard library only)
  applies the same structural rules plus content rules (no `<` outside exhibits, no tag-like text
  anywhere, no URLs or URL schemes, no control, zero-width or bidirectional characters, consistent
  subnet answers) and fails on any error. The browser does not rely on that check: it renders
  whatever it accepts as inert text.
- **`localStorage` is untrusted**: everything read from it is validated against a small schema inside
  `try/catch`; anything unexpected is ignored and the app starts clean.
- **No personal data** is collected or sent. `referrer` is set to `no-referrer`.

## Known and accepted limits

- The answer key ships with the static files, so anyone can read it with the browser tools. This is
  a free practice tool with no stakes; nothing is obfuscated.
- A CSP delivered by meta tag cannot set `frame-ancestors`; GitHub Pages does not allow custom
  response headers.
