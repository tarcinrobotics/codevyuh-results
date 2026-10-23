# PLAN MODE ONLY — Dolphin PRELIMS Advanced Analytics, Leaderboard & Dashboard Architecture

## Mandatory instruction: Plan first, do not build yet

I want to upgrade the **Dolphin PRELIMS dashboard** with meaningful student performance insights, a Top 10 leaderboard, a Top 3 podium on the homepage, and impressive charts based on verified data.

**Your current task is planning and analysis ONLY.**

Do not edit application files, implement components, modify database records, run migrations, install or upgrade packages, or begin building the dashboard. First inspect the existing project and produce a detailed, technically grounded implementation plan. Stop and wait for my explicit approval before making any changes.

## 1. Project Context

Project: `dashboard-codevyuh`  
Application: Codevyuh Event Insights Dashboard  
Development URL: `http://localhost:3001`  
Backend: Existing Node.js / Express application  
Database: Existing PostgreSQL database, configured locally on `127.0.0.1:54333`, database `codevyuh_db`.

Target event:
- Display name: `Dolphin PRELIMS`
- Original event name: `Mock Exam - Madurai Tech Cup`
- Event ID: `e4bd56c6-924d-49bb-9c3a-e2c74eab9f89`
- Enrolled students: 555
- Grades: 3 through 8

The existing application supports:
- Admin Overview: `/admin-overview`
- School Dashboard: `/zone-dashboard`
- Parent View: `/parent-view`
- User Access: `/user-management`

Preserve these URLs, their existing architecture, UI style, and functionality. The scope of the proposed changes is Dolphin PRELIMS analytics and its related event-specific views. Do not redesign the entire application or break KLN PRELIMS.

## 2. Use the Existing Analysis as Evidence

The project data was analyzed in the supplied workbook `madurai_tech_cup_results.xlsx` and report `Madurai_Tech_Cup_Results_Report.pdf`. Their results are summarized below.

### Verified cohort metrics

- Enrolled students: 555
- Students with at least one recorded activity row: 45, approximately 8.1%
- Students with no recorded activity: 510, approximately 91.9%
- Students who attempted at least one challenge: 35, approximately 6.3%
- Students with at least one locked challenge: 16
- Challenge-status rows: 105
- Total recorded attempts: 150
- Locked challenge records: 24
- Sum of stored student scores: 0
- Highest stored student score: 0
- Recorded first logins: 0

These activity figures describe records in the September 26, 2026 database dump. They do not prove that the students never participated outside that database snapshot.

### Critical leaderboard limitation

All 555 students currently have a stored score of zero. The supplied report also identifies no event-linked submissions, submission snapshots, official result snapshots, challenge-attempt records, or hint-usage records for this cohort.

Therefore, a genuine Top 10 ranking by exam score **cannot be produced from the currently established score data**.

Do not:
- Assign artificial scores.
- Rank students by attempts and label it a score leaderboard.
- Treat activity volume as exam performance.
- Infer pass/fail results from the number of attempts.
- Break ties arbitrarily and present the ordering as meaningful.
- Present all-zero scores as evidence that every student performed equally.

Investigate whether valid scores exist in another authoritative database table, existing API, result export, event-specific submission workflow, or a newer data source. Inspect the actual code and schema before concluding that scores are unavailable everywhere.

The latest submissions reported in the supplied audit predate the event dates. The report recommends confirming with the platform team where the actual exam submissions and scores are stored. Identify that dependency explicitly in the plan.

If no reliable source can be identified, propose the safest way to introduce the leaderboard after a valid data source is provided, and explain what remains blocked.

## 3. My Primary Feature Requirement: Top 3 + Top 10

### A. Homepage Top 3 leaderboard cards

I want three attractive student cards displayed prominently on the Dolphin PRELIMS homepage, following the existing dashboard's KPI-card visual language.

Propose a polished podium-style layout containing:
- Rank 1: Gold accent
- Rank 2: Silver accent
- Rank 3: Bronze accent
- Student name
- Grade and section, when reliably available
- Verified exam score
- Rank or score context, if valid source data supports it

Use restrained premium styling consistent with the existing dark navy dashboard, blue/cyan accents, borders, typography, and spacing.

Evaluate how the three cards should fit into the current homepage without making it cluttered or pushing important analytics too far below the fold.

The cards must be driven by real, event-scoped data. They should update when the authoritative scores change.

**If verified scores are unavailable**, propose an honest, informative empty state explaining that score data has not been recorded or connected. Do not silently replace the score leaderboard with an activity leaderboard.

### B. Top 10 score leaderboard

Plan a dedicated Top 10 leaderboard section or page, using the existing application routing and navigation conventions.

The plan should specify:
- Score-based sorting and rank assignment.
- Consistent treatment of tied scores.
- Handling of missing scores, zero scores, and incomplete results.
- Grade and section filters where supported by reliable records.
- Search by student name or assigned student identifier.
- Sort order and pagination or a compact Top 10 table.
- Consistency between the Top 3 cards and the Top 10 ranking.
- Appropriate loading, error, empty, and unavailable-score states.
- Secure access limited to the authenticated Dolphin PRELIMS administrator.

Do not introduce a new route or navigation hierarchy until you have examined the current routing architecture and justified the proposed structure.

## 4. Dashboard KPIs

Evaluate the existing KPI-card section and propose the most useful metrics for the available data.

Potential KPI cards include:

1. Total enrolled students: 555
2. Students with recorded activity: 45 (8.1%)
3. Students with no recorded activity: 510 (91.9%)
4. Students who attempted at least one challenge: 35
5. Total recorded challenge attempts: 150
6. Students with a locked challenge: 16
7. Locked challenge records: 24
8. Score-data availability status

Do not display all eight if it harms the layout. Recommend the most informative four to six for the homepage, with a logical visual hierarchy.

Distinguish student counts from challenge-record counts. For example, 16 students with at least one lock are not the same metric as 24 locked challenge records.

Do not present zero scores as a meaningful average or success metric while the score pipeline is unverified.

Use percentages with clear denominators and explain how each metric is calculated.

## 5. Analyze Grade-Wise Engagement

Available grade-level data from the supplied report:

| Grade | Enrolled | Students with activity | Total attempts | Locked challenge records |
|---|---:|---:|---:|---:|
| 3 | 103 | 12 | 11 | 1 |
| 4 | 97 | 14 | 67 | 12 |
| 5 | 62 | 10 | 39 | 7 |
| 6 | 110 | 1 | 1 | 0 |
| 7 | 88 | 3 | 10 | 2 |
| 8 | 95 | 5 | 22 | 2 |
| Total | 555 | 45 | 150 | 24 |

Use this information to assess which visualizations will be genuinely useful.

In particular:
- Grades 4 and 5 account for 106 of 150 attempts and 19 of 24 locked records.
- Grade 6 has 110 enrolled students but only one student with recorded activity.
- Grade 5 has 10 active students out of 62, the highest activity participation rate of the six grade groups.
- Grade 6 activity coverage is approximately 0.9%.

Treat these as observations about the current database records, not proof of academic ability or exam performance.

## 6. Recommended Visualization Options

Inspect the existing dashboard charts and choose the best combination of useful, visually impressive, non-redundant charts. Do not add every possible chart.

Evaluate at least these options:

### Chart A — Grade engagement comparison

A grouped horizontal bar chart or another clear design comparing enrolled students with students having recorded activity by grade.

Include activity rate as a percentage or a complementary view. Make the low activity coverage in Grade 6 easy to notice.

### Chart B — Participation and attempt progression

A clear progression visualization:
- 555 enrolled
- 45 with any activity record
- 35 who attempted at least one challenge

Show 510 students with no recorded activity separately or alongside the progression.

Ensure this is mathematically accurate. It is an activity funnel, not a completion funnel, because the dump has no verified exam-completion outcomes.

### Chart C — Challenge types and attempts

The current audit identifies these category/type aggregates:

| Category | Challenge type | Challenge rows | Students | Attempts | Locked records |
|---|---|---:|---:|---:|---:|
| logic | boolean_circuit | 61 | 35 | 101 | 16 |
| logic | pattern_match | 26 | 13 | 27 | 5 |
| logic | state_machine | 8 | 7 | 6 | 0 |
| logic | memory_grid | 4 | 3 | 6 | 1 |
| logic | robot_path | 4 | 2 | 6 | 1 |
| logic | graph_traversal | 1 | 1 | 1 | 0 |
| debug | flow_designer_pro | 1 | 1 | 3 | 1 |

The category and type were parsed from challenge IDs because the challenge metadata table was empty in the supplied dump.

Plan a horizontal bar chart of attempts by challenge type with a complementary locked-record view or an alternative that clearly communicates both measures.

Make it obvious that boolean-circuit challenges represent 101 of 150 attempts and 16 of the 24 locked records.

Avoid treating the reported lock rate as a formal failure rate. Labels and tooltips must define it as locked records divided by challenge-status rows if that is the chosen calculation.

Do not claim that one challenge type is academically harder solely because it has more lockouts; participation volume differs significantly.

### Chart D — Most-attempted challenges

Consider a ranked horizontal bar chart or compact table showing the most frequently opened or attempted challenge IDs.

The current audit reports:
- `logic-boolean_circuit-001`: 30 students opened it, 50 attempts, 10 locked records.
- `logic-boolean_circuit-002`: 17 students opened it, 26 attempts, 3 locked records.
- `logic-pattern_match-001`: 12 students opened it, 16 attempts, 4 locked records.
- `logic-pattern_match-003`: 5 students opened it, 6 attempts, 1 locked record.
- `logic-boolean_circuit-003`: 4 students opened it, 6 attempts, 0 locked records.

Verify the available raw schema before relying on these aggregates. Define whether "opened" refers to a challenge-status row, a distinct student, or a separate genuine opening event.

### Chart E — Student activity and intervention table

Evaluate a searchable, paginated table that shows only data genuinely available, such as:
- Student name or username
- Grade
- Number of challenge rows
- Number of attempts
- Number of locked challenges
- Most recent recorded challenge activity
- A data-supported activity or lockout indicator

Use sensible labels such as "No activity recorded", "Activity recorded", "Attempts recorded", and "Challenge locked".

Do not label students as pass/fail, low-performing, or academically weak based on missing records or lockouts alone.

Restrict identifiable student information to authorized users.

### Chart F — Optional advanced visualizations

Recommend additional charts only if the database supports them. Potential options include:
- Grade × challenge-type heatmap.
- Activity timeline.
- Challenge-level attempt distribution.
- Grade-normalized activity-rate comparison.
- Score distribution and score bands after valid scores are connected.

For every proposed chart, state the exact fields, aggregation, and interpretation. If required fields are missing, mark the chart as blocked or optional rather than inventing data.

## 7. Data Definitions and Quality Requirements

Inspect the schema and application code to confirm all definitions.

Based on the supplied audit, the current definitions are:

- **Activity recorded:** At least one ChallengeStatus record exists for the student.
- **Challenge attempted:** Recorded attempts are greater than zero.
- **Challenge locked:** `isLocked = true`.
- **Official score/result:** Not established in the supplied dump.
- **Category/type:** Inferred from the challenge ID, not confirmed from authoritative metadata.

A locked challenge is an indicative lockout signal, not a confirmed scored failure.

The supplied report says the school field is empty for all 555 Dolphin participants. Do not create school breakdowns until reliable school records exist. Grade-level reporting is supported by the current data.

The plan must explicitly include a data-readiness investigation:
1. Inspect the live PostgreSQL schema and safe, read-only data samples.
2. Compare the supplied dump with the current development database without overwriting either.
3. Locate event-specific score generation, result persistence, submission endpoints, and existing APIs in the source code.
4. Investigate whether valid results exist in another approved source.
5. Identify the missing relationship or persistence step if scores are being generated but not saved.
6. Propose how the actual score source should be integrated.
7. Explain which features can be delivered immediately from reliable activity data and which require the missing score source.

Do not change the database, restore over the current database, or invent a score source.

## 8. Architecture Planning Requirements

Inspect the current application before recommending the implementation structure.

Review relevant parts of:
- `server.js`
- Existing event-insights API routes
- `db.js` and database-supervisor implementation
- Authentication middleware and role/event scoping
- Current Admin Overview frontend
- School Dashboard frontend
- Parent View frontend
- User Access frontend
- Existing charting library, reusable KPI cards, table components, and design tokens
- Existing tests, scripts, and package-manager lockfile

Recommend a maintainable architecture that reuses current components.

Describe:
- Which existing page or component should host Dolphin analytics.
- Whether new reusable components are needed.
- What existing charts can be reused.
- Which event-scoped backend APIs or SQL query functions will be needed.
- How metrics should be aggregated and validated.
- How the Top 3 and Top 10 views will use the same trusted ranking data.
- How server-side authorization will restrict results to the Dolphin event ID.
- How empty, missing, or unavailable score data will be handled.
- How dashboard loading performance and query efficiency will be preserved.
- Whether any schema migration is actually necessary.

Prefer existing dependencies and a minimal, incremental implementation. Do not propose a new framework or major dependency without a strong technical reason.

## 9. UI/UX Planning

Maintain the existing dashboard style:
- Dark navy/charcoal background.
- Blue and cyan accents.
- Consistent typography, spacing, card borders, and restrained visual effects.
- Responsive desktop and mobile layouts.
- Existing Tarcin branding and navigation.

Propose a page hierarchy such as:
1. Event identity and overview.
2. Key activity KPI cards.
3. Top 3 verified-score podium, when data is available.
4. Grade-level engagement.
5. Challenge type and lockout analysis.
6. Most-attempted challenges.
7. Student-level activity details.
8. Top 10 verified-score leaderboard, when data is available.

Reorder these sections if your inspection suggests a better information hierarchy. Explain your rationale and how the page will fit the current application rather than presenting a generic new dashboard design.

## 10. Security and Correctness

The proposed implementation must preserve server-side event authorization.

- Do not trust client-supplied event IDs as authorization.
- Do not allow KLN PRELIMS administrators to retrieve Dolphin-only information and vice versa.
- Do not expose student records through unauthenticated APIs.
- Use existing secure session mechanisms and parameterized queries.
- Avoid logging sensitive student information unnecessarily.
- Do not introduce fake API results to make the charts look populated.
- Avoid expensive repeated SQL queries for every chart if shared aggregates or efficient queries can be used.
- Recommend indexes only when justified by the actual query plans and existing schema.
- Preserve the existing four dashboard routes and the features currently available on them.

## 11. What You Must Return Before Implementation

Produce a detailed but practical **implementation plan for review and approval**, organized as follows:

### A. Current-state audit
Summarize the current dashboard architecture, reusable components, event scoping, database tables, and data quality issues found during read-only inspection.

### B. Data-readiness matrix
For each desired feature—Top 3, Top 10, scores, official results, grade analytics, challenge categories, attempts, lockouts, and student activity—identify:
- Available fields
- Actual source tables or APIs
- Whether the data is verified
- Whether implementation is unblocked
- What dependency or correction remains

### C. Recommended design
Explain the proposed homepage hierarchy, the Top 3 card design, Top 10 table, KPI cards, and selected charts. Include the reasoning for each.

### D. Technical architecture
Identify the specific existing files/components that would be reused or modified, proposed API/query boundaries, ranking logic, authorization approach, and relevant database considerations. Base file names and locations on actual repository inspection; do not guess.

### E. Implementation phases
Organize the proposed work into small, reviewable phases with dependencies and acceptance criteria.

Separate work that can be done using the verified activity data from work blocked by missing official scores.

### F. Risks and decisions
List unresolved data-source questions, assumptions, potential regressions, security considerations, and any decisions needed from me.

### G. Verification plan
Specify the build, tests, data reconciliation, event-isolation checks, chart-total checks, empty-state checks, and responsive UI verification you would run after approval.

### H. Final recommendation
Present the best recommended approach, why it suits the current project, what the first implementation phase should contain, and what must be resolved before score ranking can be activated.

## 12. Strict Stop Condition

**Do not implement anything during this task.**

Do not edit source files, create components, run migrations, alter database records, install packages, or begin a build.

Inspect safely, reason about the available evidence, propose the architecture and phased plan, present the blockers and design choices, and then stop.

Wait for me to explicitly approve the plan before beginning implementation.