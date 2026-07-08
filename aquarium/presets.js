// Built-in rulebooks. Each is a plain-text L-system that anyone can edit live in
// the on-screen editor. Lines starting with # are comments; "key = value" lines
// set parameters; "A -> ..." lines are production rules (optionally weighted
// with "A ->(0.4) ..." so a symbol can grow more than one way at random).

export const PRESETS = {
  'Staghorn coral': `# Branching stony coral — grows up and outward, forking in threes.
axiom      = F F X
angle      = 28
length     = 0.85
thickness  = 0.20
iterations = 5
taper      = 0.80
jitter     = 0.22
gravity    = -0.15
leafsize   = 0.6

# X is the growing tip: it forks, occasionally just extends.
X ->(0.7) F [ ' & + X ] [ ' & - X ] ' ^ X L
X ->(0.3) F [ ' + X ] ' & X L
F -> F F`,

  'Sea fan (gorgonia)': `# A flat-ish fan that spreads sideways, like a purple gorgonian.
axiom      = A
angle      = 22
length     = 0.7
thickness  = 0.12
iterations = 6
taper      = 0.88
jitter     = 0.10
gravity    = -0.05
leafsize   = 0.35

A -> F [ + B ] [ - B ] F A
B ->(0.6) F [ + B ] F ' B L
B ->(0.4) F [ - B ] F ' B L
F -> F`,

  'Kelp / seagrass': `# Tall swaying blades reaching for the surface, fronds along the way.
axiom      = S
angle      = 18
length     = 1.0
thickness  = 0.16
iterations = 6
taper      = 0.95
jitter     = 0.30
gravity    = -0.35
leafsize   = 1.2

S ->(0.5) F [ ' + L ] S
S ->(0.5) F [ ' - L ] S
F -> F`,

  'Brain-coral mound': `# A dense low dome that packs polyps over its surface.
axiom      = [ M ] [ / M ] [ // M ] [ /// M ]
angle      = 30
length     = 0.5
thickness  = 0.26
iterations = 5
taper      = 0.82
fatten     = 1.05
jitter     = 0.35
gravity    = 0.1
leafsize   = 0.5

M ->(0.5) F [ ^ + M L ] [ ^ - M L ] ' L
M ->(0.5) F [ & M L ] ' + M L
F -> F`,

  'Bubble tip anemone': `# Short fat column crowned with a burst of tentacle tips.
axiom      = ' ' C
angle      = 40
length     = 0.4
thickness  = 0.34
iterations = 5
taper      = 0.9
jitter     = 0.4
gravity    = -0.5
leafsize   = 1.6

C -> . F T
T -> [ + T ] [ - T ] [ & T ] [ ^ T ] ! ! L
F -> F`,
};

export const DEFAULT_PRESET = 'Staghorn coral';
