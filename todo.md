# NEXUS Functional Frontend Checklist

- [x] Audit all visible controls and define a meaningful client-side result for each action.
- [x] Add functional navigation across Mission, Findings, Evidence, Agents, Tools, Terminal, Reports, and Settings workspaces.
- [x] Implement mission replay progression, pause, step, stage focus, and approval-gate flows.
- [x] Implement finding selection, evidence inspection, filtering, and validation-state interactions.
- [x] Implement agent and tool detail interactions, terminal log controls, report review, and settings changes.
- [x] Validate the interface with type checks, production build, interaction testing, responsive screenshots, and a final checkpoint.

## Enhancement Pass — Interaction, Search, Export, and Reuse

- [x] Define the reusable-skill format and write the NEXUS frontend workflow skill.
- [x] Add restrained transition choreography and meaningful workspace-change status messages.
- [x] Add search and filtering controls for Findings and Evidence records.
- [x] Add direct browser-side PDF export for the generated report record.
- [x] Validate the enhanced interactions, build the frontend, and save an updated checkpoint.

## Enhancement Pass — Persistence, Data, and Keyboard Control

- [x] Persist NEXUS settings and register filters locally between browser sessions.
- [x] Add documented keyboard shortcuts for mission replay and workspace navigation.
- [x] Upgrade the project for backend and database support, then store and retrieve report records.
- [x] Connect Reports workspace state to the persisted report record while retaining direct local exports.
- [x] Validate persistence, keyboard behavior, report records, type checks, build, and checkpoint delivery.

## Enhancement Pass — Report History and Ownership

- [x] Define report-history and ownership behaviors that retain scope and evidence provenance.
- [x] Add authenticated backend queries for report history and the current report owner.
- [x] Add report version history, record selection, and comparison states to the Reports workspace.
- [x] Add visible authenticated session status and report owner controls to the NEXUS interface.
- [x] Validate the report-history and ownership features with tests, build checks, browser verification, and a final checkpoint.
- [x] Add an explicit authenticated report-owner procedure tied to the active report record.
- [x] Extend browser validation to cover Reports ownership and history states, then save the final checkpoint.
- [x] Defer saved-version selection, comparison, and owner-detail verification until real authenticated report records are available; the user approved completion without synthetic report data.

## Enhancement Pass — Attack Surface Map

- [x] Define the upgraded topology entities, risk categories, and linked evidence states.
- [x] Add interactive asset search, category filters, risk filtering, and a richer topology canvas.
- [x] Add a detailed asset inspector with services, exposures, evidence provenance, and links to Findings and Evidence.
- [x] Validate the upgraded Attack Surface workspace with build checks, browser interaction testing, and a checkpoint.

## Enhancement Pass — Multi-Mission Portfolio

- [x] Define a portfolio ledger that communicates mission posture, authorization, risk, evidence, and owner context.
- [x] Add a portfolio workspace with mission search plus risk and status filters.
- [x] Add mission selection, detailed case context, and navigation into the active mission workspace.
- [x] Validate the multi-mission portfolio interactions, build, browser workflow, and checkpoint.

## Enhancement Pass — Data-Backed Mission Operations

- [x] Define the mission, mission-assignment, and approval-queue record model with archival state and owner boundaries.
- [x] Add schema migrations, database helpers, secured tRPC procedures, and backend tests for mission operations.
- [x] Replace the portfolio fixture ledger with authenticated data queries, creation controls, archival actions, and assignment controls.
- [x] Add role-aware approval-queue actions and UI states for operators and administrators.
- [x] Validate creation, archival, assignment, approval-queue, permissions, build, browser workflows, and checkpoint delivery.
- [x] Defer authenticated mission creation, archival, assignment, and approval-decision verification until the user creates their own mission; the user approved finalizing without synthetic mission records.

## Enhancement Pass — Mission Audit, Evidence, and Alerts

- [x] Define owner-scoped activity records, evidence attachment metadata, and approval-alert delivery boundaries.
- [x] Add schema migrations, database helpers, secured tRPC procedures, and tests for activity and evidence metadata.
- [x] Record mission operations in the activity ledger and create pending-approval notification records.
- [x] Add mission activity, attachment metadata, and approval-alert interfaces to the data-backed portfolio.
- [x] Validate audit, attachment, alert, permission, build, browser workflows, and checkpoint delivery.
- [x] Defer live attachment uploads and approval notification delivery checks until the user creates real mission records; no synthetic mission data will be inserted.
- [x] Defer real-record verification of activity rendering, evidence uploads, and approval-alert display until the user is ready; the user approved completion of all non-account-dependent work without synthetic mission data.
- [ ] Verify activity rendering, evidence uploads, and approval-alert display with a real authenticated mission record when the user is ready; no synthetic mission data will be inserted.

## Enhancement Pass — iPhone Web Experience

- [ ] Rework NEXUS navigation and workspace chrome for narrow iPhone viewports without changing the desktop forensic layout.
- [ ] Add touch-friendly mobile controls, readable timeline/workspace layouts, and mobile-safe drawers or overflow behavior.
- [ ] Make authenticated Portfolio, Mission runtime, audit, evidence, and approval workflows usable from iPhone.
- [ ] Validate responsive behavior at iPhone viewport sizes plus desktop regression, update tests, and save a mobile-ready checkpoint.
- [ ] Verify the remaining real-record governance workflows from the user's iPhone once an authenticated mission exists; do not create synthetic mission data.

## History

- [x] Previous completion-pass checkpoint preserved the desktop NEXUS workspace and supported Linux package; mobile redesign is the next requested scope.
- [x] Preserve functional Tools registry access on narrow and desktop layouts; the active snapshot does not contain the governed runtime component.

## Delivery Pass — GitHub Repository Export

- [x] Separate the stable NEXUS desktop/web project state from unfinished iPhone-responsive edits and temporary debug files.
- [x] Create a new private GitHub repository named `nexus` and upload the selected NEXUS project files.
- [x] Verify the remote repository contents and commit history, then share the GitHub link.
- [x] Defer the iPhone-responsive enhancement and its remaining mobile validation until a later request.

## Documentation Pass — NEXUS Project Details

- [x] Audit the active NEXUS source and stable repository state for factual product, architecture, technology, governance, and roadmap details.
- [x] Write and review a comprehensive `NEXUS_PROJECT_DETAILS.md` document suitable for a full project description.
- [x] Synchronize the approved details document to the private `Yashmko/nexus` GitHub repository and deliver the file.
