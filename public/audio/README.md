# Prototype audio

No downloaded samples, proprietary clips, or external audio assets are required.
`src/game/BattleAudio.ts` synthesizes seven persistent shared voices using native
Web Audio oscillators and gain envelopes:

1. Sawtooth gate creak.
2. Triangle footstep pulse; louder/faster during charge.
3. Square hoofbeat pulse scaled by living cavalry.
4. High sawtooth arrow release, scaled by visible projectile density.
5. Low triangle arrow-impact pulse.
6. Modulated square melee layer, scaled by attack density.
7. Sine result sting, pitched for player victory, defeat, or draw.

The renderer supplies phase/time/counts; audio has no independent timer. Voices
are shared regardless of troop count, capped at seven oscillators and seven
gain nodes. Gain automation is canceled before replacement to avoid queued
envelopes growing across frames. All nodes stop/disconnect at completed return
or scene shutdown, and their AudioContext closes. A subsequent battle creates
a fresh context from its own To Battle click. Pause suspends the context;
playback-speed buttons resume it. Audio is never created during page load or
mere scenario selection. Missing Web Audio and rejected autoplay/device access
degrade to silent playback.

These are deliberately synthetic placeholder sounds, not realistic samples.
Actual sound quality, browser autoplay behavior, Safari support, background-tab
behavior and physical-device latency remain UNVERIFIED. See
`docs/PrototypePlaytest.md` before claiming audio acceptance.
