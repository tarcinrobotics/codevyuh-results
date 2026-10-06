# Graph Report - .  (2026-04-20)

## Corpus Check
- Corpus is ~46,746 words - fits in a single context window. You may not need a graph.

## Summary
- 186 nodes · 279 edges · 21 communities detected
- Extraction: 79% EXTRACTED · 20% INFERRED · 1% AMBIGUOUS · INFERRED: 56 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Access And Navigation|Access And Navigation]]
- [[_COMMUNITY_Dashboard Reporting Views|Dashboard Reporting Views]]
- [[_COMMUNITY_Admin View Rendering|Admin View Rendering]]
- [[_COMMUNITY_Role Scope Enforcement|Role Scope Enforcement]]
- [[_COMMUNITY_Server Auth Bootstrap|Server Auth Bootstrap]]
- [[_COMMUNITY_Dashboard API Layer|Dashboard API Layer]]
- [[_COMMUNITY_Chart Rendering Engine|Chart Rendering Engine]]
- [[_COMMUNITY_Data Access Utilities|Data Access Utilities]]
- [[_COMMUNITY_Client Auth Routing|Client Auth Routing]]
- [[_COMMUNITY_Filter State Controls|Filter State Controls]]
- [[_COMMUNITY_KTA Brand System|KTA Brand System]]
- [[_COMMUNITY_Theme Preferences|Theme Preferences]]
- [[_COMMUNITY_Tarcin Monochrome Identity|Tarcin Monochrome Identity]]
- [[_COMMUNITY_TechSavvy Brand System|TechSavvy Brand System]]
- [[_COMMUNITY_Vadiva Brand Identity|Vadiva Brand Identity]]
- [[_COMMUNITY_Tarcin Signal Mark|Tarcin Signal Mark]]
- [[_COMMUNITY_Environment Config|Environment Config]]
- [[_COMMUNITY_Parent View Route|Parent View Route]]
- [[_COMMUNITY_User Account Model|User Account Model]]
- [[_COMMUNITY_Theme Toggle UI|Theme Toggle UI]]
- [[_COMMUNITY_Project Root|Project Root]]

## God Nodes (most connected - your core abstractions)
1. `loadAllPanels()` - 11 edges
2. `loadZonePerformance()` - 9 edges
3. `apiFetch()` - 9 edges
4. `School Dashboard Analytics` - 8 edges
5. `loadProgressBands()` - 7 edges
6. `loadScoringBreakdown()` - 7 edges
7. `loadScoreRanges()` - 7 edges
8. `Express Bootstrap` - 7 edges
9. `Admin Overview API` - 7 edges
10. `Parent View API` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Student Performance Report PDF` --semantically_similar_to--> `Student Report Generator`  [AMBIGUOUS] [semantically similar]
  aakash_a_performance_report_2026.pdf → public/student-report.html
- `Prototype Hackathon Dashboard` --semantically_similar_to--> `Admin Overview Page Controller`  [INFERRED] [semantically similar]
  index.html → public/js/admin-overview.js
- `Aakash A Performance Report 2026` --conceptually_related_to--> `PDF Report Download Flow`  [AMBIGUOUS]
  aakash_a_performance_report_2026.pdf → public/parent-view.html
- `loadAllPanels()` --calls--> `getFilters()`  [INFERRED]
  public\js\admin-overview.js → public\js\filters.js
- `loadScoreRanges()` --calls--> `buildScoreRangeChart()`  [INFERRED]
  public\js\admin-overview.js → public\js\charts.js

## Hyperedges (group relationships)
- **Auth Session Access Stack** — server_express_bootstrap, middleware_role_gate, routeauth_session_auth_flow, authclient_nav_auth_client [EXTRACTED 0.94]
- **Admin Overview Data Flow** — adminoverview_page_controller, api_admin_api_client, routeadmin_admin_overview_api, db_postgres_pool [EXTRACTED 0.96]
- **Parent Scoped Lookup Flow** — access_parent_scope_guard, routeparent_student_lookup_flow, dashdocs_parent_autofetch_rationale [EXTRACTED 0.88]
- **Dashboard Navigation and Access** — login_role_based_access, admin_overview_dashboard, zone_dashboard_school_analytics, parent_view_dashboard, user_management_role_accounts [EXTRACTED 0.95]
- **Parent Report Generation Flow** — parent_view_dashboard, parent_view_pdf_report_download, student_report_generator, student_report_milestones, student_report_suggestions, aakash_report_concept [INFERRED 0.76]
- **School Analytics Views** — admin_overview_dashboard, admin_overview_school_performance, admin_overview_progress_bands, zone_dashboard_school_analytics, zone_dashboard_score_milestones, zone_dashboard_zone_rank, zone_dashboard_level_proficiency [INFERRED 0.82]
- **KTA Logo Brand System** — kta_logo_karky_tamil_academy, kta_logo_bilingual_identity, kta_logo_seal_emblem, kta_logo_monogram_mark [INFERRED 0.86]
- **Tarcin Brand Mark Composition** — tarcin_tarcin_logo, tarcin_tarcin_robotics, tarcin_concentric_signal_arcs [INFERRED 0.88]
- **Tarcin Logo Brand System** — tarcin_logo_tarcin_robotics, tarcin_logo_wordmark_logo, tarcin_logo_monochrome_branding, tarcin_logo_round_icon_mark [INFERRED 0.80]
- **Velammal TechSavvy Brand System** — techsavvy_logo_velammal_techsavvy, techsavvy_logo_creativity_meets_technology, techsavvy_logo_gear_motif, techsavvy_logo_green_yellow_identity [INFERRED 0.88]
- **Vadiva Logo Composition** — vadiva_logo, vadiva_logomark, vadiva_wordmark, vadiva_brand [EXTRACTED 0.96]

## Communities

### Community 0 - "Access And Navigation"
Cohesion: 0.09
Nodes (35): Parent Scope Guard, Role Home Map, Student Access Guard, Admin Overview Page Controller, Admin Overview API Client, Navigation Auth Client, Dashboard Chart Builders, Auth Config (+27 more)

### Community 1 - "Dashboard Reporting Views"
Cohesion: 0.1
Nodes (26): Student Performance Report PDF, Aakash A Performance Report 2026, Admin Overview Dashboard, School Progress Bands, School-wise Performance, Scoring Rule Breakdown, Top 3 Students, Top Performing Schools (+18 more)

### Community 2 - "Admin View Rendering"
Cohesion: 0.22
Nodes (18): animateValue(), emptyState(), errorRow(), errorState(), esc(), loadAllPanels(), loadProgressBands(), loadScoreRanges() (+10 more)

### Community 3 - "Role Scope Enforcement"
Cohesion: 0.2
Nodes (9): enforceStudentAccess(), filterSchoolsForUser(), getHomeForRole(), getScopedSchool(), getScopedStudentId(), getSessionUser(), serializeUser(), getF() (+1 more)

### Community 4 - "Server Auth Bootstrap"
Cohesion: 0.24
Nodes (8): blockProtectedStaticFiles(), requireRoles(), serveProtectedPage(), connectMongo(), ensureSuperAdmin(), main(), upsertSharedUser(), bootstrap()

### Community 5 - "Dashboard API Layer"
Cohesion: 0.38
Nodes (9): apiFetch(), fetchFilters(), fetchProgressBands(), fetchScoringBreakdown(), fetchSummary(), fetchTopStudents(), fetchTopZones(), fetchZonePerformance() (+1 more)

### Community 6 - "Chart Rendering Engine"
Cohesion: 0.31
Nodes (5): buildProgressBandsChart(), buildScoreRangeChart(), buildScoringChart(), buildZonePerformanceChart(), hexAlpha()

### Community 7 - "Data Access Utilities"
Cohesion: 0.25
Nodes (3): getStatusZoneSet(), query(), run()

### Community 8 - "Client Auth Routing"
Cohesion: 0.43
Nodes (6): allowedRoutes(), applyNavAccess(), fetchMe(), initAuthClient(), renderTopbarAuth(), roleLabel()

### Community 9 - "Filter State Controls"
Cohesion: 0.33
Nodes (1): getFilters()

### Community 10 - "KTA Brand System"
Cohesion: 0.73
Nodes (6): Bilingual Tamil-English Brand Identity, Established 2024, KTA Logo Image, Karky Tamil Academy, Central Monogram Mark, Circular Seal Emblem

### Community 11 - "Theme Preferences"
Cohesion: 0.7
Nodes (4): getPreferredTheme(), initThemeToggle(), setTheme(), updateButtons()

### Community 12 - "Tarcin Monochrome Identity"
Cohesion: 0.9
Nodes (5): Monochrome Branding, Round Icon Mark, Tarcin Logo Image, Tarcin Robotics, Wordmark Logo

### Community 13 - "TechSavvy Brand System"
Cohesion: 0.8
Nodes (5): Creativity Meets Technology, Gear Motif, Green-Yellow Technology Brand Identity, Velammal TechSavvy Logo Image, Velammal TechSavvy

### Community 14 - "Vadiva Brand Identity"
Cohesion: 0.5
Nodes (5): Vadiva Creative Labs, Creative Brand Identity, Vadiva Logo, Vadiva 'V' Symbol, Vadiva Wordmark

### Community 15 - "Tarcin Signal Mark"
Cohesion: 1.0
Nodes (3): Concentric Signal Arcs Motif, Tarcin Logo, Tarcin Robotics

### Community 16 - "Environment Config"
Cohesion: 1.0
Nodes (0): 

### Community 17 - "Parent View Route"
Cohesion: 1.0
Nodes (0): 

### Community 18 - "User Account Model"
Cohesion: 1.0
Nodes (0): 

### Community 19 - "Theme Toggle UI"
Cohesion: 1.0
Nodes (1): Theme Toggle Controller

### Community 20 - "Project Root"
Cohesion: 1.0
Nodes (1): dashboard-codevyuh

## Ambiguous Edges - Review These
- `Protected Route Registration` → `Protected Static Page Map`  [AMBIGUOUS]
  server.js · relation: conceptually_related_to
- `PDF Report Download Flow` → `Aakash A Performance Report 2026`  [AMBIGUOUS]
  aakash_a_performance_report_2026.pdf · relation: conceptually_related_to
- `Student Report Generator` → `Student Performance Report PDF`  [AMBIGUOUS]
  aakash_a_performance_report_2026.pdf · relation: semantically_similar_to

## Knowledge Gaps
- **19 isolated node(s):** `Database Schema Inspector`, `Student Access Guard`, `Protected Static Page Map`, `Theme Toggle Controller`, `Zone Filter Bundle` (+14 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Environment Config`** (2 nodes): `config.js`, `parseEnv()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Parent View Route`** (2 nodes): `nullify()`, `parent-view.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `User Account Model`** (1 nodes): `UserAccount.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Theme Toggle UI`** (1 nodes): `Theme Toggle Controller`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Project Root`** (1 nodes): `dashboard-codevyuh`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Protected Route Registration` and `Protected Static Page Map`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `PDF Report Download Flow` and `Aakash A Performance Report 2026`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Student Report Generator` and `Student Performance Report PDF`?**
  _Edge tagged AMBIGUOUS (relation: semantically_similar_to) - confidence is low._
- **Why does `loadAllPanels()` connect `Admin View Rendering` to `Filter State Controls`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `getFilters()` connect `Filter State Controls` to `Admin View Rendering`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `loadZonePerformance()` (e.g. with `fetchZonePerformance()` and `buildZonePerformanceChart()`) actually correct?**
  _`loadZonePerformance()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `loadProgressBands()` (e.g. with `fetchProgressBands()` and `buildProgressBandsChart()`) actually correct?**
  _`loadProgressBands()` has 3 INFERRED edges - model-reasoned connections that need verification._