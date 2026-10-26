// ==UserScript==
// @name         MTX Classic Look
// @namespace    https://clearbridge.ca/userscripts/mtx-classic
// @version      1.3.0
// @description  Restores the pre-5.2 (October 2026) Nilear MTX layout for the Tickets list, the ticket summary and Work on Ticket.
// @author       Clearbridge Business Solutions
// @match        https://mtx.nilear.com/*
// @match        https://app.nilear.com/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @noframes
// ==/UserScript==

/*
 * How it works
 * ------------
 * MTX 5.2 kept the same Angular components as the old UI and mostly changed their
 * templates and styles. This script layers a stylesheet over the new UI (scoped to
 * html.cbs-classic so it can be switched off instantly) and makes a few small DOM
 * tweaks that CSS alone cannot do:
 *   - moves the Status / Priority / Board pills from the ticket summary header back
 *     into the properties grid (the elements are moved, not copied, so they keep working)
 *   - sizes the notes area to fit under the restored properties grid
 *   - rebuilds the Type button group and the red Delete Ticket button, both of which
 *     simply click Nilear's own controls
 *
 * Toggle: Tampermonkey/Violentmonkey menu > "Toggle MTX Classic Look", or Alt+Shift+C.
 *
 * One-time setup per tech (Nilear stores this per user, it follows them to any device):
 *   Tickets tab > Columns (beside Filters) > tick Company, Contact and Date.
 *   Nilear then stops squeezing those into the Summary and Assigned cells.
 *
 * Also runs unchanged as a Firefox/Edge/Chrome extension content script (see manifest.json).
 */

(function () {
  'use strict';

  // ---- Options ---------------------------------------------------------------
  // Set any of these to false to keep the matching 5.2 feature visible.
  const CONFIG = {
    hideBudgetInHoursColumn: true,   // "0.00 / 0.25" and the meter become "0.00"
    hideNoteSearchAndChips: true,    // notes search box and All/Discussion/Internal/Resolution chips
    hideNoteDayDividers: true,       // "Today", "Your last visit" dividers and New marks
    hideQuickViewCounts: true,       // red count on Customer Updated, SLA count
    addTypeButtonGroup: true,        // Service / Monitoring / Project ... buttons instead of the Type dropdown
    addDeleteButton: true,           // red Delete Ticket button in the ticket summary
    pinOldTabs: true,                // first run only: pin the tabs 5.2 moved under "More"
    showOldColumns: true,            // first run only: tick Company, Contact and Date in Nilear's Columns menu
    showTeamField: false,            // Team (new in 5.2) in the properties grid; the Scheduling tab still has it
    pageZoom: 0.875,                 // Firefox zoom for MTX (old MTX text was smaller); 1 leaves zoom alone
  };

  const STORAGE_KEY = 'cbs-mtx-classic';
  const ROOT_CLASS = 'cbs-classic';

  // Nilear's own per-browser list of ticket summary tabs pinned out of the "More" menu.
  const PINNED_TABS_KEY = 'mtx.summaryPinnedTabs';
  const OLD_TAB_BAR = ['other-tickets', 'expenditures', 'custom-fields', 'pods', 'company-notes', 'audit-trail'];

  // Set once the old columns have been switched on in this browser. Nilear stores the
  // column choice on the user's account, so later changes by the tech are left alone.
  const COLUMNS_DONE_KEY = 'cbs-mtx-classic-columns';
  const OLD_COLUMNS = ['Company', 'Contact', 'Date'];

  // ---- Stylesheet --------------------------------------------------------------
  // Colours are the Bootswatch "Darkly" palette the old MTX used.
  const CSS = String.raw`
html.cbs-classic {
  --cbs-primary: #375a7f;
  --cbs-info: #3498db;
  --cbs-success: #00bc8c;
  --cbs-danger: #e74c3c;
  --cbs-warning: #f39c12;
  --cbs-light: #adb5bd;
  --cbs-value: #90ee90;
  --cbs-row: #303030;
  --cbs-row-alt: #424242;
  --cbs-bar: #9fa8b2;
  --cbs-header: #444444;
}

/* =====================================================================
   Tickets list
   ===================================================================== */

/* Striped rows, as before. Customer-updated, in-house, selected and highlighted rows keep their colours. */
html.cbs-classic app-issues-table tr.mat-mdc-row.row-state-none:not(.highlighted):nth-child(odd),
html.cbs-classic app-issues-table tr.mat-mdc-row.row-state-none:not(.highlighted):nth-child(odd) > td {
  background-color: var(--cbs-row) !important;
}
html.cbs-classic app-issues-table tr.mat-mdc-row.row-state-none:not(.highlighted):nth-child(even),
html.cbs-classic app-issues-table tr.mat-mdc-row.row-state-none:not(.highlighted):nth-child(even) > td {
  background-color: var(--cbs-row-alt) !important;
}

/* Age / Modified: left aligned, normal weight */
html.cbs-classic app-issues-table .age-col,
html.cbs-classic app-issues-table .age-col * {
  text-align: left !important;
  font-weight: 400 !important;
}

/* Status: plain text, with the old badges for In Progress (green), late In Progress (red) and PSR (blue) */
html.cbs-classic app-issues-status-cell .status-pill {
  background: transparent !important;
  color: inherit !important;
  padding: 0 !important;
  border-radius: 0 !important;
  font-weight: 400 !important;
}
html.cbs-classic app-issues-status-cell .status-pill span {
  white-space: normal !important;
}
html.cbs-classic app-issues-status-cell .status-pill.status-progress,
html.cbs-classic app-issues-status-cell .status-pill.status-stale,
html.cbs-classic app-issues-status-cell .status-pill.status-psr {
  color: #fff !important;
  padding: .35em .65em !important;
  border-radius: 6px !important;
  font-weight: 700 !important;
  line-height: 1;
}
html.cbs-classic app-issues-status-cell .status-pill.status-progress { background: var(--cbs-success) !important; }
html.cbs-classic app-issues-status-cell .status-pill.status-stale    { background: var(--cbs-danger) !important; }
html.cbs-classic app-issues-status-cell .status-pill.status-psr      { background: var(--cbs-info) !important; }
html.cbs-classic app-issues-status-cell .status-pill.status-progress span,
html.cbs-classic app-issues-status-cell .status-pill.status-stale span,
html.cbs-classic app-issues-status-cell .status-pill.status-psr span {
  white-space: nowrap !important;
}

/* Ticket number: blue button instead of a link; folder icon instead of the dot */
html.cbs-classic app-issues-ticket-cell .ticket-link {
  background-color: var(--cbs-info) !important;
  border: 1px solid var(--cbs-info) !important;
  color: #fff !important;
  padding: 0 4px !important;
  border-radius: 4px !important;
  font-size: 14px !important;
  line-height: 21px !important;
  font-weight: 400 !important;
  text-decoration: none !important;
}
html.cbs-classic app-issues-ticket-cell .ticket-link:hover {
  filter: brightness(1.1);
}
html.cbs-classic app-issues-ticket-cell i.viewed-dot {
  --fa: "\f07c";
}

/* Toolbar: old order (New Ticket, quick icons, SLA, State, Type), icon-only quick buttons */
html.cbs-classic app-issues-toolbar button[title="New Ticket"] { order: 1; }
html.cbs-classic app-issues-toolbar .d-lg-flex:has(app-tags) { order: 2; }
html.cbs-classic app-issues-toolbar .d-flex > button:has(.fa-triangle-exclamation) { order: 3; }
html.cbs-classic app-issues-toolbar .d-flex:has(> .btn-group) { order: 4; }
html.cbs-classic app-issues-toolbar app-tickets-view-switcher { order: 5; }
html.cbs-classic app-issues-toolbar .d-flex > .ms-auto { order: 6; }
html.cbs-classic app-issues-toolbar .quick-heading,
html.cbs-classic app-issues-toolbar .quick-label {
  display: none !important;
}
html.cbs-classic app-issues-toolbar .d-flex > button:has(.fa-triangle-exclamation) > i {
  display: none !important;
}
html.cbs-classic app-issues-toolbar .d-flex > button:has(.fa-triangle-exclamation) > small {
  font-size: inherit;
}
html.cbs-classic.cbs-hide-counts app-issues-toolbar app-customer-responded-only .badge,
html.cbs-classic.cbs-hide-counts app-issues-toolbar .d-flex > button:has(.fa-triangle-exclamation) > .badge {
  display: none !important;
}

/* Columns menu stays invisible while the script ticks Company / Contact / Date */
html.cbs-columns-auto .columns-menu {
  opacity: 0 !important;
  pointer-events: none !important;
}

/* View picker (new in 5.2) kept small at the end of the row so the toolbar doesn't wrap */
html.cbs-classic app-issues-toolbar .view-switcher-label { display: none !important; }
html.cbs-classic app-issues-toolbar .view-switcher {
  padding: 2px 8px !important;
  line-height: 21px !important;
  min-height: 0 !important;
  height: auto !important;
}
html.cbs-classic app-issues-toolbar .view-switcher-text { display: inline !important; }
html.cbs-classic app-issues-toolbar .view-switcher-name { font-weight: 400 !important; font-size: 14px !important; }

/* Type as a button group (built by the script); the dropdown stays in the page, hidden */
html.cbs-classic.cbs-type-group app-issues-toolbar .dropdown:has(> .dropdown-toggle .opacity-75) {
  display: none !important;
}
html.cbs-classic .cbs-type-group-buttons .btn { white-space: nowrap; }

/* Hours: just the hours, as before */
html.cbs-classic.cbs-hide-budget app-issues-table .budget-of,
html.cbs-classic.cbs-hide-budget app-issues-table .budget-meter {
  display: none !important;
}

/* =====================================================================
   Ticket summary (the window that opens from the list)
   Tablet and desktop only; the 5.2 phone layout is left as Nilear made it.
   ===================================================================== */
@media (min-width: 768px) {

/* Stack: title bar, action buttons, age bar, properties, tabs */
html.cbs-classic .summary-modal {
  display: flex !important;
  flex-direction: column;
}
html.cbs-classic .summary-modal > .summary-header,
html.cbs-classic .summary-modal > .summary-header > .summary-fields-row,
html.cbs-classic .summary-modal .summary-title-row > .summary-nav {
  display: contents !important;
}
html.cbs-classic .summary-modal > app-spinner { order: 0; }
html.cbs-classic .summary-modal .summary-title-row { order: 1; }
html.cbs-classic .summary-modal > .summary-actions { order: 2; }
html.cbs-classic .summary-modal .summary-meta { order: 3; }
html.cbs-classic .summary-modal .summary-fields-row > app-ticket-summary-header-pills { order: 3; }
html.cbs-classic .summary-modal > app-ticket-summary { order: 4; display: block; }

/* Title bar */
html.cbs-classic .summary-modal .summary-title-row {
  display: flex !important;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  background-color: var(--cbs-header);
  color: #fff;
  padding: 8px 16px 9px;
  margin: 0;
  border-radius: 7px 7px 0 0;
}
html.cbs-classic .summary-modal .summary-title-row > button[title="Backward"] { order: 1; }
html.cbs-classic .summary-modal .summary-title-row > button[title="Forward"] { order: 2; }
html.cbs-classic .summary-modal .summary-title-row > .summary-controls { order: 3; gap: 8px; flex-wrap: nowrap; }
html.cbs-classic .summary-modal .summary-title-row > .summary-position { order: 4; }
html.cbs-classic .summary-modal .summary-title-row > .summary-title { order: 5; flex: 1 1 auto; min-width: 0; }
html.cbs-classic .summary-modal .summary-title-row > .summary-close { order: 6; margin-left: auto; }

html.cbs-classic .summary-modal .summary-icon-button,
html.cbs-classic .summary-modal .summary-controls .summary-tag {
  width: auto !important;
  min-width: 27px;
  height: 30px !important;
  padding: 4px !important;
  border-radius: 4px !important;
  background-color: var(--cbs-light) !important;
  border: 1px solid var(--cbs-light) !important;
  color: #000 !important;
  font-size: 14px !important;
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
}
html.cbs-classic .summary-modal .summary-icon-button i,
html.cbs-classic .summary-modal .summary-controls .summary-tag i {
  color: #000 !important;
}
html.cbs-classic .summary-modal .summary-position {
  font-size: 20px !important;
  font-weight: 500 !important;
  color: #fff !important;
  padding: 0 0 0 4px !important;
  white-space: nowrap;
}
html.cbs-classic .summary-modal .summary-position::after { content: "."; }
html.cbs-classic .summary-modal .summary-title {
  font-size: 20px !important;
  font-weight: 500 !important;
  line-height: 24px;
  color: #fff !important;
  margin: 0 !important;
  white-space: normal;
}
html.cbs-classic .summary-modal .summary-number {
  background: transparent !important;
  color: #fff !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 0 !important;
  font-size: inherit !important;
  font-weight: inherit !important;
  display: inline !important;
}
html.cbs-classic .summary-modal .summary-number::before { content: "Ticket "; }
html.cbs-classic .summary-modal .summary-number::after { content: ":\00a0"; }
html.cbs-classic .summary-modal .summary-title .summary-text {
  font-weight: inherit !important;
  color: #fff !important;
}

/* Action buttons: full width, square, old colours */
html.cbs-classic .summary-modal > .summary-actions {
  display: flex !important;
  flex-wrap: nowrap !important;
  gap: 0 !important;
  padding: 0 !important;
  background: transparent !important;
}
html.cbs-classic .summary-modal > .summary-actions > .btn {
  flex: 1 1 0 !important;
  justify-content: center;
  border-radius: 0 !important;
  margin: 0 !important;
  font-weight: 400 !important;
  font-size: 14px !important;
  padding: 4px 8px !important;
  color: #fff !important;
  background-color: #444 !important;
  border: 1px solid #444 !important;
}
html.cbs-classic .summary-modal > .summary-actions > .summary-work {
  background-color: var(--cbs-primary) !important;
  border-color: var(--cbs-primary) !important;
}
html.cbs-classic .summary-modal > .summary-actions > .btn:has(.fa-object-ungroup) {
  background-color: var(--cbs-light) !important;
  border-color: var(--cbs-light) !important;
  color: #000 !important;
}
html.cbs-classic .summary-modal > .summary-actions > .btn:has(.fa-scissors) {
  background-color: var(--cbs-info) !important;
  border-color: var(--cbs-info) !important;
}
html.cbs-classic .summary-modal > .summary-actions > .btn.cbs-delete {
  background-color: var(--cbs-danger) !important;
  border-color: var(--cbs-danger) !important;
}
html.cbs-classic .summary-modal > .summary-actions > .btn:hover { filter: brightness(1.1); }
html.cbs-classic .summary-modal > .summary-actions .summary-key { display: none !important; }
html.cbs-classic .summary-modal > .summary-actions > .btn > span::after { content: " Ticket"; }
html.cbs-classic .summary-modal > .summary-actions > .summary-work > span::after,
html.cbs-classic .summary-modal > .summary-actions > .btn:has(.fa-calendar-circle-user) > span::after,
html.cbs-classic .summary-modal > .summary-actions > .btn.cbs-delete > span::after {
  content: none;
}

/* Age bar */
html.cbs-classic .summary-modal .summary-meta {
  display: flex !important;
  flex-wrap: nowrap !important;
  gap: 0 !important;
  margin: 0 !important;
  background-color: var(--cbs-bar);
  color: #fff !important;
  font-size: 16px !important;
  line-height: 24px;
}
html.cbs-classic .summary-modal .summary-meta > span {
  flex: 1 1 0;
  text-align: center;
  color: #fff !important;
}
html.cbs-classic .summary-modal .summary-meta > span * { color: #fff !important; font-weight: 400 !important; }

/* Properties: from the side panel back to the band above the tabs */
html.cbs-classic .summary-body.panel-mode {
  flex-direction: column !important;
  height: auto !important;
}
html.cbs-classic .summary-body.panel-mode > .summary-tabs {
  width: auto !important;
  max-width: none !important;
  flex: 1 1 auto;
}
html.cbs-classic .summary-body.panel-mode > aside.summary-panel {
  order: -1;
  position: relative;
  flex: 0 0 auto !important;
  width: auto !important;
  max-width: none !important;
  height: auto !important;
  background: transparent !important;
  border: 0 !important;
  border-bottom: 1px solid #ddd !important;
  padding: 4px 8px 14px !important;
}
html.cbs-classic aside.summary-panel .summary-panel-open {
  position: static !important;
  height: auto !important;
  display: block !important;
}
html.cbs-classic aside.summary-panel .summary-panel-open.d-none {
  display: none !important;
}
html.cbs-classic aside.summary-panel .summary-panel-header {
  padding: 0 !important;
}
html.cbs-classic aside.summary-panel .summary-panel-title,
html.cbs-classic aside.summary-panel .summary-panel-warnings {
  display: none !important;
}
/* The collapse button becomes the old double chevron under the properties */
html.cbs-classic aside.summary-panel .summary-panel-collapse {
  position: absolute;
  left: 50%;
  bottom: -2px;
  transform: translateX(-50%);
  background: transparent !important;
  border: 0 !important;
  color: rgba(222, 226, 230, .75) !important;
  font-size: 14px;
  padding: 0 6px !important;
  z-index: 1;
}
html.cbs-classic aside.summary-panel .summary-panel-collapse i { --fa: "\f325"; }
html.cbs-classic aside.summary-panel .summary-panel-rail {
  width: 100% !important;
  height: 18px !important;
  min-height: 0 !important;
  padding: 0 !important;
  display: flex !important;
  flex-direction: row !important;
  justify-content: center;
  align-items: center;
  gap: 6px;
  background: transparent !important;
  border: 0 !important;
  writing-mode: horizontal-tb !important;
  color: rgba(222, 226, 230, .75) !important;
  font-size: 13px;
}
html.cbs-classic aside.summary-panel .summary-panel-rail * { writing-mode: horizontal-tb !important; transform: none !important; }
html.cbs-classic aside.summary-panel .summary-panel-rail i { --fa: "\f322"; }
html.cbs-classic aside.summary-panel .summary-panel-content {
  padding: 0 !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
}

/* Notes area: as tall as the notes, up to the space left under the properties
   (the script measures that), so short tickets give a short window as before */
html.cbs-classic .summary-body.panel-mode .tab-overflow {
  height: auto !important;
  min-height: 0 !important;
  max-height: var(--cbs-tab-h, calc(100vh - 560px)) !important;
}

/* Window size: the old standard extra-large dialog, 1140px wide and centred,
   instead of 5.2's near-full-width, full-height window */
html.cbs-classic .modal:has(app-ticket-summary-modal) .modal-dialog {
  max-width: 1140px !important;
  width: auto !important;
  height: auto !important;
  margin-left: auto !important;
  margin-right: auto !important;
}
html.cbs-classic .modal:has(app-ticket-summary-modal) :is(.modal-content, .summary-modal, app-ticket-summary, .summary-body) {
  height: auto !important;
  min-height: 0 !important;
}

/* ---- The properties grid (ticket summary and Work on Ticket > Ticket Properties) ----
   Old layout, two columns:
     Summary (full width)
     Company   | Contact
     Board     | Priority
     Status    | Agreement
     Site      | Address     (Address is drawn from the Site field)
     Email     | Phone
     Mobile    | Team        (Draft SMS is the chip beside Mobile; Team is new in 5.2)
     Source    | SLA
     Owner     | Budget Hrs
     Type      | Due Date
     SubType   | CC List
     Item      | Links
*/
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel {
  --cbs-col-gap: 24px;
  display: grid !important;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-auto-flow: row dense;
  column-gap: var(--cbs-col-gap);
  row-gap: 0 !important;
  width: auto !important;
  height: auto !important;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel > section.panel-group,
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel app-ticket-summary-header-pills,
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .header-pills {
  display: contents !important;
}
html.cbs-classic .working-properties .props-panel .panel-row:has(> .panel-value > app-ticket-summary-header-pills) > .panel-label,
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-group-title,
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-attention,
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-warning {
  display: none !important;
}

/* A field: label on the left (80px), value on the right */
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:not(.d-none),
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .header-pill {
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start;
  gap: 0 !important;
  padding: 1px 0 !important;
  margin: 0 !important;
  min-height: 26px;
  height: auto !important;
  background: transparent !important;
  border: 0 !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  max-width: none !important;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-label,
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .header-pill::before {
  flex: 0 0 80px;
  width: 80px;
  display: flex !important;
  align-items: flex-start;
  gap: 4px;
  padding: 1px !important;
  font-size: 14.4px !important;
  line-height: 21.6px !important;
  font-weight: 400 !important;
  color: #fff !important;
  text-transform: none !important;
  letter-spacing: normal !important;
  white-space: nowrap;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-label::after {
  content: ":";
  order: 1;
  margin-left: -4px;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-label > * { order: -1; }
/* Labels with extra icons (e.g. the VIP crown beside Contact) widen instead of running into the value */
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-label {
  flex: 0 0 auto !important;
  width: auto !important;
  min-width: 80px;
  gap: 3px !important;
  padding-right: 6px !important;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .status-pill::before { content: "Status:"; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .priority-pill::before { content: "Priority:"; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .board-pill::before { content: "Board:"; }

html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-value {
  flex: 1 1 auto;
  min-width: 0;
  width: auto !important;
  font-weight: 400 !important;
  color: var(--cbs-value) !important;
  font-size: 16px !important;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel :is(.panel-value, .header-pill) :is(select, input, .panel-name, .panel-company-name, .summary-wrap-text, .panel-text, .pill-text, form > span, .select-wrapper) {
  color: var(--cbs-value) !important;
  font-weight: 400 !important;
  font-size: 16px !important;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel :is(.panel-value, .header-pill) option {
  color: initial;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .header-pill > :not(.pill-icon) {
  flex: 1 1 auto;
  min-width: 0;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .header-pill .pill-icon {
  display: none !important;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .priority-pill > .pill-swatch {
  flex: 0 0 auto;
  margin: 5px 6px 0 4px;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(.panel-company) > .panel-value {
  display: flex !important;
  align-items: flex-start;
  position: relative;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-company { display: contents !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-company-name { flex: 0 1 auto; min-width: 0; padding-right: 0 !important; order: 0; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-company-types {
  display: inline-flex !important;
  order: 1;
  margin: 0 0 0 5px !important;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-type-pill {
  background: transparent !important;
  border: 0 !important;
  padding: 0 !important;
  color: var(--cbs-value) !important;
  font-size: 16px !important;
  font-weight: 400 !important;
  line-height: 24px;
  text-transform: none !important;
  letter-spacing: normal !important;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-type-pill::before { content: "("; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-type-pill::after { content: ")"; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-type-pill + .panel-type-pill { margin-left: 4px; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .ai-company-btn { order: 2; margin-left: auto !important; margin-right: 28px !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-sub {
  color: #ccc !important;
  font-size: 13px !important;
  padding-left: 4px;
}
/* Address goes back beside Site, in the right-hand column */
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="site"] {
  position: relative;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="site"] .panel-address {
  position: absolute;
  top: 1px;
  left: calc(100% + var(--cbs-col-gap, 24px));
  width: 100%;
  display: flex !important;
  align-items: flex-start;
  margin: 0 !important;
  padding: 0 !important;
  color: #fff !important;
  font-size: 16px !important;
  line-height: 24px;
  white-space: nowrap;
  overflow: hidden;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="site"] .panel-address::before {
  content: "Address:";
  flex: 0 0 80px;
  padding: 1px;
  font-size: 14.4px;
  line-height: 21.6px;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="site"] .panel-address > div {
  padding-left: 4px;
  white-space: nowrap;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="site"] .panel-address > div + div {
  padding-left: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="site"] .panel-address > div + div::before {
  content: ",\00a0";
}
/* SLA goal and recorded hours on the same line, right aligned, as before */
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel :is(app-ticket-summary-sla, app-ticket-summary-hours) {
  display: flex !important;
  align-items: flex-start;
  gap: 8px;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel :is(app-ticket-summary-sla, app-ticket-summary-hours) > form {
  flex: 1 1 auto;
  min-width: 0;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel :is(app-ticket-summary-sla, app-ticket-summary-hours) :is(.field-meter, .field-meter-text) {
  flex: 0 0 auto;
  display: block !important;
  width: auto !important;
  margin: 0 !important;
  font-size: 14.4px !important;
  line-height: 24px;
  white-space: nowrap;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel app-ticket-summary-hours .field-meter-text {
  color: #999 !important;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel app-ticket-summary-sla .field-meter-text:not(.text-danger) {
  color: #fff !important;
}
/* "No Contact!" in plain green like the old layout, not on a pink warning fill */
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="contact"] :is(.text-bg-danger-light, .bg-danger-light) {
  background: transparent !important;
  color: var(--cbs-value) !important;
}
/* Summary underlined, as the old text box was */
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel app-ticket-summary-summary td.summary-wrap {
  border-bottom: 1px solid #ccc;
}
/* Dropdown carets on Board, Status and Priority like the other fields */
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .header-pill {
  position: relative;
  padding-right: 22px !important;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .header-pill::after {
  content: "0d7";
  font-family: "Font Awesome 5 Pro", "Font Awesome 7 Pro", "Font Awesome 6 Pro";
  font-weight: 900;
  font-size: 16px;
  line-height: 24px;
  color: #adb5bd;
  position: absolute;
  right: 4px;
  top: 1px;
  pointer-events: none;
}
/* Draft SMS chip and Links styled like the old small blue buttons */
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-sms-chip,
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .summary-links-quiet {
  background-color: var(--cbs-primary) !important;
  border: 1px solid var(--cbs-primary) !important;
  color: #fff !important;
  border-radius: 4px !important;
  font-size: 14px !important;
  font-weight: 400 !important;
  padding: 0 8px !important;
  line-height: 21px;
  height: auto !important;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(app-ticket-summary-mobile) { position: relative; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-sms-chip {
  text-transform: uppercase;
  position: absolute !important;
  top: 2px;
  left: calc(100% + var(--cbs-col-gap, 24px));
  display: inline-flex !important;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-sms-chip::before { content: "Draft"; }
html.cbs-classic.cbs-hide-team :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(app-ticket-summary-team) { display: none !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-sms-chip i { order: -1; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .field-meter-bar { display: none !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .field-meter {
  padding: 0 4px !important;
}

/* Field placement */
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel :is(
  .panel-row:has(app-ticket-summary-summary)) { grid-column: 1 / -1 !important; grid-row: 1 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(.panel-company) { grid-column: 1 !important; grid-row: 2 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="contact"] { grid-column: 2 !important; grid-row: 2 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .board-pill { grid-column: 1 !important; grid-row: 3 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .priority-pill { grid-column: 2 !important; grid-row: 3 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .status-pill { grid-column: 1 !important; grid-row: 4 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="agreement"] { grid-column: 2 !important; grid-row: 4 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="site"] { grid-column: 1 !important; grid-row: 5 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(app-ticket-summary-team) { grid-column: 2 !important; grid-row: 7 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="email"] { grid-column: 1 !important; grid-row: 6 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="phone"] { grid-column: 2 !important; grid-row: 6 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(app-ticket-summary-mobile) { grid-column: 1 !important; grid-row: 7 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(app-ticket-summary-source) { grid-column: 1 !important; grid-row: 8 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(app-ticket-summary-sla) { grid-column: 2 !important; grid-row: 8 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(app-ticket-summary-owner) { grid-column: 1 !important; grid-row: 9 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(app-ticket-summary-hours) { grid-column: 2 !important; grid-row: 9 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="type"] { grid-column: 1 !important; grid-row: 10 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(app-ticket-summary-due) { grid-column: 2 !important; grid-row: 10 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="subtype"] { grid-column: 1 !important; grid-row: 11 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(.fa-edit[title="Edit CC List"]) { grid-column: 2 !important; grid-row: 11 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row[data-field="item"] { grid-column: 1 !important; grid-row: 12 !important; }
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel app-summary-links { grid-column: 2 !important; grid-row: 12 !important; padding: 1px 0; }

/* Work on Ticket keeps Status / Priority / Board in one "Status · Priority · Board" row.
   Dissolve that row so each pill becomes its own field (declared last so it beats the field rule). */
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row.panel-row:has(> .panel-value > app-ticket-summary-header-pills),
html.cbs-classic :is(aside.summary-panel, .working-properties) .props-panel .panel-row:has(> .panel-value > app-ticket-summary-header-pills) > .panel-value.panel-value {
  display: contents !important;
}

} /* end @media (min-width: 768px) */

/* =====================================================================
   Notes tab
   ===================================================================== */

/* Toolbar: centred coloured buttons (Send, Internal, Note, Internal), view toggles on the left */
html.cbs-classic .notes-toolbar {
  position: relative;
  display: flex !important;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 4px !important;
  min-height: 30px;
}
html.cbs-classic.cbs-hide-note-search .notes-toolbar .notes-search,
html.cbs-classic.cbs-hide-note-search .notes-toolbar .notes-chips {
  display: none !important;
}
html.cbs-classic .notes-toolbar .notes-view-controls {
  position: absolute;
  left: 0;
  top: 4px;
  margin: 0 !important;
}
html.cbs-classic .notes-toolbar .notes-add {
  display: inline-flex;
  gap: 0;
}
html.cbs-classic .notes-toolbar .notes-add > .btn {
  border-radius: 4px !important;
  margin: 0 8px 0 4px !important;
  padding: 0 8px !important;
  font-size: 14px !important;
  line-height: 21px;
  display: inline-flex !important;
  flex-direction: row-reverse;
  align-items: center;
  gap: 4px;
  color: #fff !important;
  background-color: var(--cbs-primary) !important;
  border: 1px solid var(--cbs-primary) !important;
}
html.cbs-classic .notes-toolbar .notes-add > .btn:has(.text-warning) {
  background-color: var(--cbs-warning) !important;
  border-color: var(--cbs-warning) !important;
}
html.cbs-classic .notes-toolbar .notes-add > .btn:has(.text-success) {
  background-color: var(--cbs-success) !important;
  border-color: var(--cbs-success) !important;
}
html.cbs-classic .notes-toolbar .notes-add > .btn i { color: #fff !important; margin: 0 !important; }
html.cbs-classic .notes-toolbar .notes-add > .btn .notes-add-label { margin: 0 !important; }
/* Old labels: Send / Internal / Note / Internal */
html.cbs-classic .notes-toolbar .notes-add > .btn:nth-child(1) .notes-add-label,
html.cbs-classic .notes-toolbar .notes-add > .btn:nth-child(2) .notes-add-label {
  font-size: 0 !important;
}
html.cbs-classic .notes-toolbar .notes-add > .btn:nth-child(1) .notes-add-label::before { content: "Send"; font-size: 14px; }
html.cbs-classic .notes-toolbar .notes-add > .btn:nth-child(2) .notes-add-label::before { content: "Internal"; font-size: 14px; }
html.cbs-classic .notes-toolbar .notes-customer-updated {
  background-color: #444 !important;
  border-color: #444 !important;
  color: #fff !important;
  padding: 0 8px !important;
  font-size: 14px !important;
  line-height: 21px;
  border-radius: 4px !important;
}
html.cbs-classic .timeline-note .timeline-kind-email,
html.cbs-classic .timeline-note .timeline-kind-discussion,
html.cbs-classic .working-properties .props-panel .panel-company-types.panel-company-types,
html.cbs-classic.cbs-hide-dividers .notes-divider,
html.cbs-classic.cbs-hide-dividers .timeline-note .timeline-kind-initial,
html.cbs-classic.cbs-hide-dividers .timeline-note .badge.rounded-pill.text-bg-primary {
  display: none !important;
}

/* Modern view: the 5.2 timeline cards drawn like the old Modern view
   (avatar, blue name, date underneath, note below, thin rule between notes) */
html.cbs-classic .timeline-note {
  grid-template-columns: 40px minmax(0, 1fr) !important;
  gap: 0 16px !important;
  margin: 0 0 8px !important;
  padding: 0 0 8px;
  border-bottom: 1px solid #aaa;
}
html.cbs-classic .timeline-note .timeline-avatar {
  box-shadow: none !important;
}
html.cbs-classic .timeline-note .timeline-card,
html.cbs-classic .timeline-note.dark-theme .timeline-card {
  border: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
  overflow: visible;
}
html.cbs-classic .timeline-note .timeline-card.internal {
  border-left: 3px solid var(--cbs-warning) !important;
  padding-left: 8px;
}
html.cbs-classic .timeline-note .timeline-card.resolution {
  border-left: 3px solid var(--cbs-success) !important;
  padding-left: 8px;
}
html.cbs-classic .timeline-note .timeline-card-header {
  display: grid !important;
  grid-template-columns: auto 1fr auto;
  align-items: start;
  gap: 0 8px !important;
  padding: 0 !important;
  font-size: 85% !important;
  line-height: 14px;
}
html.cbs-classic .timeline-note .timeline-card-header > app-contact-card-trigger { grid-column: 1; grid-row: 1; }
html.cbs-classic .timeline-note .timeline-card-header .timeline-author {
  color: var(--cbs-info) !important;
  font-weight: 700 !important;
}
html.cbs-classic .timeline-note .timeline-card-header .timeline-date {
  grid-column: 1 / 3;
  grid-row: 2;
  color: #fff !important;
  margin-top: 2px;
}
html.cbs-classic .timeline-note .timeline-card-header .timeline-controls {
  grid-column: 3;
  grid-row: 1 / 3;
  justify-self: end;
}
html.cbs-classic .timeline-note .timeline-card-header .timeline-kind {
  grid-row: 1;
  justify-self: start;
}
html.cbs-classic .timeline-note .timeline-card-body {
  padding: 16px 0 0 !important;
}
html.cbs-classic .timeline-note .timeline-card-footer {
  padding: 4px 0 0 !important;
  background: transparent !important;
  border: 0 !important;
}

/* =====================================================================
   Work on Ticket > Ticket Properties
   ===================================================================== */
html.cbs-classic .working-properties .props-panel {
  --cbs-col-gap: 16px;
}
/* Same grey as the rest of the Work on Ticket card, not 5.2's navy panel */
html.cbs-classic .working-properties.working-properties {
  background-color: transparent !important;
}
`;

  // ---- Helpers ------------------------------------------------------------------
  let enabled = readEnabled();
  let styleEl = null;
  let scheduled = false;
  const movedPills = new WeakMap(); // summary modal -> its header pills element

  function readEnabled() {
    try { return localStorage.getItem(STORAGE_KEY) !== 'off'; } catch (e) { return true; }
  }

  function saveEnabled(value) {
    try { localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off'); } catch (e) { /* private window */ }
  }

  function makeEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  }

  // Leaves the setting alone once a tech has pinned or unpinned anything themselves.
  function seedPinnedTabs() {
    if (!CONFIG.pinOldTabs) return;
    try {
      if (localStorage.getItem(PINNED_TABS_KEY) === null) {
        localStorage.setItem(PINNED_TABS_KEY, JSON.stringify(OLD_TAB_BAR));
      }
    } catch (e) { /* storage blocked */ }
  }

  function applyRootClasses() {
    const root = document.documentElement;
    if (!root) return;
    root.classList.toggle(ROOT_CLASS, enabled);
    root.classList.toggle('cbs-hide-budget', enabled && CONFIG.hideBudgetInHoursColumn);
    root.classList.toggle('cbs-hide-note-search', enabled && CONFIG.hideNoteSearchAndChips);
    root.classList.toggle('cbs-hide-dividers', enabled && CONFIG.hideNoteDayDividers);
    root.classList.toggle('cbs-hide-counts', enabled && CONFIG.hideQuickViewCounts);
    root.classList.toggle('cbs-type-group', enabled && CONFIG.addTypeButtonGroup);
    root.classList.toggle('cbs-hide-team', enabled && !CONFIG.showTeamField);
  }

  function ensureStyle() {
    if (styleEl && styleEl.isConnected) return;
    const parent = document.head || document.documentElement;
    if (!parent) return;
    styleEl = styleEl || document.createElement('style');
    styleEl.id = 'cbs-mtx-classic-style';
    styleEl.textContent = CSS;
    parent.appendChild(styleEl);
  }

  // ---- Ticket summary: Status / Priority / Board back into the properties grid ----
  function placeHeaderPills() {
    document.querySelectorAll('.summary-modal').forEach((modal) => {
      const headerRow = modal.querySelector('.summary-fields-row');
      const props = modal.querySelector('aside.summary-panel .props-panel');
      const pills = (headerRow && headerRow.querySelector(':scope > app-ticket-summary-header-pills')) || movedPills.get(modal);
      if (!pills) return;
      movedPills.set(modal, pills);
      if (enabled && props) {
        if (pills.parentElement !== props) props.prepend(pills);
      } else if (headerRow && pills.parentElement !== headerRow) {
        // Switched off, or the side panel is gone (narrow window): put them back in the header.
        headerRow.prepend(pills);
      }
    });
  }

  // ---- Ticket summary: fit the notes under the restored properties ------------------
  function sizeNotesArea() {
    document.querySelectorAll('.summary-body.panel-mode').forEach((body) => {
      if (!enabled) { body.style.removeProperty('--cbs-tab-h'); return; }
      const overflow = body.querySelector('.mat-mdc-tab-body-active .tab-overflow') || body.querySelector('.tab-overflow');
      if (!overflow) return;
      const top = overflow.getBoundingClientRect().top;
      const height = Math.max(220, Math.floor(window.innerHeight - top - 40));
      const value = height + 'px';
      if (body.style.getPropertyValue('--cbs-tab-h') !== value) body.style.setProperty('--cbs-tab-h', value);
    });
  }

  // ---- Ticket summary: "Age:" and "Modified:" as before ------------------------------
  function labelAgeBar() {
    document.querySelectorAll('.summary-modal .summary-meta > span').forEach((span) => {
      const text = span.firstChild;
      if (!text || text.nodeType !== Node.TEXT_NODE) return;
      const label = text.data.trim().replace(/:$/, '');
      if (label !== 'Age' && label !== 'Modified') return;
      const wanted = enabled ? label + ': ' : label + ' ';
      if (text.data !== wanted) text.data = wanted;
    });
  }

  // ---- Ticket summary: red Delete Ticket button --------------------------------------
  function placeDeleteButtons() {
    document.querySelectorAll('.summary-modal').forEach((modal) => {
      const actions = modal.querySelector(':scope > .summary-actions');
      if (!actions) return;
      const existing = actions.querySelector(':scope > .cbs-delete');
      const want = enabled && CONFIG.addDeleteButton;
      if (!want) { if (existing) existing.remove(); return; }
      if (existing) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-sm cbs-delete d-none d-sm-inline-flex';
      button.append(makeEl('i', 'fa fa-trash'), makeEl('span', '', 'Delete Ticket'));
      button.title = 'Delete Ticket (opens Nilear’s own confirmation)';
      button.addEventListener('click', () => clickMenuItem(modal, /delete ticket/i));
      actions.appendChild(button);
    });
  }

  // Opens the ticket's "..." menu and clicks the matching item, so Nilear's own
  // confirmation and permission checks still apply.
  function clickMenuItem(modal, pattern) {
    const trigger = modal.querySelector('.summary-controls .fa-ellipsis');
    if (!trigger) return;
    (trigger.closest('button') || trigger).click();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const items = document.querySelectorAll('.cdk-overlay-container .mat-mdc-menu-panel .mat-mdc-menu-item');
      const item = Array.from(items).find((el) => pattern.test(el.textContent || ''));
      if (item) {
        clearInterval(timer);
        item.click();
      } else if (tries > 20) {
        clearInterval(timer);
        const backdrop = document.querySelector('.cdk-overlay-backdrop');
        if (backdrop) backdrop.click();
      }
    }, 50);
  }

  // ---- Tickets toolbar: Type as a button group --------------------------------------
  function placeTypeGroup() {
    document.querySelectorAll('app-issues-toolbar').forEach((toolbar) => {
      const toggle = Array.from(toolbar.querySelectorAll('.dropdown > .dropdown-toggle'))
        .find((el) => el.querySelector('.opacity-75') && /type/i.test(el.querySelector('.opacity-75').textContent));
      const holder = toggle && toggle.closest('.dropdown');
      let group = toolbar.querySelector('.cbs-type-group-buttons');
      const want = enabled && CONFIG.addTypeButtonGroup && holder;
      if (!want) { if (group) group.remove(); return; }
      const items = Array.from(holder.querySelectorAll('.dropdown-item'));
      if (!items.length) return;
      const names = items.map((el) => el.textContent.trim());
      if (!group || group.dataset.names !== names.join('|')) {
        if (group) group.remove();
        group = document.createElement('div');
        group.className = 'btn-group btn-group-sm cbs-type-group-buttons';
        group.dataset.names = names.join('|');
        const label = document.createElement('button');
        label.type = 'button';
        label.className = 'btn btn-dark';
        label.disabled = true;
        label.append(makeEl('i', 'fa fa-filter'), makeEl('span', 'ps-1', 'Type:'));
        group.appendChild(label);
        names.forEach((name) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'btn btn-outline-secondary';
          button.textContent = name;
          button.dataset.type = name;
          button.addEventListener('click', () => {
            const target = Array.from(holder.querySelectorAll('.dropdown-item')).find((el) => el.textContent.trim() === name);
            if (target) target.click();
            schedule();
          });
          group.appendChild(button);
        });
        holder.parentElement.insertBefore(group, holder);
      }
      const active = items.find((el) => el.classList.contains('active'));
      const activeName = active ? active.textContent.trim() : '';
      group.querySelectorAll('button[data-type]').forEach((button) => {
        const on = button.dataset.type === activeName;
        button.classList.toggle('btn-primary', on);
        button.classList.toggle('btn-outline-secondary', !on);
      });
    });
  }

  // ---- Tickets list: Company, Contact and Date as their own columns -----------------
  // 5.2 hid these columns and folded them into the Summary and Assigned cells. Ticking them
  // in Nilear's Columns menu brings them back and stops the folding. The menu is hidden
  // while this runs; closing it is what makes Nilear save the choice.
  let columnsBusy = false;

  function ensureOldColumns() {
    if (!enabled || !CONFIG.showOldColumns || columnsBusy) return;
    try { if (localStorage.getItem(COLUMNS_DONE_KEY)) return; } catch (e) { return; }
    const toggle = document.querySelector('app-issues-columns-menu .columns-toggle');
    if (!toggle || !document.querySelector('app-issues-table tr.mat-mdc-row')) return;

    columnsBusy = true;
    document.documentElement.classList.add('cbs-columns-auto');
    toggle.click();
    waitFor(() => document.querySelector('.columns-menu app-edit-columns tbody tr'), 3000, (found) => {
      if (found) {
        document.querySelectorAll('.columns-menu app-edit-columns tbody tr').forEach((row) => {
          const name = row.cells[1] ? row.cells[1].textContent.trim() : '';
          const box = row.cells[2] ? row.cells[2].querySelector('i') : null;
          if (OLD_COLUMNS.includes(name) && box && !/check/.test(box.className)) box.click();
        });
        try { localStorage.setItem(COLUMNS_DONE_KEY, new Date().toISOString()); } catch (e) { /* storage blocked */ }
      }
      if (document.querySelector('.columns-menu')) toggle.click();
      setTimeout(() => {
        document.documentElement.classList.remove('cbs-columns-auto');
        columnsBusy = false;
      }, 400);
    });
  }

  function waitFor(test, timeoutMs, done) {
    const started = Date.now();
    const timer = setInterval(() => {
      const result = test();
      if (result || Date.now() - started > timeoutMs) {
        clearInterval(timer);
        done(result);
      }
    }, 50);
  }

  // ---- Page zoom -------------------------------------------------------------------
  // Old MTX text was about 87.5% of 5.2's. Real browser zoom keeps Nilear's menus and
  // pop-ups lined up, which a CSS-only shrink would not. The add-on's background script
  // applies it (Firefox remembers it for the site) and only when the tech hasn't picked
  // their own zoom. Does nothing when running as a Tampermonkey script.
  function requestZoom() {
    const api = typeof browser !== 'undefined' ? browser : null;
    if (!api || !api.runtime || !api.runtime.sendMessage || !CONFIG.pageZoom || CONFIG.pageZoom === 1) return;
    api.runtime.sendMessage({ type: 'cbs-zoom', zoom: CONFIG.pageZoom, on: enabled }).catch(() => {});
  }

  // ---- Main pass ------------------------------------------------------------------
  function run() {
    scheduled = false;
    applyRootClasses();
    if (enabled) ensureStyle();
    try { placeHeaderPills(); } catch (e) { console.warn('[MTX Classic] pills', e); }
    try { labelAgeBar(); } catch (e) { console.warn('[MTX Classic] age bar', e); }
    try { placeDeleteButtons(); } catch (e) { console.warn('[MTX Classic] delete', e); }
    try { placeTypeGroup(); } catch (e) { console.warn('[MTX Classic] type group', e); }
    try { sizeNotesArea(); } catch (e) { console.warn('[MTX Classic] sizing', e); }
    try { ensureOldColumns(); } catch (e) { console.warn('[MTX Classic] columns', e); }
  }

  // Batches DOM changes into one pass per frame. The timer covers background tabs,
  // where animation frames are paused.
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { if (scheduled) run(); });
    setTimeout(() => { if (scheduled) run(); }, 250);
  }

  function toggle() {
    enabled = !enabled;
    saveEnabled(enabled);
    requestZoom();
    run();
  }

  // ---- Start ------------------------------------------------------------------------
  if (enabled) seedPinnedTabs();
  if (enabled) requestZoom();
  applyRootClasses();
  if (enabled) ensureStyle();

  const observer = new MutationObserver(schedule);
  const start = () => {
    observer.observe(document.documentElement, { childList: true, subtree: true });
    // Re-apply our root classes if the page ever rewrites <html class="...">.
    new MutationObserver(schedule).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    schedule();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.addEventListener('resize', schedule);
  window.addEventListener('keydown', (event) => {
    if (event.altKey && event.shiftKey && !event.ctrlKey && (event.key === 'C' || event.key === 'c')) {
      event.preventDefault();
      toggle();
    }
  }, true);

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('Toggle MTX Classic Look (Alt+Shift+C)', toggle);
  }
})();
