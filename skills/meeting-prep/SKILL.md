---
name: meeting-prep
description: "Prepare for meetings — agenda, attendee research, talking points, follow-up templates. Use when prepping for meetings, creating agendas, /meeting-prep."
user-invocable: true
disable-model-invocation: true
argument-hint: "[topic] [attendee-names]"
---

# Meeting Prep

## Pre-Meeting (Preparation)

### 1. Define the Objective
State one clear sentence: "By the end of this meeting, we will have [decision / agreement / plan]." If you cannot define the objective, the meeting may not be necessary.

### 2. Build the Agenda
| # | Topic | Owner | Time | Goal |
|---|-------|-------|------|------|
| 1 | [item] | [name] | [min] | Decision / Update / Discussion |

Keep to 3-5 items. Allocate time per item. Place decisions before updates.

### 3. Research Attendees
- Role and decision-making authority
- Recent interactions and open items with them
- Their likely priorities and concerns for this topic
- Use WebSearch for external contacts (LinkedIn, company site)

### 4. Prepare Key Questions
List 3-5 questions that must be answered in the meeting. These drive the agenda and ensure the objective is met. Frame as decisions: "Do we go with A or B?" not "What do you think about A?"

### 5. Gather Supporting Materials
- Relevant data, metrics, or documents
- Recent project status (git log, task boards, progress.md)
- Previous meeting notes or decisions

## During-Meeting (Framework)

Use three columns to capture everything in real time:

| Decisions Made | Action Items (Who + When) | Parking Lot (Defer) |
|---------------|--------------------------|-------------------|
| [decision] | [person]: [task] by [date] | [topic for later] |

Rules: Every action item has an owner and a deadline. Topics that derail the agenda go to the parking lot, not into discussion.

## Post-Meeting (Follow-Up)

Within 1 hour, send a summary:

```
## Meeting Summary: [Topic] — [Date]

### Decisions
- [Decision 1]
- [Decision 2]

### Action Items
- [ ] [Person]: [Task] — due [date]
- [ ] [Person]: [Task] — due [date]

### Parking Lot (to address separately)
- [Deferred topic]

### Next Meeting: [date/time if applicable]
```

Track action items in work-queue or project management tool. Follow up 24 hours before deadlines.

## Anti-Patterns

- **No clear objective** — meetings without a goal waste everyone's time
- **Agenda sent at meeting start** — send at least 24 hours in advance so attendees can prepare
- **No follow-up sent** — decisions without documentation get forgotten or disputed
- **Allowing scope creep in-meeting** — use the parking lot; protect the agenda
