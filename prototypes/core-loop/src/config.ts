// All tuning knobs — single source of truth for the prototype
export const CONFIG = {
  // Canvas
  LOGICAL_WIDTH: 800,
  LOGICAL_HEIGHT: 450,

  // Runner
  BASE_SPEED: 300, // px/s at 100% speed
  GATE_SPEED_MULTIPLIER: 0.3,
  BOOST_MULTIPLIER: 1.5,
  BOOST_DURATION: 1.0,
  BOOST_DECAY: 0.8,
  CHARACTER_X: 160,

  // Gate timing
  GATE_INTERVAL_FIRST: 10, // shortened for prototype (GDD: 20s)
  GATE_INTERVAL: 12, // shortened for prototype (GDD: 22s)
  GATE_APPROACH_DURATION: 1.5,
  GATE_RESOLVE_DURATION: 1.2,

  // Gate timer
  GATE_TIMER_DURATION: 15, // fixed seconds per gate (GDD default)

  // Visual
  GATE_BACKDROP_OPACITY: 0.6,
  TIMER_WARNING_THRESHOLD: 3,

  // Parallax
  PARALLAX_FAR: 0.2,
  PARALLAX_MID: 0.5,
  PARALLAX_NEAR: 1.0,

  // Physics
  MAX_DELTA_TIME: 50,
  JUMP_VELOCITY: -380,     // px/s upward
  DOUBLE_JUMP_VELOCITY: -340,
  GRAVITY: 1100,           // px/s²
  FAST_FALL_GRAVITY: 3300, // 3x gravity when duck pressed in air
  DUCK_SQUISH: 0.6,       // vertical scale when ducking

  // Character zones (px above ground line)
  GROUND_Y_FRAC: 0.72,
  ZONE_LOW_TOP: 50,        // low obstacles/orbs: 0-50px above ground
  ZONE_MID_TOP: 95,        // mid: 50-95px — single jump peak
  ZONE_HIGH_TOP: 145,      // high: 95-145px — double jump peak

  // Orb score values
  ORB_SCORE_LOW: 10,        // green orb
  ORB_SCORE_MID: 25,        // gold orb
  ORB_SCORE_HIGH: 50,       // blue orb

  // Hit
  HIT_INVINCIBLE: 0.6,

  // Scoring
  BASE_GATE_SCORE: 100,
  MAX_STREAK_MULTIPLIER: 5,
  TIME_BONUS_PER_SECOND: 10, // end-of-run bonus for remaining gate time
} as const;
