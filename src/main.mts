import { activate } from "./index.mts";

declare global {
  interface Window {
    TIMESTAMP_REFRESH_TIME_MS?: number;
  }
}

activate(window.TIMESTAMP_REFRESH_TIME_MS);
