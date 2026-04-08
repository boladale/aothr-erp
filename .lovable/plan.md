
## Workflow Engine Implementation

### Phase 1: Database Schema
Create tables to define workflows:
- **`workflows`** — defines a workflow per entity type (e.g., Purchase Orders, Vendors, Invoices)
- **`workflow_states`** — the statuses/steps in each workflow (e.g., Draft, Pending Approval, Approved, Sent, Closed)
- **`workflow_transitions`** — allowed transitions between states with conditions (e.g., Draft → Pending Approval requires "submit" action)
- **`workflow_auto_actions`** — auto-actions triggered on state entry (e.g., send notification, update field)

### Phase 2: Workflow Configuration UI
- **Workflow list page** (`/workflows`) — shows all configured workflows grouped by entity type
- **Workflow detail/editor** — visual representation of states and transitions, ability to add/edit/remove states, define transition conditions (role required, amount thresholds), and configure auto-actions (notifications, escalations)

### Phase 3: Integration
- Wire existing approval engine to use workflow definitions
- Status transitions on POs, Vendors, Invoices check workflow_transitions table for allowed moves
- Auto-actions fire on state changes

### Scope for now
- Database tables + seed default workflows for existing entities (Vendors, POs, Invoices, Requisitions, GRN)
- Visual workflow configuration page with state/transition management
- Keep existing approval rules working alongside
