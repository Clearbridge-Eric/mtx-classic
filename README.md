# MTX Classic Look (Firefox add-on)

Restores the pre-5.2 Nilear MTX layout (as it looked before the 26 October 2026 release) for the Tickets list, the ticket summary window and Work on Ticket. It restyles the new UI in the browser only; nothing changes in Nilear or ConnectWise. **Alt+Shift+C** turns it on and off.

Nilear removed the old version from its servers (both `app.nilear.com` and `mtx.nilear.com` now serve the new build), so going back is not possible. This add-on lays the old look over the new code instead.

## Files

| File | What it is |
|---|---|
| `mtx-classic.user.js` | The add-on's code (also works as a Tampermonkey script) |
| `manifest.json` | Add-on definition: name, version, which sites it runs on |
| `background.js` | Sets MTX's page zoom (see Text size below) |
| `icon.svg` | Add-on icon |
| `build.ps1` | Builds the zip to upload to Mozilla |
| `dist/mtx-classic-1.3.0.zip` | Ready to upload. Passed Mozilla's validator with 0 errors and 0 warnings |

## Step 1: get it signed by Mozilla (once per version, about 5 minutes)

Firefox only installs add-ons signed by Mozilla. Signing is free and automatic. Choosing **On your own** keeps it private: it is not listed on the public add-ons site.

1. Go to **https://addons.mozilla.org/developers/** and sign in with a Mozilla account. A shared CBS mailbox is better than a personal one, so the add-on isn't tied to one person.
2. Click **Submit a New Add-on**.
3. Under "How to Distribute this Version", choose **On your own**, then **Continue**.
4. Upload `dist/mtx-classic-1.3.0.zip`. Validation runs and should come back clean. **Continue**.
5. When asked whether you need to submit source code, choose **No**. The code isn't minified or compiled.
6. Click **Submit Version**. Signing usually finishes within a few minutes. The version page then shows a link to the signed **.xpi** file. Download it.

## Step 2: install (each tech, one step)

Send the techs the signed `.xpi` (SharePoint, Teams or email). Each tech then:

1. Drags the `.xpi` onto any Firefox window and clicks **Add**. As an alternative: open `about:addons`, click the gear icon, choose **Install Add-on From File…**, pick the `.xpi`, then **Add**.
2. Reloads MTX.

Firefox 128 or later is required.

### One-time setting in MTX (each tech)

- Company, Contact and Date come back as their own columns automatically. The first time the Tickets list loads, the add-on ticks them in Nilear's Columns menu. Nilear saves that choice on the tech's account, and the add-on never touches the menu again in that browser, so a tech can still change their columns later.
- Open any ticket. On the Notes tab, click the **toggle icon** at the left of the notes toolbar so it shows **Modern**. That gives the old avatar-style notes; Classic keeps the green header bars.

## Text size

5.2's text is larger than the old MTX. The add-on sets Firefox's zoom for MTX to **87.5%**, which brings it back to the old size and keeps everything lined up. Firefox remembers zoom per site, so every MTX tab opens at that size.

- If a tech zooms MTX to a different level themselves (Ctrl + scroll, or Ctrl + plus/minus), the add-on leaves that alone.
- Ctrl+0 resets to 100%. The add-on sets 87.5% again the next time MTX loads, as long as the zoom is at 100%.
- To change the size for everyone, edit `pageZoom` in the `CONFIG` block (1 turns the zoom off) and release a new version.

## Turning it off or removing it

- **Alt+Shift+C** in MTX turns it off and on, including the zoom. Firefox remembers the choice.
- To remove it: `about:addons` > MTX Classic Look > **Remove**.
- If something in MTX looks broken, press Alt+Shift+C first. If the problem goes away, it's the add-on. If it doesn't, it's Nilear.
- Firefox doesn't run add-ons in private windows unless allowed: `about:addons` > MTX Classic Look > **Run in Private Windows**.

## Releasing a new version

1. Make the change in `mtx-classic.user.js`.
2. Bump the version in **both** `manifest.json` (`"version"`) and the script header (`@version`), for example to 1.0.1.
3. Run `build.ps1` (right-click > Run with PowerShell). It creates `dist/mtx-classic-1.0.1.zip` and refuses to build if the two versions don't match.
4. On addons.mozilla.org, open the add-on and choose **Upload New Version**. Pick **On your own** again, then upload the zip.
5. Send out the new `.xpi`. Techs install it the same way; it replaces the old one.

## What it restores

**Tickets list**
- Striped rows and plain-text statuses, with the old badges: green In Progress, red late In Progress, blue PSR
- Ticket numbers as blue buttons, and the folder icon for "changed since last viewed"
- Age and Modified left aligned, in normal weight
- Toolbar in the old order: New Ticket, icon-only quick buttons, SLA, State, then **Type as a button group** (Service, Monitoring, Project, Sales, Other, Custom)
- Hours column shows hours only, without the budget meter

**Ticket summary window**
- Grey title bar: `◀ ▶ [icons] 2/104. Ticket #191131: Summary`
- Full-width action buttons in the old colours, including a red **Delete Ticket** button. It opens Nilear's own Delete confirmation.
- Grey Age / Responded / Modified bar
- Properties back above the tabs in the old two-column grid: Company | Contact, Board | Priority, Status | Agreement, Site | Address, Email | Phone, Mobile | Draft SMS, and so on. Values are green, "No Contact!" is plain green as before, and the double chevron collapses the grid. Team (new in 5.2) is hidden; it's still on the Scheduling tab.
- Other Tickets, Expenditures, Custom Fields, Pods, Company Notes and Audit Trail pinned back into the tab bar. This happens on first run only, and only if the tech hasn't pinned tabs themselves.
- Notes toolbar back to the centred Send / Internal / Note / Internal buttons
- Notes **Modern** view drawn like the old Modern view: avatar, blue name, date underneath, a rule between notes

**Work on Ticket**
- The Ticket Properties tab uses the same old two-column grid

## Options

The `CONFIG` block at the top of `mtx-classic.user.js` switches individual pieces on or off. For example, `hideNoteSearchAndChips: false` keeps the new notes search box. The defaults match the old look as closely as possible. Changing an option means releasing a new version (see above).

## Known limits

- **Tuned for the dark theme**, which the old layout was built around. Light theme gets the layout, but some colours may look off.
- **Window width:** the properties grid applies when the window is 1200 px or wider, which is where 5.2 uses its side panel. Narrower windows keep 5.2's properties band, though the title bar and buttons are still restored. Phones are left alone.
- **Not restorable without Nilear:** the second header row of filters on the Tickets list (5.2 replaced it with a funnel on each heading), and the old Ticket Search magnifier (now under View > Ticket Search).
- **Future Nilear updates** may move things again. The add-on fails safe: anything it can't find stays as Nilear drew it. Expect to adjust it when Nilear ships layout changes.

## Testing done

Tested against saved copies of the 5.2 Tickets list, ticket summary and Work on Ticket pages (26 October 2026) in a local browser, with the old pages side by side. Packaged and validated with Mozilla's `web-ext lint` (0 errors, 0 warnings). Not yet tested against a live, signed-in MTX session. Install it on one machine first.
