# Inverse RPG

An "inverted RPG" where the core gameplay is **character creation** rather than playing. Players invest significant time crafting interesting characters with meaningful choices, then watch those characters navigate pre-written branching scenarios.

## Quick Start

### Development (with editor)
```
dev-server.bat    # Start server with editor support
dev-open.bat      # Open http://localhost:5173
```

### Production (test deployment)
```
prod-build.bat    # Build optimized version
prod-server.bat   # Serve production build
prod-open.bat     # Open http://localhost:4173
```

## Deployment

### To deploy to GitHub Pages (or any static host):

1. Run `prod-build.bat` (or `cd src && npm run build`)
2. Upload the `src/dist/` folder
3. Done!

The production build is ~106 MB (images converted to WebP).

### What gets deployed
- `dist/index.html` - The app
- `dist/assets/` - Bundled JS/CSS
- `dist/images/` - WebP images only (PNG/JPG stripped)

## Project Structure

```
inverse-rpg/
  src/                    # Main app (Vite + React + TypeScript)
    dist/                 # Production build output ← DEPLOY THIS
    public/images/        # Source images (PNG/JPG + generated WebP)
    src/                  # React source code
      data/               # JSON config files (editable via UI)
      components/         # React components
  tools/                  # Build scripts
  scenarios/              # Scenario content (not yet implemented)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/src/data/characterCreation.json` | All character options |
| `src/src/data/appearanceConfig.json` | Appearance options + portrait registry |
| `src/public/images/portraits/` | Portrait images (gitignored) |
| `src/public/images/options/` | Option card images |

## Batch Files

| | Build | Server | Browser |
|---|-------|--------|---------|
| **Dev** | `dev-build.bat` | `dev-server.bat` | `dev-open.bat` |
| **Prod** | `prod-build.bat` | `prod-server.bat` | `prod-open.bat` |

## Common Tasks

### Edit character options
1. Run `dev-server.bat`
2. Open site, toggle "Edit Mode: ON" in header
3. Edit/add/delete options directly in the UI
4. Changes save immediately to JSON files

### Generate portraits
1. Set `GEMINI_API_KEY` environment variable
2. Run `dev-server.bat`
3. Enable Edit Mode, go to Appearance → Portrait
4. Use Portrait Manager to generate/review portraits

### Delete unwanted portraits
1. Delete image files from `src/public/images/portraits/`
2. Run `prod-build.bat` (auto-cleans orphaned JSON entries)
   - Or manually: `cd src && npm run cleanup-portraits`

### Test production build locally
```
prod-build.bat    # Creates optimized dist/
prod-server.bat   # Serves at localhost:4173
```

## Quirks & Gotchas

### Images
- **Source images** are PNG/JPG in `public/images/`
- **WebP versions** are generated alongside them during build
- **Production** uses WebP only (86% smaller)
- **Development** uses original PNG/JPG (for editor workflow)
- **Portraits are gitignored** - they're generated locally via Gemini API

### Build modes
- `npm run build` = **Production** (WebP conversion + cleanup)
- `npm run build:dev` = **Development** (no WebP, faster)

### Ports
- **5173** = Development server (Vite)
- **4173** = Production preview (Vite preview)
- **3001** = Editor API server (only in dev:edit mode)

### The `src/src/` folder
Yes, it's `src/src/`. The outer `src/` is the Vite project root, the inner `src/` is the React source. This is Vite's default structure.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GEMINI_API_KEY` | Required for portrait/option image generation |

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Plain CSS (no framework)
- **Image Generation**: Google Gemini API (Nano Banana)
- **Build**: Vite + custom Node.js scripts
