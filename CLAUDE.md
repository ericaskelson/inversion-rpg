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

## Character System (TBD)

How character traits influence scenarios:
- Stat checks? (deterministic or probabilistic)
- Path unlocking/blocking?
- Flavor text variations?
- Combination effects?

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
