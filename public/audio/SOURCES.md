# V2 sample audio library

V2 replaces the oscillator-only battle feel with a layered sample soundscape.

## License rule

Prefer CC0/public-domain assets. Every shipped sample must have its original source URL, author, license, and any required attribution recorded here before release.

## Candidate sources

- Horse gallop — BigSoundBank / La Sonothèque sound 611 — Joseph SARDIN — CC0 — https://bigsoundbank.com/horse-gallop-s0611.html
- Footsteps — OpenGameArt, Fantozzi's Footsteps — CC0 — https://opengameart.org/content/fantozzis-footsteps-grasssand-stone
- General foley — OpenGameArt, Sound Effects Pack by OwlishMedia — CC0 — https://opengameart.org/content/sound-effects-pack
- RPG/medieval foley — OpenGameArt, 50 RPG sound effects by Kenney — CC0 — https://opengameart.org/content/50-rpg-sound-effects
- Battle weapon candidates — OpenGameArt, Battle Sound Effects — verify exact per-file license before shipping — https://opengameart.org/content/battle-sound-effects

## Runtime design

Samples are grouped by role rather than by soldier: march, drums, cavalry, horn, arrows, collision impacts, melee texture and result signal.
Playback should use pooled Web Audio sample voices, slight gain/rate variation and phase-driven mixing. The existing oscillator engine remains a fallback until the sample bank is complete.