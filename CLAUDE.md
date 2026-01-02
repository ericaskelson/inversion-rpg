# Inverse RPG - Architecture Notes

## Concept

An "inverted RPG" where the core gameplay is **character creation** rather than playing. Players invest significant time crafting interesting characters with meaningful choices, then watch those characters navigate pre-written branching scenarios. Think: CYOA books meets character fate simulator.

## Key Design Principles

1. **Character creation IS the game** - should take ~15 minutes of interesting decisions
2. **Scenarios are pre-authored** (with AI tooling), not generated live
3. **Roguelike structure** - individual runs are short, meta-progression spans runs
4. **AI-assisted content pipeline** - bulk scenario generation with human review

## Technical Architecture

### Web App (Frontend)
- **Framework:** React or Svelte (TBD)
- **State:** Finite state machine for scenario progression
- **Persistence:** localStorage for meta-progression/saves

### Scenario Content Structure
Each scenario is a **folder** containing:
```
scenarios/
  scenario-id/
    content.md       # Main narrative text (markdown)
    config.json      # Game logic: choices, conditions, links to next scenarios
    cover.png        # Primary illustration (optional)
    assets/          # Additional images if needed
```

**Why folders instead of monolithic JSON:**
- LLM-friendly: generate one scenario without needing context of others
- Human-editable: markdown is easy to review/tweak
- Git-friendly: isolated changes per scenario
- Scales to hundreds/thousands of scenarios

### Build Process
A build step that:
1. Walks all scenario folders
2. Extracts and merges config.json files
3. Builds a complete scenario graph
4. Validates links (no broken references, orphan detection)
5. Outputs optimized bundle for the web app

### Content Generation Pipeline (Python)
Separate tooling for:
- Bulk scenario generation via LLM APIs
- Image generation (Nano Banana / similar)
- Validation and linting
- Human review workflow

## Character System

### The Fate Mechanic

**Fate** is a meta-score calculated from character creation choices:
- Positive/powerful choices **increase** fate
- Drawbacks/weaknesses **decrease** fate
- Higher fate = "destined for greatness" = harder starting scenarios
- Lower/negative fate = "avoiding heaven's gaze" = more mundane challenges

This elegantly solves:
- **Balance**: Powerful characters face appropriately difficult challenges
- **Replay variety**: Different fate ranges unlock entirely different story trees
- **Meaningful choices**: Every option has weight because it affects difficulty

### Character Data

Characters have two types of underlying stats:

#### Attributes (Numeric, Hidden)
- Derived from character creation choices (user picks flavor, system tracks numbers)
- Never shown as raw numbers - described qualitatively if at all ("Hardy", "Quick-witted")
- Used for deterministic threshold checks in scenarios
- Core attributes TBD (e.g., Strength, Agility, Endurance, Cunning, Charisma, Will)

#### Traits (Boolean Tags)
- Named qualities: "noble-born", "scarred", "silver-tongued", "spellcaster"
- Gained from character creation choices
- Can be gained/lost during scenarios
- Used for path gating and outcome branching

### Character Creation Categories

| # | Category | Description | Picks | Drawbacks? |
|---|----------|-------------|-------|------------|
| 1 | **Sex** | Male/Female/Other | 1 | No |
| 2 | **Race** | Fantasy race with attribute modifiers | 1 | Varies by race |
| 3 | **Appearance** | Physical description, minor effects | Several | Possible |
| 4 | **Culture** | Where you grew up, cultural background | 1 | Possible |
| 5 | **Avocation** | Former profession/upbringing | 1 | Possible |
| 6 | **Virtue & Vice** | Personality tendencies | 1+ each | Yes (vices) |
| 7 | **Philosophy** | Worldview, moral stance | 1 | Possible |
| 8 | **Edge** | Key defining ability (not a class) | 1 | No |
| 9 | **Skills** | Practical competencies | 1-2 | No |
| 10 | **Feats** | Exceptional capabilities | 1-2 | No |
| 11 | **Spells** | Magical abilities (requires spellcaster) | 0-3 | No |
| 12 | **Gear** | Starting equipment | Several | Possible (cursed?) |

### How Choices Work

Each option in a category specifies:
- `id`: Unique identifier
- `name`: Display name
- `description`: Flavor text
- `fate`: Fate adjustment (+N for powerful, -N for drawbacks)
- `attributes`: Attribute modifications (`{ "strength": +1, "charisma": -1 }`)
- `traits`: Traits granted (`["noble-born", "literate"]`)
- `requires`: Prerequisites (traits, other choices, attribute minimums)

Example:
```json
{
  "id": "culture-frozen-north",
  "name": "The Frozen North",
  "description": "Raised in the harsh tundra, where only the strong survive.",
  "fate": 1,
  "attributes": { "endurance": 2, "charisma": -1 },
  "traits": ["cold-resistant", "stoic"]
}
```

### How They Influence Scenarios
- **Deterministic checks** - no dice rolls, outcomes based on meeting thresholds
- **Path gating** - some choices only available with certain traits/stats
- **Branching outcomes** - same choice leads to different results based on character
- **Random availability** - some choices appear only X% of the time (rare)

## Scenario Config Schema

### Multi-Start System

**No single root node.** Instead, many disconnected story trees with multiple possible starting points.

Starting scenario selection:
1. Calculate character's fate score
2. Filter starts by `minFate` / `maxFate` range
3. Check any trait/attribute requirements
4. For each eligible start, roll against its `chance` (1-100%)
5. Present all successful rolls as choices to the player

This prevents replay fatigue (different fate = different trees) and adds discovery excitement.

### Start Node Schema

```json
{
  "id": "epic-quest-begins",
  "isStart": true,
  "startConfig": {
    "minFate": 5,
    "maxFate": null,
    "chance": 80,
    "requires": { "trait": "chosen-one" }
  },
  "choices": [...]
}
```

- `minFate`: Minimum fate to be eligible (null = no minimum)
- `maxFate`: Maximum fate to be eligible (null = no maximum)
- `chance`: Probability (1-100) this start appears if eligible
- `requires`: Additional trait/attribute requirements

### Regular Node Schema

```json
{
  "id": "tavern-confrontation",
  "choices": [
    {
      "text": "Throw a punch",
      "available": {
        "requires": { "trait": "hot-headed" }
      },
      "outcomes": [
        { "condition": { "attribute": "strength", "op": ">", "value": 3 }, "next": "fight-win" },
        { "condition": "default", "next": "fight-lose" }
      ]
    },
    {
      "text": "Try to talk them down",
      "outcomes": [
        { "condition": { "trait": "silver-tongued" }, "next": "diplomacy-success" },
        { "condition": "default", "next": "diplomacy-fail" }
      ]
    },
    {
      "text": "Slip away unnoticed",
      "available": {
        "chance": 0.3
      },
      "outcomes": [
        { "condition": "default", "next": "escape" }
      ]
    }
  ]
}
```

### Schema Notes
- `available`: conditions for the choice to appear (optional)
  - `requires`: trait/attribute requirements
  - `chance`: random availability (0.0-1.0 for choices, 1-100 for starts)
- `outcomes`: array of possible destinations, evaluated in order
  - First matching condition wins
  - `"default"` matches anything (use as fallback)
- Conditions can check traits (has/doesn't have) or attributes (comparisons)

### Fallback Guarantee

There should always be at least one starting scenario with:
- `minFate: null, maxFate: null` (any fate)
- `chance: 100` (always available)
- No requirements

This ensures every character can start somewhere.

## File Structure (Current)

```
inverse-rpg/
  CLAUDE.md                    # This file (for Claude)
  README.md                    # Quick reference (for humans)

  # Batch files (Windows)
  dev-build.bat                # Build for development
  dev-server.bat               # Start dev server (with editor support)
  dev-open.bat                 # Open browser to localhost:5173
  prod-build.bat               # Build for production (WebP + cleanup)
  prod-server.bat              # Start production preview server
  prod-open.bat                # Open browser to localhost:4173

  src/                         # Vite + React + TypeScript web app
    editor-server.js           # Express API for editing character data
    dist/                      # Production build output (deploy this folder)
    public/
      images/
        options/               # Option card images (PNG/JPG source + WebP generated)
        portraits/             # Portrait images (gitignored, ~1000 files)
      scenarios.json           # Compiled scenario bundle
    src/
      api/
        editorApi.ts           # Frontend API client for editor server
      components/
        AppearanceSelector.tsx # Multi-step wizard for Build/Skin/Hair/Portrait
        CategorySelector.tsx   # Generic option grid for most categories
        CharacterCreator.tsx   # Main character creation orchestrator
        CharacterSummary.tsx   # Sidebar showing current stats/traits
        CharacterReview.tsx    # Final review page before adventure
        OptionEditorModal.tsx  # Modal form for editing options
        PortraitManager.tsx    # Portrait generation and review UI
        ScenarioPlayer.tsx     # Plays through scenarios (not yet integrated)
      contexts/
        EditModeContext.tsx    # React context for edit mode state
      data/
        characterCreation.json # All category options (editable via GUI)
        characterCreation.ts   # Thin wrapper for JSON import
        appearanceConfig.json  # Build/Skin/Hair options + portrait metadata
        appearanceConfig.ts    # Thin wrapper for JSON import
      engine/
        characterBuilder.ts    # State management, calculations, validation
        conditions.ts          # Scenario condition evaluation
      types/
        game.ts                # All TypeScript interfaces
      utils/
        imagePath.ts           # WebP path conversion for production
      App.tsx                  # Main app component
      App.css                  # All styles

  scenarios/                   # Scenario content folders (one per scenario)
  tools/
    build-scenarios.js         # Compiles scenarios/ into scenarios.json
    convert-to-webp.js         # Converts PNG/JPG to WebP (incremental)
    cleanup-dist-images.js     # Removes PNG/JPG from dist/ after build
    cleanup-orphaned-portraits.js  # Removes JSON entries for deleted images
```

## Current Implementation State

### Working Features
- **Character Creator UI** - Full 12-category flow with navigation
- **Fate System** - Calculated from all selections, shown descriptively
- **Attributes** - Hidden numeric values, shown as descriptions (Weak/Average/Strong)
- **Traits** - Boolean tags collected from selections
- **Prerequisites** - Options can require traits, attributes, or other selections
- **Option Images** - 1:1 aspect ratio images on option cards with hover zoom
- **Subcategories** - Options grouped within categories (e.g., Martial/Magic skills)

### Appearance System
Special multi-step wizard (not using CategorySelector):
1. **Build** - Affects attributes (Slim: +AGI/-STR, Muscular: +2 STR/-AGI + intimidating)
2. **Skin Tone** - Cosmetic only
3. **Hair Color** - Some grant traits (Red/White = "distinctive")
4. **Portrait** - Filtered by Build + Skin + Hair + Sex + Race (not yet generated)

Portrait combinations: 5 builds × 6 skins × 7 hair × 2 sexes × 5 races = **2,100 portraits needed**

### Key Types (in types/game.ts)
- `CharacterOption` - Standard option with id, name, description, fate, attributes, traits, requires, image, subcategory
- `CategoryConfig` - Category definition with id, name, minPicks, maxPicks, options[]
- `AppearanceSelections` - { build, skinTone, hairColor, portraitId }
- `Portrait` - Tagged with build, skinTone, hairColor, sex (+ race to be added)
- `CharacterBuilderState` - Current selections, calculated values

### Data Files
- `characterCreation.json` - All 12 categories of options (editable via GUI)
- `characterCreation.ts` - Thin wrapper that imports and type-asserts the JSON
- `appearanceConfig.json` - Builds, skinTones, hairColors, portraits (editable via GUI)
- `appearanceConfig.ts` - Thin wrapper that imports and type-asserts the JSON

---

## Character Options Editor (IMPLEMENTED)

### Usage
- Run `npm run dev:edit` or `start-edit.bat` to start in edit mode
- This starts both Vite (port 5173) and the editor API server (port 3001)
- In the UI, an "Edit Mode: ON/OFF" toggle appears in the header when editor server is available
- When ON, each option card shows Edit/Delete buttons
- "Add Option" button appears at the end of each category/subcategory
- Changes are saved immediately to the JSON files

### Editor Server
Located at `src/editor-server.js`, provides:
- `GET /api/character-creation` - Returns characterCreation.json
- `PUT /api/character-creation` - Writes to characterCreation.json
- `GET /api/appearance-config` - Returns appearanceConfig.json
- `PUT /api/appearance-config` - Writes to appearanceConfig.json

### Key Files
- `src/editor-server.js` - Express API server for reading/writing JSON + portrait generation
- `src/src/api/editorApi.ts` - Frontend API client
- `src/src/contexts/EditModeContext.tsx` - React context for edit mode state
- `src/src/components/OptionEditorModal.tsx` - Modal form for editing character options
- `src/src/components/AppearanceEditorModal.tsx` - Modal form for editing appearance options
- `src/src/components/PortraitManager.tsx` - Portrait generation and review UI

### What You Can Edit
For each CharacterOption:
- id, name, description
- subcategory (auto-suggests existing ones)
- image filename
- fate value
- attributes (STR/AGI/END/CUN/CHA/WIL)
- traits (comma-separated)
- isDrawback flag

### Appearance Config Editing (IMPLEMENTED)
In edit mode, the appearance wizard (Build/Skin Tone/Hair Color) also supports:
- Edit/Delete buttons on each appearance option
- Add button to create new builds, skin tones, or hair colors
- Uses AppearanceEditorModal for the edit form
- Saves changes to appearanceConfig.json

### Portrait Management (IMPLEMENTED)

AI-powered portrait generation integrated into edit mode:

#### Usage
1. Navigate to the Portrait step in the Appearance category
2. Enable Edit Mode (toggle in header)
3. The Portrait Manager UI replaces the portrait grid

#### Features
- **Stats Dashboard**: Shows existing, missing, and pending portrait counts
- **Editable Prompt Template**: Edit base prompt and style modifiers directly in the UI
- **Selection Interface**: Checkboxes for each characteristic (Sex, Race, Build, Skin Tone, Hair Color)
- **Per-Combination Count**: Generate multiple portraits (1-10) for each characteristic combo
- **Batch Generation**: Select any combination of options, generates all permutations × count
- **Missing Counts**: Shows how many portraits are missing per category
- **Generation Progress**: Real-time progress bar during generation
- **Review Queue**: All generated portraits go to "pending" for review
- **Click-to-Zoom**: Click any pending portrait to view full-size in lightbox
- **Accept/Reject**: Individual or bulk accept/reject of pending portraits

#### Portrait Filtering
Portraits are filtered by ALL characteristics:
- Sex (from sex category selection)
- Race (from race category selection)
- Build, Skin Tone, Hair Color (from appearance wizard)

Multiple portraits can exist per characteristic set (unique IDs with timestamp suffix).

#### API Endpoints (editor-server.js)
- `POST /api/portraits/generate` - Queue generation (accepts `count` param for multiple per combo)
- `GET /api/portraits/pending` - List pending portraits
- `GET /api/portraits/generation-status` - Get progress
- `POST /api/portraits/accept/:id` - Accept single portrait
- `POST /api/portraits/accept-all` - Accept all pending
- `DELETE /api/portraits/pending/:id` - Reject single portrait
- `DELETE /api/portraits/pending` - Reject all pending

#### Prompt Configuration
Editable in the Portrait Manager UI, stored in `appearanceConfig.json`:
```json
{
  "portraitConfig": {
    "basePrompt": "Fantasy RPG character portrait. A {sex} {race} with a {build} build...",
    "styleModifiers": "Dark fantasy art style, painterly...",
    "aspectRatio": "3:4",
    "imageSize": "1K"
  }
}
```

Template variables: `{sex}`, `{race}`, `{build}`, `{skinTone}`, `{hairColor}`

#### Requirements
- `GEMINI_API_KEY` environment variable must be set

#### Image Generation Models

Two Gemini models support image generation:

| Model | ID | Quality | Speed | Best For |
|-------|-----|---------|-------|----------|
| **Nano Banana Pro** | `gemini-3-pro-image-preview` | Highest (4K, photorealism, text) | Slower | Final assets, text-heavy images |
| **Nano Banana** | `gemini-2.5-flash-image` | Good (1K max) | Faster | Bulk generation, iteration |

**Quality Note:** Flash Image produces noticeably lower quality with "AI smooth skin" artifacts. For final portrait assets, Nano Banana Pro is strongly preferred despite slower speed. Use Batch API to offset the lower rate limits.

#### Gemini API Rate Limits (as of Dec 2025)

Rate limits are per-project (not per-key) and vary by billing tier:

| Tier | Qualification | Gemini 3 Pro Image RPD | Flash Image RPD |
|------|---------------|------------------------|-----------------|
| Free | Default | ~25 | ~250 |
| Tier 1 | Paid billing enabled | ~250 | ~2,000 |
| Tier 2 | $250+ spend + 30 days | Higher | Higher |
| Tier 3 | $1,000+ spend + 30 days | Much higher | Much higher |

**Key findings:**
- RPD (requests per day) is the main bottleneck for bulk generation
- Flash Image has ~8x higher RPD limits than Pro Image
- Limits reset at midnight Pacific Time
- Check actual limits in [Google AI Studio](https://aistudio.google.com/) under Settings

**Rate limit headers** returned by API:
- `X-RateLimit-Remaining` - requests left
- `X-RateLimit-Limit` - total allowed
- `X-RateLimit-Reset` - reset timestamp

#### Batch API (IMPLEMENTED)

For high volume portrait generation, the [Gemini Batch API](https://ai.google.dev/gemini-api/docs/batch-api) offers:
- **50% cost reduction** vs real-time API
- **Separate rate limits** from real-time API
- **Higher throughput** - not subject to RPM limits
- **Async processing** - submit batch, poll for completion, import results

##### Batch API Endpoints
- `POST /api/portraits/batch` - Create batch job with selected characteristics
- `GET /api/portraits/batch` - List all batch jobs
- `GET /api/portraits/batch/:id/status` - Check job status (polls Google API)
- `POST /api/portraits/batch/:id/import` - Import completed results to pending
- `DELETE /api/portraits/batch/:id` - Delete local job record

##### Response Structure (Google Cloud Long-Running Operation)
The Gemini Batch API returns a long-running operation object:
```javascript
{
  name: "batches/abc123",      // Job ID
  metadata: {...},              // Job metadata
  done: true/false,             // Completion status
  response: {                   // Only present when done=true
    "@type": "...",
    inlinedResponses: {         // Double-nested!
      inlinedResponses: [...]   // Array of results
    }
  }
}
```

**Key insight:** Results are at `response.inlinedResponses.inlinedResponses` (double-nested).

**Important:** Each response includes a ~2MB encrypted `thoughtSignature` field (base64-encoded chain-of-thought trace) between the image data and the metadata block. When parsing, search for the `"metadata"` block first, then find the `"key"` within it - don't just look N bytes after the image data ends.

##### Batch Job Persistence
Jobs are stored in `src/src/data/batchJobs.json` (gitignored) with:
- Job ID, display name, creation time
- Request metadata (characteristics for each image)
- Status, last checked time, import results

##### Inline vs File-Based Batches
Currently using **inline requests** (requests embedded in API call, results returned inline).

**Batch Size Limits:**
- Each image is ~3MB base64 in the response
- JavaScript has a ~512MB string length limit (`0x1fffffe8` characters)
- **Maximum inline batch size: ~100 images** (to stay safely under the limit)
- Tested successfully: 28 images, 70 images
- 175 images (500MB+ response) requires streaming processing

**Large Batch Handling (100+ images):**
For batches over 100 images, the server uses streaming processing:
1. Downloads response to a temp file instead of memory
2. Status check parses just the first few KB for `done` status
3. Import processes images incrementally using chunked file reading
4. Temp files are preserved in `src/temp/` for debugging and re-imports (delete manually when done)

**Recommendations:**
- For batches under 100 images: standard processing, fast and simple
- For batches 100-200 images: works but slower, uses temp files
- For batches 200+ images: consider splitting into multiple batch jobs

##### UI Features
- **Create Batch Job** button in Portrait Manager (uses same characteristic selection as real-time)
- **Batch Jobs Panel** showing all jobs with status
- **Refresh** button to poll Google API for status updates
- **Import** button to pull completed results into pending queue
- **Delete** button to remove job records

#### UI Details
- **Portrait selection grid**: Large cards (280px min), 3:4 aspect ratio, no name labels
- **Character summary sidebar**: 340px wide, shows selected portrait with click-to-zoom
- Portraits stored in `public/images/portraits/`, pending in `public/images/portraits/pending/`

### TODO: Prerequisites & Incompatibilities Editor
The option editor currently doesn't support editing `requires` and `incompatibleWith` fields. These are complex because:
- `requires` is an array of `OptionRequirement` objects with multiple possible conditions:
  - `trait` - requires a specific trait
  - `notTrait` - must NOT have a trait
  - `attribute` - requires attribute comparison (id, op, value)
  - `selection` - requires a specific option from another category
  - `notSelection` - must NOT have selected an option
- `incompatibleWith` is an array of option IDs from the same category

Ideal UI would:
- List all existing requirements with delete buttons
- "Add Requirement" button with dropdown for requirement type
- For trait/notTrait: dropdown/autocomplete of all existing traits
- For selection/notSelection: cascading dropdowns (category -> option)
- For attribute: dropdown for attribute, dropdown for operator, number input for value
- For incompatibleWith: multi-select of options in current category

---

## Roadmap / Next Steps

### 1. Name Selection System (HIGH PRIORITY)
Replace the free-text name input with a curated name selection tab:
- New category/tab specifically for names (distinct UI from normal options)
- Name lists filtered by sex and race combinations
- Could show 10-20 suggestions with a "regenerate" button
- Names should feel culturally appropriate for each race
- Data structure: `namesConfig.json` with arrays per sex/race combo
- Consider: should names affect anything mechanically, or purely cosmetic?

### 2. AI Text Generation for Options
Automate option creation by prompting an LLM:
- Input: category context, all existing options in that category
- Output: new option that fits the style but is maximally distinctive
- Implementation approach:
  - Add "Generate Option" button in edit mode
  - Call Gemini API with structured prompt
  - Pre-fill the option editor modal with generated content
  - Human reviews/edits before saving
- Could also generate descriptions for existing options that lack them
- Reuse this infrastructure for scenario text generation later

### 3. Scenario Framework
Build the post-character-creation gameplay loop:
- **Scenario Editor UI** - similar to option editor but for scenario nodes
- **Scenario Player** - already exists (ScenarioPlayer.tsx) but not integrated
- **AI-Assisted Authoring**:
  - Generate scenario text given: character traits, previous node, desired tone
  - Generate choice options with appropriate trait/attribute gates
  - Generate outcome variations based on character builds
- **Image Generation** - reuse portrait/option image pipeline for scenario illustrations
- **Build Process** - compile scenario folders into optimized bundle

### 4. Public Hosting
See "Hosting Options" section below for detailed analysis.

---

## Hosting Options

### Option A: Static Hosting (Vercel/Netlify/GitHub Pages)
**Best for: Read-only public access**

Pros:
- Free tier available
- Zero server maintenance
- Global CDN, fast everywhere
- Simple deployment (git push)

Cons:
- No edit mode (editor-server.js won't run)
- All content must be baked into the build
- No AI generation features for end users

Implementation:
1. `npm run build` creates static bundle
2. Deploy `dist/` folder to Vercel/Netlify
3. All images and data bundled at build time

**Verdict:** Good for v1 public release. Edit mode stays local-only.

### Option B: Node.js Server (Railway/Render/Fly.io)
**Best for: Full features including edit mode**

Pros:
- Full editor-server.js functionality
- Could enable edit mode for admin users
- Can add authentication later

Cons:
- Costs money (~$5-20/month)
- Need to manage persistent storage for images
- More complex deployment

Platforms:
- **Railway** - simple, good DX, $5/month hobby tier
- **Render** - free tier available (sleeps after inactivity)
- **Fly.io** - edge deployment, slightly more complex

**Verdict:** Good if you want remote editing or future user features.

### Option C: Hybrid (Static + Serverless Functions)
**Best for: Selective backend features**

Pros:
- Static hosting for main app (free)
- Serverless functions for specific features (pay per use)
- Can add AI generation as API routes

Cons:
- More complex architecture
- Need to split editor-server.js into serverless functions
- Cold start latency

Platforms:
- **Vercel** with API routes
- **Netlify Functions**
- **Cloudflare Workers**

**Verdict:** Good middle ground if you want some dynamic features.

### Recommended Approach
1. **Phase 1**: Deploy static build to Vercel/Netlify (free, immediate)
   - Public can play the character creator
   - Edit mode remains local development only
   - All content pre-generated and bundled

2. **Phase 2**: If needed, add serverless functions for:
   - Name generation (call Gemini API)
   - Analytics/telemetry
   - Future: user accounts, saved characters

3. **Phase 3**: Full backend only if:
   - You want remote editing
   - You want user-generated content
   - You need persistent user data

---

## Completed Features

### Portrait Generation
- [x] Model selector (Nano Banana Pro vs Flash Image)
- [x] Rate limit display from API headers
- [x] Batch API mode for bulk generation at 50% cost
- [x] Large batch streaming (100+ images via temp files)
- [x] Option Image Manager for non-appearance options

### Character Creator Polish
- [x] Single-select categories allow switching selections
- [x] Visual emphasis on selected options (checkmark badge, glow)
- [x] Subcategories sort alphabetically
- [x] Comma input works in traits field
- [x] Image preloading for fast tab switching
- [x] Character review page before adventure begins
- [x] Fate tier styling with visual effects and difficulty descriptions
- [x] Fixed-position tooltips on review page (mobile-friendly tap support)

### Build & Deployment
- [x] WebP image compression (86% size reduction: 750MB → 106MB)
- [x] Incremental conversion (only converts new/changed images)
- [x] Production build strips PNG/JPG from dist/ (WebP only)
- [x] Orphaned portrait cleanup (removes JSON entries for deleted images)
- [x] Automatic cleanup runs during both dev and prod builds

---

## Build System

### NPM Scripts (in src/package.json)

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (no editor) |
| `npm run dev:edit` | Start dev server + editor API server |
| `npm run build` | **Production build** - full pipeline |
| `npm run build:dev` | Dev build (cleanup only, no WebP) |
| `npm run preview` | Serve production build locally |
| `npm run convert-images` | Convert PNG/JPG to WebP |
| `npm run cleanup-portraits` | Remove orphaned portrait entries |
| `npm run cleanup-dist` | Remove PNG/JPG from dist/ |

### Production Build Pipeline (`npm run build`)
1. `cleanup-portraits` - Remove JSON entries for deleted image files
2. `convert-images` - Generate WebP versions (incremental, skips existing)
3. `tsc -b` - TypeScript compilation
4. `vite build` - Bundle app, copy public/ to dist/
5. `cleanup-dist` - Remove PNG/JPG from dist/ (keep WebP only)

### Image Path Handling
- Source images: `src/public/images/` (PNG/JPG)
- Generated WebP: alongside originals (same folder)
- In development: app uses original PNG/JPG files
- In production: `getImageUrl()` utility swaps extensions to `.webp`
- Utility location: `src/src/utils/imagePath.ts`

### Deleting Portraits
1. Delete image files from `src/public/images/portraits/`
2. Run `npm run cleanup-portraits` (or just build - it runs automatically)
3. Orphaned entries are removed from `appearanceConfig.json`

---

## Pending Improvements

### Editor Enhancements
- [ ] **Prerequisites editor** - UI for editing `requires` and `incompatibleWith` fields
- [ ] **Batch chunking** - auto-split large image requests into multiple batch jobs
- [ ] **Text description** of character in sidebar (prose summary)

---

## Commits

Commit early and often. No permission needed for commits.
