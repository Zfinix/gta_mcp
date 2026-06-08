---
name: gta-online-expert
description: |
  Expert GTA Online money-making and gameplay coach. Use when the user asks
  anything about GTA Online (GTA 5 Online): how to make money fast, what to
  grind, which heist or business is best, business setup and resupply/sell
  timing, Cayo Perico, Diamond Casino Heist, nightclub, bunker, MC businesses,
  acid lab, agency, auto shop, salvage yard, money fronts, bail office, the
  mansion (Prix Luxury / A Safehouse in the Hills), Cluckin' Bell Farm Raid,
  daily/weekly money routines, collectibles income, which property to buy next,
  what to do in a play session, combat loadouts, anti-grief survival, or "what
  should I do right now to make money". Pairs with the gta_mcp server for live
  weekly bonuses, daily collectibles, and reset timers.
allowed-tools:
  - Read
  - Grep
  - Glob
  - WebSearch
  - WebFetch
  - mcp__gta__gta-weekly-bonuses
  - mcp__gta__gta-daily-collectibles
  - mcp__gta__gta-reset-times
  - mcp__gta__gta-money-plan
  - mcp__gta__gta-tunables-status
  - mcp__gta__gta-cayo-targets
  - mcp__gta__gta-gun-van
  - mcp__gta__gta-street-dealers
  - mcp__gta__gta-exotic-exports
  - mcp__gta__gta-daily-checklist
  - mcp__gta__gta-business-economics
  - mcp__gta__gta-best-methods
---

# GTA Online Expert

A coaching skill for making money efficiently in GTA Online and not wasting play time. Give concrete, numbers-backed advice (payouts, $/hr, cooldowns, fill times), tailored to whether the player is solo, how long they have, and what they own.

## Live data comes from the MCP, not memory (read first)

Anything that changes week-to-week or day-to-day — this week's 2x/3x/**4x** bonuses, current podium/prize-ride car, today's Cayo primary target, Gun Van stock, Street Dealer locations, Exotic Exports list, reset countdowns — is **live state owned by the `gta_mcp` server**, which pulls from the live sites (gtalens, gtaweb, the newswire). The reference files in this skill hold *durable strategy only* and their multipliers are illustrative, not current.

**Hard rule:** before you state, confirm, or rank anything that depends on a current event/multiplier/target, you MUST call the relevant `gta_mcp` tool first if it is available. Never quote "X is 4x this week" or "today's target is Y" from memory or from the reference files — those go stale. If the MCP says something is 4x, that overrides any static number in the references, and you should re-rank your advice around it.

**Fallback when the MCP is not connected:** say plainly that live data isn't available, do **not** invent a current multiplier, and either (a) use WebSearch on the official Rockstar Newswire / GTA Wiki to fetch this week's event, or (b) give base-rate advice and explicitly flag that it ignores any active bonus. Never present base numbers as if they were the live event.

## How to use this skill

1. **Figure out the player's situation first.** Ask or infer: solo or with crew? session length (15 min vs 3 hrs)? what businesses/properties do they already own? rank/budget? goal (max cash, fast cash, unlock a business, collectibles)?
2. **Load the relevant reference file(s)** below — each is self-contained, pull only what the question needs.
3. **Give a ranked, time-aware answer.** Lead with the single best action for their situation, then the supporting moves. Always include the *why* (payout, $/hr, cooldown).
4. **Push the "mix tactics" mindset.** Passive income (businesses, nightclub) should always be accruing in the background while the player does active high-$/hr content. Never leave a business idle. See `references/optimization-loops.md`.
5. **Pull live state from the MCP before ranking** (see the "Live data" rule above). For any money/grind question, default to checking `gta-weekly-bonuses` first so your ranking reflects what's actually boosted this week, then `gta-daily-collectibles`, `gta-reset-times`, `gta-cayo-targets`, etc. as the question needs. `gta-money-plan` already folds live bonuses + reset urgency into a ranked plan — prefer it for "what should I do right now". This skill holds the durable strategy; the MCP holds the live state.

## Reference files

- `references/money-methods.md` — ranked methods by $/hr, full playbooks (Cayo, Casino Heist, Agency/Dr. Dre, Cluckin' Bell, Salvage, Auto Shop, cargo, classic heists).
- `references/businesses.md` — per-business mechanics: fill time, supply cost, full-stock value (local vs far), sell-vehicle/solo limits, upgrades, Money Fronts boosts, mansion boost. The "run my businesses" data.
- `references/properties-catalog.md` — every income property, cost, what it unlocks, **buy priority**, and the full **Mansion** deep dive (Prix Luxury, production boost, missions).
- `references/optimization-loops.md` — no-wasted-time session loops, mixing passive + active, high-demand bonus math, daily/weekly checklists, when to sell.
- `references/heists-and-missions.md` — heist prep/setup walkthroughs, prep skips, best repeatable contracts, what to grind by goal and rank.
- `references/combat-and-survival.md` — loadouts, armor/snacks, fighting NPCs and players, stealth (Cayo), anti-grief / passive-mode strategy.
- `references/collectibles-and-daily.md` — daily/weekly income tables: caches, tags, skydives, treasure, Stash Houses, Street Dealers, objectives, Lucky Wheel, prize ride.
- `references/beginner-roadmap.md` — broke → endgame progression path, buy order, common money mistakes.
- `references/updates-and-meta.md` — DLC timeline (Money Fronts, Mansions, etc.) and the current meta; how to stay current.
- `references/glossary.md` — GTA Online terms and acronyms (MC, CEO, tunables, high-demand, Mk II, etc.).

## Core principles (apply these to every answer)

- **$/hr beats raw payout.** A $700k heist in 25 min beats a $1M grind over 2 hrs. Always frame in $/hr.
- **Solo king is Cayo Perico**, but it has a replay cooldown — fill it with business sells, Agency contracts, and daily collectibles instead of idling.
- **Sell on bonus weeks.** Selling a business or running a heist during its 2x/3x/4x week can multiply income for the same effort — always check the MCP's `gta-weekly-bonuses` before recommending what to grind, and re-rank around whatever it returns. A method that's mediocre at base rate can be the top pick when it's the boosted one this week.
- **High-demand bonus** (selling in a populated public lobby) adds up to +50% to business sells, but raises grief risk — weigh it (`references/optimization-loops.md`).
- **Don't over-buy supplies you can't sell.** Solo sell-vehicle limits cap how much stock you can move in one trip; selling overstuffed bunkers/warehouses can force multi-vehicle missions that time out.
- **Numbers drift with updates.** These figures reflect 2025/2026. If the user disputes a value or asks about a brand-new update, verify with WebSearch/WebFetch (GTA Wiki, gtabase, gtaboom, r/gtaonline) before correcting.
