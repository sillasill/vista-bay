// Vista Bay: every tuning number, colour, mission and key in one place.
// The world is a fixed-size coastal city; nothing here depends on the screen.
export const STEP = 1 / 60;

export const CITY = {
  roadsX: [-90, -45, 0, 45, 90],
  roadsZ: [-90, -45, 0, 45, 90],
  roadHalf: 5,
  sidewalk: 3.5,
  min: -118,
  max: 118,
  beachZ: 118,
  seaZ: 142,
  pierX: 30,
  pierZ0: 140,
  pierZ1: 205,
  pierHalf: 4,
};

export const PLAYER = {
  radius: 0.6,
  height: 1.8,
  walkSpeed: 5.2,
  sprintSpeed: 8.5,
  accel: 40,
  jumpSpeed: 7.5,
  gravity: 20,
  health: 100,
};

export const CAR = {
  length: 4.4,
  width: 2.0,
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 34,
  maxReverse: 10,
  steer: 1.9,
  grip: 8,
  handbrake: 26,
};

export const TRAFFIC_COUNT = 12;
export const PED_COUNT = 20;
export const MAX_POLICE = 3;

export const WANTED = {
  steal: 1,
  hitPed: 1,
  shootNearPolice: 2,
  decaySeconds: 26,
  maxStars: 5,
};

export const PALETTE = {
  sky: 0x8ec7ee,
  fog: 0xa8cbe8,
  sun: 0xfff2d0,
  ground: 0x3d3a33,
  road: 0x2e2e33,
  sidewalk: 0x9a958a,
  sand: 0xe8d49a,
  sea: 0x2e7fa8,
  building: [0xd8c9a8, 0xb8c4cc, 0xc9a689, 0xa8b8a0, 0xd0b8c8],
  palm: 0x3f8f4f,
  trunk: 0x8a6b4a,
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export const SAVE_KEY = 'vista-bay.save.v1';
export const BEST_KEY = 'vista-bay.best.v1';

/** The four chained jobs Marla Voss hands Rico. Each step is a place to reach or a fight to win. */
export const MISSIONS = [
  {
    id: 'getaway',
    title: 'Job 1 — The Getaway',
    reward: 500,
    briefing:
      '"Rico, welcome home. First job\'s easy — a blue sedan is parked on Harbor Row. Take it, bring it to the safehouse, and don\'t scratch the paint."',
    steps: [
      { kind: 'reach', label: 'Steal the blue sedan on Harbor Row', x: 6.5, z: -20, radius: 4, needCar: true },
      { kind: 'reach', label: 'Drive the sedan to the safehouse', x: -10, z: 95, radius: 7, needCar: true },
    ],
    done: '"Clean. The crew likes you already. Next job\'s a courier run — three drops, no questions."',
  },
  {
    id: 'courier',
    title: 'Job 2 — Courier Run',
    reward: 800,
    briefing:
      '"Three packages, three corners of Vista Bay. Drop them off and the money\'s yours. Cops are jumpy tonight, so keep it low-key."',
    steps: [
      { kind: 'reach', label: 'Drop 1 of 3 — the corner of 5th and Coral', x: -67, z: -67, radius: 6 },
      { kind: 'reach', label: 'Drop 2 of 3 — the marina gates', x: 67, z: -45, radius: 6 },
      { kind: 'reach', label: 'Drop 3 of 3 — the old arcade', x: -45, z: 67, radius: 6 },
    ],
    done: '"All three delivered. You\'re fast, Rico. Now the real work — a dockside deal that went sour."',
  },
  {
    id: 'docks',
    title: 'Job 3 — Dockside Deal',
    reward: 1200,
    briefing:
      '"The Harlow boys are holding my shipment on the pier. They won\'t talk, so make them listen. Take your pistol — and watch the water."',
    steps: [
      { kind: 'reach', label: 'Get to the pier', x: 30, z: 150, radius: 8 },
      { kind: 'fight', label: 'Clear the thugs off the pier', x: 30, z: 172, radius: 14 },
    ],
    done: '"Shipment\'s safe. One last job, Rico — the big one. The harbor vault. Then we\'re both rich."',
  },
  {
    id: 'heist',
    title: 'Job 4 — The Harbor Heist',
    reward: 2500,
    briefing:
      '"The harbor vault is full of clean cash. Grab it, and the whole city will be on you — lose them and get to the safehouse. This is the one, Rico."',
    steps: [
      { kind: 'reach', label: 'Break into the harbor vault', x: -60, z: 108, radius: 6 },
      { kind: 'escape', label: 'Lose the heat — reach the safehouse', x: -10, z: 95, radius: 7 },
    ],
    done: '"We did it, Rico. Vista Bay is ours now. The city\'s yours to roam — spend it well."',
  },
];

export const STORY_INTRO =
  'Rico Santana just walked out of the Harbor lockup after three years. ' +
  'The fixer Marla Voss has work for a wheelman who can keep his mouth shut — ' +
  'four jobs, one city, and a fortune waiting at the end of the pier.';

export const CONTROLS_TEXT =
  'WASD move · Mouse look · Shift sprint · Space jump / handbrake · E enter or exit a car · ' +
  'Click shoot · F punch · P pause · R restart after busted';
