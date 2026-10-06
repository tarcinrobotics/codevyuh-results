# Velammal School Campus Analysis — Technical Documentation

This document provides a comprehensive technical overview of the dashboard logic, API endpoints, and SQL queries used across the Admin, Zone, and Parent views.

## 1. System Architecture
- **Backend**: Node.js with Express.
- **Database**: PostgreSQL (relational structure).
- **Frontend**: Vanilla HTML5, CSS3, and JavaScript (ES Modules).
- **Visuals**: Lucide Icons for iconography, Chart.js for data visualization.

---

## 2. Shared Data Logic & Scoring
The platform uses a standardized scoring system for all student submissions:
- **Base Score**: 100 points.
- **Wrong Attempt Deduction**: -5 points per extra attempt (calculated as `(attempts - 1) * -5`).
- **Time Taken Deduction**: -3 points per minute (calculated as `(seconds / 60) * -3`).
- **Minimum Floor**: Submissions generally bottom out at 50 points to ensure positive reinforcement.

---

## 3. Admin Overview Dashboard
The goal of this dashboard is to provide a high-level view of performance across all 28+ campuses.

### 3.1 Global Filters
Filters (Zone, Event, Zone Status) are synchronized across all panels. When a filter changes, a new classification set is requested from the backend.

### 3.2 Zone Status Classification (Active vs Inactive)
Unlike simple averages, we use **Median-based Classification** for robustness against outliers:
- **Data Source**: Submissions and Avg Score per zone.
- **Calculation**:
    1. Fetch performance for all zones.
    2. Compute the **Median Submissions** and **Median Avg Score**.
- **Rules**:
    - **🟢 ACTIVE**: Zone is at or above median in **BOTH** Submissions AND Avg Score.
    - **🔴 INACTIVE**: Zone is below median in **EITHER** Submissions OR Avg Score.

### 3.3 Top Performing Zones Panel
This panel ranks zones and assigns a trend status:
- **UP**: Avg Score > Global Avg + 5% AND Activity Rate > 50%.
- **DOWN**: Avg Score < Global Avg - 5% OR Activity Rate < 40% OR Active Members = 0.
- **STABLE**: Within the ±5% range with healthy participation.

---

## 4. Zone Dashboard
Provides a specialized view into a selected school's performance.

### 4.1 Student Proficiency
Calculated per level to show mastery:
- **Proficient Count**: Students scoring ≥ 80 on a level.
- **Proficiency %**: `(Proficient / Total Submissions) * 100`.

### 4.2 Grade-wise Stats
Aggregates performance by student grade (e.g., Grade 6, Grade 7) to identify demographic performance gaps.

### 4.3 Inactive Students
Specifically queries for users with **zero** records in the `Submission` table within the selected school, helping administrators identify students who haven't started.

---

## 5. Parent View
A personalized analytics page for individual student performance.

### 5.1 Profile & Ranking
- **Global Rank**: Calculated by ranking the student's **Total Score** against all other students in the same `schoolId`.
- **Comparison**: Shows child's avg score side-by-side with the current School Average.

### 5.2 Milestone Tracker (Achievements)
Threshold-based logic:
- **Perfect 100s**: Count of submissions with exactly 100 points.
- **90+ / 95+ Consistency**: Counts of high-tier submissions.
- **Level Mastery**: Checks if a student has successfully submitted at least one valid entry for Levels 1, 2, 3, and 4.

### 5.3 Deduction Breakdown
Analyzes the student's *primary loss factors*:
- **Wrong Attempts**: Total points lost to multiple tries.
- **Time Factor**: Total points lost due to slow execution.
- Helps parents guide students on whether to focus on **Accuracy** or **Speed**.

---

## 6. Database Schema Summary
| File | Table | Purpose |
|------|-------|---------|
| `School` | Campus | The 28+ Velammal locations. |
| `User` | Students/Admins | Stores names, grades, and school associations. |
| `Submission` | Results | Log of scores, levels, attempts, and durations. |
| `Event` | Competitions | Context for participation sets. |

---

## 7. Performance Optimizations
### 7.1 Student Auto-Fetch (Parent View)
To improve UX, the Parent View uses a specialized `students-by-school` endpoint.
- **Trigger**: Selecting a school from the dropdown.
- **Logic**: Immediately returns up to 80 students with their grade and submission counts.
- **Benefit**: Removes the need for parents to manually type student names to find their child's profile.

### 7.2 Icon System Consistency
The dashboard uses **Lucide-JS** for all iconography. 
- **Centralized Initialization**: Icons are initialized via `lucide.createIcons()` in both a synchronous inline script and a `DOMContentLoaded` listener to prevent "icon flicker" on slow loads.
- **Attributes**: Every interactive element uses the `data-lucide` attribute for cross-page design continuity.

---
*Generated: April 18, 2026 | Technical Team*
