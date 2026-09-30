# V2.1 Real Battle Audio — sources and licence record

All files in this directory are Ogg Vorbis renders prepared for the browser version of Medieval Idle. No attribution is required by the underlying CC0 1.0 sources, but the full chain is recorded here so every shipped sound remains auditable.

Every looping file also has a 35 ms boundary microfade after Vorbis encoding. This removes codec-edge clicks while leaving the longer cyclic crossfade responsible for the musical/foley transition.

## Intermediate project

The source cues were taken from [`djeada/Standard-of-Iron`](https://github.com/djeada/Standard-of-Iron) at commit `e96e01e4ad7fe68d8009abfb33ed8817d738a033`. Its `tools/audio_field/battle.py` contains the reconstruction recipes and `THIRD_PARTY_LICENSES.md` documents the underlying recordings. The repository is MIT licensed, copyright © 2025 Adam Djellouli; its licence notice is reproduced below.

## Shipped files

| Medieval Idle file | Standard of Iron cue               | Original recording(s) and author                                                                                                                                                      | Licence | Transformations for V2.1                                                                                            |
| ------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| `march-1.ogg`      | `army_march_dirt_mass.ogg`         | [The Designer's Choice UCS Collection — FOOTSTEPS](https://archive.org/details/Designers-Choice-Collection-Footsteps), Nicholas A. Judy                                               | CC0 1.0 | Raised 7 dB; 350 ms cyclic crossfade; 48 kHz Vorbis q5                                                              |
| `march-2.ogg`      | `spearmen_formation_advance.ogg`   | Designer's Choice FOOTSTEPS and [MUSICAL](https://archive.org/details/Designers-Choice-Collection-Musical), Nicholas A. Judy                                                          | CC0 1.0 | Reduced 5 dB; 300 ms cyclic crossfade; 48 kHz Vorbis q5                                                             |
| `drums-loop.ogg`   | `spearmen_formation_advance.ogg`   | Designer's Choice FOOTSTEPS and MUSICAL, Nicholas A. Judy                                                                                                                             | CC0 1.0 | 180–2,200 Hz band-limit to foreground the military snare; reduced 5 dB; 300 ms cyclic crossfade; 48 kHz Vorbis q5   |
| `cavalry-loop.ogg` | `horse_gallop_close_pass.ogg`      | [Six Horses Galloping By](https://commons.wikimedia.org/wiki/File:Six_Horses_Galloping_By.ogg), Freesound Community via Pixabay                                                       | CC0 1.0 | 55 Hz high-pass; reduced 1 dB; 250 ms cyclic crossfade; 48 kHz Vorbis q5                                            |
| `horn-charge.ogg`  | `roman_war_horns_orders.ogg`       | [Hunting horn tone](https://commons.wikimedia.org/wiki/File:Hunting_horn_tone.ogg), Alon-De-Lon                                                                                       | CC0 1.0 | Kept the reconstructed three-blast order; 20 ms fade-in, 600 ms fade-out; reduced 1 dB; 48 kHz Vorbis q5            |
| `arrows-1.ogg`     | `arrows_many_overhead.ogg`         | [Designer's Choice SWOOSHES](https://archive.org/details/Designers-Choice-Collection-Swooshes), Nicholas A. Judy                                                                      | CC0 1.0 | 20 ms fade-in and 640 ms fade-out; 48 kHz Vorbis q5                                                                 |
| `arrows-2.ogg`     | `arrows_overhead_dark.ogg`         | Designer's Choice SWOOSHES, Nicholas A. Judy                                                                                                                                          | CC0 1.0 | 30 ms fade-in, 350 ms fade-out; raised 3 dB; 48 kHz Vorbis q5 (the source cue's natural 0.9 s duration is retained) |
| `impact-1.ogg`     | `roman_shield_wall_impact.ogg`     | Designer's Choice [FIGHT](https://archive.org/details/Designers-Choice-Collection-Fight) and [METAL](https://archive.org/details/Designers-Choice-Collection-Metal), Nicholas A. Judy | CC0 1.0 | Long 550 ms release; reduced 2 dB; 48 kHz Vorbis q5                                                                 |
| `impact-2.ogg`     | `gladius_shield_impacts_close.ogg` | Designer's Choice FIGHT and METAL, Nicholas A. Judy                                                                                                                                   | CC0 1.0 | 250 ms release; 48 kHz Vorbis q5                                                                                    |
| `melee-1.ogg`      | `battlefield_crowd_chaos.ogg`      | [Designer's Choice CROWDS](https://archive.org/details/Designers-Choice-Collection-Crowds), Nicholas A. Judy                                                                          | CC0 1.0 | 90 Hz high-pass, 5 kHz low-pass, reduced 5 dB; 450 ms cyclic crossfade; 48 kHz Vorbis q5                            |
| `melee-2.ogg`      | `battlefield_distant_mass_01.ogg`  | Designer's Choice CROWDS, Nicholas A. Judy                                                                                                                                            | CC0 1.0 | 80 Hz high-pass, 3.6 kHz low-pass, raised 3 dB; 400 ms cyclic crossfade; 48 kHz Vorbis q5                           |
| `result.ogg`       | `soldiers_victory_cheer.ogg`       | Designer's Choice CROWDS, Nicholas A. Judy                                                                                                                                            | CC0 1.0 | 60 ms fade-in, 1.1 s fade-out; reduced 3 dB; 48 kHz Vorbis q5                                                       |

The Standard of Iron cues are themselves layered, filtered and enveloped reconstructions from the named CC0 recordings; they are not AI-generated audio. Its source notes state that all replaced generated cues were rebuilt from CC0/public-domain material and ceilinged below full scale before distribution.

## MIT notice for Standard of Iron

> MIT License
>
> Copyright (c) 2025 Adam Djellouli
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
