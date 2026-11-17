---
name: ticket-up
description: "Draft GitHub or GitLab tickets: one for planned work before it starts, or ones for finished work and its follow-ups. Use when the user asks to make or raise tickets, to write up work before building it, or to set up tickets for a project."
---

# Ticket up

Write up planned work as a ticket before it starts (Intake), or record finished work as tickets, written from what actually happened in the task (Draft). Skip it for a one-line fix, a question, or a task that changed nothing.

Set up the project yourself, because it needs the user. When delegation is available, hand Intake or Draft to the **threepio** agent with this file's absolute path, the mode (`intake` or `finish`), and the goal. For `finish`, add the branch or diff and the checks that ran with their results. Run Create yourself, and show the user its drafts unchanged. Pass on its remark too, if you like.

## Set up a project

Look for `.tblock/tickets.json` in the project root. If it is missing, ask the user which labels their tickets need and what each weight means on their team, then write it:

```json
{
  "labels": ["team-scraper"],
  "followUpLabel": "follow-up",
  "weightScale": "1: under a day. 2: a few days. 3: about a week. 5: more than a week."
}
```

`labels` go on every ticket. `followUpLabel` goes on follow-ups only. `weightScale` is the team's own scale for GitLab weights. This file is what makes tblock-mode offer tickets at the end of a task, so projects without it never see the prompt.

## Intake

A ticket for work not started yet. Its acceptance criteria are the contract: the build works to them, and review checks the branch against them.

1. Resolve the forge and read any template, as in Draft step 1.
2. Search for a duplicate, as in Draft step 2. If one exists, stop and show it, since the work belongs on that ticket.
3. Draft the ticket:
   - **Title:** the outcome, imperative and plain, such as "Export a customer's orders as CSV".
   - `## Why`: the user's goal and the problem, in 1 to 2 sentences.
   - `## Acceptance`: one checkbox per criterion, written `- [ ] AC-1 <behaviour> (evidence: <kind>)`. Each one is behaviour someone can check from outside the code, such as a command and its output, a request and its response, or what a user sees. The kind is `test`, `command`, `screenshot`, or `manual`; prefer `test`. Once the ticket exists, IDs never change, because later work cites them.
   - `## Out of scope`: what a reader might expect that this ticket won't do, with a ticket link where one exists.
   - **Weight:** from `weightScale`, your estimate of the work.
4. Read the code the work will touch, so each criterion names real commands, routes, or fields. Don't settle what the goal leaves open, such as a format, a limit, or who may call it. Ask the user instead.
5. Write it with [technical-writing](../technical-writing/SKILL.md), then [unslop](../unslop/SKILL.md).

Then run Create. When the work is done, Draft finds this ticket in its step 2 and comments on it.

## Draft

1. Resolve the forge from the remote: `glab` for GitLab, `gh` for GitHub. Check it is logged in with `glab auth status` or `gh auth status`. Read any template in `.gitlab/issue_templates/` or `.github/ISSUE_TEMPLATE/`; a template overrides the shapes below.
2. Find the task's ticket. If the user gave one, or a search finds one, the work gets a comment on that ticket, not a new one:

   ```
   glab issue list --all --search "<key words>"
   gh issue list --state all --search "<key words>"
   ```

3. Draft the task ticket:
   - **Title:** what changed, imperative and plain, such as "Add the Acme knowledge base to the scraper".
   - `## Goal`: the user's goal in 1 to 2 sentences.
   - `## What changed`: 1 to 3 bullets.
   - `## Verification`: the checks you ran and their outcomes.
   - **Weight:** from `weightScale`, for the size of the work as it turned out.
4. Draft one ticket per follow-up. A follow-up is work someone needs to do: something this task left unfinished, or a bug or risk it found. Finish it now if it fits this task. "Could also", tidy-ups, and ideas get no ticket. A task with no follow-ups is a normal result. Search for a duplicate of each one, as in step 2.
   - **Title:** the work left, imperative and plain.
   - First line: `Follow-up to #<task ticket>`.
   - `## What's left`: the work, with the file, failing case, or gap that shows it is real.
   - `## Why it matters`: what goes wrong or stays missing without it.
   - **Weight:** from `weightScale`, your estimate of the work left.
5. Write every ticket with [technical-writing](../technical-writing/SKILL.md), then [unslop](../unslop/SKILL.md). A teammate with no memory of this chat must be able to act on it. Leave out secrets, customer data, and raw log lines.

## Create

1. Show the user every draft, and name each ticket you will create or comment on, in one question. Wait for a clear yes. Drop or change whatever they cut. Inside the [Opening an MR](../tblock-mode/playbooks/opening-an-mr.md) playbook, this is part of that playbook's question.
2. Write each body to a temp file outside the repo. Create the task ticket first, because each follow-up needs its number:

   ```
   glab issue create --title "<title>" --description-file <file> --label "<labels>" --weight <weight> --yes
   glab issue create --title "<title>" --description-file <file> --label "<labels>,<followUpLabel>" --weight <weight> --linked-issues <task number> --yes
   glab issue note <number> --message "<comment>"
   glab issue update <number> --weight <weight>

   gh issue create --title "<title>" --body-file <file> --label "<labels>"
   gh issue comment <number> --body-file <file>
   ```

   Use `glab issue update` only on an existing ticket with no weight; never change a weight someone already set. On GitHub, follow-ups get the same labels plus `followUpLabel`, the `Follow-up to` line makes the link, and tickets have no weight.
3. Read each one back with `glab issue view` or `gh issue view` before you link it.

An MR closes the task ticket with `Closes #<number>`. With no MR, the ticket stays open until the change lands, and you say so.

**Reply:** a link to each ticket created or commented on, which are follow-ups, and anything you left out and why.
