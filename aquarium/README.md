# Aquarium growth project

Growing a **structure inside a real aquarium**, where the *rules of growth are
defined in software*, sensed by instruments in and around the tank, and steered
by an electronic "brain" (an LLM running on an old Mac). Fish are not required —
the living process here is the growth itself.

Starting parameters (given): **an aquarium, an old Apple Mac, and an LLM API.**
Everything else is specified in the plan below for you to build.

## What's here

- **[`PLAN.md`](./PLAN.md)** — the main deliverable: the full plan and build spec.
  How to physically grow a structure (mineral accretion on an addressable
  electrode array), the four layers of "growth rules," the sensor mesh + camera,
  the LLM brain, a phased roadmap, safety, and the open questions I need answered
  to turn it into an exact bill of materials.
- **Phase‑0 sandbox** — an *optional* browser previewer that makes the
  "rules can be defined" idea concrete before any hardware exists. Edit a
  text rulebook, press **Grow**, and watch a structure accrete inside a glass
  tank. It shares no code with anything else in this repo.
  - `index.html` — the tank viewer + rulebook editor
  - `lsystem.js` — the portable rule engine (parses a rulebook, grows geometry)
  - `presets.js` — five example rulebooks (coral, sea fan, kelp, brain coral, anemone)
  - `sandbox.js` — builds the aquarium scene and animates the growth

## Running the sandbox

It's static files using three.js from a CDN, so it needs to be *served over HTTP*
(ES module imports won't load from `file://`). From this folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/aquarium/  (from the repo root)
# or, if you ran it inside aquarium/, http://localhost:8000/
```

Edit the rulebook in the left panel and press **Grow** to regrow, or **Re-seed**
to get a new random variant of a stochastic rulebook. See the "Rulebook syntax"
section in the panel for the grammar.

> The sandbox is a design aid for authoring growth rules, **not** a simulation of
> the electrochemistry. The real growth mechanism is specified in `PLAN.md`.
