# Setting up PMCC from zero

A complete, ordered run-through. Every step has something to check before you move
on, because most of what goes wrong here fails quietly rather than loudly.

Budget about two hours. Most of that is Step 6 (filling in the contract details) and
Step 7 (checking the programme parsed correctly). Do not rush either — everything
downstream is wrong if those are wrong.

---

## What you are setting up

**The Ledger** is the important idea, and it is a simpler one than the name suggests:
**a folder of files on disk, one per project**, holding everything known about that
project.

```
MARINA-01/
  00-contract/     the contract, conditions, BOQ
  01-programme/    every P6 export ever loaded, kept forever
  02-ledger/       site diary, progress, delay events
  03-registers/    RFIs, submittals, variations, NCRs, risks, procurement
  04-evidence/     photos, letters, minutes, drawings
  05-commercial/   valuations, cashflow
  06-outputs/      the reports and letters it produces
```

Not a database. Plain text files you can open in any editor — so if every line of this
software disappeared tomorrow, you would still have a well-organised project folder.

The one part that earns the name: the folder is a **git repository**. Git stamps every
change with a date and an author and will not let that history be quietly rewritten. So
you get a contemporaneous record as a side effect of ordinary use — *"on 5 August the
site engineer reported the blocks were short"* — which is what wins an extension-of-time
claim eighteen months later, and what almost nobody actually keeps.

Three other terms used throughout:

| Term | What it means |
|---|---|
| **The workspace** | `~/PMCC/` on the Mac mini — the Ledger, the code, and an inbox folder, all in one place |
| **Two repositories** | The code and the Ledger are backed up separately. The code could be public one day; the Ledger holds contract sums, rates and claims strategy, so it never can be. |
| **The bot** | The Telegram chat. It reads and writes the Ledger — it is the way in, not the thing itself. Everything it does can also be done from the command line. |

---

## Before you start

Three things to have ready:

| | |
|---|---|
| A Mac mini you can leave on | It runs the bot |
| A P6 export of one real project | `.xer`, both a baseline and the current update if you have them |
| Your contract | The form (FIDIC Red/Yellow, bespoke), the completion date, and the notice periods |

You will also need a GitHub account, for the code and for the Ledger's off-site backup
(Steps 1, 2 and 11).

---

## Part 1 · GitHub

### Step 0. Merge the work into `main`

**Do this first.** All of the agent code lives on a branch called
`claude/construction-automation-usecases-pucblv`. Your `main` branch still contains
only the original marketing website. Clone the repo before doing this and you get a
website with no bot.

1. Go to `https://github.com/nadimsaleh123/Construction-React/branches`
2. Find `claude/construction-automation-usecases-pucblv` and click **New pull request**
3. Confirm it reads **base: `main` ← compare: `claude/construction-automation-…`**
4. **Create pull request**, then **Merge pull request**, then **Confirm merge**

**Check:** go to the repository home page. You should now see a `pm-agent` folder and
a `SETUP.md` file in the file list. If you only see `src`, `index.html` and
`package.json`, the merge did not happen.

> Prefer the command line? From a clone of the repo:
> ```bash
> git checkout main
> git merge origin/claude/construction-automation-usecases-pucblv
> git push origin main
> ```

### Step 1. Rename this repository

It is called `Construction-React` after the template it started from. It now holds the
marketing site *and* the PM agent, so give it your name.

1. Go to `https://github.com/nadimsaleh123/Construction-React/settings`
2. Under **Repository name**, change it to `pmcc`
3. **Rename**

GitHub redirects the old URL automatically, so nothing you have already cloned breaks.
The commit history is kept — worth keeping, since the commits record why things are
built the way they are.

> Renaming rather than starting fresh is deliberate. A new empty repo would lose that
> history for no gain.

### Step 2. Create the private Ledger repository

The project data lives in its **own** repository, separate from the code. The code repo
can be public one day; the Ledger holds contract sums, rates and claims strategy and
must never be.

1. `https://github.com/new`
2. Name: `pmcc-ledger`
3. **Private** — check this, and check it twice
4. Do **not** add a README, .gitignore or licence. It must start empty.
5. **Create repository**

Copy the URL it shows you. You need it in Step 11.

**Check:** the repo page shows a 🔒 Private badge next to the name.

---

## Part 2 · The Mac mini

### Step 3. Prerequisites

```bash
# Node 18 or newer
node --version

# If it is missing or older:
brew install node

# Claude Code — needed for /ask. You probably already have this.
claude --version
```

**Check:** `node --version` prints v18 or higher, and `claude --version` prints a
version. If `claude` is missing, `/ask` is the only thing that will not work; the rest
runs fine.

### Step 4. Create the workspace and install

```bash
mkdir -p ~/PMCC/inbox
cd ~/PMCC

git clone https://github.com/nadimsaleh123/pmcc.git website
cd website/pm-agent
npm install
npm test
```

**Check:** the last line of `npm test` reads `# fail 0`. If anything fails, stop —
do not build on a broken install.

Now make the commands convenient and the environment permanent:

```bash
cat >> ~/.zshrc <<'EOF'
export LEDGER_ROOT=~/PMCC/ledger/projects
export PM_INBOX=~/PMCC/inbox
alias pm='node ~/PMCC/website/pm-agent/bin/pm.js'
EOF

source ~/.zshrc
```

**Check:** `pm` on its own prints the command list.

> Everything below uses `pm`. If you skipped the alias, write
> `node ~/PMCC/website/pm-agent/bin/pm.js` instead.

### Step 5. Create the Ledger repository locally

```bash
mkdir -p ~/PMCC/ledger/projects
cd ~/PMCC/ledger
git init -b main
git config user.name  "Your Name"
git config user.email "you@example.com"
```

**Check:** `pm doctor` runs and the Ledger line is no longer a failure. Several
warnings are expected at this point — you have not set up Telegram yet.

---

## Part 3 · Your first project

### Step 6. Create it, then fill in the contract

```bash
pm init MARINA-01 --name "Marina Tower"
open ~/PMCC/ledger/projects/MARINA-01/CLAUDE.md
```

**This file is the step people skip, and it is the one that matters most.** Fill in:

- **Parties** — who the Employer, Engineer and Contractor are, and **which of those you
  are on this project**
- **Contract form** — FIDIC Red 1999, Yellow 2017, or the actual bespoke form
- **Contract completion date**
- **Notice period for delay events** — e.g. 28 days under Sub-Clause 20.1
- **Response periods** for RFIs and submittals

Then mirror the numeric ones into `project.yaml` in the same folder, under `contract:`,
because that is where the code reads them from:

```yaml
contract:
  form: FIDIC Red Book 1999
  completionDate: 2026-12-18
  delayNoticeDays: 28
  rfiResponseDays: 14
  submittalResponseDays: 21
```

**Why this matters:** the notice deadlines, the SLA alerts and every clause the agent
cites all come from these numbers. Left blank, the system does not guess — it stays
silent, and you lose the single most valuable thing it does.

**Check:** `cat ~/PMCC/ledger/projects/MARINA-01/project.yaml` shows your real numbers,
not `null`.

### Step 7. Load the programme — and verify it

```bash
pm ingest MARINA-01 ~/Downloads/baseline.xer --baseline
pm ingest MARINA-01 ~/Downloads/current-update.xer
```

**Now open P6 side by side and confirm all four of these match:**

| The output says | Check in P6 |
|---|---|
| Activity count | Total activities in the project |
| Data date | Project → Data Date |
| Forecast finish | Your completion milestone's finish |
| Critical count | Activities with total float ≤ 0 |

**If any of these disagree, stop and tell me.** Every report, alert and claim built on
top inherits the error, and it will not be obvious later.

Once they match:

```bash
pm health MARINA-01     # DCMA 14-point check on the programme
pm diff MARINA-01       # only works once two updates are ingested
```

### Step 8. Branding for the client report

```bash
cp ~/PMCC/website/pm-agent/report-assets/brand.example.yaml ~/PMCC/ledger/brand.yaml
open ~/PMCC/ledger/brand.yaml
```

Fill in the real contact block — address, phone, email, website — and the issuer name
and title. The defaults are placeholders on purpose; the only contact details anywhere
in this repo belong to the original website template's author and must not go on a
client document.

For the logo: `pmcc-logo.jpeg` works, but it has no transparency so it renders as a
solid square. A transparent PNG or an SVG looks materially better. Swap the file and
point `company.logo` at it — no code change needed.

```bash
pm report MARINA-01 --pdf
open ~/PMCC/ledger/projects/MARINA-01/06-outputs/reports/
```

**Check:** the PDF opens, page 1 fits on one sheet, your letterhead and contact details
are right, and the command printed no warnings. Anything it lists under *"Before this
goes to a client"* is worth fixing now.

---

## Part 4 · The Telegram bot

### Step 9. Create the bot and lock it down

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. `/newbot`, give it a name and a username
3. Copy the token

```bash
cd ~/PMCC/website/pm-agent
cp .env.example .env
open .env          # paste the token into TELEGRAM_BOT_TOKEN
```

`.env` is read automatically — you do not need to source it. A real environment
variable always wins, so the launchd plist in Step 12 stays authoritative.

Start it and find your chat id:

```bash
pm bot
```

Message your bot anything. The terminal prints:

```
[bot] ignoring message from unauthorised chat 512334
```

That number is your chat id. Stop the bot (Ctrl-C), put it in `.env`:

```
TELEGRAM_ALLOWED_CHAT_IDS=512334
```

Restart with `pm bot` and message it again — it should now answer.

> **The allowlist is the whole security model.** Empty means the bot ignores everyone,
> which is the safe default. Anyone on it can read the entire Ledger, contract included
> — so add your PM here, and nobody else until roles exist.

**Check:** `/help` in Telegram returns the command list.

### Step 10. Try each thing once

In the Telegram chat:

```
/status      → forecast completion and progress
/alerts      → whatever is currently flagged
/report      → the PDF arrives as a file
/chase       → it asks you about the first activity
/ask when does the contract say completion is?
```

Send a photo with a caption like `A-1240 level 3 blockwork` and it files as evidence.
Send a PDF with the caption `contract` and it files into `00-contract/`, hashed.

**Check:** `/chase` asks a question, you answer in plain English — *"started tuesday,
about 30%, waiting on the blocks"* — and it records it. Then look at
`~/PMCC/ledger/projects/MARINA-01/02-ledger/diary.md`; your words should be there
verbatim, with your name.

---

## Part 5 · Make it permanent

### Step 11. Back up the Ledger off the machine

Using the private repo from Step 2:

```bash
cd ~/PMCC/ledger
git remote add origin https://github.com/nadimsaleh123/pmcc-ledger.git
pm sync
```

**Check:** `pm sync` says it pushed, and the GitHub repo now shows your files —
and still shows 🔒 **Private**.

**Do not skip this step.** It is the only thing standing between you and losing the
whole record if the Mac mini's disk fails — and it is a machine running around the
clock. A private repo is also what makes Step 14, working from a laptop, possible at
all.

> The one case where this changes: a client contract that forbids storing project data
> with a third party, which some government work does. Then the answer is a private
> network such as Tailscale between your own machines, *plus* a separate encrypted
> backup — because a network between two machines is not a backup.

### Step 12. Run it around the clock

Create `~/Library/LaunchAgents/com.pmcc.bot.plist` using the template in
`pm-agent/README.md` (under *Running it unattended on a Mac mini*), then:

```bash
launchctl load ~/Library/LaunchAgents/com.pmcc.bot.plist
```

**Two fields catch everybody**: `UserName` must be your account, and `HOME` must be
your home folder. launchd does not set `HOME` reliably, and without it `claude` cannot
find its login — so `/ask` fails under launchd while working perfectly in your
terminal.

Then schedule the routine work:

```bash
crontab -e
```

```cron
# Morning chase, Sunday–Thursday
0  7 * * 0-4 cd /Users/you/PMCC/website/pm-agent && /usr/local/bin/node bin/pm.js chase MARINA-01 --send

# Alerts, half an hour earlier. Silent on a quiet day.
30 6 * * 0-4 cd /Users/you/PMCC/website/pm-agent && /usr/local/bin/node bin/pm.js alerts MARINA-01 --send

# File anything dropped in the inbox
*/15 * * * * cd /Users/you/PMCC/website/pm-agent && /usr/local/bin/node bin/pm.js inbox MARINA-01

# Keep the laptop in step
*/10 * * * * cd /Users/you/PMCC/website/pm-agent && /usr/local/bin/node bin/pm.js sync
```

Adjust `0-4` if you do not work a Sunday–Thursday week, and check `which node` — the
path may be `/opt/homebrew/bin/node` on Apple Silicon.

### Step 13. Final check

```bash
pm doctor --deep
```

**Check:** every line reads `ok`. `--deep` makes a real Claude call (a few cents) to
prove the CLI is genuinely signed in, which nothing else can establish.

If it reports a problem, each line carries its own fix.

---

## Part 6 · Working from elsewhere

### Step 14. The laptop

```bash
mkdir -p ~/PMCC
cd ~/PMCC
git clone https://github.com/nadimsaleh123/pmcc.git website
git clone https://github.com/nadimsaleh123/pmcc-ledger.git ledger
cd website/pm-agent && npm install

cat >> ~/.zshrc <<'EOF'
export LEDGER_ROOT=~/PMCC/ledger/projects
alias pm='node ~/PMCC/website/pm-agent/bin/pm.js'
EOF
source ~/.zshrc

pm sync
```

Run `pm sync` before and after you work. Both machines stay in step.

**Do not** put `~/PMCC/ledger` inside Google Drive, Dropbox or iCloud. They sync `.git`
internals out of order and corrupt the repository — you would lose the tamper-evident
history that makes the record worth having.

### Step 15. Documents from anywhere

Two routes, use whichever suits:

- **Telegram** — send the file with a caption (`contract`, `drawing rev C`,
  `minutes`). Filed, hashed, committed. 20 MB limit.
- **The inbox** — put it in `~/PMCC/inbox/MARINA-01/contract/` and the cron files it
  within 15 minutes. No size limit.

To make the inbox reachable from your laptop and phone, point **Google Drive at
`~/PMCC/inbox` only** — never at the ledger folder.

To read reports anywhere, mirror the outputs out:

```cron
0 * * * * rsync -a --delete ~/PMCC/ledger/projects/MARINA-01/06-outputs/ ~/"Google Drive/My Drive/PMCC/MARINA-01/"
```

Mirror `06-outputs/` and nothing above it — the project root would put `00-contract/`
and `05-commercial/` in a folder you might one day share.

---

## When something is wrong

| What you see | What it is |
|---|---|
| Bot ignores you | `TELEGRAM_ALLOWED_CHAT_IDS` empty or wrong. Watch the log for the id. |
| `/ask` works in terminal, fails under launchd | `HOME` or `UserName` missing from the plist. |
| `/ask` fails after being idle | Budget too low. A question costs ~$0.01 warm, ~$0.25 cold — keep `PM_CLAUDE_BUDGET_USD` at 0.35 or above. |
| Nothing is ever committed | The ledger folder is not a git repo. `pm doctor` says so. |
| Report has a blank footer | `brand.yaml` contact block still empty. |
| Chase asks nothing | Everything was already answered today; suppression is working. Try `pm exceptions MARINA-01`. |
| Alerts went quiet | Correct. Each condition fires once and stays silent until it worsens. `pm alerts MARINA-01 --all` lists everything open. |

Anything else: `pm doctor --deep` first. It checks the things that fail silently.

---

## What you will have

- A bot that asks you every morning what moved, in plain English, and writes it down
- A tamper-evident record of every status, with who said it and when
- Notice deadlines computed the moment a delay is mentioned
- Alerts that fire once and then stay quiet
- A client-ready PDF in one command
- Contracts and drawings reaching the Ledger from wherever you are

## What you will not have yet

Stated plainly so nothing is a surprise:

- **No BOQ, valuations or cashflow.** The report reads commercial data if you type it
  in and marks it as hand-entered; otherwise the section is absent.
- **No roles.** Everyone on the allowlist can do everything, `/ask` included. Fine for
  you and a PM, not safe for site staff.
- **No monthly or board report.** The weekly only.
- **Voice notes are filed but not transcribed** unless you configure an engine.
- **You cannot raise an RFI or a VO from chat.** Registers are edited by hand.
