### Punch it

**You own the run from an idea to a merge-ready MR. Ask once, then stop only for a real blocker. Never merge.**

This runs when "punch it" follows `/tblock-mode` or stands alone as the request, with an idea or a ticket number. It grants nothing until the user answers step 2. "MR" means a GitLab merge request or a GitHub pull request.

1. **Draft the contract.** For an idea, draft the ticket per the Intake section of [ticket-up](../../ticket-up/SKILL.md), with threepio in intake mode. For a ticket, read it, and when it has no `AC-n` lines, draft them. Create a branch for the work off the default branch.
2. **Ask once.** Show the draft or the criteria, then ask one question naming everything the yes covers: create the ticket, push this branch, open the MR, and babysit it with fix pushes, thread replies, and one CI rerun. It never covers a merge, auto-merge, a force-push, another branch, or closing anything. With tblock's guard on, ask by running `tblock grant` (or `node <tblock>/bin/tblock.mjs grant`, where `<tblock>` is three folders above this playbook): its prompt is the question, and nothing asks again. Otherwise use the harness's question tool. A request that already states the criteria and says to go without asking is the yes.
3. **Create the ticket** per ticket-up's Create section. With no forge, keep the draft as the contract and say no ticket exists.
4. **Build** per [Feature](feature.md), or [Bug fix](bug-fix.md) for a defect.
5. **Check** with the checker agent on the `judgment` role, given the criteria, the branch, and its base. Fix each `missing` criterion, move each `unrelated` change to its own branch, and run checker again on the new head.
6. **Open the MR** per [Opening an MR](opening-an-mr.md), with step 2 of this playbook as its question. Put checker's Acceptance table in the description. With no forge, stop after the push.
7. **Babysit** in `drive` mode per [Babysit](babysit.md), with step 2 as its ask. Run checker on each fix before you push it.
8. **Hand off at merge-ready.** Run `tblock grant off`. The result is one of: ready to merge, waiting only on a human approval, or blocked.

**Stop and ask** with the harness's question tool, so the thread shows it is waiting, only when a criterion can't be met or proved, checker's second round still has gaps, a fix needs something outside the grant (another branch, a rebase, data, production, CI config), or a review thread needs the user's decision. Decide everything else yourself and list each decision in the reply.

**Picking up.** `punch it #<n>` in a new session reads the ticket, the branch, and the MR, and resumes at the first step whose result is missing.

**Reply:** the MR link and the forge's verdict, the Acceptance table, what babysit fixed, each decision you made, and that the MR is open and unmerged.
