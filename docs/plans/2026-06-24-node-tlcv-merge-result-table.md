# Merge Incoming Game Records with Existing (Retain >300 Games)

## Context

When the TLCS server sends a `RESULTTABLE` dump, it streams a `CTRESET` followed by `CT:` lines. The current code in `onCTReset()` clears **everything** (`results`, `parsedResults`, `parsedGames`), then `onCT()` rebuilds `parsedGames` from the raw text. The problem: the server only returns the most recent ~300 games in the dump. Games older than 300 are lost on every refresh.

The standings crosstable (top portion of the dump) is always complete — it aggregates all player scores. Only the games list at the bottom is truncated to ~300 entries.

## Approach

Make two targeted changes in `src/game-service.ts`:

1. **In `onCTReset()`**: Stop clearing `parsedGames`. Keep the existing game records so older games survive the reset. Still clear `results` (raw string) and `parsedResults` (standings), since the standings crosstable is complete in every dump.

2. **In `onCT()` debounce callback**: Instead of replacing `parsedGames` outright, merge the incoming games into the existing array using `gameNumber` as the sole match key. Incoming data always wins for matching game numbers (constraint: "when a game result is received which matches it always correct"). Games that exist in the old array but not the incoming one are preserved (these are the >300-old games).

The merge logic:
- Build a `Map<gameNumber, GameRecord>` from the existing `parsedGames` (if any)
- For each incoming game, overwrite the map entry (incoming is authoritative)
- Convert the map back to a sorted `GameRecord[]`
- Sort by `gameNumber` ascending

## Files to Modify

- `src/game-service.ts` — the only file that needs changes

## Reuse

- `parseGames(raw: string): GameRecord[]` in `src/services/result-parser.ts` — already parses the raw CT text into game records
- `GameRecord` type in `shared/types.ts` — `{ gameNumber, white, black, result }`
- No new utility files needed; the merge logic is ~10 lines and belongs inline in the debounce callback

## Steps

- [x] **Step 1: Modify `onCTReset()`** — Remove `this.broadcast.parsedGames = null;` so existing game records survive the CT reset. Keep clearing `results` and `parsedResults` (standings are always complete in each dump).

- [x] **Step 2: Modify `onCT()` debounce callback** — Replace the line `this.broadcast.parsedGames = games;` with a merge:

  ```typescript
  // Merge incoming games into existing, keyed by gameNumber.
  // Incoming always wins for matching keys; old-only games are preserved.
  const existingMap = new Map<number, GameRecord>();
  if (this.broadcast.parsedGames) {
    for (const g of this.broadcast.parsedGames) existingMap.set(g.gameNumber, g);
  }
  for (const g of games) existingMap.set(g.gameNumber, g);
  const merged = Array.from(existingMap.values()).sort((a, b) => a.gameNumber - b.gameNumber);
  this.broadcast.parsedGames = merged;
  ```

- [x] **Step 3: Verify `saveTournamentResults` still works** — It already uses `broadcast.parsedGames ?? []` (line 55 of `tournament-results.ts`), so the non-null merged array serializes correctly.

## Verification

- **Manual test**: Start a broadcast with a tournament that has >300 games. Wait for a result refresh. Confirm that the games list (`/:port/games/json`) still contains games beyond the 300th.
- **Existing behavior**: Standings (`/:port/result-table/json`) should still refresh fully each cycle (no change there).
- **Edge case — first load**: On initial connection `parsedGames` is `null`, so `existingMap` is empty and the merge is equivalent to a straight assignment. No regression.
- **Edge case — CTRESET on fresh broadcast**: `parsedGames` is `null` or empty, merge is a no-op. No regression.
