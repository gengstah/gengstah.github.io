# Wilderkin production plan

| Player or maintainer task | Change | Release check |
| --- | --- | --- |
| Open the trail on a phone | Reduce startup requests, defer optional features, make a failed download recoverable | Measure cold loads and a retry on a fresh browser profile |
| Take a turn and recruit a teammate | Keep battle choices visible on short screens, give hunts a capture intent, show the partner's contribution | Play the opening encounter, recruit Opalclasp, take the next hunt and see HP change at each impact |
| Explore and advance | Signpost both ends of each crossing, label the quest at a locked path and direct players to campaign objectives | Reach the gate from a fresh save, turn in the quest, cross and reload |
| Keep a campaign | Preserve damaged save bytes, maintain a recoverable copy, offer backup preview and restore, show storage failures in play | Break the current save, deny a write, export and restore a known party |
| Play with keyboard, touch or larger text | Use native focus, support leaving the game controls, reflow text and respect browser Back | Visit Party, return with Back, Tab out, and complete a battle on a short phone |
| Meet a friend | Keep private room invitations usable from the map, explain team choices and support a fair exit when a friend goes idle | Join from an independently copied map URL, check the roster and complete a friendly duel |
| Publish a known build | Check generated assets, gameplay, Jekyll output and two browser engines before merging | Compare the public HTML and assets with the approved commit |

## Make a release

1. Use a topic branch. Install the build tool with `npm ci --no-bin-links --prefix _tools`. After changing runtime sources, run `node _tools/wilderkin-build.mjs` and include its generated output. Run `node _tools/wilderkin-build.mjs --check` and `node --test _tests/wilderkin*.cjs`.
2. Install the browser runner with `python -m pip install -r _tests/wilderkin-browser/requirements.txt`. Run `python _tests/wilderkin-browser/smoke.py --browser chrome` and repeat with `--browser firefox`. For Jekyll output add `--site-root _site`.
3. Open a pull request targeting master. Wait for the Wilderkin workflow to build the site and pass both browser jobs, then merge. This repository publishes GitHub Pages from master.
4. After Pages publishes that commit, run `python _tools/wilderkin-release.py --url https://gengstah.github.io/games/wilderkin/` from its checkout. Use the same URL with the browser runner. Record the verified commit, gameplay results and any device limitations.
5. If the release breaks play, revert the game release commit on a topic branch. Run the same checks against the revert, including a reload with a campaign saved by the affected release. Merge and verify the public bytes again. Keep the player's backup available throughout recovery.

## Player validation

Use fresh profiles with five first-time players. Ask each player to recruit Mossbell, explain one benefit of switching partners and find Fern's next required action. Record unassisted completions, unintended knockouts and scrolls before the first move. Ask three pairs of friends to meet by copying a link while exploring. Record whether they see each other without assistance. On a physical phone, include the short-screen battle and the device's larger text setting. With NVDA and Firefox or VoiceOver and Safari, check focus order, departure from the game and both health announcements. Keep observed human results separate from automated runs.
