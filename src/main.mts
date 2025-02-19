import type { Deactivate } from "./index.mts";
import { activate } from "./index.mts";

declare let TIMESTAMP_REFRESH_TIME_MS: number | undefined;

declare global {
  interface Window {
    godotTimestampsStop: Deactivate;
  }
}

window.godotTimestampsStop = activate(TIMESTAMP_REFRESH_TIME_MS);
