# Developer Context: Demons Despair RPG Manager

## Overview
This application is a digital character sheet and Virtual Tabletop (VTT) manager for the "Demons Despair" RPG. It synchronizes character stats, inventory, and combat actions between the player's character sheet and the VTT board.

## Technology Stack
- **Frontend**: React (SPA), Vite, TypeScript.
- **Styling**: Tailwind CSS.
- **State Management**: React state, with complex synchronization between the sheet and VTT.
- **Backend/Persistence**: Firebase (Firestore, Auth).
- **Core Rules Engine**: Modular rule files located in `src/rules/`.

## Architectural Principles
1.  **Immutable State Updates**: All state updates (especially nested objects like `magias` or `inventory`) MUST use functional updates (`map`, spread syntax) to ensure reactivity and persistency. Direct mutation of state (e.g., `newMags[idx].nome = val`) will break the UI update cycle.
2.  **VTT/Sheet Sync**: Combat logic (`src/components/VTTBoard.tsx`) must mirror the formulas in `SYSTEM_RULES.md` and `src/rules/`. Changes to combat stats on the sheet MUST be reflected in the VTT resolution.
3.  **Scalability Rules**: Respect the scaling multipliers defined in `rulesConfig.json` (`0, D, C, B, A`).

## Critical Files & Directories
- `SYSTEM_RULES.md`: The source of truth for all game mechanics.
- `src/rules/`: Logic for combat, proficiencies, inventory, status effects, and survival.
- `src/App.tsx`: Main UI entry point, character sheet logic.
- `src/components/VTTBoard.tsx`: Combat engine and VTT logic.
- `package.json`: Contains versioning and dependencies.

## Development Workflow
1.  **Rules First**: Update `SYSTEM_RULES.md` before changing logic in `src/rules/`.
2.  **Consistency**: Propagate changes to `App.tsx` (Sheet) and `VTTBoard.tsx` (Combat) simultaneously.
3.  **Versioning**: Bump the version in `package.json` for every significant feature or bug fix.
4.  **Verification**: Always run `compile_applet` after changes.
