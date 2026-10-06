I need to audit and refactor the existing Codevyuh dashboard based on a requirement from my TL.

==================================================
TL REQUIREMENT
==================================================

My TL said that the current dashboard contains too much general/platform-wide data that is not required for the current task.

The dashboard should now focus specifically on these TWO events:

1. Madurai Tech Cup Demo (KLN School)
2. Mock Exam - Madurai Tech Cup

The goal is NOT to rebuild the application from scratch.

Instead:

- Keep the existing common/reusable dashboard infrastructure.
- Keep the existing visual style and UI design where appropriate.
- Keep reusable Chart.js components/configuration.
- Remove dashboard sections, KPIs, charts, filters and calculations that are completely unrelated to these two events.
- Replace the irrelevant platform-wide insights with meaningful event-specific insights.
- Use only data that actually exists in the PostgreSQL dump/database.
- Do not invent scores, marks, results or performance metrics.

Before modifying any code, perform a complete READ-ONLY AUDIT and generate documentation explaining what should be kept, replaced, removed and added.

==================================================
INPUTS
==================================================

1. PostgreSQL dump:

codevyuh_db_2026_09_26.dump

2. Existing dashboard repository:

dashboard-codevyuh

3. Existing application runs locally and already contains the dashboard UI and Chart.js-based visualizations.

The existing UI currently contains concepts such as:

- Top 3 Students
- Platform Overview
- Total Students
- Participation Rate
- Total Submissions
- Total Score
- Submission Intensity
- School filters
- School status filters
- Generic platform-wide charts/data

==================================================
PHASE 1 — REPOSITORY AUDIT
==================================================

Inspect the complete existing dashboard repository.

Analyze:

- HTML files
- CSS
- JavaScript
- Chart.js implementation
- API routes
- SQL queries
- Database access code
- Server code
- Configuration
- Authentication
- Filters
- Dashboard components
- Reusable cards
- Tables
- Existing charts
- Data transformation/calculation logic

Create a file:

AUDIT_01_EXISTING_DASHBOARD.md

Document:

1. Application architecture
2. Page structure
3. Main dashboard entry point
4. Existing UI sections
5. Existing KPI cards
6. Existing charts
7. Existing filters
8. Existing API endpoints
9. Existing SQL queries
10. Chart.js usage
11. Reusable components
12. Platform-wide/global data
13. Event-specific data
14. Dependencies
15. Potentially obsolete code

For every major dashboard section classify it as:

KEEP
REPLACE
REMOVE
MODIFY

and explain WHY.

==================================================
PHASE 2 — DATABASE/DUMP AUDIT
==================================================

Inspect the PostgreSQL dump using PostgreSQL tools.

First verify the dump:

pg_restore --list "codevyuh_db_2026_09_26.dump"

Restore it into a SAFE temporary/local database.

DO NOT modify the original dump.

Discover the complete schema.

Do not assume table names.

Inspect:

- tables
- columns
- primary keys
- foreign keys
- indexes
- views
- relevant functions
- relevant JSON/JSONB fields

Create:

AUDIT_02_DATABASE_SCHEMA.md

==================================================
PHASE 3 — FIND THE TWO EVENTS
==================================================

Search the database for these exact events:

1. Madurai Tech Cup Demo (KLN School)
2. Mock Exam - Madurai Tech Cup

Use exact matching first and case-insensitive matching as fallback.

Find:

- event ID
- event name
- slug
- status
- event type
- mode
- school/organization
- start date
- end date
- created date
- updated date
- registration token/link if appropriate
- event configuration
- tracks/categories
- participant count

Trace all foreign-key relationships.

Create:

AUDIT_03_EVENT_DATA.md

Clearly document the exact database records belonging to each event.

==================================================
PHASE 4 — PERFORMANCE DATA INVESTIGATION
==================================================

This is VERY IMPORTANT.

Determine whether these two events actually contain performance-related data.

Search for all relevant concepts/fields such as:

- score
- scores
- marks
- result
- results
- submission
- submissions
- attempt
- attempts
- answer
- correct
- incorrect
- unanswered
- percentage
- rank
- leaderboard
- completion
- accuracy
- timeTaken
- duration
- challengeScore
- qualification
- certificate
- performance
- assessment

Inspect relevant tables and relationships.

Specifically verify whether event-linked records exist in tables similar to:

- Submission
- SubmissionSnapshot
- OfficialResultSnapshot
- ChallengeStatus
- Qualification
- TrackCertificate
- Leaderboard/result tables
- Assessment/result tables
- Any other actual performance tables discovered in the schema

DO NOT assume the table names above exist.

For each performance-related table found, determine:

- Does it contain records?
- Can records be linked to the two events?
- What is the foreign key?
- What metrics are available?
- Are scores/marks real event-specific values?
- Can student-level performance be safely calculated?

Create:

AUDIT_04_PERFORMANCE_DATA.md

Include a table:

| Metric | KLN Event | Mock Exam | Source Table | Usable? |
|--------|-----------|-----------|-------------|---------|
| Participants | | | | |
| Scores | | | | |
| Marks | | | | |
| Results | | | | |
| Submissions | | | | |
| Accuracy | | | | |
| Rank | | | | |
| Completion | | | | |
| Time Taken | | | | |

IMPORTANT:

If performance data does NOT exist, explicitly say:

"Performance visualization cannot currently be generated from this dump."

Do NOT calculate fake scores or infer performance from registration data.

==================================================
PHASE 5 — EVENT DATASET DESIGN
==================================================

Identify exactly what data is available for meaningful visualization.

For each event identify:

A. Event metadata
B. Participant data
C. Grade/class distribution
D. Registration timeline
E. School/organization information
F. Tracks/categories
G. Event status
H. Any actual result/performance data
I. Other useful measurable fields

Create:

AUDIT_05_EVENT_ANALYTICS_DATASET.md

Define the recommended dataset for the frontend.

Example:

event_overview
event_participants
grade_distribution
registration_trend
event_tracks
performance_results

Only include datasets that actually exist.

==================================================
PHASE 6 — VISUALIZATION PLAN
==================================================

Analyze the existing dashboard's current visual style.

Do NOT introduce a completely different design.

Use the existing:

- cards
- typography
- spacing
- borders
- shadows
- colors
- responsive layout
- Chart.js configuration
- existing interaction patterns

Design a new Event Insights dashboard.

Recommended structure:

----------------------------------
EVENT INSIGHTS
----------------------------------

Event selector:

[ Madurai Tech Cup Demo (KLN School) ▼ ]

or

[ Mock Exam - Madurai Tech Cup ▼ ]

----------------------------------
EVENT OVERVIEW
----------------------------------

KPI Cards:

- Total Participants
- Event Status
- Grade/Class Coverage
- Number of Tracks/Categories

Only display metrics that actually exist.

----------------------------------
PARTICIPATION INSIGHTS
----------------------------------

Chart 1:
Participants by Grade/Class

Chart.js:
Bar chart

Chart 2:
Grade Distribution

Chart.js:
Doughnut chart

Chart 3:
Registration Trend

Chart.js:
Line chart

Only use this if timestamps exist.

----------------------------------
EVENT STRUCTURE
----------------------------------

Track/category distribution.

Chart.js:
Bar or Doughnut chart.

Only show this when applicable to the selected event.

----------------------------------
PERFORMANCE
----------------------------------

ONLY create this section if actual event-linked result/submission data exists.

Possible charts:

- Score distribution
- Average score
- Highest/lowest score
- Pass/fail
- Accuracy
- Correct vs incorrect
- Completion
- Rank/leaderboard
- Time taken

If performance data does not exist:

Do NOT show empty/fake charts.

Instead show a clear "Performance data unavailable for this event" state or omit the section.

----------------------------------
EVENT COMPARISON
----------------------------------

Create a comparison section using ONLY metrics that are available for BOTH events.

For example:

Participants
Grade coverage
Tracks/categories
Registration activity

Do not compare incompatible metrics.

Create:

AUDIT_06_VISUALIZATION_PLAN.md

For every chart specify:

- Chart name
- Chart.js chart type
- Data source
- SQL/API endpoint
- X-axis
- Y-axis
- Dataset
- Tooltip values
- Why the chart is useful
- Conditions under which the chart should be hidden

==================================================
PHASE 7 — CURRENT DASHBOARD REFACTOR PLAN
==================================================

Create:

AUDIT_07_REFACTOR_PLAN.md

Create a table:

| Current Feature | Action | Reason |
|----------------|--------|--------|
| Top 3 Students | REPLACE/REMOVE | Generic/global |
| Total Students | REPLACE | Should become event participants |
| Participation Rate | MODIFY | Calculate for selected event only if valid |
| Total Submissions | REPLACE | Only show event submissions if they exist |
| Total Score | REMOVE/REPLACE | Only use actual event results |
| Submission Intensity | REMOVE/REPLACE | Not useful without event submissions |
| School filter | REMOVE/MODIFY | Events are already fixed |
| School status filter | REMOVE | Not required |
| Existing Chart.js | KEEP | Reuse |
| Header/navigation | KEEP | Common UI |
| Authentication | KEEP | Required infrastructure |
| Theme | KEEP | Existing style |
| Responsive layout | KEEP | Existing functionality |

Do not blindly use this table.

Verify each item against the actual repository.

==================================================
PHASE 8 — PROPOSED APPLICATION ARCHITECTURE
==================================================

Design a clean structure such as:

Event Insights
│
├── Event Selector
│
├── Event Overview
│   ├── Participants
│   ├── Status
│   ├── Grades
│   └── Tracks
│
├── Participation Analytics
│   ├── Grade Distribution
│   ├── Registration Trend
│   └── Participant Breakdown
│
├── Event Structure
│   └── Tracks/Categories
│
├── Performance Analytics
│   └── Only if actual data exists
│
└── Event Comparison
    └── Common metrics

Reuse existing dashboard components wherever possible.

==================================================
PHASE 9 — SQL/API PLAN
==================================================

Create:

AUDIT_08_SQL_API_PLAN.md

Define the required queries/endpoints.

Examples:

GET /api/events
GET /api/events/:id/overview
GET /api/events/:id/participants
GET /api/events/:id/grades
GET /api/events/:id/registration-trend
GET /api/events/:id/tracks
GET /api/events/:id/performance

Do not create endpoints for data that doesn't exist.

For each endpoint provide:

- SQL query
- Tables used
- Fields returned
- Expected output structure
- Whether it applies to both events

==================================================
PHASE 10 — DATA VALIDATION
==================================================

Before proposing implementation, verify:

KLN:

Madurai Tech Cup Demo (KLN School)

Expected participant count should be checked against the actual database.

Mock Exam:

Mock Exam - Madurai Tech Cup

Expected participant count should be checked against the actual database.

Also verify:

- duplicate participants
- missing user records
- invalid foreign keys
- NULL values
- inconsistent grades
- inconsistent event relationships
- records that appear related but cannot be reliably linked

Document all findings.

==================================================
PHASE 11 — SAFE IMPLEMENTATION PLAN
==================================================

Do NOT immediately delete existing code.

First create a Git branch:

event-insights-refactor

Then:

1. Preserve existing application.
2. Add event-specific SQL/API layer.
3. Build the new Event Insights UI.
4. Reuse existing cards and Chart.js styling.
5. Connect the new UI to real database data.
6. Test both events.
7. Compare old and new dashboard.
8. Only then remove obsolete platform-wide UI/code.
9. Verify no unrelated pages break.
10. Verify authentication/navigation still works.

Do not modify unrelated pages.

==================================================
FINAL AUDIT DOCUMENT
==================================================

Finally create:

EVENT_INSIGHTS_AUDIT_REPORT.md

This must be understandable to a technical lead.

Structure:

# Codevyuh Event Insights Audit

## 1. TL Requirement

Explain clearly what the TL requested.

## 2. Current Dashboard Analysis

What the existing dashboard currently shows.

## 3. Problems / Unnecessary Data

Identify the platform-wide content that is not relevant to the two events.

## 4. Database Findings

Explain what data actually exists for:

- Madurai Tech Cup Demo (KLN School)
- Mock Exam - Madurai Tech Cup

## 5. Performance Data Findings

Clearly state whether:

- scores
- marks
- results
- submissions
- accuracy
- ranking
- completion
- time taken

actually exist and are linked to these events.

## 6. Recommended Event Insights

List the exact KPIs and visualizations that can be safely created.

## 7. Chart.js Visualization Plan

Explain every proposed chart and its data source.

## 8. Current UI → New UI Mapping

Example:

Current:
Platform Overview

New:
Event Overview

Current:
Total Students

New:
Event Participants

Current:
Total Score

New:
Event Score
ONLY IF REAL RESULT DATA EXISTS

## 9. What to KEEP

List reusable application components.

## 10. What to REMOVE

List completely unrelated dashboard components.

## 11. What to REPLACE

List components that should become event-specific.

## 12. SQL/API Changes

Document required queries and endpoints.

## 13. Implementation Plan

Give a step-by-step safe development plan.

## 14. Risks / Limitations

Especially missing performance/result data.

## 15. Final Recommendation

Provide a concise technical summary suitable for sending directly to the TL.

IMPORTANT:

This phase is an AUDIT ONLY.

Do NOT modify files yet.

Do NOT delete code.

Do NOT change database records.

Do NOT invent missing data.

Finish the audit documents first so I can review them before implementation.