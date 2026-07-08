# Growing a structure in an aquarium — project plan & build spec

A structure that **physically grows inside a real water tank**, where the *rules
of growth can be defined* in software, sensed by instruments in and around the
tank, and steered by an electronic "brain" running an LLM on an old Mac.

Fish are not required. The living thing here is the **structure and its growth
process**, not livestock.

This document is a spec you can build from. Where a decision is open, it is
flagged as **[decide]**. Where something can be bought rather than made, that is
called out because "ideally just bought" is preferred.

---

## 1. The idea in one paragraph

We put a conductive scaffold into a tank of mineral-rich water and pass a small
electric current through it. Minerals dissolved in the water precipitate onto the
scaffold and **accrete into solid rock** — this is real, well-documented
"mineral accretion" (a.k.a. Biorock, after Hilbertz & Goreau). Where and how fast
the rock grows is set by *where and how much current flows*. Because we control
the current per region with an addressable electrode array, we can drive growth
from a **rulebook** — a generative-growth program (an L-system, reaction–diffusion
field, or cellular rules) that says which parts should thicken, branch, or stop.
A camera and a mesh of in-tank sensors report what is actually happening; the Mac
runs a control loop, and an LLM acts as the slow "gardener" that reads the state
and adjusts the rules toward a goal.

The three fixed inputs — **aquarium, Mac, LLM API** — map cleanly onto
**medium, brain, and policy**. Everything below is the connective tissue.

---

## 2. How do you grow a structure? (mechanism options)

The whole project hinges on picking a growth mechanism that is (a) real and
repeatable in a home tank, (b) *controllable in space and time by electronics*,
and (c) safe. Four candidates, then a recommendation.

| Mechanism | What grows | Controllable by electronics? | Speed | Risk |
|---|---|---|---|---|
| **Mineral accretion / electrodeposition** (recommended) | Limestone-like CaCO₃ + Mg(OH)₂ on a cathode | **Yes — directly, via current per electrode** | mm/week, visible in days | Low‑V DC; gas at electrodes (manage, see §9) |
| Silicate "chemical garden" | Tubular metal-salt crystals | Barely — chemistry-driven, hard to modulate | minutes (too fast) | Reactive salts, messy |
| Struvite / scale precipitation | Crusty mineral scale | Indirectly via pH/temperature | slow, uneven | Low, but low control |
| Biological (coralline algae, live rock, plants) | Living calcifiers | Only indirectly (light/flow/chem) | weeks–months | Livestock husbandry burden |

### Recommendation: mineral accretion on an addressable electrode array

It is the only option where **"the rules of growth" translate directly into an
electrical signal we generate**. Growth rate scales with local current density,
morphology depends on current density and electrode geometry, and we can switch
current per node. That makes the pipeline honest: *rulebook → per-node current →
real mineral deposited exactly there*.

Physics we rely on:
- Passing DC through mineral water drives reduction at the **cathode**, raising
  local pH, which precipitates **aragonite/calcite (CaCO₃)** and
  **brucite (Mg(OH)₂)** onto it. The scaffold literally gains solid mass.
- **Low current density** → harder, denser, aragonite-rich growth (slower).
  **Higher current density** → faster but softer, brucite-rich, more brittle.
  This trade-off is a *knob the brain can turn per region*.
- The **anode** is sacrificial or inert; with a chloride electrolyte it evolves
  chlorine (a real hazard — see §9). Electrolyte choice matters a lot.

**[decide] Electrolyte.** Two routes:
1. **Seawater / marine salt mix** — authentic, rich in Ca²⁺/Mg²⁺, but chloride
   means chlorine gas at the anode. Requires low current, an inert (MMO/titanium)
   anode, and ventilation.
2. **Chloride-free mineral bath** — e.g. magnesium sulfate (Epsom salt) + sodium
   bicarbonate (+ a calcium source like calcium chloride *sparingly*, or calcium
   nitrate). Evolves mostly O₂/H₂ instead of Cl₂ — **much safer indoors** and my
   recommended starting point. Growth is Mg(OH)₂-dominated (whiter, softer).

---

## 3. Defining the rules of growth

"Rules can be defined in some way" is the heart of the request. There are **four
rule layers**, from abstract shape down to safe electricity. Keep them separate so
each can be edited, tested, and reasoned about on its own.

### Layer A — Morphology rules (what shape do we want?)
A text **rulebook** describes the target form generatively. Supported models:
- **L-system** (recommended to start): a short grammar of production rules like
  `X -> F[+X][-X]` that expands into a branching structure. Easy to author, easy
  to explain, maps naturally to "branch here, extend there." *This is exactly
  what the Phase‑0 sandbox in this folder demonstrates and lets you edit live.*
- **Reaction–diffusion field** (Gray–Scott): grows organic, coral/brain-like
  patterns as a 2‑D/3‑D field; good for mounds and encrusting forms.
- **Cellular / voxel rules**: "a cell grows if ≥2 neighbours are solid and local
  pH is in range" — closest to the physics, easiest to close the loop on.

The rulebook is **plain text and hot-swappable**. See `presets.js` for five
worked examples (staghorn coral, sea fan, kelp, brain-coral mound, anemone).

### Layer B — Mapping rules (shape → which electrodes, how hard)
Project the desired morphology onto the physical electrode array:
- Each electrode node owns a region of the scaffold. The mapper computes a
  **target growth field** (where should there be more mass next?) from Layer A and
  from the *current measured structure* (from the camera), then assigns each node a
  **duty cycle / current setpoint** proportional to "wanted minus have."
- Rules here include: max mass per node, minimum spacing, "grow tips faster than
  trunk," "stop a node once its region hits target thickness."

### Layer C — Homeostasis rules (keep the tank alive-able)
Simple deterministic guardrails that run every control tick, independent of the
brain:
- Hold pH, temperature, conductivity within bands; if out of band, throttle
  current and raise an alert.
- Per-node and total **current limits**; thermal cutoff; gas-accumulation timeout.

### Layer D — Policy rules (the brain's slow adjustments)
The LLM operates here only (see §6). It may edit Layer A/B parameters within
bounds ("branch more toward the light side," "slow region 3, it's getting soft"),
never Layer C limits.

> Design principle: **fast loops are dumb and safe; the smart loop is slow.**
> Layers B/C run on a microcontroller at 1–10 Hz. Layer D (LLM) runs every few
> minutes to hours.

---

## 4. System architecture

```
        ┌─────────────────────────── Old Apple Mac ───────────────────────────┐
        │  Camera (USB/built-in)  →  Vision + CV metrics                       │
        │  Control app (Python/Node):                                          │
        │     • state store (sensor JSON + CV metrics + photos)                │
        │     • Layer B mapper + Layer C guards (deterministic)                │
        │     • Layer D "gardener": LLM API call every N minutes               │
        │     • rulebook editor + dashboard (local web UI)                     │
        └──────────────┬───────────────────────────────┬──────────────────────┘
                       │ USB / USB-serial              │ USB / Wi-Fi (MQTT)
              ┌────────┴────────┐            ┌──────────┴───────────┐
              │  Growth driver  │            │   Sensor node mesh   │
              │  (MCU + current │            │  (N nodes: pH, temp, │
              │   drivers/DACs) │            │  EC, DO, per-node    │
              └────────┬────────┘            │  V/I sense)          │
                       │ wires (potted)      └──────────┬───────────┘
        ┌──────────────┴───────────────────────────────┴──────────────────────┐
        │                         THE AQUARIUM                                 │
        │   inert anode(s)  ·  addressable cathode array (the scaffold)        │
        │   mineral electrolyte  ·  circulation pump  ·  the growing structure │
        └──────────────────────────────────────────────────────────────────────┘
```

**Why the Mac is outside with a camera, not inside the loop of every node:**
the Mac is the perception + policy hub (vision, logging, LLM). The tight,
safety-critical control lives on a cheap microcontroller so a Mac hiccup, sleep,
or crash can never leave current on uncontrolled.

---

## 5. Sensing & compute

### 5.1 The camera (Mac)
- Fixed mount looking through one clean tank face; consistent lighting (LED
  panel on a timer). Backlight or dark backdrop improves silhouette extraction.
- **Time-lapse** (e.g. one frame/minute) for growth logging and shareable video.
- **CV metrics** per frame: silhouette area, height, width, branch/tip count,
  per-region coverage (grid aligned to the electrode nodes), color/whiteness
  (proxy for aragonite vs brucite). These become the "how" fed to the mapper and
  summarized for the LLM.
- Optional: a second view (mirror or webcam) for crude 3‑D / occlusion checks.

### 5.2 In-tank sensor mesh (the "node-based multi-sensor mesh")
Each node is a small waterproof-potted board sitting near a region of the
scaffold. A node reports local conditions and (if co-located with an electrode)
its own voltage/current.

Per-node sensors — **buy where possible**:
- **Temperature**: DS18B20 waterproof probe (cheap, 1-wire, trivial). *Buy.*
- **pH**: pH probe + analog front-end (e.g. Atlas Scientific EZO-pH, or DFRobot
  Gravity pH). Needs calibration; the single most useful chemistry signal. *Buy.*
- **Conductivity / TDS / salinity**: EC probe (Atlas EZO-EC / DFRobot Gravity
  TDS). Tells us mineral depletion. *Buy.*
- **ORP / redox**: optional, tracks the electrodeposition environment. *Buy.*
- **Dissolved oxygen**: optional (gas evolution proxy). *Buy if budget allows.*
- **Per-node V/I sense**: measure the actual current each electrode draws
  (INA219/INA226 over I²C). *Buy the modules.*
- **Turbidity / a tiny camera per node**: optional, likely overkill v1.

Mesh transport **[decide]**:
- **Wired I²C/RS‑485 back to one hub MCU** — simplest, most reliable in a fixed
  installation, no batteries. **Recommended v1.**
- **Wi-Fi mesh of ESP32 nodes publishing MQTT** — matches the "node mesh" vision,
  scales, no long analog runs; more moving parts. **Recommended v2.**

### 5.3 Growth driver (the electrode controller)
- One MCU (ESP32 or RP2040) that receives per-node setpoints over USB-serial or
  MQTT and drives each electrode.
- **Per-node current control**: either PWM through a MOSFET into a
  current-limiting circuit, or small constant-current sinks, or per-channel
  DAC → current source. **Constant-current is better** than constant-voltage for
  repeatable, rule-driven accretion.
- Channel count = number of independently controllable regions. **[decide]**
  Start with **4–8 channels**; the array can be a laser-cut grid or bent titanium
  wire zones. More channels = finer spatial rules = more wiring/waterproofing.
- Sacrificial/inert **anode(s)** on their own supply return.

### 5.4 Power
- Bench DC supply or a current-limited 5–12 V brick. Total current is modest
  (order of amps). **Hard-limit the supply** as a last-resort safety net (§9).

---

## 6. The electronic "brain" (LLM on the Mac)

The LLM is a **gardener, not a servo**. It should never be in a loop that could
be unsafe if it stalls, hallucinates, or the API is down.

**Cadence:** every few minutes to hours (configurable). Between calls the
deterministic Layer B/C controller keeps running on the last approved plan.

**Each call, the Mac sends the model:**
- The current **goal** (target form + priorities, in plain language).
- A compact **state summary**: latest sensor JSON, CV metrics, deltas since last
  call, and 1–3 recent photos (use a vision-capable model).
- The active **rulebook** (Layer A/B parameters) and the **allowed bounds**.

**The model must return structured JSON only**, e.g.:
```json
{
  "assessment": "region 3 growing soft/brittle, whiteness high; tips lagging",
  "rulebook_edits": { "region3.current_setpoint": -0.2, "tip.bias": +0.15 },
  "notes_for_human": "consider topping up calcium; EC down 12% since start",
  "confidence": 0.62
}
```
The Mac **validates** every edit against Layer C bounds, clamps it, logs the
before/after, and only then applies it. A human-readable log and a "revert last
brain action" button are mandatory.

**Prompt strategy:** system prompt encodes the physics, the rule layers, the hard
limits, and "respond with JSON conforming to this schema." Provide a few-shot
example. Keep a rolling memory summary so the brain has continuity across days
without resending the full history.

**Nice-to-have brain behaviors:**
- Narrate the structure's growth as a daily "diary" entry (great for a blog).
- Propose experiments ("run region 5 at half current for 6 h and compare hardness
  by whiteness/CV") and evaluate the result next session.
- Detect anomalies the fast loop's fixed thresholds miss.

---

## 7. Software components to build (on the Mac)

1. **`state store`** — append-only log (SQLite + a photos folder) of every sensor
   reading, CV metric, plan, and brain action. Everything is replayable.
2. **`vision`** — grab frames, compute CV metrics, write time-lapse. (OpenCV.)
3. **`controller`** — Layer B mapper + Layer C guards; talks to the driver MCU.
4. **`gardener`** — Layer D LLM client: build prompt, call API, validate JSON,
   apply clamped edits. Pluggable model/provider.
5. **`dashboard`** — a local web page: live camera, sensor charts, the **rulebook
   editor**, current per-node plan, brain log, and manual overrides / e-stop.
6. **`sim`** — the offline growth sandbox (this folder's Phase‑0 demo) so
   rulebooks can be authored and previewed *before* touching the tank.

**[decide] language:** Python is the pragmatic pick on an old Mac (OpenCV, serial,
LLM SDKs, matplotlib/Flask). Node.js is fine if you'd rather share the sandbox's
JS. I'd default to **Python for the Mac app, keep the sandbox in JS.**

---

## 8. Roadmap (phases, each independently useful)

- **Phase 0 — Simulate.** Author growth rulebooks in the offline sandbox; agree on
  target forms and the rule schema. *No hardware. Partially built in this folder.*
- **Phase 1 — One electrode, one beaker.** Prove accretion: a single cathode +
  inert anode in the chosen electrolyte, fixed current, camera time-lapse. Confirm
  real mineral grows and measure rate vs current. *Riskiest assumption, cheapest
  test — do this first.*
- **Phase 2 — Addressable array.** 4–8 channel driver + scaffold; drive a static
  spatial pattern (e.g. "grow the outline of a shape") to prove per-region control.
- **Phase 3 — Sensor mesh + CV.** Wire the sensors and the camera metrics into the
  Mac state store; close the Layer B/C loop (grow toward a target field, hold
  chemistry in band). Fully autonomous *without* the LLM.
- **Phase 4 — Brain.** Add the Layer D gardener; let the LLM adjust rules within
  bounds; keep the human override. Add the growth "diary."
- **Phase 5 — Live it.** Long-run installation, time-lapse video, refill/maintenance
  routine, and (optional) a public dashboard / blog feed.

Ship Phase 1 before building anything elaborate; everything after it is
incremental.

---

## 9. Safety (do not skip)

Electricity + water + gases. All of these are manageable at our scale, but must be
designed in, not added later.

- **Chlorine gas.** Chloride electrolytes (seawater/table salt) evolve Cl₂ at the
  anode. **Prefer the chloride-free bath (§2) for indoor work**, or use an
  MMO/titanium inert anode, keep current low, and **ventilate**. Never run a
  chloride tank in a closed room.
- **Hydrogen + oxygen.** Electrolysis makes H₂/O₂. Keep the tank open/vented; no
  sealed headspace where gas can collect and ignite.
- **Low voltage only.** Design for **≤12 V DC**; optimal accretion is a couple of
  volts. Never mains voltage near the tank. GFCI/RCD on the supply.
- **Hard current limit** at the bench supply as an independent backstop, below the
  MCU's software limits.
- **Galvanic/heat.** Watch electrode and wire heating; thermal cutoff in Layer C.
- **Waterproofing.** Pot all in-tank electronics (epoxy/heat-shrink), keep
  connectors above the waterline, strain-relief every cable.
- **No livestock dependency.** Since fish aren't required, we're free to run water
  chemistry (high pH at the cathode, mineral baths) that would be unsafe for
  animals — a real simplification. Keep it that way unless you decide otherwise.
- **E-stop.** A physical switch that cuts electrode power regardless of software.

---

## 10. What I need from you to finish the spec (open questions)

1. **Tank**: volume, dimensions, material (glass/acrylic), and is it dedicated to
   this (no fish/plants to protect)?
2. **Electrolyte** route: authentic seawater vs chloride-free mineral bath (§2)?
3. **Mac**: exact model / macOS version / RAM (bounds what runs locally, and
   whether the built-in camera or a USB webcam is better placed).
4. **LLM API**: which provider/model, and is a **vision-capable** model available
   (strongly preferred so the brain can "see" the structure)?
5. **Budget & buy-vs-build appetite**: how many sensor nodes and electrode
   channels to target for v1? (Drives the bill of materials.)
6. **Goal aesthetic**: what should it grow *toward* — a coral-like branch, a flat
   fan, a lattice, a logo/shape? (Sets the first rulebooks.)
7. **Runtime & noise/venting constraints** of where the tank will live.

Answer these and I'll turn §5–§7 into an exact bill of materials (with links),
a wiring diagram, and the initial rulebooks.

---

## 11. My added ideas (beyond the brief)

- **Grow a *recognizable* shape.** Because we control growth spatially, aim the
  first real run at a simple target (a letter, a spiral, a small arch) — proof that
  "rules define growth" in the most visible way.
- **Aragonite vs brucite as a controllable material property.** Use current density
  as a "hardness dial" and let the brain optimize for denser growth, verified by
  the camera's whiteness metric — a closed-loop materials experiment.
- **Growth "seasons."** Have the brain run day/night or weekly regimes and compare
  morphology, like tree rings you can later slice and photograph.
- **The diary/blog angle.** The gardener writing a daily entry about "its" reef fits
  this repo's blog nicely and makes the project self-documenting.
- **Regeneration demo.** Snap off a branch; let the loop detect the loss (CV) and
  regrow it — a striking, easily-filmed capability.
- **Sonification/visualization.** Map sensor + growth data to sound or light for an
  ambient installation feel (kept entirely separate from any other project).

---

*Phase‑0 sandbox: an editable growth-rule previewer lives alongside this plan.*
*See `README.md` in this folder for how to open it. It is optional and exists only*
*to make the "rules can be defined" idea concrete before hardware exists.*
