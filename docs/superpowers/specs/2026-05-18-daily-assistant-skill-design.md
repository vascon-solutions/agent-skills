# Daily Assistant Skill Design

## Context

The user needs a personal daily operating memory that can capture messy ideas during the day, organize them by life/work role, and turn them into useful follow-up actions. The first version should be implemented as a reusable skill and artifact workflow, not as a full app yet. It should create structured daily Markdown artifacts that can later power an interactive HTML dashboard and a standalone personal assistant application.

The assistant must support random capture from any session. A note might be a CTO standup signal, client feedback, a coding-agent idea, a family reminder, a perfume discovery, a music/mood observation, or a learning moment that could become teaching content.

## Decision

Create a `daily-assistant` skill that maintains one artifact workspace per day under `~/agent-artifacts/daily-assistant/YYYY-MM-DD/`.

Markdown remains the source of truth. The skill writes predictable Markdown sections and metadata so an HTML renderer can parse, search, filter, edit, and sync daily content later.

Version one focuses on:

- daily planning
- live capture
- action queues
- role-aware organization
- delegation and resume briefs
- end-of-day digests
- dashboard-ready Markdown structure
- reminder intent records for Google Calendar, phone calendar notifications, Gmail/email, and dashboard alerts

## Architecture

The first implementation should be small and file-based:

- `SKILL.md`: teaches Codex when and how to use the daily assistant workflow.
- daily Markdown template: defines the stable command center, role lanes, capture entries, action queues, and digest sections.
- optional helper script: creates or updates the current day's workspace, appends normalized captures, and keeps metadata in sync.
- dashboard renderer: reads `markdown/day.md` and `metadata.json` to generate `html/index.html`.

The skill should avoid hidden global state. The daily workspace is the durable state boundary.

## Daily Workspace

Default daily workspace:

```text
~/agent-artifacts/daily-assistant/YYYY-MM-DD/
├── markdown/
│   └── day.md
├── html/
│   └── index.html
├── assets/
│   ├── voice-notes/
│   ├── images/
│   └── mood-board/
└── metadata.json
```

`markdown/day.md` is authoritative. `metadata.json` stores machine-friendly state for theme inference, sync status, source IDs, and dashboard settings. The `html/index.html` file is generated from Markdown and metadata.

## Data Flow

Normal capture flow:

1. User gives messy text, transcript, link, or note.
2. Skill infers lane, type, action, priority, project, owner, and next step.
3. Skill preserves the raw note and appends a structured entry to `markdown/day.md`.
4. Skill updates `metadata.json` with normalized fields for dashboard/search use.
5. Skill refreshes `html/index.html` when dashboard rendering is available.
6. Skill reports the captured item and recommended next action.

Review flow:

1. Skill reads the current day's Markdown and metadata.
2. Skill summarizes command center cards, due reminders, action queue, and role lanes.
3. User chooses an item to brainstorm, delegate, schedule, turn into a spec, or park.
4. Skill updates the same daily workspace instead of creating a separate note unless the user asks for a promoted artifact.

## Role Lanes

The skill recognizes these initial lanes:

- Family: father, husband, school routines, kids' growth, meals, memories, home coordination.
- CTO at Vascon: team alignment, standup signals, product/client feedback, backlog, delegation, one-on-ones, engineering quality, DevOps/security, BI/reporting, strategic company opportunities.
- Software Engineering / Side Gigs: client feedback, project coordination, hands-on coding, specs for coding agents, frontend/backend/DevOps handoffs, QA loops, progress reporting.
- Perfume Enthusiast: personal collection, scent taste profile, wishlist, vendors, reviews, layering experiments, content ideas, app research dataset.
- Music / Mood / Joy: general daily vibe, Apple Music listening context, gospel music, accomplishments, happiness signals.
- Learning / Teaching: things learned, AI coding insights, teachable moments, tweet/post/blog/video ideas, internal lessons, audience framing.
- Meta-System: improvements to the assistant, dashboard, skills, artifact workflows, voice capture, reminders, and future app ideas.

The skill may infer lanes, but it should preserve the raw note so bad classification can be corrected later.

## Command Center View

The daily dashboard should open with a stable command center before showing detailed role lanes:

1. Now: current focus block or lock-in task.
2. Today's Top Priorities: three to five success-defining items.
3. Due / Reminder Queue: calendar, email, and dashboard reminders.
4. Track Today: important signals from standups, client feedback, backlog, bugs, PRs, and personal goals.
5. Active Projects: applications, products, or initiatives that moved or need movement.
6. Delegations: who owns what, expected output, and follow-up point.
7. Capture Inbox: unsorted thoughts, transcripts, links, perfume notes, learning notes, and family notes.
8. Good Day Scorecard: tasks completed, apps advanced, PRs reviewed, features completed, delegations made, bugs handled, business wins, and mood.

Below the command center, the dashboard shows role lanes. The core cards remain stable, but each day can have an inferred visual design.

## Capture Model

Every capture should store:

```yaml
id: YYYYMMDD-HHMM-slug
created_at: ISO timestamp with timezone
source: text | voice-note | link | standup | client-feedback | personal-observation | browsing | learning-source
lane: inferred role lane
type: task | idea | question | learning | memory | risk | content-seed | research | perfume-record | delegation | reminder
action: brainstorm | delegate | remind | schedule | create-spec | create-task-doc | research | implement | turn-into-content | track | park | remember
priority: low | medium | high
status: captured | tracking | delegated | scheduled | in-progress | resolved | parked
owner: optional person or team
project: optional project/client/product
raw_note: preserved original input
summary: assistant-written concise interpretation
next_step: one recommended next action
```

The Markdown representation should be human-readable, while `metadata.json` can store normalized records for dashboard sync.

## CTO at Vascon Model

The CTO lane is source-first, with action labels on each item.

Primary sections:

- Client / Product Feedback
- Standup Signals
- Pending Backlog
- Team Lead Coordination
- Personal Technical Observation
- One-on-One Notes
- Legacy App / Hands-On Coding
- DevOps / Security
- BI / Reporting
- Strategic Opportunities

Important CTO signals include client feedback, issues to resolve, pending backlog, follow-ups, implementation curiosity, delegation/reassignment, delivery risk, engineering quality opportunities, and reusable product opportunities.

The skill should avoid becoming a full standup minutes system. It captures only signals that need action, memory, reassignment, investigation, or later brainstorming.

## Side-Gig / Engineering Model

The side-gig and hands-on engineering lane is project-first.

Primary sections:

- Client Feedback
- Feature Brainstorming
- Spec Writing for Coding Agents
- Hands-On Coding
- Team Coordination
- Delegation of Specs
- Feedback Loop Management
- Progress Reporting
- Roadmap and Task Planning

The skill should help convert rough client feedback into feature artifacts, specs, task docs, coding-agent briefs, developer handoffs, and progress reports.

## Family Model

The family lane starts generic as `Kids / Family` rather than child-specific profiles.

Primary sections:

- School Routine
- Food / Home Care
- Kids Growth
- Family Moments
- Husband / Home Partnership

Family captures can be reminders, routines, growth notes, activity ideas, memories, discussions, or follow-ups. The skill should not force every family note into a task.

## Perfume Model

The perfume lane prioritizes the user's personal scent profile before general app-ready perfume data.

Primary sections:

- My Collection
- My Taste Profile
- My Experiments
- My Wishlist
- Vendor / Purchase Memory
- Content Ideas
- App Research Dataset

Perfume records should track ownership or wishlist status, smell direction, notes, accords, occasion, season, performance, vendor, price when known, reviews when sourced, personal reaction, and what the entry teaches about the user's taste.

When the assistant provides current perfume notes, public reviews, prices, vendor claims, or availability, it should verify from sources instead of relying on memory.

## Learning / Teaching Model

The learning lane is a hybrid of explicit and inferred capture.

Explicit triggers include:

- "I learned this"
- "teach this"
- "how do I explain this?"
- "make this a tweet"
- "turn this into a lesson"
- "this is an aha moment"

Inferred signals include coding-agent workflows, skills being written, blogs, videos, X/Twitter, Instagram, AI news, recurring debugging patterns, and explanations given to developers.

Each learning item should capture source, category, type, target audience, teaching angle, possible output format, and status.

## Reminder And Scheduling Model

The skill records reminder intent in Markdown and metadata. External side effects require explicit confirmation before creating calendar events or sending email.

Initial reminder channels:

- Google Calendar for time-based reminders and focus blocks.
- Phone notifications through the user's synced calendar.
- Gmail/email for digests and self-reminders.
- Dashboard alerts for pending items.

Schedule modes:

- `reminder-only`: quick follow-up, check-in, or nudge that should not reserve real work time.
- `time-block`: focus work, meetings, one-on-ones, reviews, implementation lock-ins, writing/spec work, or family activities that need protected time.

Default inference:

- Short follow-up -> reminder-only.
- Deep work -> time-block.
- Meeting or one-on-one -> time-block.
- Family pickup/drop-off -> recurring calendar routine.
- Daily review/digest -> optional recurring time-block.

## Voice Notes

Voice notes are an input channel, not the core data model.

Version one should accept either:

- an uploaded/local audio path with a transcript supplied by the user or another tool, or
- a pasted transcript from a phone/voice app.

The skill stores raw audio under `assets/voice-notes/` only when a local file is provided and the user confirms copying it into the daily workspace. The transcript becomes a normal capture item with `source: voice-note`.

Automatic transcription and phone ingestion are later integration phases.

## Interactive Dashboard

The HTML dashboard should render from `markdown/day.md` and `metadata.json`.

Required dashboard capabilities for the first useful version:

- search across the day
- filter by lane, action, status, priority, owner, and project
- show the command center first
- show role lanes below
- show reminder queue and active focus block
- show capture inbox for unsorted notes
- show good-day scorecard
- support visual theme inference per day

The dashboard may later edit, reorder, and tag cards, then sync changes back into Markdown. The design must preserve Markdown as the source of truth until round-trip sync is reliable.

## Theme Inference

Each day receives inferred visual metadata:

```json
{
  "date": "2026-05-18",
  "day_type": "execution-heavy",
  "mood": ["focused", "stretched", "optimistic"],
  "theme": "daily-command-center",
  "layout": "command-center-plus-role-lanes",
  "accent": "inferred"
}
```

The assistant infers the day type from captured content, mood, active work, and success signals. The user can override the theme later.

## Skill Behavior

The skill should support these user intents:

- Capture this.
- Show today.
- Plan my day.
- Start a focus block.
- End this focus block.
- Track this today.
- Create a reminder.
- Create a delegation brief.
- Create a resume note.
- Brainstorm this item.
- Turn this into a spec.
- Turn this into teaching content.
- Add perfume record.
- End-of-day review.

The skill should make reasonable inferences, ask at most one clarification when the capture would otherwise be misfiled or cause an external side effect, and always preserve the raw note.

## Error Handling

- If today's workspace does not exist, create it from the standard template.
- If the user's input is too ambiguous to classify, append it to Capture Inbox with `lane: unclassified` and ask one follow-up only when needed.
- If an external reminder, email, or calendar action is requested but the tool is unavailable, record the reminder intent and tell the user it has not been sent or scheduled.
- If a dashboard render fails, keep the Markdown update and report that only the HTML refresh failed.
- If a capture looks like a duplicate, add it with a duplicate note instead of discarding it silently.
- If the user asks for destructive cleanup or deletion, require explicit confirmation.

## Integration Boundaries

Version one may define and record Google Calendar/Gmail reminder intent. Actual calendar creation or email sending is a separate integration step that requires explicit confirmation and the relevant connector/tool availability.

Slack, WhatsApp, Apple Music, Telegram, automatic phone voice-note ingestion, and native phone reminders are out of scope for version one, but the data model should not block them.

## Out Of Scope

- A full standalone personal assistant app.
- Automatic Apple Music integration.
- Automatic WhatsApp ingestion.
- Automatic Slack messaging.
- Automatic Telegram messaging.
- Native phone reminder-app integration.
- Automatic audio transcription.
- Multi-user/team dashboard.
- Financial account integration.
- Full perfume recommendation engine.
- Full two-way Markdown/dashboard sync.

## Validation

The implementation should be validated with realistic daily captures:

1. CTO standup signal from Vascon.
2. Client feature feedback for a side gig.
3. Family routine or kids' activity idea.
4. Perfume discovery or collection note.
5. AI coding learning moment that can become teaching content.
6. Reminder-only follow-up.
7. Time-block focus task.
8. End-of-day digest.

The generated Markdown should remain readable without the dashboard, and the dashboard should render the command center and role lanes from the same source data.
