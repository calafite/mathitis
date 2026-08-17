# 03. Discovery Catalog, Algorithmic Matching & Requests

This domain covers mentor discovery, the analytical recommendation engine, the freshman "Bump" interaction system, request submission, and transactional concurrency safeguards.

---

## 🔍 Discovery Catalog & Freshman Privacy Model

1. **Senior Discoverability**:
   - Senior profiles have `is_discoverable = true` by default. They are indexed and queryable via `GET /api/seniors` with support for multi-faceted filters (semester, tags, course criteria, card genres, and open slot availability).
   - Indexed via partial index: `CREATE INDEX idx_profiles_discoverable ON profiles(is_discoverable) WHERE is_discoverable = true;`.

2. **Freshman Discoverability Privacy**:
   - Freshmen profiles default to `is_discoverable = false`. Freshmen **do not appear** in public catalog searches or exploratory grids.
   - A Freshman's rich profile is revealed **exclusively** to a specific Senior when the Freshman submits a mentorship request to that Senior. This ensures freshmen have complete privacy while browsing, but can showcase full portfolios (bios, cards, projects) to potential mentors.

3. **Public-Optional Contact Information**:
   - `contact_email` and `social_links` (Discord, GitHub, LinkedIn, Telegram) on all profiles are **public if populated, but completely optional**. Students choose whether to provide direct communication channels publicly.

---

## 🎯 Algorithmic Mentor Matching Engine

To assist freshmen in discovering compatible mentors, the platform calculates a weighted compatibility score on `GET /api/recommendations`:

$$\text{Match Score} = (0.40 \times T_o) + (0.30 \times E_p) + (0.10 \times V_p) + (0.20 \times B_p)$$

| Component | Metric | Description |
| :--- | :--- | :--- |
| **Tag Overlap ($T_o$)** | Shared Tags Ratio (0–100) | Intersection of interest tags, CS courses, and tech stacks between freshman and senior. |
| **Profile Effort ($E_p$)** | Complexity Score (0–100) | Computed from senior bio length, custom markdown styling, and rich card count. |
| **Profile Views ($V_p$)** | $\log_{10}(\text{views} + 1)$ Normalized | Prevents over-saturating popular profiles while reflecting student interest. |
| **Freshman Bumps ($B_p$)** | Normalized Bump Count | Aggregated signal of student affinity from the bump mechanism. |

---

## 👍 Freshman Bumps / Likes System

Freshmen can signal interest and affinity toward senior mentors before or without submitting formal requests:

```sql
CREATE TABLE profile_bumps (
    freshman_id UUID REFERENCES users(id) ON DELETE CASCADE,
    senior_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (freshman_id, senior_id)
);
```

### Business Rules & Safeguards:
- **Maximum 4 Active Bumps**: A freshman can hold at most 4 active bumps across the entire platform (`COUNT(*) WHERE freshman_id = $1 <= 4`).
- **Reallocatable Affinity**: Freshmen can un-bump a senior and allocate that bump to another senior at any time. Reallocation executes as an atomic `DELETE` + `INSERT` in a single transaction.
- **Anti-Spam**: Bump endpoints are rate-limited per user (`POST /api/profiles/:handle/bump`).

---

## 📝 Mentorship Requests & Transactional Concurrency

```sql
CREATE TYPE request_status AS ENUM ('pending', 'pending_admin_approval', 'accepted', 'rejected', 'cancelled');

CREATE TABLE mentorship_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    freshman_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    senior_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status request_status NOT NULL DEFAULT 'pending',
    message TEXT NOT NULL,
    rejection_reason TEXT,
    reviewed_by_admin_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial Unique Index: Only 1 active request per pair at a time!
-- Allows re-application in future semesters if rejected or cancelled.
CREATE UNIQUE INDEX unique_active_request ON mentorship_requests (freshman_id, senior_id)
WHERE status IN ('pending', 'pending_admin_approval', 'accepted');
```

### Request Submission Flow (`POST /api/requests`):
1. Check `X-Idempotency-Key` in Redis (24-hour TTL) to prevent double submissions.
2. Validate freshman has not exceeded `MAX_FRESHMAN_REQUESTS` active applications (configured in `system_config`).
3. Check senior is accepting requests (`is_accepting_requests = true`).
4. Insert record into `mentorship_requests` with status `pending`.
5. Dispatch notification to the target senior via BullMQ.

### Concurrency-Safe Decision Flow (`POST /api/requests/:id/accept`):
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Lock Senior profile row to prevent concurrent race conditions
  const [seniorProfile] = await tx.$queryRaw<Array<{ max_mentees: number }>>`
    SELECT max_mentees FROM profiles 
    WHERE user_id = ${seniorId}::uuid FOR UPDATE
  `;

  // 2. Count active mentorships for this senior
  const activeCount = await tx.mentorships.count({
    where: { senior_id: seniorId, status: 'active' }
  });

  if (activeCount >= seniorProfile.max_mentees) {
    throw new CapacityExceededError('Senior has reached maximum mentee capacity');
  }

  // 3. Check dynamic admin approval configuration
  const adminConfig = await tx.system_config.findUnique({
    where: { key: 'REQUIRE_ADMIN_REQUEST_APPROVAL' }
  });
  const requireAdmin = adminConfig?.value === true;

  if (requireAdmin) {
    await tx.mentorship_requests.update({
      where: { id: requestId },
      data: { status: 'pending_admin_approval' }
    });
    // Notify admins
  } else {
    await tx.mentorship_requests.update({
      where: { id: requestId },
      data: { status: 'accepted' }
    });

    await tx.mentorships.create({
      data: {
        request_id: requestId,
        freshman_id: request.freshman_id,
        senior_id: request.senior_id,
        semester: currentSemester,
        academic_year: currentAcademicYear,
        status: 'active'
      }
    });

    // 4. Auto-cancel remaining pending requests if capacity is now saturated
    if (activeCount + 1 >= seniorProfile.max_mentees) {
      await tx.mentorship_requests.updateMany({
        where: { senior_id: seniorId, status: 'pending' },
        data: { status: 'cancelled', rejection_reason: 'Senior capacity filled' }
      });
    }
  }
});
```
