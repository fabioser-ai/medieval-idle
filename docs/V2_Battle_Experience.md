# V2 — Battle Experience

V1 remains preserved on `main`. V2 is developed only on `feature/v2-battle-experience` until explicit approval.

## Product goal

Make the prototype feel like two armies approaching and colliding, rather than a configuration screen followed by a technical replay.

## 1. Pre-battle: simple first

The default flow should expose only the decisions a player understands immediately:

- choose a battle plan / army posture;
- see a compact visual summary of the army;
- press **March to Battle**.

Detailed formation, unit counts, and experience allocation remain available behind an **Advanced deployment** disclosure for players who want control. The default screen must not require percentage arithmetic.

## 2. Battlefield: distance and anticipation

The battlefield should read as a long valley between two elevated strongholds.

- widen the perceived distance between armies;
- keep each army visibly massed before contact;
- give marching enough screen time to create anticipation;
- distinguish march, acceleration/charge, collision, fighting, rout/return;
- preserve the existing deterministic battle simulation underneath the presentation.

## 3. Army representation: mass over tiny figurines

V2 may render soldiers as compact dots/marks rather than literal 20px characters.

Desired behavior:

- hundreds of soldiers should read as a formation;
- formations subtly breathe and deform while marching;
- cavalry separates from infantry and moves with greater momentum;
- archers remain readable as a rear/ranged mass;
- casualties visibly thin formations;
- collision compresses and disrupts the two masses;
- retreat/return should look different from advance.

The purpose is scale, motion and readability—not individual character art.

## 4. Soundscape

Audio should become part of the battle rhythm.

Before contact:

- distant drums;
- synchronized marching/footfalls;
- occasional horn/cornet calls;
- horse hoof rhythm when cavalry is active.

During charge/contact:

- faster hoof cadence;
- charge horn;
- arrow volleys;
- stronger impact/combat texture.

After battle:

- combat falls away;
- short victory/defeat signal;
- return march ambience.

Browser autoplay rules still apply: audio begins only after a user gesture. V2 should make that gesture natural (for example, **March to Battle**).

## 5. Dramatic timing

Presentation timing is intentionally cinematic and is not the simulation clock.

Target emotional sequence:

1. quiet preparation;
2. gates open;
3. armies emerge;
4. deliberate march;
5. drums/hooves intensify;
6. ranged volleys;
7. charge;
8. collision;
9. formation disruption and casualties;
10. result;
11. survivors return.

Playback speed controls remain available but secondary.

## 6. Guardrails

- Do not rewrite the combat domain merely to obtain visual effects.
- Keep simulation deterministic and presentation separate.
- Keep V1 deployable and untouched on `main`.
- Preserve accessibility and reduced-motion considerations.
- Maintain automated unit and browser E2E coverage.
- No merge to `main` until V2 is reviewed in-browser.
