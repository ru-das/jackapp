// capabilities stays empty until T-52 lands: the countdown only runs while the app is open (see Timer.tsx).
export const TimerMeta = {
  "name": "Timer",
  "tier": "P0",
  "hint": "Countdown for chores: tea, laundry, workouts, focus sessions.",
  "example": {
    "seconds": 300,
    "label": "Tea"
  },
  "children": false,
  "capabilities": []
} as const;
