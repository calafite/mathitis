# 02. Expressive Profiles & Customization Studio

This domain handles the core value of *Mathitis* — rich, expressive student profiles, custom themes, banner uploads, sanitized custom Markdown rendering, and Rich media cards.

---

## 🎨 Expressive Profile Architecture

Profiles serve as personal showcases where students express their technical and creative identities:

1. **Theme & Palette Engine**:
   - Students can choose custom accent colors and cards style (e.g. solid, borders, or glassmorphism).
   - The theme configuration is stored in the database in a JSONB field:
     ```json
     {
       "primaryColor": "#6366f1",
       "accentColor": "#ec4899",
       "badgeColor": "#3b82f6",
       "cardStyle": "glassmorphic"
     }
     ```
   - On the frontend, this JSON is parsed and injected as CSS custom properties (`--profile-primary`, `--profile-accent`, `--profile-card-bg`) scoped to the profile container, allowing full visual customization without custom stylesheets.

2. **Custom Banners & Header HERO**:
   - Custom uploaded banners are supported alongside visual presets.
   - Avatars can feature user-selected animated borders or glow accents.

---

## 🔒 Server-Side Image Processing (Sharp Pipeline)

To protect the server and object storage from malicious uploads and file payloads, the platform implements a **strict server-side processing pipeline**:

- **No direct S3 uploads**: The frontend never receives pre-signed URLs to S3 to write files directly.
- **Upload Flow**:
  1. Frontend submits a standard multipart/form-data request to Fastify (`POST /api/profiles/me/avatar` or `/banner`).
  2. Fastify middleware validates:
     - Maximum file size (2MB avatar, 5MB banner).
     - Magic bytes (file signature check) to ensure the uploaded file is indeed a valid image (JPEG, PNG, WebP) and not a renamed executable or script.
  3. The raw file stream is piped directly into **Sharp**:
     - Strips ALL EXIF, GPS location, and camera metadata (protecting student privacy).
     - Re-encodes the image pixels to completely neutralize hidden steganographic payloads or embedded script exploits.
     - Compresses and converts the output image to optimized standard `.webp` format.
     - Automatically generates small thumbnail and large hero responsive variants.
  4. Fastify uploads the sanitized, compressed WebP buffers to S3/MinIO bucket and returns the final asset CDN URLs to the React client.

---

## 📝 Rich Markdown Sanitisation Pipeline

The biography is authored in standard Markdown with custom extension syntax for colored text spans and block callouts. To render this safely in the React application:

- **Parsing Pipeline**: `remark-gfm` -> `remark-directive` -> `rehype-raw` -> `rehype-sanitize` -> `rehype-highlight`.
- **Strict rehype-sanitize Whitelist**:
  - Tags allowed: `<span>`, `<div>`, `<code>`, `<pre>`, `<blockquote>`, `<img>`, `<a>`, `<iframe>` (exclusively whitelisted for safe embeds like Spotify/YouTube/Soundcloud player widgets).
  - Allowed attributes: `class`, `style` (strictly limited to `color`, `background-color`, `text-align` to prevent styling breakout), `data-*`.
  - Prohibited: `script` tags, inline event listeners (`onload`, `onerror`), and `javascript:` protocol URIs.

---

## 🎵 Rich Media Cards

```sql
CREATE TYPE rich_card_type AS ENUM ('song', 'game', 'film', 'book', 'project', 'custom');

CREATE TABLE rich_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    card_type rich_card_type NOT NULL,
    title VARCHAR(150) NOT NULL,
    subtitle VARCHAR(150),
    description TEXT,
    image_url VARCHAR(512),
    external_url VARCHAR(512),
    embed_url VARCHAR(512), -- Spotify, Soundcloud, YouTube widget
    accent_color VARCHAR(7) DEFAULT '#6366f1',
    metadata JSONB DEFAULT '{}'::jsonb, -- Spotify URI, Steam app ID, Letterboxd rating, tech stacks
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_rich_cards_profile ON rich_cards(profile_id, display_order);
```

- Each profile can have an ordered collection of Rich Cards. Banners are fetched via API scrapers (e.g. fetching metadata from Steam, Letterboxd, or Spotify APIs) and customized locally.
- The drag-and-drop editor allows reordering card stacks (`display_order`) and saving state via `PUT /api/profiles/me/cards/reorder` in a single query.
- Any embedded iframe uses the HTML5 `sandbox` attribute to prevent parent window redirection or cookie access.

---

## 📊 Analytics & Profile Effort Scoring

Whenever a student views another profile, unique views are tracked (`profile_views` incremented using cookie/session tracking to prevent refresh spamming).

The backend calculates a **Profile Effort / Complexity Score** whenever a profile is updated:
- **Effort Score** ($E_p$) is derived from:
  - Biography word count (up to a reasonable limit).
  - Markdown complexity (checking usage of custom headers, badges, colors, and lists).
  - Number of customized Rich Cards added (up to max cap).
- This score is saved as a cached value on the `profiles` table to power matching algorithm calculations.
