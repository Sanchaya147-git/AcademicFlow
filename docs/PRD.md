# AI-Powered Academic Execution Data Capture & Schedule-Linking Platform

## 1. Product Overview

### Product Name

**AcademicFlow — Intelligent Academic Data Capture & Schedule-Linking Layer**

### One-Line Description

An AI-powered execution intelligence layer that converts heterogeneous faculty and staff progress reports into structured academic events, semantically links them to the college's master academic execution plan, updates actual progress with confidence scoring, and builds institutional memory from historical execution data.

### Core Value Proposition

> **Turn fragmented faculty reports into trusted, schedule-linked academic progress — automatically, while keeping humans in control of uncertain decisions.**

---

## 2. Problem Statement

College academic execution is planned through structured semester plans, department schedules, course plans, unit-wise teaching plans, laboratory schedules, and institutional calendars.

However, actual execution happens through heterogeneous channels:

* Free-text faculty reports
* Department spreadsheets
* Laboratory records
* Daily teaching logs
* Site/classroom diary entries
* Informal coordinator updates
* Optional voice reports

These inputs differ in terminology, structure, granularity, and reporting frequency.

The official academic plan may contain a structured activity such as:

> `CSE-DSA-L5-0042 — Singly & Doubly Linked List Implementation`

while a faculty member may report:

> "Finished linked lists today."

A conventional keyword-based system may fail to associate these two descriptions.

Consequently:

1. Actual academic progress is fragmented.
2. Schedule updates are delayed.
3. Manual reconciliation consumes coordinator/HOD time.
4. Ambiguous or differently worded reports can be mapped incorrectly.
5. Extra activities may be lost because they do not exist in the baseline plan.
6. Historical execution knowledge is not captured in a structured, queryable form.
7. Future planning therefore relies heavily on individual faculty experience rather than institutional data.

AcademicFlow addresses this problem through an AI-powered extraction, semantic matching, confidence scoring, human review, and schedule synchronization pipeline.

---

## 3. Product Goals

## Primary Goals

1. Ingest heterogeneous academic execution reports.
2. Extract structured activity events from unstructured inputs.
3. Normalize reports from different sources into a common schema.
4. Semantically match reported activities to planned academic activities.
5. Handle vocabulary differences between faculty language and formal plan terminology.
6. Handle granularity mismatches between reported and planned activities.
7. Assign an explainable confidence score to every match.
8. Automatically update high-confidence activities.
9. Route uncertain matches to a human review queue.
10. Preserve unmatched activities instead of silently discarding them.
11. Maintain a complete audit trail.
12. Build a historical dataset for institutional memory.

---

## 4. Non-Goals

The MVP will not attempt to:

* Replace the college ERP.
* Replace timetable generation.
* Perform student attendance management.
* Automatically evaluate faculty performance.
* Generate official academic decisions without human approval.
* Require production-grade OCR.
* Require production-grade speech recognition.
* Integrate with every existing college ERP.
* Replace existing academic planning software.

AcademicFlow is an **intelligence and synchronization layer**, not a complete college ERP.

---

## 5. Target Users

## 5.1 Faculty

Needs:

* Low-friction reporting.
* Ability to report naturally.
* No rigid forms.
* Minimal manual data entry.

Example:

> "Completed DBMS normalization today for CSE-C."

---

## 5.2 Laboratory Staff

Needs:

* Spreadsheet-based reporting.
* Session completion logging.
* Lab activity tracking.

---

## 5.3 Department Coordinator

Needs:

* Review ambiguous matches.
* Monitor academic schedule health.
* Correct incorrect mappings.
* View unmatched activities.

---

## 5.4 HOD / Academic Administrator

Needs:

* Department-level progress.
* Schedule variance.
* Delayed activities.
* Historical execution trends.

---

## 6. Core Concept: Master Academic Execution Plan

The baseline plan represents the college's intended academic execution.

## Hierarchy

```text
L1 — Semester
 └── L2 — Department
      └── L3 — Course
           └── L4 — Unit / Module
                └── L5 — Academic Activity
                     └── L6 — Executable Session
```

## Example

```text
L1: 2026 Odd Semester
L2: CSE Department
L3: Data Structures
L4: Unit III — Linked Lists
L5: Linked List Implementation
L6: Singly Linked List Practical
```

---

## 7. Supported Input Types

## MVP

### Input 1 — Free Text

Example:

> "Finished linked lists today for CSE-C."

### Input 2 — Spreadsheet

Example:

| Activity        | Class | Date        | Status   |
| --------------- | ----- | ----------- | -------- |
| Linked List Lab | CSE-C | 25-Aug-2026 | Complete |

### Input 3 — Optional Voice

```text
Voice Report
     ↓
Speech-to-Text
     ↓
Standard Extraction Pipeline
```

Voice input is considered a stretch feature.

---

## 8. System Architecture

```text
                    FACULTY / STAFF
                          |
             +------------+------------+
             |            |            |
          Free Text     Excel        Voice
             |            |            |
             +------------+------------+
                          |
                    INGESTION LAYER
                          |
                    n8n WORKFLOW
                          |
                +---------+---------+
                |                   |
          Input Parsing        File Storage
                |                   |
                +---------+---------+
                          |
                    LLM EXTRACTION
                          |
                  Structured Events
                          |
                 NORMALIZATION LAYER
                          |
                  Candidate Retrieval
                          |
               PostgreSQL + pgvector
                          |
                  Semantic Matching
                          |
              Domain-Aware Rule Engine
                          |
                 CONFIDENCE SCORING
                          |
             +------------+------------+
             |            |            |
          HIGH          MEDIUM         LOW
          >=90%        50–89%         <50%
             |            |            |
          AUTO-LINK     REVIEW       UNMATCHED
             |            |            |
             +------------+------------+
                          |
                SCHEDULE SYNCHRONIZATION
                          |
                  AUDIT TRAIL
                          |
               HISTORICAL DATASET
                          |
                 INSTITUTIONAL MEMORY
```

---

## 9. Functional Requirements

## FR-01: Report Ingestion

The system shall accept:

* Plain text.
* Spreadsheet files.
* Optional voice input.

Each input shall be assigned a unique report ID.

---

## FR-02: Input Classification

The system shall determine the source type:

```text
FREE_TEXT
SPREADSHEET
VOICE_TRANSCRIPT
```

The source type shall be stored as metadata.

---

## FR-03: Structured Extraction

The LLM shall extract:

```json
{
  "activity_description": "",
  "department": "",
  "course": "",
  "unit": "",
  "class_section": "",
  "faculty": "",
  "location": "",
  "event_date": "",
  "start_time": "",
  "end_time": "",
  "status": "",
  "completion_percentage": "",
  "source_excerpt": ""
}
```

Missing fields shall remain null rather than being hallucinated.

---

## 10. Activity Normalization

Different reports describing the same event shall be normalized into a common representation.

Example:

```text
"covered linked lists"
"finished linked list topic"
"completed LL module"
"taught singly/doubly linked lists"
```

may normalize to:

```text
activity_concept = "linked list"
```

The original text shall always be preserved for auditability.

---

## 11. Candidate Retrieval

The system shall retrieve the most likely planned activities.

Candidate retrieval shall consider:

* Semantic similarity.
* Course.
* Department.
* Class.
* Faculty.
* Unit.
* Location.
* Date.
* Activity type.

The system shall return the top 3–5 candidates.

---

## 12. Semantic Matching

The matching engine shall use embeddings rather than relying exclusively on exact keyword matching.

Example:

```text
Reported:
"spool erected on Line 24"

College equivalent:
"completed linked list implementation"

Plan:
"Singly & Doubly Linked List Implementation"
```

The system should recognize conceptual similarity even when terminology differs.

---

## 13. Confidence Engine

The confidence score shall combine multiple signals.

Example:

```text
Semantic Similarity       55%
Course Match              20%
Class Match               15%
Date/Context Match        10%
```

Example formula:

```text
Confidence =
0.55 × semantic_score
+ 0.20 × course_score
+ 0.15 × class_score
+ 0.10 × context_score
```

Thresholds shall be configurable.

Default MVP policy:

```text
>= 90%       AUTO-LINK
50–89%       HUMAN REVIEW
< 50%        UNMATCHED
```

These thresholds shall be calibrated using labeled test data before production deployment.

---

## 14. High-Confidence Flow

Example:

```text
Reported:
"Finished linked lists."

Best candidate:
"Singly & Doubly Linked List Implementation"

Confidence:
94%
```

System action:

```text
AUTO-LINK
```

The corresponding planned activity shall be updated with actual execution information.

---

## 15. Medium-Confidence Flow

Example:

```text
Reported:
"SQL practice completed."

Candidate 1:
SQL Practical Session — 78%

Candidate 2:
SQL Query Exercises — 73%

Candidate 3:
Database Lab — 65%
```

System action:

```text
REVIEW REQUIRED
```

The coordinator shall see:

* Original report.
* Extracted information.
* Top candidate activities.
* Confidence scores.
* Match explanation.
* Approve button.
* Reject button.
* Manual mapping option.

---

## 16. Low-Confidence Flow

Example:

```text
Reported:
"Conducted placement aptitude training."

Best candidate:
Quantitative Aptitude Unit

Confidence:
38%
```

System action:

```text
UNMATCHED ACTIVITY
```

The system shall never silently discard the event.

The coordinator may:

* Map manually.
* Add as an extra activity.
* Reject.
* Mark as outside academic scope.

---

## 17. Granularity Reconciliation

The system must handle situations where reported execution is more granular than the master plan.

Example:

```text
Faculty reports:

1. Explained singly linked lists.
2. Demonstrated insertion.
3. Demonstrated deletion.
4. Conducted implementation exercise.

Master plan:

L5 — Linked List Implementation
```

The system may associate multiple execution events with one planned activity.

This relationship must be stored rather than forcing a one-to-one mapping.

---

## 18. Schedule Synchronization

After an automatic or human-confirmed match, the system shall update the execution state.

Example:

```text
Activity:
CSE-DSA-L5-0042

Planned:
25-Aug-2026

Actual:
25-Aug-2026

Status:
Completed

Match:
94%

Match Type:
Auto-linked
```

For human-approved matches:

```text
Match Type:
Planner-confirmed
```

---

## 19. Audit Trail

Every event shall record:

```text
event_id
report_id
activity_id
source
source_excerpt
extracted_data
candidate_activities
confidence_score
decision
decision_type
approved_by
timestamp
```

Possible decision types:

```text
AUTO_LINKED
HUMAN_CONFIRMED
HUMAN_REJECTED
UNMATCHED
MANUALLY_MAPPED
```

---

## 20. Institutional Memory

Historical execution data shall be retained.

The system shall eventually support queries such as:

> "How many sessions does Data Structures Unit III usually require?"

or:

> "Which activities frequently exceed their planned duration?"

or:

> "Which departments have the largest schedule variance?"

Example:

```text
Data Structures — Unit III

Planned Sessions:
3

Historical Average:
4.2

Historical Variance:
+40%
```

This converts the platform from a reporting tool into an institutional learning system.

---

## 21. Dashboard Requirements

## Dashboard

Display:

```text
Reports Today
Auto-Linked
Needs Review
Unmatched
Activities Completed
Delayed Activities
Schedule Health
```

---

## Review Queue

Each item shall show:

```text
Original Report
        ↓
Extracted Activity
        ↓
Candidate 1 — 82%
Candidate 2 — 75%
Candidate 3 — 61%
        ↓
[Approve] [Reject] [Manual Map]
```

---

## Academic Schedule

Display:

```text
Activity
Planned Start
Planned End
Actual Start
Actual End
Variance
Status
Confidence
```

---

## Analytics

MVP analytics:

* Planned vs actual completion.
* Schedule variance.
* Department-level progress.
* Course-level progress.
* Activity completion trends.
* Average actual duration.

---

## 22. Technology Stack

## Frontend

```text
Next.js
TypeScript
Tailwind CSS
shadcn/ui
Recharts
TanStack Table
```

## Workflow Orchestration

```text
n8n
```

n8n shall orchestrate:

```text
Webhook
→ Input detection
→ File parsing
→ LLM extraction
→ Candidate retrieval
→ Matching API
→ Confidence decision
→ Database update
→ Review queue
→ Notifications
```

## AI

```text
GPT-4.1 Mini
text-embedding-3-small
Whisper (optional)
```

## Backend

```text
Python
FastAPI
Pydantic
SQLAlchemy
RapidFuzz
```

## Database

```text
PostgreSQL
pgvector
```

## Object Storage

```text
Amazon S3
```

---

## 23. AWS Deployment

```text
                    AWS
                     |
          +----------+----------+
          |                     |
        EC2                   RDS
          |                 PostgreSQL
     +----+----+                |
     |         |              pgvector
    n8n     FastAPI
     |
   Nginx
     
     S3
      |
Reports / Excel / Audio
```

### MVP AWS Services

| AWS Service    | Purpose             |
| -------------- | ------------------- |
| EC2            | n8n + FastAPI       |
| RDS PostgreSQL | Database            |
| S3             | File storage        |
| IAM            | Access control      |
| CloudFront     | Frontend delivery   |
| Route 53       | Domain              |
| CloudWatch     | Logs and monitoring |

---

## 24. n8n Workflow

The primary workflow shall be:

```text
Webhook Trigger
      ↓
Identify Input Type
      ↓
Parse Input
      ↓
Extract Structured Activity
      ↓
Normalize Activity
      ↓
Generate Embedding
      ↓
Retrieve Top Candidates
      ↓
Matching API
      ↓
Calculate Confidence
      ↓
       ┌───────────────┐
       │ Confidence?   │
       └───────┬───────┘
               |
       +-------+-------+
       |       |       |
      HIGH   MEDIUM    LOW
       |       |       |
    Auto     Review   Unmatched
    Link      Queue     Log
       |       |       |
       +-------+-------+
               |
       Update Execution Plan
               |
          Audit Record
               |
       Analytics Dataset
```

---

## 25. Data Model

## academic_activities

```text
id
activity_id
activity_name
level
department
course
unit
activity_type
faculty
class_section
location
planned_start
planned_end
actual_start
actual_end
completion_percentage
status
embedding
```

## execution_reports

```text
id
source_type
source_file
raw_content
submitted_by
submitted_at
```

## extracted_events

```text
id
report_id
activity_description
department
course
unit
class_section
faculty
location
event_date
start_time
end_time
status
```

## activity_matches

```text
id
event_id
activity_id
semantic_score
context_score
final_confidence
decision
decision_type
```

## audit_logs

```text
id
event_id
action
performed_by
timestamp
previous_value
new_value
```

---

## 26. Security Requirements

The prototype shall implement:

* Authentication.
* Role-based access.
* HTTPS.
* Environment-based secrets.
* Database credentials stored securely.
* S3 access restrictions.
* Audit logging.
* No hard-coded API keys.
* Synthetic/anonymized datasets for demonstrations.

Roles:

```text
FACULTY
LAB_STAFF
COORDINATOR
HOD
ADMIN
```

---

## 27. MVP Scope

The first working prototype must demonstrate:

### Required

* Synthetic academic master plan.
* Free-text report ingestion.
* Excel ingestion.
* LLM extraction.
* Semantic activity matching.
* Confidence scoring.
* Auto-linking.
* Human review.
* Unmatched activity detection.
* Schedule update.
* Audit trail.
* Dashboard.

### Stretch

* Voice interface.
* Whisper transcription.
* OCR.
* Conversational "time agent".
* Historical analytics.
* Predictive schedule deviation.
* Cross-semester institutional memory.

---

## 28. Demo Scenario

### Input 1

Faculty report:

> "Finished linked lists today for CSE-C."

Expected:

```text
Extracted Activity:
Linked Lists

Matched Plan:
Singly & Doubly Linked List Implementation

Confidence:
94%

Decision:
AUTO-LINKED
```

### Input 2

Faculty report:

> "Did SQL practice today."

Expected:

```text
Candidate 1:
SQL Practical Session — 78%

Candidate 2:
SQL Query Exercises — 73%

Decision:
REVIEW REQUIRED
```

### Input 3

Faculty report:

> "Conducted placement aptitude training."

Expected:

```text
Best Candidate:
38%

Decision:
UNMATCHED
```

---

## 29. Success Metrics

The MVP shall measure:

### Extraction Accuracy

Percentage of reported events correctly structured.

### Matching Accuracy

Percentage of known report-to-plan pairs correctly matched.

### Auto-Link Precision

Percentage of automatically linked activities that are correct.

### Review Rate

Percentage of activities requiring human intervention.

### Unmatched Detection

Percentage of genuinely new/unplanned activities correctly identified.

### Schedule Latency

Time between report submission and schedule update.

Target:

```text
Minutes rather than days.
```

---

## 30. Development Roadmap

## Phase 1 — Foundation

* Create repository.
* Define database schema.
* Generate synthetic master academic plan.
* Set up PostgreSQL + pgvector.
* Set up n8n.
* Set up FastAPI.

## Phase 2 — Extraction

* Build free-text ingestion.
* Build Excel ingestion.
* Implement structured LLM extraction.
* Implement normalized event schema.

## Phase 3 — Matching

* Generate embeddings.
* Implement pgvector candidate search.
* Add RapidFuzz fallback.
* Implement course/class/faculty/context rules.
* Implement confidence engine.

## Phase 4 — Decision Engine

* Implement auto-link.
* Implement review queue.
* Implement unmatched activity flow.
* Implement manual mapping.

## Phase 5 — Dashboard

* Build dashboard.
* Build review queue.
* Build schedule view.
* Build activity details.
* Build basic analytics.

## Phase 6 — Trust Layer

* Implement audit trail.
* Show source evidence.
* Show confidence.
* Show match reasoning.
* Add role-based access.

## Phase 7 — AWS

* Containerize services.
* Deploy n8n to EC2.
* Deploy FastAPI.
* Configure RDS PostgreSQL.
* Configure S3.
* Configure HTTPS.
* Configure logging.

## Phase 8 — Demo Polish

Demonstrate:

```text
Messy Input
    ↓
AI Extraction
    ↓
Semantic Matching
    ↓
Confidence
    ↓
Auto-Link / Review / Unmatched
    ↓
Schedule Update
    ↓
Historical Intelligence
```

---

## 31. Final Product Positioning

AcademicFlow is **not an attendance system**.

It is **not a timetable generator**.

It is **not simply an LLM chatbot**.

It is:

> **An AI-powered execution intelligence layer that connects what faculty and staff actually report with what the institution planned.**

The system closes the loop:

```text
PLAN
 ↓
REAL-WORLD EXECUTION
 ↓
HETEROGENEOUS REPORTS
 ↓
AI EXTRACTION
 ↓
SEMANTIC LINKING
 ↓
CONFIDENCE + HUMAN VALIDATION
 ↓
ACTUAL PROGRESS
 ↓
SCHEDULE INTELLIGENCE
 ↓
INSTITUTIONAL MEMORY
 ↓
BETTER FUTURE PLANNING
```

This preserves the **core technical intent of PS 26122** while replacing the refinery/infrastructure-project domain with a **college execution environment**.
