# pm-agent

A construction Project Ledger, a Primavera P6 parser, and a Telegram agent that chases
you for site updates against the programme.

This is Stage 1–2 of the automation roadmap: the data spine and the daily capture
habit. Everything else — client reports, EOT packs, look-aheads, commercial tracking —
reads from the Ledger this builds.

## Why it is shaped like this

**The Ledger is files in git, not a database.** Construction disputes turn on
contemporaneous records. Git gives you a timestamped, tamper-evident, diffable history
of every status you ever recorded, for free. When you are arguing an extension of time
eighteen months later, `git log 02-ledger/diary.md` is evidence. That is the highest
value design decision here and it costs nothing.

**The agent proposes, P6 disposes.** The bot never rewrites your XER. It produces a
P6-importable CSV of the fields you confirmed, which you import and review before
saving. Automated write-back is fragile and destroys the reviewability that makes a
programme defensible.

**Nothing goes out without you.** No email, no client message, no notice is ever sent
automatically. The agent drafts; a human sends. Reputational and contractual risk is
asymmetric — a wrongly-worded notice is worse than a late one.

## Install

Node 18 or later. One dependency.

```bash
cd pm-agent
npm install
npm test
```

## Quickstart

```bash
export LEDGER_ROOT=~/ledger/projects        # a PRIVATE repo, not this one

node bin/pm.js init MARINA-01 --name "Marina Tower"
# Fill in the contract form and notice periods in MARINA-01/CLAUDE.md — the
# clause-citing features are confidently wrong without it.

node bin/pm.js ingest MARINA-01 ~/exports/baseline.xer --baseline
node bin/pm.js ingest MARINA-01 ~/exports/2026-07-update.xer

node bin/pm.js exceptions MARINA-01     # what needs chasing
node bin/pm.js chase MARINA-01          # answer in the terminal
node bin/pm.js diff MARINA-01           # what changed between updates
node bin/pm.js health MARINA-01         # DCMA 14-point check
node bin/pm.js report MARINA-01 --pdf   # the weekly client report
```

**Before trusting anything downstream**, open P6 side by side with the ingest output
and confirm the activity count, the data date, the critical path and total float
match. If they do not, nothing built on top is worth reading.

## The Ledger

```
<LEDGER_ROOT>/<CODE>/
  CLAUDE.md           contract form, parties, notice periods — read by every skill
  project.yaml        config: role, chase settings, contract periods
  00-contract/        contract, BOQ, conditions, clause index
  01-programme/       xer/ (every export, archived by data date, never overwritten)
                      parsed/ (normalized JSON) · baseline/
  02-ledger/          diary.md · progress.yaml · events.yaml · decisions.yaml
  03-registers/       rfi · submittals · vo · ncr · risk · procurement · actions
  04-evidence/        photos/ · correspondence/ · minutes/
  05-commercial/      valuations/ · cashflow.yaml · subcontracts/
  06-outputs/         reports/ · claims/ · notices/ · p6-updates/
```

Registers are YAML so you can hand-edit them; hand edits are preserved. Parsed
programmes are JSON because they are machine-written and large. The diary is Markdown
because it gets quoted verbatim in claims.

## The Telegram agent

### Set it up

1. Message [@BotFather](https://t.me/BotFather), send `/newbot`, copy the token.
2. `cp .env.example .env` and paste the token in.
3. Start the bot, message it once, and read your chat id out of the log.
4. Put that id in `TELEGRAM_ALLOWED_CHAT_IDS` and restart.

The allowlist is not optional. The bot holds contract sums, rates and claims strategy;
an open bot is a disclosure incident. Messages from unknown chats are ignored.

```bash
node bin/pm.js bot
```

### What it does

| Command | |
|---|---|
| `/chase` | the daily update — it asks, you answer |
| `/status` | forecast completion, progress, critical path count |
| `/diff` | what changed between the last two P6 updates |
| `/health` | DCMA 14-point check |
| `/lookahead [days]` | what is coming up and what is at risk |
| `/projects`, `/project CODE` | list and switch |

During a chase, answer naturally — *"started tuesday, about 30%, block delivery came
up short"*. It extracts the date, the percentage, and recognises the delay. `skip` and
`stop` work at any point.

Send a photo with an activity code in the caption and it files it as evidence against
that activity.

### How the chase decides what to ask

It never asks about everything in the window. It computes an exception list — should
have started and has not, should have finished and has not, remaining duration no
longer fits, about to go critical, already negative float — ranks it by float first
and lateness second, and asks about the worst six. On a 4,000-activity project that is
the difference between five real questions and a wall of text nobody reads.

Anything already answered today is suppressed, so running it twice does not re-ask.

### Delay events

When your answer contains a delay cue, the agent opens an entry in `events.yaml` and
asks one follow-up: was it client-caused, our own, or neutral. **It never infers this
from a keyword** — entitlement is a contractual judgement and a wrong guess propagates
into a claim.

If the cause could support a claim and `contract.delayNoticeDays` is set in
`project.yaml`, it computes and tells you the notice deadline. That single line is
probably the highest-value thing in this repo: entitlement is lost on missed notice
periods far more often than on weak merits.

## The weekly client report

```bash
node bin/pm.js report MARINA-01 --pdf --as-of 2026-08-05
```

Writes to `06-outputs/reports/` and commits. **Nothing is sent** — you review it and
issue it yourself.

**Page 1 is the whole story**: forecast completion and whether it moved, progress
against plan, status, what changed this week, the S-curve, the critical path, the
decisions needed from the client, and the top risks. Appendices — look-ahead,
photographs, registers, delay events, commercial — attach only when they have
something in them. A quiet week is one page.

### Set up the letterhead first

```bash
cp report-assets/brand.example.yaml $LEDGER_ROOT/brand.yaml
```

Company name, logo, contact block, issuer, colours and page setup. Fill it in once;
override per project with `<CODE>/report-brand.yaml` when reporting under a joint
venture name. The command lists what is still missing every time it runs, because a
report going to a client with a blank footer is a real defect.

### What makes it trustworthy

Every figure in the model carries its provenance — `measured` (recorded in the
Ledger by a human), `programme` (as reported in the P6 update), `derived`,
`manual`, or `not-measured`. Anything without a source prints as **"Not measured"**
in the body of the report, visibly, rather than as a zero. A footnote states the
basis of every number, including how progress was weighted and how stale the
programme is. These figures end up in payment applications; an admitted gap is
always better than a plausible invention.

### PDF generation

`pm report` alone needs no extra install — it writes a self-contained HTML file
(fonts, logo and photographs all inlined) that opens in any browser and prints with
Cmd+P. `--pdf` additionally needs a browser:

```bash
npm install --save-dev playwright
npx playwright install chromium
```

Two details that are load-bearing rather than cosmetic:

- **Fonts are embedded, and are static weights rather than a variable font.**
  Chromium cannot subset an instance of a variable font, so it silently falls back
  to Type3 glyph procedures — the report still looks right, but the PDF text stops
  being selectable and searchable. Static weights produce real embedded TrueType.
- **`page.pdf()`, not Chrome's `--print-to-pdf`.** The CLI cannot do
  `printBackground`, which would strip every tinted panel and chart wash.

`--png <file>` renders page 1 to an image and measures it. If page 1 exceeds the
printable area, or any table is wider than the page, the command says so before you
send it.

## Running it unattended on a Mac mini

Save as `~/Library/LaunchAgents/com.pm-agent.bot.plist`, then
`launchctl load ~/Library/LaunchAgents/com.pm-agent.bot.plist`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.pm-agent.bot</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/you/Construction-React/pm-agent/bin/pm.js</string>
    <string>bot</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>TELEGRAM_BOT_TOKEN</key><string>...</string>
    <key>TELEGRAM_ALLOWED_CHAT_IDS</key><string>...</string>
    <key>LEDGER_ROOT</key><string>/Users/you/ledger/projects</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/pm-agent.log</string>
  <key>StandardErrorPath</key><string>/tmp/pm-agent.err</string>
</dict>
</plist>
```

For the 07:00 push, a second agent with `StartCalendarInterval` running
`bin/pm.js chase <CODE> --send`, or a crontab line:

```cron
0 7 * * 0-4 cd /Users/you/Construction-React/pm-agent && /usr/local/bin/node bin/pm.js chase MARINA-01 --send
```

(Sunday–Thursday, for a Gulf working week.)

## What this does not do yet

Stated plainly so nothing here is mistaken for working:

- **Voice notes are not transcribed.** The bot acknowledges them and asks for text.
- **No BOQ, valuation, cashflow or VO handling.** The folders exist; the logic does
  not. The report reads commercial data if you hand-enter it and marks it `manual`;
  otherwise the section does not appear.
- **The report has no monthly or board variant yet.** Same engine, different section
  set — worth adding once the weekly has been used in anger.
- **DCMA checks 12–14** (critical path test, CPLI, BEI) are reported as unassessed
  rather than silently passed — they need a baseline and a perturbation run in P6.
- **Reply parsing is deterministic, not an LLM.** It is good on the common phrasings
  and tested against them, and it reports what it could not extract rather than
  guessing. Genuinely ambiguous replies come back as a follow-up question.
- **Resource and cost loading is parsed but not yet reported on.**

## Tests

```bash
npm test
```

98 tests covering the XER parser (including the Windows-1252 encoding P6 actually
writes), float and duration conversion, the exception engine, the diff engine against
a deliberately dishonest revision, the DCMA checks, reply parsing, the P6 export
format, an end-to-end chase that writes the Ledger, and the report model — including
that a missing measurement can never render as a number, and that duration weighting
does not let a handful of snagging items outweigh the frame.
