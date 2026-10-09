# DEVELOPMENT TASK: Separate KLN PRELIMS and Dolphin PRELIMS Dashboards with Independent Logins

## 1. Project Overview

**Project:** `dashboard-codevyuh`  
**Application:** Codevyuh Event Insights Dashboard  
**Local URL:** `http://localhost:3001`  
**Login endpoint:** `http://localhost:3001/login`  
**Backend:** Existing Node.js / Express application  
**Database:** Existing PostgreSQL database, configured locally on `127.0.0.1:54333`, database name `codevyuh_db`.

### Primary objective

Separate the two existing events into independent, securely authenticated dashboard environments, each displaying only its own event's data.

The application currently includes multiple dashboard modules. **All existing dashboard modules, their URLs, styling, layouts, charts, functionality, navigation, and responsive behavior must be preserved.**

This is a focused enhancement to the existing application, not a complete redesign or rewrite.

Before implementation, inspect the existing project, routes, authentication system, database schema, and dashboard dependencies. Make the smallest safe set of changes that meets the requirements.

---

## 2. Correct Event Mapping and Renaming

There are two existing events. Their participant data must remain correctly associated with their original event IDs.

### Event A — KLN PRELIMS

- **New display name:** `KLN PRELIMS`
- Original event name: `Madurai Tech Cup Demo (KLN School)`
- Expected participants: 107
- Event ID: `0542016a-b443-421e-9ae0-a4787697b945`
- Username: `admin@kln`
- Password: `klnprelims@2026`

### Event B — Dolphin PRELIMS

- **New display name:** `Dolphin PRELIMS`
- Original event name: `Mock Exam - Madurai Tech Cup`
- Expected participants: 555
- Event ID: `e4bd56c6-924d-49bb-9c3a-e2c74eab9f89`
- Username: `admin@dolphin`
- Password: `dolphinprelims@2026`

### Data preservation rules

1. Preserve both existing event IDs.
2. Preserve the existing participants and their event relationships.
3. Update user-facing event names consistently throughout the application.
4. Avoid unnecessary database schema changes, duplicate event creation, participant reassignment, or record deletion.
5. If database name changes are required, prefer updating the relevant display-name mapping rather than performing destructive migrations.
6. Verify the actual participant counts before declaring them correct. Investigate discrepancies without fabricating records or silently modifying the database.

The original event names may remain in historical records where necessary, but the dashboard interface should consistently display `KLN PRELIMS` and `Dolphin PRELIMS`.

---

## 3. Login Page: Two Separate Event Login Cards

Keep the existing endpoint unchanged:

`http://localhost:3001/login`

Create two clear, professional login cards on the existing login page.

### Card A — KLN PRELIMS

Include:

- Appropriate academic or examination icon.
- Title: `KLN PRELIMS`
- Subtitle: `KLN Vidyalaya CBSE Senior Secondary School`
- Description: `Access the KLN PRELIMS dashboard and event insights.`
- Username field.
- Password field with show/hide toggle.
- Button: `Login to KLN PRELIMS`.

### Card B — Dolphin PRELIMS

Include:

- Appropriate academic or examination icon.
- Title: `Dolphin PRELIMS`
- Description: `Access the Dolphin PRELIMS dashboard and event insights.`
- Username field.
- Password field with show/hide toggle.
- Button: `Login to Dolphin PRELIMS`.

### Login UI requirements

- Display the cards side by side on desktop.
- Stack the cards vertically on mobile.
- Maintain consistent spacing, typography, borders, card sizing, and visual hierarchy.
- Include input validation, loading indicators, accessible labels, and appropriate error messages.
- Prevent multiple submissions while a login request is processing.
- Provide clear feedback for invalid credentials and unavailable services.
- Do not prefill or visibly display administrator credentials.
- Do not allow either card to bypass server-side authentication.
- Preserve the existing Tarcin branding and the application's professional appearance.

### Required design style

Use the existing dashboard design and reference screenshot:

- Dark navy and charcoal backgrounds.
- Blue and cyan accents.
- Existing typography and icon styles.
- Restrained gradients and glow effects.
- Rounded cards and subtle borders.
- Clean spacing and a premium, modern dashboard appearance.
- Responsive layouts across desktop, tablet, and mobile.

Do not introduce an unrelated design system, unnecessary dependencies, or excessive animations.

---

## 4. Preserve All Four Existing Dashboard Modules and Routes

**This requirement is critical: Do not remove, rename, break, or redesign the following existing dashboard routes. They must remain available at their current URLs and retain their current appearance, functionality, layout, and visual style.**

<escape>→ Admin Overview: `http://localhost:3001/admin-overview`

→ School Dashboard: `http://localhost:3001/zone-dashboard`

→ Parent View: `http://localhost:3001/parent-view`

→ User Access: `http://localhost:3001/user-management`</escape>

### A. Admin Overview

Preserve `/admin-overview`.

Keep the existing overview layout, KPI cards, navigation, charts, summaries, and other currently supported functions.

After login, show the relevant event's data only. KLN administrators must see KLN PRELIMS information, while Dolphin administrators must see Dolphin PRELIMS information.

### B. School Dashboard

Preserve `/zone-dashboard`.

Retain the existing school dashboard's design, components, charts, filters, and currently supported features.

Ensure the dashboard displays the appropriate event's school, grade, section, and participant data, according to the existing schema and authenticated user's permissions.

Do not remove existing school dashboard features merely because two separate event logins are being introduced.

### C. Parent View

Preserve `/parent-view`.

Keep the current interface and supported parent-view functionality unchanged wherever possible.

Ensure that parent or student information, where available, is restricted to the correct event and the existing authorization rules. An event administrator must not gain access to unrelated event records by changing a URL, identifier, or request parameter.

Do not invent parent records or student-performance data where none exists.

### D. User Access

Preserve `/user-management`.

Retain the existing user-management page, layout, controls, and supported functionality.

Enforce event-level permissions securely. An event administrator must only be able to view or manage users that they are authorized to manage for their event.

An administrator for KLN PRELIMS must not be able to manage Dolphin PRELIMS users or obtain their information. The reverse restriction must also apply.

If the existing application has a platform super-administrator role with broader privileges, preserve that role's existing authorized functionality. Do not grant global super-administrator privileges to either event-specific account.

### Rules applicable to all four routes

1. Keep all four URLs unchanged.
2. Do not replace the existing pages with new, simplified pages.
3. Preserve their current styling, components, behavior, and responsive layouts.
4. Reuse the existing frontend components and backend routes where practical.
5. Scope the displayed data to the currently authenticated user's permitted event.
6. Enforce authorization in backend middleware and API handlers, not only through frontend filters.
7. Keep shared application features working wherever they are currently supported.
8. Ensure direct URL navigation, browser refresh, and in-app navigation behave correctly.
9. Unauthenticated requests to protected content must be redirected to login or rejected with an appropriate API response.
10. Do not allow cross-event access through edited URLs, query parameters, request bodies, or client-side state.

If some functionality is inherently global, preserve it only for roles that are already authorized to access it. Do not silently change existing permission rules.

---

## 5. Secure Event-Specific Authentication

Inspect the existing authentication routes, middleware, session handling, user-management implementation, and database schema before making changes.

Reuse the current authentication infrastructure when it can safely support event-scoped accounts.

Configure these accounts with the following event permissions:

| Account | Username | Authorized event |
|---|---|---|
| KLN administrator | `admin@kln` | KLN PRELIMS only |
| Dolphin administrator | `admin@dolphin` | Dolphin PRELIMS only |

### Security requirements

1. Validate credentials on the server.
2. Store passwords securely using the existing approved password-hashing mechanism or an appropriate secure hash such as bcrypt.
3. Never embed plaintext passwords in frontend HTML, JavaScript bundles, public configuration, API responses, or committed source code.
4. Use server-side session or equivalent trusted authentication context to determine the authenticated account's permitted event.
5. Do not trust an event ID provided by the browser as proof of authorization.
6. Prevent unauthorized access to the other event's participant data, metrics, charts, APIs, reports, and protected routes.
7. Preserve suitable session expiration and secure logout behavior.
8. Use HTTP-only cookies and appropriate SameSite settings where cookie-based sessions are used; enable Secure cookies in HTTPS production environments.
9. Add login rate limiting and generic authentication errors that do not disclose whether a username exists.
10. Validate all user-controlled inputs and use parameterized SQL queries.
11. Do not log passwords, session secrets, or sensitive authentication tokens.
12. Keep environment-specific secrets out of Git.
13. Ensure event administrators cannot escalate their privileges using the User Access page or API.
14. Revoke the authenticated session correctly during logout.

### Environment configuration

Use the existing configuration approach where appropriate. If new environment variables or administrator password hashes are required, document their names and setup process.

Keep actual secrets out of committed `.env` files and source code. Update `.gitignore` if required, but do not assume that ignoring a file removes it from Git history.

Do not create conflicting authentication implementations or weaken existing security to make the new login flow work.

---

## 6. Event-Specific Dashboard Access and Navigation

After successful authentication, redirect each account to the correct event-specific dashboard environment.

Suggested landing routes, subject to the existing architecture:

- KLN PRELIMS: `/kln/dashboard`
- Dolphin PRELIMS: `/dolphin/dashboard`

Reuse the existing dashboard architecture wherever practical. Do not duplicate the full frontend and backend unnecessarily.

### KLN account

- Default event: `0542016a-b443-421e-9ae0-a4787697b945`
- Expected participant count: 107
- Must display only KLN PRELIMS data.

### Dolphin account

- Default event: `e4bd56c6-924d-49bb-9c3a-e2c74eab9f89`
- Expected participant count: 555
- Must display only Dolphin PRELIMS data.

Both authenticated event administrators should retain access to the four existing modules according to their existing role permissions, with each module scoped to their respective event.

Update navigation carefully so that the currently logged-in administrator can move between the four existing modules without losing event authorization.

Do not allow event administrators to switch between events unless an existing, explicitly authorized platform super-administrator workflow permits it.

The login page should remain accessible at `/login`, and logout should return the user to `/login` after invalidating the session.

---

## 7. Preserve Accurate Dashboard Data

Preserve the existing Event Insights dashboard style and currently supported functionality, including:

- Registered participant totals.
- Grade and section coverage.
- Cohort breakdowns and distribution charts.
- Event status and allocated duration, where supported by the database.
- Admin Overview functionality.
- School Dashboard functionality.
- Parent View functionality.
- User Access functionality.
- Existing navigation, responsive design, and shared UI components.

Use the existing PostgreSQL records as the source of truth.

Verify all event filters, joins, API responses, totals, and chart calculations against the correct event IDs.

Do not fabricate marks, rankings, scores, completion rates, accuracy percentages, or other performance indicators that lack underlying source data. Provide sensible empty states for unavailable metrics.

Do not hardcode participant numbers merely to make the dashboard look correct. Use verified database queries.

Avoid destructive migrations, accidental record deletion, duplicate events, and unnecessary changes to the database schema.

---

## 8. Audit and Repair Database Connectivity and Startup

The application has previously experienced PostgreSQL connection failures, including connection-refused errors, `ECONNRESET`, unexpected connection termination, and repeated database-supervisor startup attempts.

Inspect the existing database and startup implementation, including:

- `db.js`
- `db-supervisor.js`
- `start_postgres.bat`
- `server.js`
- `routes/event-insights.js`
- Existing authentication and authorization routes.
- Relevant dashboard and API JavaScript files.
- `.env`
- `package.json`
- `nodemon.json`
- Other relevant database and session configuration files.

### Required checks

1. Confirm the configured PostgreSQL host, port, database, and user.
2. Verify that the intended PostgreSQL instance is reachable.
3. Inspect the real database data directory only when required; do not assume the project folder is the live database directory.
4. Ensure PostgreSQL is not repeatedly started for individual API requests.
5. Prevent duplicate database-supervisor instances and infinite retry loops.
6. Implement bounded retry logic, suitable connection timeouts, connection-pool handling, and proper resource cleanup.
7. Return appropriate HTTP status codes when a dependency is unavailable.
8. Ensure frontend loading indicators terminate correctly on failure.
9. Show a useful database-unavailable message rather than fabricated data or indefinite loading.
10. Verify the application can recover appropriately after a temporary database interruption.
11. Preserve the current development configuration unless a demonstrated technical issue requires a change.
12. Do not change database ports, credentials, or storage locations unnecessarily.

Do not mask real database failures with mock responses or hardcoded KPI values.

---

## 9. Build and Security Audit

After implementation, conduct a genuine audit, fix the issues found, and report the results.

### A. Build and code-quality checks

- Verify dependencies and the existing package-manager lockfile.
- Run the project's available build, lint, and test scripts.
- Check for JavaScript syntax errors and broken imports.
- Verify frontend and backend route wiring.
- Confirm required assets load correctly.
- Test the login page and all four preserved dashboard routes.
- Check browser-console errors and backend terminal errors.
- Verify responsive behavior on desktop and mobile.
- Confirm no unrelated functionality has been broken.

Only report a build, lint, or test as successful if the check was actually executed and passed.

If the project does not have a particular script or test framework, report that fact and run the closest suitable available checks.

### B. Authorization testing

Test all of the following:

- Correct KLN credentials authenticate successfully.
- Correct Dolphin credentials authenticate successfully.
- KLN cannot retrieve Dolphin event data.
- Dolphin cannot retrieve KLN event data.
- Invalid passwords are rejected.
- Unknown usernames are rejected without account enumeration.
- Protected routes and APIs reject unauthenticated requests.
- Editing an event ID in a URL, query string, or API payload does not bypass event authorization.
- The four dashboard routes retain their expected behavior for authorized users.
- User Access cannot be used to create unauthorized cross-event access.
- Logout invalidates the session.
- Session expiration and rate limiting behave as configured.
- Inputs cannot manipulate SQL queries.

### C. Dependency and vulnerability checks

- Run the appropriate dependency vulnerability audit for the existing package manager.
- Inspect known vulnerabilities in authentication and session-related dependencies.
- Review session security, request validation, error handling, security headers, and CORS configuration.
- Check for accidental credential exposure and unsafe debug settings.
- Check whether `.env`, database backups, or other sensitive artifacts are tracked by Git.
- Fix confirmed exploitable issues and relevant high- or critical-severity vulnerabilities within the change's scope.
- Review dependency upgrades for compatibility before applying them.
- Avoid destructive automatic dependency updates.

If credentials were previously committed, explain the potential exposure and recommend rotating them. Removing a file from the latest commit does not erase it from Git history.

Report any remaining risks or issues that cannot safely be resolved automatically.

### D. Database audit

- Confirm the intended PostgreSQL instance and database are being used.
- Verify both event IDs exist.
- Verify participant-to-event mapping.
- Compare actual participant totals against the expected 107 and 555.
- Investigate mismatches instead of altering records to force a match.
- Verify every relevant API applies event authorization.
- Check for missing-data cases and correct error handling.
- Confirm the two dashboards cannot accidentally combine their event data.
- Verify that temporary database failures do not trigger repeated startup processes or permanent loading states.

---

## 10. End-to-End Verification

Use automated tests and browser testing where available.

Perform these workflows:

1. Open `http://localhost:3001/login`.
2. Confirm the two login cards appear with the correct event names and descriptions.
3. Log in as `admin@kln` using its configured password.
4. Verify the resulting dashboard displays only KLN PRELIMS data.
5. Open Admin Overview at `/admin-overview`.
6. Open School Dashboard at `/zone-dashboard`.
7. Open Parent View at `/parent-view`.
8. Open User Access at `/user-management`.
9. Verify the four routes retain their existing UI and work within the account's authorized event scope.
10. Log out and confirm the session is invalidated.
11. Log in as `admin@dolphin` using its configured password.
12. Repeat the same route checks and confirm only Dolphin PRELIMS data is visible.
13. Attempt direct access to the opposite event's protected APIs and data, and verify it is denied.
14. Test invalid credentials and database-unavailable behavior.
15. Refresh pages and verify that authentication and routing work as intended.
16. Test the layout on desktop, tablet, and mobile widths.
17. Inspect the browser console, server logs, database connectivity, and vulnerability-audit results.

Do not claim the tests were performed if execution was blocked by missing dependencies, unavailable services, or missing test tools.

---

## 11. Scope Restrictions

This is a focused event-separation task.

Do not:

- Redesign the entire application.
- Remove, rename, or break the four existing dashboard URLs.
- Change the existing dashboards' visual style unnecessarily.
- Remove current Admin Overview, School Dashboard, Parent View, or User Access functionality.
- Delete or regenerate existing event or participant data.
- Duplicate event records to simulate separate dashboards.
- Replace PostgreSQL with a different database.
- Introduce unnecessary frameworks or major dependencies.
- Expose passwords in frontend code, Git, API responses, or logs.
- Grant event administrators global super-administrator privileges.
- Hardcode statistics or return fake success responses to hide errors.
- Modify unrelated business logic without a demonstrated requirement.

Preserve maintainability, backward compatibility, the existing Tarcin branding, and the current dashboard design.

---

## 12. Final Deliverables and Completion Report

After implementation, provide a concise but complete report covering:

1. Files modified and the purpose of each important change.
2. Final login URL and event-specific landing routes.
3. Confirmation that all four existing dashboard URLs remain unchanged.
4. Confirmation that the original UI and functionality were preserved.
5. How the two administrator accounts are configured securely.
6. Actual participant counts verified against the database.
7. Database changes or migrations, if any.
8. Build, lint, test, and dependency-audit results.
9. Authorization tests performed and their results.
10. Vulnerabilities discovered, fixes applied, and any remaining risks.
11. Environment-variable requirements and local setup instructions.
12. Any manual actions required to complete the deployment.

Clearly distinguish **passed**, **failed**, **skipped**, and **blocked** checks.

### Final acceptance criteria

The task is complete only when both event accounts authenticate independently; KLN PRELIMS and Dolphin PRELIMS show only their respective authorized data; the four existing routes remain unchanged and functional; their current visual style is preserved; database startup and queries work reliably; and all performed build, security, and end-to-end checks are documented honestly.

**Execution order:** Audit the current implementation → plan the smallest safe changes → implement event-specific authentication and authorization → preserve all existing dashboard modules → repair confirmed database issues → run the build and security checks → test both complete login workflows → fix identified issues → deliver the final audit report.