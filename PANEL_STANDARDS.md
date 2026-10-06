# Velammal Dashboard — Panel Standards & Metrics Definition

This document defines the purpose, calculation standard, and performance benchmarks for every panel across the School Campus Analysis platform. Use this as a guide for communicating our assessment standards to stakeholders.

---

## 1. Admin Overview — Regional Level Analysis

### 1.1 Summary KPI Tiles
- **Purpose**: Instant snapshot of cross-campus health.
- **Metrics**: 
    - **Total Zones**: Active schools participating.
    - **Total Students**: Cumulative student body registered.
    - **Participation Rate**: Ratio of students who have joined at least one event vs. the total student population.
    - **Average Score**: Global quality benchmark.
- **Standard**: A Participation Rate > 60% is considered the minimum standard for healthy engagement.

### 1.2 Zone Performance (Bar Chart)
- **Purpose**: Visual comparison of output and quality across zones.
- **Metrics**: Y-axis represents **Total Score** (output volume), Color intensity represents **Avg Score** (quality).
- **Standard**: Zones appearing in the top 20% of the Y-axis are identified as "Volume Leaders."

### 1.3 Submission Timeline
- **Purpose**: Monitoring event peak periods and infrastructure load.
- **Metrics**: Submissions aggregated hourly.
- **Standard**: Identifying "Crunch Hours" (usually 1 hour before event deadlines) to monitor backend stability.

### 1.4 Scoring Rule Breakdown
- **Purpose**: Monitoring where students are losing points globally.
- **Metrics**: Breakdown of average deductions due to **Time Taken** vs **Wrong Attempts**.
- **Standard**: If Time Deductions exceed 15 points on average, curriculum difficulty may need adjustment.

### 1.5 Top Performing Zones (Executive Table)
- **Purpose**: Identifying "Centers of Excellence."
- **Status Metrics**:
    - **UP**: Exceeding global average by 5% with high (>50%) activity.
    - **DOWN**: Significant drop in activity (<40%) or score.
- **Standard**: Zones flagged as "UP" for 3 consecutive weeks are eligible for excellence certification.

---

## 2. Zone Dashboard — Campus Level Depth

### 2.1 Top Students Leaderboard
- **Purpose**: Gamifying the experience and identifying potential mentors.
- **Metrics**: Ranked by **Total Score**. Includes "Best Score" to show peak potential.
- **Standard**: Includes the Top 15 students to ensure a broad enough visibility for consistent high-performers.

### 2.2 Gradewise Stats
- **Purpose**: Identifying if a particular grade (e.g., Grade 6) is struggling compared to others.
- **Metrics**: Students, Submissions, and Avg Score grouped by Grade Level.
- **Standard**: Performance variance between grades should ideally be within ±10%.

### 2.3 Level Proficiency & Breakdown
- **Purpose**: Measuring the "Difficulty Curve" survival rate.
- **Metrics**: **Proficiency %** (Students scoring ≥80 on the level).
- **Standard**: Level 1 Proficiency should be >85%. Level 4 (Advanced) Proficiency >40% is considered "Elite."

### 2.4 Score Distribution (Student Histogram)
- **Purpose**: Identifying the "Long Tail" of achievement.
- **Metrics**: Binning students into score brackets (e.g., 0-500, 500-1000).
- **Standard**: A "Normal Distribution" (bell curve) is expected. A heavy cluster in the "No Submissions" bin triggers an automated campus alert.

---

## 3. Parent View — Individual Student Analytics

### 3.1 Profile KPI Header
- **Purpose**: Clear status reporting for parents.
- **Metrics**: 
    - **Global Rank**: Student position relative to all peers in the same school.
    - **Best Level**: The highest difficulty level where a student scored ≥90.
- **Standard**: "Rank in Zone" is used instead of "Global Rank" to keep the comparison localized and achievable.

### 3.2 Child vs School Comparison (Level Radar/Bar)
- **Purpose**: Contextualizing performance.
- **Metrics**: Student's Avg Score per level overlaid against the **School-Wide Median**.
- **Standard**: Provides parents a realistic benchmark—"Is my child performing at the level of their classmates?"

### 3.3 Milestone Achievements
- **Purpose**: Positive reinforcement through gamification.
- **Badges**: 
    - **Consistent High Flyer**: 10+ submissions scoring 90+.
    - **The Perfectionist**: Score of exactly 100.
    - **Pathfinder**: Attempting all 4 levels regardless of score.
- **Standard**: Badges are permanent "Unlocks" designed to reward effort, not just raw intelligence.

### 3.4 Deduction Breakdown (The "Advice" Panel)
- **Purpose**: Actionable coaching for parents.
- **Metrics**: Donut chart showing % of points lost to **Slow Time** vs **Trial and Error**.
- **Standard Action**: 
    - High Time Deduction → "Advice: Practice speed drills."
    - High Attempt Deduction → "Advice: Review concepts before submitting."

---
*Document Version: 1.0.2 | Released: April 2026*
