# Battleship Game — Bug Report

## Overview
This document describes the bugs found during testing of the Battleship game and explains how each was fixed. Testing was performed through code review and manual playthroughs in the browser.

---

## Bug 1: Direct Mutation of React State (Ship Hits)

**Severity:** High — Core game logic defect

**Description:**  
The `processAttack()` function in `gameLogic.ts` directly mutated ship objects that were part of React state. Specifically, `ship.hits.add(key)` modified the `Set` inside a ship object without creating a new object reference. Because React relies on reference equality to detect state changes, the ship status panel (showing hit counts per ship) would not reliably re-render after attacks.

**How it manifested:**  
The ship status indicators (the colored blocks under "Your Ships" / "Enemy Ships") could fail to update after hits. The game appeared to work because *other* state changes (board updates) happened to trigger re-renders that incidentally picked up the mutated data — but this was accidental, not guaranteed.

**Fix:**  
Rewrote `processAttack()` to return a new `newShips` array with immutably-updated ship objects. Each hit now creates a new `Set` via `new Set(ship.hits)` and a new ship object via spread syntax (`{ ...ship, hits: updatedHits }`). The calling code in `App.tsx` was updated to call `setEnemyShips(updatedEnemyShips)` and `setPlayerShips(updatedPlayerShips)` with the new arrays.

**Files changed:** `gameLogic.ts` (processAttack), `App.tsx` (handleAttack)

---

## Bug 2: AI Forgets Partially-Hit Ships When Sinking Another

**Severity:** Medium — AI quality defect

**Description:**  
In `updateAIAfterAttack()`, when the AI sank a ship, it cleared **all** `hitPositions` and the entire `targetQueue`. If the AI had scored hits on two different ships before sinking one, all targeting data for the second ship was lost. The AI would revert to random "hunt" mode despite having actionable hit data on an unsunk ship.

**How it manifested:**  
During games where the AI hit cells on two ships close together, sinking the first ship would cause the AI to "forget" about the second partially-hit ship and start firing randomly again — making the AI noticeably weaker.

**Fix:**  
Rewrote the `'sunk'` branch of `updateAIAfterAttack()` to only remove the sunk ship's positions from `hitPositions`. If hits remain from other ships, the AI stays in target mode and rebuilds its `targetQueue` from those remaining hits. The function now accepts an optional `sunkShipPositions` parameter to identify which positions belong to the sunk ship.

**Files changed:** `gameLogic.ts` (updateAIAfterAttack signature + logic), `App.tsx` (passes sunk ship positions)

---

## Bug 3: Dead/Unreachable Code in AI Logic

**Severity:** Low — Code quality issue

**Description:**  
In the original `updateAIAfterAttack()`, the `'sunk'` branch contained:
```typescript
aiState.hitPositions = [];
aiState.targetQueue = [];
if (aiState.targetQueue.length === 0) {  // Always true — just set to []
    aiState.mode = 'hunt';
}
```
The `if` check on line 197 was dead code — `targetQueue` was unconditionally set to `[]` on the previous line, so the condition was always true.

**Fix:**  
Eliminated the dead code as part of the Bug 2 rewrite. The new logic has clear, reachable branches for both "remaining hits exist" and "no remaining hits" cases.

**Files changed:** `gameLogic.ts`

---

## Bug 4: Ships Could Be Placed Touching Each Other

**Severity:** Medium — Game rules violation

**Description:**  
The `canPlaceShip()` function only checked that target cells were `'empty'`, but did not enforce any spacing between ships. In standard Battleship rules, ships must have at least one cell of separation (including diagonals). This allowed ships to be placed directly adjacent to each other, both during manual placement and random placement.

**How it manifested:**  
When using "Random Placement" or manually placing ships, ships could end up sharing edges or corners. This made the game easier for the attacker (finding one ship immediately reveals the boundary of another) and violated standard game rules.

**Fix:**  
Added neighbor checking to `canPlaceShip()` — for each cell of the ship being placed, all 8 surrounding cells are checked. If any neighbor contains a `'ship'` cell that isn't part of the ship currently being placed, placement is rejected. This applies to both manual and random (AI) placement.

**Files changed:** `gameLogic.ts` (canPlaceShip)

---

## Bug 5: No Keyboard Shortcut for Ship Rotation

**Severity:** Low — UX issue

**Description:**  
During the placement phase, the only way to toggle ship orientation between horizontal and vertical was to click the "Orientation" button. Most Battleship games support pressing 'R' to rotate, which is more ergonomic — especially when the mouse is positioned over the grid.

**Fix:**  
Added a `useEffect` hook that listens for the 'R' key during the placement phase and toggles orientation. Updated the button label to show "(R)" as a hint for the keyboard shortcut.

**Files changed:** `App.tsx` (useEffect for keydown, button label)

---

## Bug 6: Stale Closure in AI Turn Processing

**Severity:** High — Race condition / state consistency defect

**Description:**  
In `handleAttack()`, the AI's turn ran inside a `setTimeout` callback that captured `playerBoard` and `playerShips` from the React state closure at the time `handleAttack` was created. Since React state updates are asynchronous, these values could be stale by the time the AI's 600ms delay elapsed — particularly if multiple rapid interactions occurred.

**How it manifested:**  
The AI could read outdated board/ship state, potentially:
- Attacking a cell that was already processed
- Checking `allShipsSunk()` against stale ship data, missing a game-over condition
- The `processAttack` mutation (Bug 1) masked this bug since mutated objects were shared, but after fixing Bug 1 to use immutable updates, this would have become a visible issue.

**Fix:**  
Added `playerBoardRef` and `playerShipsRef` refs that stay synchronized with state via `useEffect` hooks. The `setTimeout` callback now reads from these refs instead of the closure, guaranteeing it always operates on the latest state.

**Files changed:** `App.tsx` (added refs, useEffects, updated setTimeout callback)

---

## Summary

| # | Bug | Severity | Category |
|---|-----|----------|----------|
| 1 | Direct mutation of React state (ship hits) | High | State management |
| 2 | AI forgets partially-hit ships on sink | Medium | AI logic |
| 3 | Dead/unreachable code in AI logic | Low | Code quality |
| 4 | Ships can be placed touching each other | Medium | Game rules |
| 5 | No keyboard shortcut for rotation | Low | UX |
| 6 | Stale closure in AI turn processing | High | Race condition |

**Total: 6 bugs found and fixed.** All fixes maintain backward compatibility with the game's existing behavior and visual design. The game has been rebuilt, lint-checked, and manually tested after all fixes were applied.
