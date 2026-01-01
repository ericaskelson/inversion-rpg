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
  CLAUDE.md                    # This file
  open-dev.bat                 # Opens browser to localhost:5173
  start-server.bat             # Starts the Vite dev server

  src/                         # Vite + React + TypeScript web app
    src/
      components/
        AppearanceSelector.tsx # Multi-step wizard for Build/Skin/Hair/Portrait
        CategorySelector.tsx   # Generic option grid for most categories
        CharacterCreator.tsx   # Main character creation orchestrator
        CharacterSummary.tsx   # Sidebar showing current stats/traits
        ScenarioPlayer.tsx     # Plays through scenarios (not yet integrated)
      data/
        characterCreation.ts   # All category options (Sex, Race, Culture, etc.)
        appearanceConfig.ts    # Build/Skin/Hair options + portrait metadata
      engine/
        characterBuilder.ts    # State management, calculations, validation
        conditions.ts          # Scenario condition evaluation
      types/
        game.ts                # All TypeScript interfaces
      App.tsx                  # Main app component
      App.css                  # All styles
    public/
      images/options/          # Option card images (sex-male.png, race-*.png, etc.)
      scenarios.json           # Compiled scenario bundle

  scenarios/                   # Scenario content folders (one per scenario)
  tools/
    build-scenarios.js         # Compiles scenarios/ into scenarios.json
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
- `characterCreation.ts` - Exports `characterCreationData` with all 12 categories
- `appearanceConfig.ts` - Exports `appearanceConfig` with builds, skinTones, hairColors, portraits[]

---

## NEXT TASK: Character Options Editor

### Goal
GUI editor for character creation options, integrated into the web app with edit mode toggle.

### Plan
1. **Convert data to JSON** - Change characterCreation.ts and appearanceConfig.ts to import from JSON files
   - `src/src/data/characterCreation.json`
   - `src/src/data/appearanceConfig.json`
   - TS files become thin wrappers that import and type-assert the JSON

2. **Create editor server** - Simple Express server (~50 lines) at `tools/editor-server.js`
   - `GET /api/character-creation` - Returns characterCreation.json
   - `PUT /api/character-creation` - Writes to characterCreation.json
   - `GET /api/appearance-config` - Returns appearanceConfig.json
   - `PUT /api/appearance-config` - Writes to appearanceConfig.json
   - Runs on port 3001 (Vite is on 5173)

3. **Add Edit Mode to UI**
   - Toggle button in header: "Edit Mode: ON/OFF"
   - When ON, each option card shows Edit/Delete buttons
   - "Add Option" button at end of each category/subcategory
   - Clicking Edit opens inline form or modal with all fields
   - Changes POST to editor server immediately

4. **Update dev scripts**
   - `npm run dev` - Starts Vite only (normal mode)
   - `npm run dev:edit` - Starts both Vite and editor server

### Editor UI Needs
For each CharacterOption:
- id (auto-generated or manual)
- name (text)
- description (textarea)
- subcategory (dropdown of existing + new)
- image (file picker or text path)
- fate (number, can be negative)
- attributes (key-value pairs for strength/agility/etc)
- traits (tag list)
- requires (complex - trait/attribute/selection requirements)
- incompatibleWith (list of option IDs)
- isDrawback (checkbox)

For AppearanceConfig:
- builds, skinTones, hairColors (similar to options)
- portraits (list with build/skin/hair/sex tags)

---

## Commits

Commit early and often. No permission needed for commits.
