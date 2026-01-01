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

## File Structure

```
inverse-rpg/
  src/                  # Web app source
  scenarios/            # Scenario content folders
  tools/                # Python content generation scripts
  build/                # Build output
  CLAUDE.md             # This file
```

## Commits

Commit early and often. No permission needed for commits.
