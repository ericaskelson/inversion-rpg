# Inverse RPG - Architecture Notes

## Concept

An "inverted RPG" where the core gameplay is **character creation** rather than playing. Players invest significant time crafting interesting characters with meaningful choices, then watch those characters navigate pre-written branching scenarios. Think: CYOA books meets character fate simulator.

## Key Design Principles

1. **Character creation IS the game** - should take 30+ minutes of interesting decisions
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

Characters have two types of characteristics:

### Attributes (Numeric)
- Numeric values (may not be displayed as raw numbers to player)
- Used for deterministic threshold checks (e.g., strength > 3)
- Examples: Strength, Charisma, Cunning, etc. (TBD)

### Traits (Boolean/Tags)
- Named qualities the character has or doesn't have
- Examples: "hot-headed", "noble-born", "scarred", "silver-tongued"
- Can be gained/lost during scenarios

### How They Influence Scenarios
- **Deterministic checks** - no dice rolls, outcomes based on meeting thresholds
- **Path gating** - some choices only available with certain traits/stats
- **Branching outcomes** - same choice leads to different results based on character
- **Random availability** - some choices appear only X% of the time (rare)

## Scenario Config Schema

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
  - `chance`: random availability (0.0-1.0)
- `outcomes`: array of possible destinations, evaluated in order
  - First matching condition wins
  - `"default"` matches anything (use as fallback)
- Conditions can check traits (has/doesn't have) or attributes (comparisons)

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
