# Medieval Idle Combat Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable Unity prototype in which two configured medieval armies leave opposing gates, descend hills, accelerate near contact, and fight automatically until only one army has living soldiers.

**Architecture:** Keep the deterministic combat simulation in plain C# with no Unity scene dependencies. Unity-facing presenters consume simulation snapshots to animate pooled pixel-art units, allowing rules to be tested quickly and visuals to change without changing outcomes. The first slice uses one battlefield, four unit classes, five formation slots, four experience tiers, persistent survivors, and local JSON saves.

**Tech Stack:** Unity 6, C#, Unity 2D, Unity UI Toolkit, Unity Test Framework/NUnit, Input System, Git, GitHub, Xcode for later iPhone builds.

**Spec:** `Medieval_Idle_Game_Design_v1.md`, especially sections 3–7, 10–12, 16, 18–23.

## Global Constraints

- Initial platform: iPhone; landscape orientation only.
- Visual style: low-resolution chunky pixel art, hard edges, limited palette, nearest-neighbor scaling.
- Initial internal reference resolution: 480 × 270.
- Ordinary medieval armies only; no heroes, magic, monsters, special weapons, or paid power.
- Battle input ends when deployment is confirmed; pause, camera, and speed controls may not alter the result.
- Every deployed unit physically exits its gate, marches downhill in formation, and accelerates near contact.
- Victory is last-army-standing; no retreat, surrender, revival, or prisoners.
- Units: infantry, archers, spearmen, cavalry.
- Formation slots: front, middle, rear, left flank, right flank.
- Experience tiers: recruit, trained, veteran, elite.
- Soft counters, experience, quantity, formation, and terrain all affect combat.
- First prototype terrain: plains only.
- Deployed casualties remain dead; survivors retain experience.
- No map, scouts, ranking, advertisements, purchases, accounts, server, or multiplayer in this plan.
- Simulation must be deterministic for a recorded integer seed.
- All game-domain source files remain independent of `MonoBehaviour` unless explicitly identified as a presenter or view.

---

## Planned File Structure

```text
MedievalIdle/
├── Assets/
│   ├── Art/Prototype/
│   │   ├── Units/
│   │   ├── Battlefield/
│   │   └── UI/
│   ├── Audio/Prototype/
│   ├── Scenes/
│   │   └── CombatPrototype.unity
│   ├── Scripts/
│   │   ├── Domain/
│   │   │   ├── ArmyTypes.cs
│   │   │   ├── ArmyDeployment.cs
│   │   │   ├── CombatRules.cs
│   │   │   ├── BattleSimulation.cs
│   │   │   ├── BattleEvents.cs
│   │   │   └── SurvivorProgression.cs
│   │   ├── Application/
│   │   │   ├── BattleController.cs
│   │   │   ├── BattlePhaseMachine.cs
│   │   │   └── PrototypeSaveStore.cs
│   │   ├── Presentation/
│   │   │   ├── UnitView.cs
│   │   │   ├── UnitViewPool.cs
│   │   │   ├── BattlePresenter.cs
│   │   │   ├── BattleCameraController.cs
│   │   │   └── BattleAudioController.cs
│   │   └── UI/
│   │       ├── DeploymentScreen.cs
│   │       └── BattleControls.cs
│   ├── Settings/
│   └── Tests/
│       ├── Shared/
│       │   └── TestFixtures.cs
│       ├── EditMode/
│       │   ├── ArmyDeploymentTests.cs
│       │   ├── CombatRulesTests.cs
│       │   ├── BattleSimulationTests.cs
│       │   ├── SurvivorProgressionTests.cs
│       │   └── PrototypeSaveStoreTests.cs
│       └── PlayMode/
│           ├── BattleFlowTests.cs
│           └── BattlePresentationTests.cs
├── Packages/
│   └── manifest.json
└── ProjectSettings/
```

---

### Task 1: Unity Project and Automated Test Harness

**Files:**
- Create: `MedievalIdle/Assets/Scripts/MedievalIdle.Domain.asmdef`
- Create: `MedievalIdle/Assets/Scripts/MedievalIdle.Runtime.asmdef`
- Create: `MedievalIdle/Assets/Tests/EditMode/MedievalIdle.EditModeTests.asmdef`
- Create: `MedievalIdle/Assets/Tests/PlayMode/MedievalIdle.PlayModeTests.asmdef`
- Modify: `MedievalIdle/Packages/manifest.json`
- Modify: `MedievalIdle/ProjectSettings/ProjectSettings.asset`

**Interfaces:**
- Produces: compile boundaries for domain, runtime, EditMode tests, and PlayMode tests.
- Produces: a Unity 2D project locked to landscape with Unity Test Framework available.

- [ ] **Step 1: Create the Unity project and Git repository**

Use Unity Hub to create a Unity 6 Universal 2D project named `MedievalIdle` in a new Git repository. Add Unity's standard `.gitignore` before the first editor launch.

- [ ] **Step 2: Configure mobile presentation**

In Player Settings set default orientation to Landscape Left and allow Landscape Right. Disable portrait orientations. Configure a Pixel Perfect Camera reference resolution of 480 × 270, Crop Frame X/Y enabled, Upscale Render Texture enabled, and Point filtering for prototype sprites.

- [ ] **Step 3: Add test and input packages**

Ensure `Packages/manifest.json` includes Unity Test Framework, Input System, 2D Pixel Perfect, and UI Toolkit packages compatible with the selected Unity 6 editor.

- [ ] **Step 4: Create assembly definitions**

Set `MedievalIdle.Domain` to no Unity-specific references. Set `MedievalIdle.Runtime` to reference Domain. Set EditMode tests to reference Domain and Runtime with `optionalUnityReferences: ["TestAssemblies"]`; set PlayMode tests to reference all runtime assemblies with the same test option.

- [ ] **Step 5: Run the empty test suites**

Run EditMode and PlayMode tests in Unity Test Runner.

Expected: both suites complete with zero failures and the project has no compiler errors.

- [ ] **Step 6: Commit**

```bash
git add MedievalIdle
git commit -m "chore: initialize Unity combat prototype"
```

---

### Task 2: Army Domain Model and Deployment Validation

**Files:**
- Create: `MedievalIdle/Assets/Scripts/Domain/ArmyTypes.cs`
- Create: `MedievalIdle/Assets/Scripts/Domain/ArmyDeployment.cs`
- Create: `MedievalIdle/Assets/Tests/Shared/TestFixtures.cs`
- Create: `MedievalIdle/Assets/Tests/EditMode/ArmyDeploymentTests.cs`

**Interfaces:**
- Produces: `UnitType`, `ExperienceTier`, `FormationSlot`, `ArmySide`, `UnitCohort`, `FormationGroup`, `ArmyDeployment`.
- Produces: `ArmyDeployment.Validate()` returning `IReadOnlyList<string>`.
- Produces: `ArmyDeployment.TotalLivingUnits` and `ArmyDeployment.GetCount(UnitType, ExperienceTier)`.
- Produces test builders `TestArmies.Blue()`, `Red()`, `Single(...)`, `OfSize(int)`, `TestResults.WithTenVeteransAndThreeSurvivors()`, `WithSingleRecruitSurvivor(int)`, and `TestSaves.First()`, `Second()`, `WithEliteInfantry(int)` in `TestFixtures.cs`.

- [ ] **Step 1: Write failing deployment tests**

```csharp
[Test]
public void Deployment_RejectsNegativeCohortCount()
{
    var deployment = ArmyDeployment.Create("Blue", ArmySide.Left,
        new FormationGroup(FormationSlot.Front,
            new UnitCohort(UnitType.Infantry, ExperienceTier.Recruit, -1)));

    Assert.That(deployment.Validate(), Does.Contain("Cohort count cannot be negative."));
}

[Test]
public void Deployment_CountsUnitsAcrossExperienceTiers()
{
    var deployment = ArmyDeployment.Create("Blue", ArmySide.Left,
        new FormationGroup(FormationSlot.Front,
            new UnitCohort(UnitType.Infantry, ExperienceTier.Recruit, 80),
            new UnitCohort(UnitType.Infantry, ExperienceTier.Veteran, 20)),
        new FormationGroup(FormationSlot.Rear,
            new UnitCohort(UnitType.Archer, ExperienceTier.Trained, 30)));

    Assert.That(deployment.TotalLivingUnits, Is.EqualTo(130));
    Assert.That(deployment.GetCount(UnitType.Infantry, ExperienceTier.Veteran), Is.EqualTo(20));
}
```

- [ ] **Step 2: Run tests and verify failure**

Run EditMode tests filtered to `ArmyDeploymentTests`.

Expected: FAIL because domain types do not exist.

- [ ] **Step 3: Implement immutable domain records**

Use enums for the four unit types, four experience tiers, five formation slots, and two sides. `UnitCohort` rejects mutation after construction. `FormationGroup` exposes read-only cohorts. `ArmyDeployment.Create` copies input collections so UI edits cannot mutate an active battle.

- [ ] **Step 4: Implement validation**

Validation must reject blank kingdom names, negative cohort counts, duplicate formation slots, and cohorts containing an undefined enum value. Empty slots are allowed; an army with zero total deployed units is invalid.

- [ ] **Step 5: Run tests**

Expected: all `ArmyDeploymentTests` pass.

- [ ] **Step 6: Add deterministic shared test fixtures**

Create static builders in `TestFixtures.cs`. `TestArmies.Blue()` and `Red()` must return fixed valid deployments; `Single(...)` and `OfSize(int)` build one-class armies; `TestResults` builds explicit survivor event streams; `TestSaves` builds equality-comparable save DTOs. Keep fixture values literal and deterministic so later tests never depend on random setup.

- [ ] **Step 7: Commit**

```bash
git add MedievalIdle/Assets/Scripts/Domain MedievalIdle/Assets/Tests/Shared/TestFixtures.cs MedievalIdle/Assets/Tests/EditMode/ArmyDeploymentTests.cs
git commit -m "feat: model army deployment and experience cohorts"
```

---

### Task 3: Combat Rules, Experience, and Soft Counters

**Files:**
- Create: `MedievalIdle/Assets/Scripts/Domain/CombatRules.cs`
- Create: `MedievalIdle/Assets/Tests/EditMode/CombatRulesTests.cs`

**Interfaces:**
- Consumes: `UnitType`, `ExperienceTier`, `FormationSlot`.
- Produces: `UnitStats CombatRules.GetStats(UnitType type, ExperienceTier tier)`.
- Produces: `float CombatRules.MatchupMultiplier(UnitType attacker, UnitType defender)`.
- Produces: `float CombatRules.FormationMultiplier(FormationSlot attackerSlot, UnitType attacker)`.
- Produces: `int CombatRules.ResolveDamage(UnitStats attacker, UnitStats defender, float matchup, float formation, float terrain, float randomFactor)`.

- [ ] **Step 1: Write failing soft-counter tests**

```csharp
[TestCase(UnitType.Spearman, UnitType.Cavalry, 1.50f)]
[TestCase(UnitType.Cavalry, UnitType.Archer, 1.40f)]
[TestCase(UnitType.Archer, UnitType.Infantry, 1.25f)]
[TestCase(UnitType.Infantry, UnitType.Spearman, 1.15f)]
public void MatchupMultiplier_AppliesExpectedSoftCounter(
    UnitType attacker, UnitType defender, float expected)
{
    Assert.That(CombatRules.MatchupMultiplier(attacker, defender), Is.EqualTo(expected));
}

[Test]
public void EliteInfantry_IsStrongerButNotInvulnerable()
{
    var recruit = CombatRules.GetStats(UnitType.Infantry, ExperienceTier.Recruit);
    var elite = CombatRules.GetStats(UnitType.Infantry, ExperienceTier.Elite);

    Assert.That(elite.Attack, Is.GreaterThan(recruit.Attack));
    Assert.That(elite.Health, Is.GreaterThan(recruit.Health));
    Assert.That(elite.Health, Is.LessThan(recruit.Health * 3));
}
```

- [ ] **Step 2: Run tests and verify failure**

Expected: FAIL because `CombatRules` does not exist.

- [ ] **Step 3: Implement baseline stats and experience multipliers**

Use one `UnitStats` record containing `Health`, `Attack`, `AttackRange`, `MoveSpeed`, and `AttackInterval`. Apply experience multipliers 1.00, 1.12, 1.28, and 1.48 for recruit, trained, veteran, and elite respectively. Keep values in one readonly table.

- [ ] **Step 4: Implement soft counters and formation modifiers**

Use the tested counter values. All unspecified matchups return 1.00. Rear archers receive a 1.10 positioning multiplier while engaged frontline archers receive 0.80; cavalry on flanks receives 1.10 before contact with the frontline. These are tunable constants, not scattered literals.

- [ ] **Step 5: Implement deterministic damage calculation**

Clamp `randomFactor` to 0.90–1.10 and calculate positive integer damage from attack, defense, matchup, formation, and terrain. Zero or negative damage is forbidden.

- [ ] **Step 6: Run all EditMode tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add MedievalIdle/Assets/Scripts/Domain/CombatRules.cs MedievalIdle/Assets/Tests/EditMode/CombatRulesTests.cs
git commit -m "feat: add experience stats and soft counters"
```

---

### Task 4: Deterministic Last-Man-Standing Simulation

**Files:**
- Create: `MedievalIdle/Assets/Scripts/Domain/BattleEvents.cs`
- Create: `MedievalIdle/Assets/Scripts/Domain/BattleSimulation.cs`
- Create: `MedievalIdle/Assets/Tests/EditMode/BattleSimulationTests.cs`

**Interfaces:**
- Consumes: valid `ArmyDeployment` values and `CombatRules`.
- Produces: `BattleResult BattleSimulation.Run(ArmyDeployment left, ArmyDeployment right, int seed)`.
- Produces: ordered `IReadOnlyList<BattleEvent>` with `MarchStarted`, `ChargeStarted`, `Attack`, `Death`, and `BattleEnded` events.
- Produces: `BattleResult.Winner`, `BattleResult.LeftSurvivors`, `BattleResult.RightSurvivors`, `BattleResult.DurationTicks`, and `BattleResult.Seed`.

- [ ] **Step 1: Write failing determinism and casualty tests**

```csharp
[Test]
public void SameSeedAndDeployment_ProduceIdenticalResult()
{
    var first = BattleSimulation.Run(TestArmies.Blue(), TestArmies.Red(), 41721);
    var second = BattleSimulation.Run(TestArmies.Blue(), TestArmies.Red(), 41721);

    Assert.That(second, Is.EqualTo(first));
}

[Test]
public void Battle_EndsWithUnitsAliveOnOnlyOneSide()
{
    var result = BattleSimulation.Run(TestArmies.Blue(), TestArmies.Red(), 12);

    Assert.That(result.LeftSurvivors.TotalLivingUnits == 0 ^
                result.RightSurvivors.TotalLivingUnits == 0, Is.True);
}

[Test]
public void Casualties_AreRemovedFromSurvivorCohorts()
{
    var left = TestArmies.Single(UnitType.Infantry, ExperienceTier.Veteran, 10, ArmySide.Left);
    var right = TestArmies.Single(UnitType.Infantry, ExperienceTier.Recruit, 10, ArmySide.Right);
    var result = BattleSimulation.Run(left, right, 90);

    Assert.That(result.LeftSurvivors.TotalLivingUnits + result.RightSurvivors.TotalLivingUnits,
        Is.LessThan(20));
}
```

- [ ] **Step 2: Run tests and verify failure**

Expected: FAIL because simulation and events do not exist.

- [ ] **Step 3: Implement simulation state**

Expand each cohort into lightweight deterministic `SimUnit` records containing stable ID, type, tier, slot, side, hit points, position, target ID, and next attack tick. Do not create GameObjects in the simulation.

- [ ] **Step 4: Implement movement and contact**

Use normalized battlefield coordinates from -1.0 to +1.0. Left units begin at -1.0 and right units at +1.0. Units march at 60% speed until an opposing unit is within `ChargeDistance = 0.28`, then emit `ChargeStarted` and use full speed. Ranged units stop at attack range; melee units continue to contact.

- [ ] **Step 5: Implement target selection and combat ticks**

At each fixed tick, select the nearest valid target, breaking equal-distance ties by stable unit ID. Use one seeded `System.Random`. Generate random factors only in stable unit-ID order. Apply all attacks scheduled for the tick before removing dead units so simultaneous kills remain possible.

- [ ] **Step 6: Handle simultaneous annihilation explicitly**

If both sides reach zero on the same tick, resolve the battle as `BattleOutcome.Draw`; no winner is invented. Store this outcome even though normal balancing should make draws uncommon.

- [ ] **Step 7: Run tests twice**

Run the complete EditMode suite twice without changing the seed.

Expected: byte-equivalent serialized `BattleResult` values in both runs and all tests pass.

- [ ] **Step 8: Commit**

```bash
git add MedievalIdle/Assets/Scripts/Domain/BattleEvents.cs MedievalIdle/Assets/Scripts/Domain/BattleSimulation.cs MedievalIdle/Assets/Tests/EditMode/BattleSimulationTests.cs
git commit -m "feat: simulate deterministic last-man-standing battles"
```

---

### Task 5: Survivor Experience Progression

**Files:**
- Create: `MedievalIdle/Assets/Scripts/Domain/SurvivorProgression.cs`
- Create: `MedievalIdle/Assets/Tests/EditMode/SurvivorProgressionTests.cs`

**Interfaces:**
- Consumes: `BattleResult` and original deployments.
- Produces: `ArmyDeployment SurvivorProgression.Apply(BattleResult result, ArmySide side)`.
- Produces: tier promotion thresholds of 1, 3, and 7 survived victories.

- [ ] **Step 1: Write failing survivor tests**

```csharp
[Test]
public void DeadUnits_DoNotAppearInProgressedArmy()
{
    var result = TestResults.WithTenVeteransAndThreeSurvivors();
    var progressed = SurvivorProgression.Apply(result, ArmySide.Left);

    Assert.That(progressed.TotalLivingUnits, Is.EqualTo(3));
}

[Test]
public void SurvivingRecruit_IsPromotedAfterFirstVictory()
{
    var result = TestResults.WithSingleRecruitSurvivor(victoriesSurvived: 1);
    var progressed = SurvivorProgression.Apply(result, ArmySide.Left);

    Assert.That(progressed.GetCount(UnitType.Infantry, ExperienceTier.Trained), Is.EqualTo(1));
}
```

- [ ] **Step 2: Run tests and verify failure**

Expected: FAIL because progression does not exist.

- [ ] **Step 3: Add survived-victory metadata to simulation units and survivors**

Preserve `VictoriesSurvived` when cohorts enter a battle, increment it only for surviving units on the winning side, and regroup identical type/tier/victory-count units after battle.

- [ ] **Step 4: Implement promotion**

Promote at 1 survived victory to trained, 3 to veteran, and 7 to elite. Elite remains elite. Losing-side survivors cannot exist under last-man-standing rules; draws preserve any technically living units without awarding a victory.

- [ ] **Step 5: Run all EditMode tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add MedievalIdle/Assets/Scripts/Domain MedievalIdle/Assets/Tests/EditMode/SurvivorProgressionTests.cs
git commit -m "feat: persist and promote surviving cohorts"
```

---

### Task 6: Battle Phase Machine and Application Controller

**Files:**
- Create: `MedievalIdle/Assets/Scripts/Application/BattlePhaseMachine.cs`
- Create: `MedievalIdle/Assets/Scripts/Application/BattleController.cs`
- Create: `MedievalIdle/Assets/Tests/PlayMode/BattleFlowTests.cs`

**Interfaces:**
- Consumes: deployments and `BattleSimulation.Run`.
- Produces: phases `Preparing`, `GatesOpening`, `Marching`, `Charging`, `Fighting`, `Result`, `Returning`.
- Produces: `BattleController.StartBattle(left, right, seed)` and read-only `CurrentPhase`, `PlaybackSpeed`, `Result`.
- Produces: `BattleController.SetPlaybackSpeed(float speed)` accepting only 0, 1, 2, and 4.

- [ ] **Step 1: Write failing phase-flow tests**

```csharp
[UnityTest]
public IEnumerator StartBattle_PassesThroughGateMarchChargeFightAndResult()
{
    var controller = CreateController();
    var observed = new List<BattlePhase>();
    controller.PhaseChanged += observed.Add;

    controller.StartBattle(TestArmies.Blue(), TestArmies.Red(), 81);
    yield return controller.PlayToCompletionForTest();

    CollectionAssert.IsSubsequenceOf(new[] {
        BattlePhase.GatesOpening, BattlePhase.Marching, BattlePhase.Charging,
        BattlePhase.Fighting, BattlePhase.Result
    }, observed);
}
```

- [ ] **Step 2: Run PlayMode test and verify failure**

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement event-driven playback**

Run the deterministic simulation once at battle start. Play its event stream according to event tick timestamps. Never recalculate damage from animation timing. Phase changes follow the first relevant event and the final `BattleEnded` event.

- [ ] **Step 4: Implement viewing-speed validation**

Speed 0 pauses event playback. Speeds 1, 2, and 4 scale presentation time only. The stored result and ordered event list must remain unchanged after speed changes.

- [ ] **Step 5: Run PlayMode and EditMode suites**

Expected: PASS and no domain assembly depends on Unity runtime types.

- [ ] **Step 6: Commit**

```bash
git add MedievalIdle/Assets/Scripts/Application MedievalIdle/Assets/Tests/PlayMode/BattleFlowTests.cs
git commit -m "feat: orchestrate immutable battle playback"
```

---

### Task 7: Pooled Pixel-Unit Presentation

**Files:**
- Create: `MedievalIdle/Assets/Scripts/Presentation/UnitView.cs`
- Create: `MedievalIdle/Assets/Scripts/Presentation/UnitViewPool.cs`
- Create: `MedievalIdle/Assets/Scripts/Presentation/BattlePresenter.cs`
- Create: `MedievalIdle/Assets/Scripts/Presentation/BattleCameraController.cs`
- Create: `MedievalIdle/Assets/Tests/PlayMode/BattlePresentationTests.cs`
- Create: `MedievalIdle/Assets/Art/Prototype/Units/*`

**Interfaces:**
- Consumes: `BattleController` phase and battle events.
- Produces: one pooled `UnitView` per visible simulation unit up to `VisibleUnitCap = 400` per side.
- Produces: deterministic visual aggregation beyond the cap without changing simulated troop counts.

- [ ] **Step 1: Write failing pooling tests**

```csharp
[UnityTest]
public IEnumerator Presenter_ReusesViewsAcrossBattles()
{
    var fixture = CreatePresentationFixture(visibleUnitCap: 20);
    fixture.Play(TestArmies.OfSize(20), TestArmies.OfSize(20), 5);
    yield return fixture.Complete();
    var createdAfterFirst = fixture.Pool.TotalCreated;

    fixture.Play(TestArmies.OfSize(20), TestArmies.OfSize(20), 6);
    yield return fixture.Complete();

    Assert.That(fixture.Pool.TotalCreated, Is.EqualTo(createdAfterFirst));
}
```

- [ ] **Step 2: Run test and verify failure**

Expected: FAIL because presentation classes do not exist.

- [ ] **Step 3: Import prototype sprite sheets correctly**

Set Texture Type to Sprite, Filter Mode to Point, Compression to None, Generate Mip Maps off, and consistent Pixels Per Unit. Provide idle, march, charge, attack, hit, death, and return clips for each unit class and side tint.

- [ ] **Step 4: Implement the unit view pool**

Prewarm views, reset all animation and tint state on return, and prohibit `Instantiate` during active battle after prewarm. Expose `TotalCreated` for tests and profiling.

- [ ] **Step 5: Implement event presentation**

Spawn units inside their castle gates. Translate normalized simulation positions onto hill paths. Play march animations first, charge animations after `ChargeStarted`, attack clips from `Attack`, and one death animation from `Death`. Survivors transition to return movement after the result pause.

- [ ] **Step 6: Implement visual aggregation**

When simulated counts exceed 400 per side, map multiple simulation units to one view and display a subtle group-density shadow. Casualty proportions reduce visible groups consistently. Never feed presentation aggregation back into combat calculations.

- [ ] **Step 7: Verify frame behavior**

Profile a battle with 2,000 simulated soldiers per side and 400 visible views per side on the Mac editor.

Expected: no per-frame managed allocations from pooling code after warm-up and no battle-time Instantiate calls.

- [ ] **Step 8: Run all tests and commit**

```bash
git add MedievalIdle/Assets/Art/Prototype/Units MedievalIdle/Assets/Scripts/Presentation MedievalIdle/Assets/Tests/PlayMode/BattlePresentationTests.cs
git commit -m "feat: render pooled pixel armies from battle events"
```

---

### Task 8: Deployment Screen and Battle Controls

**Files:**
- Create: `MedievalIdle/Assets/Scripts/UI/DeploymentScreen.cs`
- Create: `MedievalIdle/Assets/Scripts/UI/BattleControls.cs`
- Create: `MedievalIdle/Assets/UI/DeploymentScreen.uxml`
- Create: `MedievalIdle/Assets/UI/DeploymentScreen.uss`
- Create: `MedievalIdle/Assets/UI/BattleControls.uxml`
- Create: `MedievalIdle/Assets/UI/BattleControls.uss`
- Create: `MedievalIdle/Assets/Tests/PlayMode/DeploymentScreenTests.cs`

**Interfaces:**
- Consumes: available cohort counts and five formation slots.
- Produces: validated immutable `ArmyDeployment` when the player presses `To Battle`.
- Produces: pause, 1×, 2×, and 4× commands for `BattleController`.

- [ ] **Step 1: Write failing UI logic test**

```csharp
[UnityTest]
public IEnumerator Deployment_CannotAssignMoreVeteransThanAvailable()
{
    var screen = CreateDeploymentScreen(veteranInfantryAvailable: 10);
    screen.Assign(FormationSlot.Front, UnitType.Infantry, ExperienceTier.Veteran, 11);

    yield return null;

    Assert.That(screen.CanStartBattle, Is.False);
    Assert.That(screen.ValidationMessage, Does.Contain("10 veteran infantry available"));
}
```

- [ ] **Step 2: Run test and verify failure**

Expected: FAIL because the deployment screen does not exist.

- [ ] **Step 3: Build the five-zone layout**

Create large touch targets for front, middle, rear, left flank, and right flank. Each zone shows unit icon, total quantity, and a four-color experience bar. Keep all text readable at the 480 × 270 reference resolution.

- [ ] **Step 4: Implement inventory-safe editing**

Every change recomputes remaining cohorts. Invalid negative or excessive assignments disable `To Battle` and show one precise validation message. Confirmation creates a defensive copy and locks editing.

- [ ] **Step 5: Implement viewing-only battle controls**

During battle, hide all deployment controls. Show only pause, 1×, 2×, 4×, and camera controls. No control may call simulation mutation methods.

- [ ] **Step 6: Run UI and domain tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add MedievalIdle/Assets/Scripts/UI MedievalIdle/Assets/UI MedievalIdle/Assets/Tests/PlayMode/DeploymentScreenTests.cs
git commit -m "feat: configure formations and experience ratios"
```

---

### Task 9: Battlefield Scene, Gates, Hills, and Camera

**Files:**
- Create: `MedievalIdle/Assets/Scenes/CombatPrototype.unity`
- Create: `MedievalIdle/Assets/Art/Prototype/Battlefield/*`
- Create: `MedievalIdle/Assets/Tests/PlayMode/CombatSceneSmokeTests.cs`

**Interfaces:**
- Consumes: `BattlePresenter`, `DeploymentScreen`, `BattleControls`.
- Produces: complete playable scene with named anchors `LeftGate`, `RightGate`, `LeftHillPath`, `RightHillPath`, and `ValleyCenter`.

- [ ] **Step 1: Write failing scene smoke test**

```csharp
[UnityTest]
public IEnumerator CombatScene_HasRequiredAnchorsAndController()
{
    yield return SceneManager.LoadSceneAsync("CombatPrototype");

    Assert.That(GameObject.Find("LeftGate"), Is.Not.Null);
    Assert.That(GameObject.Find("RightGate"), Is.Not.Null);
    Assert.That(GameObject.Find("ValleyCenter"), Is.Not.Null);
    Assert.That(Object.FindFirstObjectByType<BattleController>(), Is.Not.Null);
}
```

- [ ] **Step 2: Run test and verify failure**

Expected: FAIL because the scene does not exist.

- [ ] **Step 3: Assemble the approved battlefield composition**

Place a blue stone castle on the left hill, a red fortified camp on the right hill, a wide central valley, distant layered mountains, and restrained foreground props. Maintain clear paths from both gates to the valley and preserve formation readability.

- [ ] **Step 4: Add gate animation and path anchors**

Gate animations finish before march events are presented. Path anchors define each formation lane and keep flanks visually separated without changing domain calculations.

- [ ] **Step 5: Configure camera and safe areas**

Show both hills at battle start. Allow bounded pan and modest zoom while keeping both army fronts discoverable. Respect iPhone safe areas for controls.

- [ ] **Step 6: Run smoke and presentation tests**

Expected: PASS at 16:9 and representative wider iPhone aspect ratios without cropped battle controls.

- [ ] **Step 7: Commit**

```bash
git add MedievalIdle/Assets/Scenes MedievalIdle/Assets/Art/Prototype/Battlefield MedievalIdle/Assets/Tests/PlayMode/CombatSceneSmokeTests.cs
git commit -m "feat: assemble two-hill combat battlefield"
```

---

### Task 10: Hybrid Battle Audio

**Files:**
- Create: `MedievalIdle/Assets/Scripts/Presentation/BattleAudioController.cs`
- Create: `MedievalIdle/Assets/Audio/Prototype/*`
- Create: `MedievalIdle/Assets/Tests/PlayMode/BattleAudioTests.cs`

**Interfaces:**
- Consumes: phases, event density, active counts, attack events, and battle result.
- Produces: layered march, charge, arrow, melee, cavalry, death-density, victory, and defeat audio.

- [ ] **Step 1: Write failing audio-state test**

```csharp
[UnityTest]
public IEnumerator ChargePhase_IncreasesFootstepIntensityWithoutCreatingPerUnitSources()
{
    var audio = CreateAudioController();
    audio.SetArmyCounts(left: 400, right: 400);
    audio.OnPhaseChanged(BattlePhase.Charging);
    yield return null;

    Assert.That(audio.ActiveLoopSourceCount, Is.LessThanOrEqualTo(8));
    Assert.That(audio.ChargeIntensity, Is.GreaterThan(audio.MarchIntensity));
}
```

- [ ] **Step 2: Run test and verify failure**

Expected: FAIL because the audio controller does not exist.

- [ ] **Step 3: Implement bounded audio layers**

Use shared loops for footsteps, armor, cavalry, ranged volleys, and melee crowd. Scale volume and filtering from normalized army density. Use a small round-robin pool for distinct impacts; never attach one AudioSource per soldier.

- [ ] **Step 4: Implement phase transitions**

Gate creak leads into march layers; charging raises pace and hoof intensity; melee crossfades at first contact; diminishing active counts thin the mix; the result stops battle loops before the short victory or defeat signature.

- [ ] **Step 5: Run audio and flow tests**

Expected: PASS with at most eight persistent loop sources and no source-count growth across repeated battles.

- [ ] **Step 6: Commit**

```bash
git add MedievalIdle/Assets/Scripts/Presentation/BattleAudioController.cs MedievalIdle/Assets/Audio/Prototype MedievalIdle/Assets/Tests/PlayMode/BattleAudioTests.cs
git commit -m "feat: add scalable hybrid medieval battle audio"
```

---

### Task 11: Local Save, Survivor Persistence, and Recovery

**Files:**
- Create: `MedievalIdle/Assets/Scripts/Application/PrototypeSaveStore.cs`
- Create: `MedievalIdle/Assets/Tests/EditMode/PrototypeSaveStoreTests.cs`

**Interfaces:**
- Consumes: available army, reserved trainer cohorts, last result, and schema version.
- Produces: `void PrototypeSaveStore.Save(PrototypeSaveData data)`.
- Produces: `LoadResult PrototypeSaveStore.Load()` with `Success`, `Missing`, or `CorruptRecovered` status.
- Produces: atomic replacement of `prototype-save.json` with a retained backup.

- [ ] **Step 1: Write failing save round-trip and recovery tests**

```csharp
[Test]
public void SaveAndLoad_PreserveSurvivorTierAndVictoryCount()
{
    var store = CreateTemporaryStore();
    var expected = TestSaves.WithEliteInfantry(victoriesSurvived: 9);

    store.Save(expected);
    var loaded = store.Load();

    Assert.That(loaded.Status, Is.EqualTo(LoadStatus.Success));
    Assert.That(loaded.Data, Is.EqualTo(expected));
}

[Test]
public void CorruptPrimary_RecoversLastValidBackup()
{
    var store = CreateTemporaryStore();
    store.Save(TestSaves.First());
    store.Save(TestSaves.Second());
    store.CorruptPrimaryForTest();

    Assert.That(store.Load().Status, Is.EqualTo(LoadStatus.CorruptRecovered));
    Assert.That(store.Load().Data, Is.EqualTo(TestSaves.First()));
}
```

- [ ] **Step 2: Run tests and verify failure**

Expected: FAIL because the save store does not exist.

- [ ] **Step 3: Implement versioned JSON DTOs**

Store schema version, kingdom identity, available cohorts, trainers, last battle seed, and last result. Do not serialize MonoBehaviours, GameObjects, or presentation state.

- [ ] **Step 4: Implement atomic save and backup recovery**

Write to a temporary file, flush it, rotate the prior valid primary to backup, then replace the primary. Validate schema and nonnegative cohort counts during load. Recover the backup on invalid JSON or validation failure and surface `CorruptRecovered` to the UI.

- [ ] **Step 5: Run all EditMode tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add MedievalIdle/Assets/Scripts/Application/PrototypeSaveStore.cs MedievalIdle/Assets/Tests/EditMode/PrototypeSaveStoreTests.cs
git commit -m "feat: persist surviving armies safely"
```

---

### Task 12: Prototype Acceptance Build

**Files:**
- Create: `MedievalIdle/Docs/PrototypePlaytest.md`
- Modify: `MedievalIdle/ProjectSettings/EditorBuildSettings.asset`
- Modify: `MedievalIdle/Assets/Scenes/CombatPrototype.unity`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a reproducible Mac editor build and an iPhone development build containing the combat prototype.

- [ ] **Step 1: Add three fixed acceptance scenarios**

Create developer presets:

1. 100 recruit infantry versus 100 recruit infantry.
2. 60 veteran infantry plus 30 trained archers versus 150 recruit infantry.
3. 40 recruit spearmen plus 20 veteran archers versus 35 trained cavalry plus 40 recruit infantry.

Each preset stores a fixed seed and expected winner so visual changes cannot silently alter simulation results.

- [ ] **Step 2: Run every automated test**

Run EditMode and PlayMode suites from a clean editor start.

Expected: zero failures, zero ignored prototype-domain tests, and no compiler warnings from project code.

- [ ] **Step 3: Perform the manual acceptance pass**

For all three presets confirm:

- every visible soldier begins inside a gate;
- gates open before movement;
- formations descend the hills intact;
- units accelerate near contact;
- archers stop at range and cavalry visibly flanks;
- pause and speed changes do not change the result;
- only one side has survivors, except a recorded deterministic draw;
- survivors return and persist after restarting the game;
- changing formation or experience ratio can change the result.

Record results in `Docs/PrototypePlaytest.md` with device/editor, seed, expected winner, actual winner, observed defects, and disposition.

- [ ] **Step 4: Create the iPhone development build**

Export the Xcode project, sign with a development team, install on a physical iPhone, and repeat the three presets. Confirm landscape locking, safe-area layout, readable pixel scaling, audio behavior, and acceptable frame rate.

- [ ] **Step 5: Confirm the product success gate**

Invite one fresh tester to play without explanation. The prototype passes only if the tester can state why two battles produced different results and voluntarily tries a changed formation or experience ratio.

- [ ] **Step 6: Commit the verified prototype**

```bash
git add MedievalIdle
git commit -m "test: verify playable combat prototype"
```

---

## Completion Boundary

This plan ends with a validated combat prototype, not a releasable game. The next independent plans should cover, in order:

1. Time-based recruitment and veteran instructors.
2. Persistent scouts and risk-based intelligence.
3. Territory map, enemy recovery, and campaign progression.
4. Offline AI Kings Ranking.
5. Production art, content, accessibility, balancing, analytics, advertisements, Remove Ads purchase, and App Store release.

The combat prototype must pass its acceptance gate before any of those plans begin.
