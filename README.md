# Exam Practice Simulators

Free, open-source practice exam simulators that run entirely in the browser. The first (and for now
the only) one is for **CompTIA Network+ (N10-009)**. Other exams are not available yet.

> Independent practice tool. Not affiliated with or endorsed by CompTIA. CompTIA and Network+ are
> trademarks of CompTIA, Inc. All questions are original.

## What it is

A static web page that reproduces the *function* of a computer-based certification exam (timer,
flag for review, review screen, performance-based questions) with its own look and its own
questions. Every question was written from the public exam objectives. Nothing comes from a real
exam, a "brain dump", a book, a course or another practice site.

## Features

- **Exam mode**: up to 90 questions in 90 minutes; 4 performance-based questions (PBQs) first, then
  multiple choice drawn by domain weight (23 / 20 / 19 / 14 / 24 %); options shuffled; countdown
  with Hide/Show; flag for review; review screen with All / Unanswered / Flagged filters; End Exam
  confirmation; automatic end at 00:00:00; no explanations until the end.
- **Score report**: estimated score on 100-900, pass or fail against 720, results per domain,
  objectives to revisit, and a full answer review with an explanation for every option.
- **Practice mode**: choose domains, objectives, question types and the number of questions; the
  explanation appears right after each answer.
- **PBQs**: put steps in order, match items, fill a subnetting table. Drag and drop, plus a
  select-then-place fallback that works with touch and keyboard. Reset button on each one.
  These formats are this project's own design; CompTIA does not publish the formats it uses.
- **Tools**: highlight and strikethrough on answer options, text size, light and dark themes,
  keyboard shortcuts (Alt+N next, Alt+P previous, Alt+F flag, Alt+R review, 1-6 select an option).
- **Progress**: attempt history and accuracy per objective, stored only in your browser
  (`localStorage`), with a Clear data button. An unfinished attempt can be resumed after a reload.
- **Private by design**: no account, no cookie, no analytics, no external request. See
  [SECURITY.md](SECURITY.md).
- Works on a phone (360 px wide) and with a keyboard or a screen reader.

## How the score is approximated

CompTIA does not publish how it converts answers into a scaled score, so the number shown here is
an **approximation, not an official CompTIA score**:

- Multiple choice (single or multiple response): 1 point, all or nothing.
- PBQ: 3 points, with partial credit equal to the fraction of correct parts; less than half right
  earns 0.
- `p` = points earned / points possible. The assumed passing point is `c = 0.75`.
- `scaled = 100 + (p / c) * 620` when `p <= c`, otherwise `720 + ((p - c) / (1 - c)) * 180`,
  rounded and kept between 100 and 900. Pass at 720.

## Honest limits

- Real scaled scores come from statistical work on calibrated questions; this one does not. The
  PBQ weight and the 75 % passing point are assumptions. A pass here is a readiness signal, not a
  prediction.
- The bank is much smaller than a real question pool. Repeating attempts inflates the score.
- The questions were written by a small project, not by a team of exam developers. Some may be
  easier, harder or less polished than the real ones. Report anything doubtful.
- The interface copies the behaviour of an exam, not its exact appearance, and the PBQ formats are
  simpler than real simulations.
- The answer key is in the static files. That is fine for a practice tool.
- If the bank cannot fill a full exam, the exam is shortened (one minute per question) and the page
  says so.

## Run it locally

No build step and no dependency. The page loads its data with `fetch`, so it must be served over
HTTP (opening the file directly does not work):

```
python -m http.server 8000
```

Run that in the repository root, then open `http://localhost:8000/`.

To check the question bank:

```
python -I Network+-Exam-Practice/scripts/validate_bank.py
```

## Repository layout

```
index.html, 404.html              landing pages
Network+-Exam-Practice/
  index.html, app.js, styles.css  the simulator
  data/objectives.json            objective numbers with short titles in our own words
  data/domains.json               the five domains and their weights
  data/domain-1.json ... 5.json   question bank
  scripts/validate_bank.py        bank validator (standard library only)
```

The official objectives are published by CompTIA on its
[Network+ certification page](https://www.comptia.org/en-us/certifications/network/).

## Contributing

Contributions go through **issues**:

- **A question is wrong, unclear or outdated**: open an issue with the question id (shown under the
  explanation, for example `N9-2.3-0007`) and what is wrong, ideally with a reference (RFC,
  standard, vendor documentation).
- **A question looks too close to a real exam question**: open an issue; it will be rewritten or
  removed. Never paste real exam content into an issue.
- **A bug or an idea**: open an issue describing what you did, what you expected and your browser.
- **Security problem**: do not open a public issue; see [SECURITY.md](SECURITY.md).

Proposed questions must be original, written from the public objectives, and must pass
`validate_bank.py`.

## Disclaimer

This project is an independent study aid. It is not affiliated with, endorsed by or sponsored by
CompTIA or any test delivery provider. CompTIA and Network+ are trademarks of CompTIA, Inc., used
here only to name the exam the tool helps prepare for. No real exam content is used. Using this tool
does not guarantee any result on a real exam.

## License

[MIT](LICENSE), copyright 2026 bazeeza.
