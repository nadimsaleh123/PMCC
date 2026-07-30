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

### Adding a second person

`TELEGRAM_ALLOWED_CHAT_IDS` is comma-separated, so adding your PM is one entry. They
get a private chat with the bot, their own chase sessions, and everything they record
is attributed to them by name in `progress.yaml`, `events.yaml`, the diary and the git
commit message. Two people can be chased at the same time without colliding.

**There are no roles yet — everyone on the allowlist can do everything**, including
`/ask`, which reads the whole ledger. That is fine for you and a PM. It is *not* fine
for site staff or a subcontractor: it would put contract sums and rates one question
away. Before opening this up further, roles are needed — the design is to scope `/ask`
by working directory so a foreman's questions physically cannot reach `00-contract/`
or `05-commercial/`.

```bash
node bin/pm.js bot
```

### What it does

| Command | |
|---|---|
| `/chase` | the daily update — it asks, you answer |
| `/status` | forecast completion, progress, critical path count |
| `/alerts` | everything currently flagged |
| `/report` | this week's client report as a PDF |
| `/ask <question>` | anything about the project record (or start a message with `?`) |
| `/open` | decisions, actions and RFIs waiting on someone else |
| `/nudge REF` | draft a chase letter for that reference |
| `/diff` | what changed between the last two P6 updates |
| `/health` | DCMA 14-point check |
| `/lookahead [days]` | what is coming up and what is at risk |
| `/projects`, `/project CODE` | list and switch |

During a chase, answer naturally — *"started tuesday, about 30%, block delivery came
up short"*. It extracts the date, the percentage, and recognises the delay. `skip` and
`stop` work at any point.

Send a photo with an activity code in the caption and it files it as evidence against
that activity. Voice notes are filed as evidence too, and become diary entries if you
switch transcription on — see below.

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

## Alerts — it tells you before you have to ask

```bash
node bin/pm.js alerts MARINA-01            # what is new
node bin/pm.js alerts MARINA-01 --all      # everything currently open
node bin/pm.js alerts MARINA-01 --send     # for cron
```

Conditions checked: contractual **notice deadlines** not yet issued, **decisions and
actions** falling due, **RFIs and submittals** beyond the contractual response period,
**procurement order-by dates**, activities crossing into **negative float**, and a
**stale programme**.

**It is quiet on purpose.** Each condition alerts once and then says nothing more
until it gets materially worse — a notice deadline crossing inside three days, float
worsening by five days, an RFI passing twice its response period. An alerter that
repeats itself every morning gets muted, and a muted alerter is worse than none.

Procurement order-by dates are **derived from the live programme**: need-on-site comes
from the linked activity's planned start, less the recorded lead time. They move when
the programme moves. If the linked activity disappears from a revision, the item is
flagged as unlinked rather than falling silent — which is exactly when it matters.

History lives in `02-ledger/alerts.yaml` and is **committed**. "You were warned about
this on that date" is itself a contemporaneous record.

## Asking questions

```bash
node bin/pm.js ask MARINA-01 "when did we first raise the block shortage?"
```

**This uses your own Claude Code CLI, not an API key.** There is no API integration in
this repo — the bot shells out to `claude`. If Claude Code is already installed and
logged in on the machine, `/ask` works with no further setup: the login lives in
`~/.claude` and `claude -p` inherits it.

It runs **strictly read-only** — the tool allowlist is `Read,Grep,Glob` with a
redundant deny list, and the permission-bypass flags are deliberately never used. The
ledger holds contract sums and claims strategy; an agent that could edit it could
rewrite the contemporaneous record this whole system exists to protect.

It is instructed to cite a file path for every claim and to answer **"Not in the
project record"** rather than infer. Asked for a contract completion date that is still
`_TBC_`, it says so instead of producing a plausible one.

**Cost is not flat.** Claude Code sends a large system prompt, so the same question
costs about **$0.01 with a warm prompt cache and about $0.25 cold**. Do not set
`PM_CLAUDE_BUDGET_USD` below ~$0.35 or questions will work all morning and then start
failing after an idle period. There is also a daily ceiling. In Telegram only `/ask`
and a leading `?` spend anything; ordinary messages still route to the chase answer.

## Chasing other people

```bash
node bin/pm.js open MARINA-01              # what is with someone else
node bin/pm.js nudge MARINA-01 DEC-001     # draft a chase letter
```

Letters are built from a **deterministic template**, not generated prose. A template
cannot invent a consequence nobody recorded, cannot soften a date, and produces the
same letter twice for the same facts — which matters when a series of chasers becomes
the evidence that you pursued something diligently.

Where the record is thin the letter says less and lists what is missing at the bottom,
for you to add to the register and regenerate. Drafts land in
`06-outputs/correspondence/`. Nothing is sent.

## Voice notes — optional, off by default

**Leave this alone and nothing breaks.** With no transcriber configured, a voice note
is filed as evidence and the bot asks you to send the update as text. That is a
perfectly reasonable way to run it.

If you ever want it on, transcription runs as a command, so any engine works — set
`PM_TRANSCRIBE_CMD` (see `.env.example`). A local engine such as whisper.cpp keeps site
audio, which names people and incidents, on your own machine. The pipeline either side
of the transcriber is built and tested; only the engine itself is your choice.

When it is on, a note becomes a dated diary entry — weather, manpower by trade, plant,
works by location, delays, instructions, visitors — with the verbatim transcript kept
underneath. **The record survives every failure**: no transcriber, failed
transcription, or failed structuring all still file the audio, and any transcript still
reaches the diary verbatim. A rambling dated transcript is a valid contemporaneous
record; losing it because a parser was unhappy is not.

If a delay is heard, an event is opened as `unclassified` and the bot asks who caused
it. It never decides that itself.

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

First, check the machine:

```bash
node bin/pm.js doctor --deep
```

It verifies Node, `HOME`, the ledger and its git repo, the Telegram token and
allowlist, that Claude Code is installed **and actually signed in**, Playwright, the
report fonts, and the budget setting. Run it **as the user the service will run as** —
that is the whole point.

Then save as `~/Library/LaunchAgents/com.pm-agent.bot.plist` and
`launchctl load ~/Library/LaunchAgents/com.pm-agent.bot.plist`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.pm-agent.bot</string>
  <key>UserName</key><string>you</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/Users/you/Construction-React/pm-agent/bin/pm.js</string>
    <string>bot</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <!-- HOME is the one that catches everybody. launchd does not set it
         reliably, and without it `claude` cannot find the login in ~/.claude,
         so /ask fails while working perfectly from your terminal. -->
    <key>HOME</key><string>/Users/you</string>
    <!-- launchd's PATH is minimal; node, claude and git all need to be on it. -->
    <key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    <key>TELEGRAM_BOT_TOKEN</key><string>...</string>
    <key>TELEGRAM_ALLOWED_CHAT_IDS</key><string>...</string>
    <key>LEDGER_ROOT</key><string>/Users/you/ledger/projects</string>
    <key>PM_CLAUDE_BUDGET_USD</key><string>0.5</string>
    <key>PM_CLAUDE_DAILY_USD</key><string>5</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/pm-agent.log</string>
  <key>StandardErrorPath</key><string>/tmp/pm-agent.err</string>
</dict>
</plist>
```

**`UserName` must be the account whose `~/.claude` holds the Claude Code login**, and
`HOME` must point at that account. If `/ask` works in your terminal but fails under
launchd, one of those two is wrong — `pm doctor --deep` will say which.

For the 07:00 push, a second agent with `StartCalendarInterval` running
`bin/pm.js chase <CODE> --send`, or a crontab line:

```cron
# Morning chase, Sunday-Thursday for a Gulf working week.
0 7 * * 0-4 cd /Users/you/Construction-React/pm-agent && /usr/local/bin/node bin/pm.js chase MARINA-01 --send

# Alerts, a little earlier. Sends nothing on a quiet day.
30 6 * * 0-4 cd /Users/you/Construction-React/pm-agent && /usr/local/bin/node bin/pm.js alerts MARINA-01 --send
```

By default a scheduled push goes to every chat in `TELEGRAM_ALLOWED_CHAT_IDS`. Set
`telegram.chatId` in a project's `project.yaml` to send that project to one chat
instead — it must still be in the allowlist, so a per-project setting can narrow the
audience but never widen it.

## What this does not do yet

Stated plainly so nothing here is mistaken for working:

- **Voice transcription is off** unless you configure an engine, and the engine itself
  is unverified — the pipeline is tested against a stub. Everything either side of the
  transcriber (filing, diary writing, delay detection, the fallbacks) is tested.
- **No BOQ, valuation, cashflow or VO handling.** The folders exist; the logic does
  not. The report reads commercial data if you hand-enter it and marks it `manual`;
  otherwise the section does not appear.
- **The report has no monthly or board variant yet.** Same engine, different section
  set — worth adding once the weekly has been used in anger.
- **No RFI, VO or NCR can be raised from chat** — registers are edited by hand or by
  the skills.
- **No multi-project digest.** Each project is chased and alerted separately.
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

184 tests, and no test costs money or needs a network — the Claude runner and the
transcriber are both exercised against stubs.

Covering the XER parser (including the Windows-1252 encoding P6 actually writes),
float and duration conversion, the exception engine, the diff engine against a
deliberately dishonest revision, the DCMA checks, reply parsing, the P6 export format,
an end-to-end chase that writes the Ledger, and the report model.

The parts most worth the tests they have:

- **Alert tiering and the quiet rule** — that a condition alerts once, stays silent at
  the same tier, fires again when it escalates, and re-fires if it clears and returns.
- **The read-only guarantee** — that the Claude invocation carries both an allowlist
  and a deny list and never the permission-bypass flags.
- **The record surviving failure** — that a failed transcription still files the audio,
  and a failed structuring still writes the transcript to the diary.
- **Never fabricating** — that a missing measurement cannot render as a number, that an
  unrecorded consequence is omitted from a chase letter rather than invented, and that
  duration weighting does not let a handful of snagging items outweigh the frame.
