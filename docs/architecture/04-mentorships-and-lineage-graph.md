# 04. Mentorships & Lineage Graph Architecture

This domain covers the permanent, family-like nature of mentorship relationships, the cross-semester Lineage Graph, and the data integrity rules that protect ancestral history.

---

## 🌳 Permanent Family-Like Mentorship Concept

Mentorships in *Mathitis* are **not temporary transactional tickets** that get closed or completed. They represent permanent departmental lineage — similar to an academic genealogy (who mentored whom, who was mentored alongside whom).

```sql
CREATE TYPE mentorship_status AS ENUM ('active');

-- Permanent Mentorship Relationship Table
CREATE TABLE mentorships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID UNIQUE NOT NULL REFERENCES mentorship_requests(id),
    freshman_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    senior_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    semester SMALLINT NOT NULL, -- e.g. 1 to 12
    academic_year VARCHAR(10) NOT NULL, -- e.g. "2025-2026"
    status mentorship_status NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- Note: No ended_at or completion status. Mentorships are permanent lineage records.
);

-- Performance Indexes
CREATE INDEX idx_mentorships_senior_status ON mentorships(senior_id, status);
CREATE INDEX idx_mentorships_freshman ON mentorships(freshman_id, status);
```

---

## 🛡️ Lineage Preservation & Soft Deletion

A critical architectural safeguard is preventing "holes" in the lineage graph when senior students graduate or request account deletion:

1. **`ON DELETE RESTRICT`**: Foreign keys to `users(id)` use `RESTRICT` rather than `CASCADE`. PostgreSQL prevents any hard delete of a `users` row that is referenced by a `mentorships` record.
2. **Soft Deletes**: Deletion operations update `users.deleted_at = NOW()` and set `users.status = 'deactivated'`.
3. **Profile Anonymisation on Deletion**:
   - The user's handle is updated to `alumnus_<uuid_prefix>`.
   - Biography, banners, custom cards, and contact links are purged.
   - The minimal node representation (social name or pseudonym + semester) remains anchored in `mentorships` so that former mentees still see their ancestral tree.

---

## 📊 Lineage Graph Data Structure & Visualization

The Lineage Graph represents a directed acyclic graph (DAG) or tree of mentorship relationships across semesters:

```
[Senior 2023: Alice]
       │
       ├───► [Senior 2024: Bob (Mentees alongside Charlie)]
       │            │
       │            └───► [Freshman 2025: Dave]
       │
       └───► [Senior 2024: Charlie]
                    │
                    └───► [Freshman 2025: Eve]
```

### API Endpoints:
- `GET /api/lineage`: Returns the full department graph (nodes and edges) aggregated by academic year and semester.
- `GET /api/lineage/:handle`: Returns the focused sub-tree for a specific student (their mentor ancestors, their direct mentees, and their "co-mentees" who shared the same mentor in the same semester).

### Response Schema:
```json
{
  "nodes": [
    {
      "id": "uuid-1",
      "handle": "alice_cs",
      "name": "Alice",
      "avatarUrl": "https://...",
      "semester": 6,
      "academicYear": "2024-2025"
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "uuid-1",
      "target": "uuid-2",
      "relationship": "mentored",
      "semester": 1,
      "academicYear": "2024-2025"
    }
  ]
}
```

### Frontend Visualization:
- Implemented with **React Flow** (`@xyflow/react`) or a custom **D3.js SVG Hierarchy Canvas**.
- Includes smooth pan/zoom, interactive node expansion, cluster highlighting for co-mentees, and quick links to open rich profile modals.
