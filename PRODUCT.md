# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Nuxt 4, Nuxt UI v4, TypeScript, Clerk authentication, Cloudflare Pages, Cloudflare D1, and a separate Cloudflare Durable Object Worker bound to Pages for authoritative match rooms and WebSockets.

## Users

Friends and family who want to play private multiplayer games together online. A user first needs an approved Clerk account, then joins individual matches through links shared by a host.

## Product Purpose

Mind Boggling is an invite-only online multiplayer game platform for private game sessions. Boggle is the MVP game. UNO and Farkle are planned for v2 and are not part of the MVP. Success means an approved user can quickly create or join a private match, play in sync with people they know, see trustworthy results, and revisit past scores.

## Positioning

One private place for recurring friends-and-family game nights: platform membership is controlled through Clerk invitations, while lightweight match links let any approved user join a specific game without public rooms or match discovery.

## Operating Context

- A platform administrator sends Clerk invitations to people allowed to access the application.
- Platform invitations are managed in the Clerk dashboard; the MVP has no application-owned administrator screen.
- An authenticated user chooses a game and creates a private match.
- The host shares a match invite link through an external channel.
- Any user with a valid approved account can join that match through the link.
- Players gather in a lobby, play synchronously, view the final scoreboard, and can revisit match-summary history later.
- Users can maintain a friendly display name and change their password through Clerk-backed account management.

## Capabilities and Constraints

- The product is online, multiplayer, and invite-only at both the platform and match levels.
- Clerk owns identity and platform admission; the application owns match invitations, roles, membership, state, and scoring.
- Boggle is the first game, not the platform architecture. Shared platform systems must remain independent of Boggle rules and UI.
- UNO and Farkle are planned v2 modules. They must use the same platform contracts and remain absent from the MVP catalog until production-ready.
- Matches have a scoreboard, and players should have durable match-summary history.
- Match history is visible only to users who participated in that match.
- A user can set a non-unique friendly display name through the Clerk API. Password changes remain owned by Clerk.
- The initial Boggle match is intended for two to eight players with server-authoritative state and scoring.
- A Boggle host can choose a 4 × 4, 5 × 5, or 6 × 6 board; a 3, 4, or 5 minute round; and a minimum valid word length of 2, 3, or 4 characters.
- A Boggle host can choose 1–5 rounds; the default is 3.
- Duplicate words score zero for every player who submitted them.
- During play, users see opponents' word counts only. Opponent words and final scores appear after round finalization.
- A match invite link is reusable by approved platform users until the host revokes it, the match starts, or the player limit is reached.
- Spectators, host-configurable rules, and detailed-result retention remain open decisions.
- The MVP language is US English (`en-US`). More languages may be added later, but no partial locale or language switcher is part of the MVP.
- Desktop web is the required MVP form factor. Mobile support is desirable but is not a launch requirement.
- The Nuxt application is hosted on Cloudflare Pages. D1 stores relational platform/history data, while a separately deployed Durable Object Worker coordinates each active match.

## Brand Commitments

The working product name is Mind Boggling. No final logo, visual identity, palette, typography, or external design references have been supplied.

## Evidence on Hand

The repository contains a Nuxt 4 and Nuxt UI starter implementation. There are no approved brand assets, user research artifacts, testimonials, benchmarks, or production game data. Future design work must not fabricate commercial claims.

## Product Principles

- Private by default: no public match directory and no access outside approved users and valid match membership.
- Fast gathering: starting and joining a match should feel lighter than organizing the game night itself.
- Trust the result: shared state, timers, validation, and scores are server authoritative.
- Familiar across games: identity, invitations, lobby behavior, connection recovery, and score history remain consistent as games are added.
- Game-specific where it matters: each game owns the interaction and rules that make it distinctive.
