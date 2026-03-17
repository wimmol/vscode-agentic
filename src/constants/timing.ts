export const SESSION_POLL_INTERVAL_MS = 2000;
export const SESSION_POLL_MAX_ATTEMPTS = 15;
export const SESSION_WATCH_POLL_MS = 3000;
export const SESSION_DIR_POLL_MS = 5000;
export const TIMER_INTERVAL_MS = 1000;
export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;

/** After this much inactivity while RUNNING, transition to IDLE. Handles local commands that don't emit end_turn. */
export const STALE_RUNNING_TIMEOUT_MS = 15_000;
/** Slow poll interval for session detection after fast phase exhausts attempts. */
export const SLOW_SESSION_POLL_INTERVAL_MS = 30_000;
/** How often to verify tracked terminals still exist. */
export const HEALTH_CHECK_INTERVAL_MS = 30_000;
