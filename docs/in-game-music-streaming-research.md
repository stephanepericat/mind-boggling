# In-game music streaming research

**Researched:** August 16, 2026  
**Project context:** Nuxt 4 browser client on Cloudflare Pages, with one Cloudflare Durable Object and WebSocket channel per match.

## Executive recommendation

Do **not** accept a YouTube URL and extract, proxy, or play only its audio. Although tools can discover YouTube media streams, that design conflicts with YouTube's current developer policies, is brittle when YouTube changes delivery, and transfers copyright and abuse risk to this application.

There are two defensible product choices:

1. **Recommended:** build a small, rights-cleared music catalog. Store audio in Cloudflare R2, play it directly in each browser with `HTMLAudioElement`, and send only track state and timestamps through the existing match Durable Object. This gives the best UX, synchronization, reliability, and control.
2. **Optional YouTube watch-along:** allow a host to paste a YouTube URL, but render the official, visible YouTube IFrame player with its normal video, controls, branding, and ads. Treat this as a video-player integration, not an audio source. It will not synchronize reliably enough to be the primary shared soundtrack.

For a fast proof of concept, implement option 1 with two or three audio files for which the project has explicit game/web playback rights. Do not begin with arbitrary remote URLs.

## Can a pasted YouTube link supply in-game audio?

### Technically

A YouTube URL can be parsed into a video ID. The official [YouTube IFrame Player API](https://developers.google.com/youtube/iframe_api_reference) can then load the video, play or pause it, change volume, and seek. The browser receives the media from YouTube; this application's server does not need to relay the stream.

Unofficial download/extraction tools can also discover a video's current audio rendition and expose it to an `<audio>` element. That is not a stable API: URLs are temporary, formats and signatures change, videos can be region-, age-, account-, or embed-restricted, and ads and rights controls are bypassed or disrupted.

### Under YouTube's current policies

Audio extraction is not a viable product design. YouTube's [Developer Policies](https://developers.google.com/youtube/terms/developer-policies) prohibit API clients from:

- separating, isolating, or modifying the audio or video components;
- promoting the audio or video component separately;
- playing content from a background player that is not displayed on the page, tab, or screen the user is viewing;
- interfering with the player or advertisements.

YouTube's own [policy compliance guide](https://developers.google.com/youtube/terms/developer-policies-guide) specifically calls out offering separate audio and background play as disallowed patterns. Therefore, using `yt-dlp`, a third-party conversion service, an Invidious-like endpoint, a Cloudflare Worker, or a server process to turn a YouTube link into an audio URL should be rejected even if a prototype works.

The official embed is possible only as an audiovisual player. YouTube's [minimum functionality rules](https://developers.google.com/youtube/terms/required-minimum-functionality) require an embedded player viewport of at least 200 by 200 pixels, recommend 480 by 270 for 16:9, require the player to be visible before automatic playback, and forbid obscuring it or its controls. The host and participants must be able to see and use the real player.

### Practical limitations of a compliant YouTube embed

- Audible autoplay is commonly blocked until each participant interacts with the page. The IFrame API exposes `onAutoplayBlocked`, but cannot override browser policy.
- Different participants can receive different ads, restrictions, buffering, or errors, so a shared timestamp does not produce a shared listening position.
- A video may forbid embedding, disappear, become private, or be unavailable in a participant's region.
- The player takes meaningful screen space and must not be hidden behind the game UI.
- Loading the embed shares playback/context data with YouTube. A consent or privacy disclosure may be appropriate; autoplay increases collection on page load.
- YouTube playback should not be expected to continue when the game is no longer the visible page or tab.

### If the project still wants the compliant embed

Call the feature **Watch together**, not “stream YouTube audio.” Accept only well-formed `https` URLs on known YouTube hosts, extract the video ID with the `URL` API, and reject everything else. Render one persistent official IFrame player in the room, at a compliant visible size, with `enablejsapi=1` and the exact application origin. Preserve controls, branding, links, related content, and ads. Require each participant to press an explicit play/unmute control and handle `onAutoplayBlocked` and normal player errors.

The Durable Object may distribute the selected video ID and a desired start position, but each client should be allowed to recover independently. Do not promise tight synchronization and do not proxy media URLs through Pages or Workers.

## Alternatives

| Option | Paste/link UX | Shared sync | Account dependency | Policy/rights fit | Recommendation |
| --- | --- | --- | --- | --- | --- |
| Rights-cleared files on R2 | Select a catalog track; admin can ingest owned files | Good | None | Good when licenses are recorded | **Best choice** |
| Allowlisted direct audio URLs | Paste a pre-approved MP3/AAC URL | Good for seekable files | None | Depends entirely on source and license | Useful for a controlled prototype |
| Licensed live radio stream | Select an approved station/stream | Everyone hears roughly the same live feed; seeking is usually unavailable | None | Requires station permission/terms review | Good optional “radio mode” |
| Visible YouTube IFrame | Paste a YouTube link | Poor because ads and availability differ | Sometimes | Allowed only as the official visible audiovisual experience | Optional watch-along only |
| SoundCloud | Paste a SoundCloud link/widget | Technically controllable | API credentials for custom integrations | SoundCloud says mixing API content into games is generally not allowed without all relevant licenses | Do not use as a general game soundtrack source |
| Spotify Web Playback SDK | Paste/resolve a Spotify URI | Not suitable for a synchronized room broadcast | Each listener needs authorization and Premium | Spotify prohibits synchronization with visual media and non-interactive broadcasting | Reject for shared in-game music |
| Apple Music MusicKit | Select Apple Music catalog content | Each client is an independent subscriber session | Apple Music authorization/subscription | Technically available on web, but rights, product fit, and per-user auth need dedicated review | Consider only for personal, unsynchronized playback |

SoundCloud's [public API guidance](https://help.soundcloud.com/hc/en-us/articles/115003446727-SoundCloud-public-APIs) explicitly lists mixing music into games as an unavailable common use case. Its [API terms](https://developers.soundcloud.com/docs/api/terms-of-use) require the relevant synchronization and public-performance rights. While its [Widget API](https://developers.soundcloud.com/docs/api/html5-widget) exposes play, pause, load, and seek controls, those controls do not create the required music rights.

Spotify's [Web Playback SDK reference](https://developer.spotify.com/documentation/web-playback-sdk/reference) requires a valid Premium user and states that Spotify content may not be synchronized with visual media or used for non-interactive broadcasting. Apple says [MusicKit on the Web](https://developer.apple.com/musickit/) can stream Apple Music in a website after authorization, but this is better suited to a participant's personal player than a host-controlled room soundtrack.

## Recommended architecture for Mind Boggling

### Media delivery

Store licensed MP3 and/or AAC files in an R2 bucket exposed through a production custom domain such as `media.example.com`. Cloudflare recommends a custom domain for production R2 delivery and caching; `r2.dev` is intended for development. Configure a narrow CORS policy for the production application origin and localhost. Cloudflare's [R2 public bucket documentation](https://developers.cloudflare.com/r2/buckets/public-buckets/) covers custom-domain caching, and its [CORS documentation](https://developers.cloudflare.com/r2/buckets/cors/) describes browser access.

Do not put a growing catalog in `public/`. Cloudflare Pages limits an individual static asset to 25 MiB and recommends R2 for larger files, according to the [Pages limits](https://developers.cloudflare.com/pages/platform/limits/).

The browser should request audio directly from the media domain. A Pages Function or Durable Object should never sit in the byte path. It adds cost and failure modes, prevents efficient CDN delivery, and is unnecessary for public catalog tracks.

### Catalog and rights records

Expose stable track IDs, not user-provided playback URLs, to the match protocol. A minimal record is:

```ts
interface MusicTrack {
  id: string
  title: string
  artist: string
  durationMs: number
  sourceUrl: string
  artworkUrl?: string
  licenseId: string
  enabled: boolean
}
```

Keep a rights ledger outside the public projection with the source agreement/license, permitted territories, game/web synchronization rights, public-performance obligations, attribution text, effective dates, and proof of purchase. A Creative Commons label alone is not always sufficient: confirm the exact license, attribution requirements, and that the uploader owns all rights.

For the first version, the catalog can be a typed file in the repository. Move it to D1 only when non-developer catalog management is needed.

### Authoritative room state

Music is a platform capability shared by future games, so keep it out of Boggle's rules and settings. Add optional music state to the match room and participant projection:

```ts
interface MatchMusicState {
  trackId: string
  status: 'playing' | 'paused'
  startedAt: number       // authoritative server epoch milliseconds
  pausedPositionMs?: number
  revision: number
}
```

Add host-only, idempotent platform commands such as:

```ts
type MusicCommand =
  | { type: 'music.select'; idempotencyKey: string; trackId: string }
  | { type: 'music.play'; idempotencyKey: string }
  | { type: 'music.pause'; idempotencyKey: string }
```

The Durable Object validates that the actor is the host and that `trackId` exists in the server-side allowlist. It updates state and uses the existing snapshot broadcast. It does not fetch, inspect, or relay the audio file.

### Client playback and synchronization

Create a client-only `useMatchMusic` composable that owns one `HTMLAudioElement` for the room. The browser's native media element can stream and seek in remote audio without loading the whole track into memory. MDN documents `<audio>` behavior and seeking through `currentTime` in its [audio delivery guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Audio_and_video_delivery).

On a play state, compute:

```text
desiredPositionMs = estimatedServerNow - startedAt
estimatedServerNow = Date.now() + serverOffset
```

Use the existing `serverOffset` from `useMatchRealtime`. Seek on initial load, reconnect, track revision, or material drift (for example, greater than 750 ms). Avoid continuously seeking for tiny differences; this is background music, not rhythm-game audio. Recheck every 10–15 seconds and when the tab becomes visible. If a track ends, the host or server can select the next catalog item and publish a new revision.

Every participant needs an **Enable music** gesture because browsers generally block audible autoplay. The [browser autoplay guide](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay) recommends detecting a rejected `play()` promise and presenting a user control. Volume and mute are personal preferences and should remain local (for example, in `localStorage`); they must never be synchronized by the host.

The existing countdown sound should remain an independent effect. Consider locally ducking music volume during the final countdown and restoring it afterward, while preserving the participant's chosen volume.

## Security, privacy, and reliability requirements

- Never fetch an arbitrary participant-supplied URL from a Worker or Durable Object. That creates server-side request forgery and resource-exhaustion risk.
- Do not treat a successful `HEAD` request or audio MIME type as proof of rights.
- Prefer catalog IDs and a server-side allowlist. If approved direct URLs are supported later, require `https`, exact host allowlisting, a maximum URL length, and no embedded credentials.
- Set a restrictive Content Security Policy `media-src` containing only the application/media domains. Add YouTube frame/script origins only if the visible embed ships.
- Return correct `Content-Type`, `Content-Length`, cache headers, and byte-range behavior from the media origin so seeking and reconnect recovery work across browsers.
- Show loading, blocked-autoplay, unavailable-track, and reconnect states without blocking gameplay.
- Pause or release the audio element when leaving the room. Do not let stale rooms keep playing.
- Do not log full signed media URLs or user tokens. Catalog IDs are enough for telemetry.
- Measure play failures, time-to-first-audio, buffering, and drift corrections, but do not make music availability part of match correctness.

## Suggested delivery plan

### Phase 1: rights-cleared local proof of concept

1. Choose two or three tracks with documented rights for browser-game use.
2. Initially serve small files from `public/music/` only if each is below the Pages 25 MiB asset limit; otherwise start directly with R2.
3. Add the catalog, `MatchMusicState`, host commands, and projection.
4. Add a compact room player with enable/mute, personal volume, track metadata, and host play/pause/select controls.
5. Test Chrome, Safari, Firefox, iOS Safari, reconnects, route changes, slow networks, blocked autoplay, and simultaneous countdown effects.

### Phase 2: production media delivery

1. Put masters/encodes in R2 behind a custom media domain and cache them.
2. Configure exact-origin CORS and `media-src` CSP.
3. Add catalog administration and rights-expiration handling.
4. Add playlists/shuffle and bounded drift correction if users value them.

### Phase 3: optional provider modes

Only after the native catalog is stable, evaluate either an approved live-radio source or the visible YouTube watch-along. Keep provider adapters separate from the core music state because seekability, authorization, errors, and policy constraints differ substantially.

## Acceptance criteria for the recommended MVP

- No third-party or arbitrary URL can cause the server to fetch media.
- Only the host can choose or control the shared track.
- Joining/reconnecting participants begin close to the room's current position after explicitly enabling audio.
- A participant can mute or change volume without affecting anyone else.
- Music failure never pauses, ends, or corrupts a match.
- All shipped tracks have a recorded license/rightsholder and game/web usage evidence.
- Mobile browsers show a clear enable-audio state instead of silently failing.
- No YouTube audio is extracted, proxied, hidden, or played in the background.

## Bottom line

Passing a YouTube link into an official visible video embed is possible. Passing that link into an audio-only in-game streamer is not an acceptable or durable integration. For Mind Boggling, a rights-cleared R2 catalog plus client-side `<audio>` playback fits the current Cloudflare architecture cleanly and is the most reliable path to a synchronized shared soundtrack.

This document is a technical and product-policy assessment, not legal advice. Obtain legal review before shipping third-party commercial music or operating in jurisdictions with public-performance or synchronization licensing requirements.
