export type Deactivate = () => void;
export type TimestampType = "t" | "T" | "d" | "D" | "f" | "F" | "R";

const DEFAULT_REFRESH_MS = 1_000;
const TIMESTAMP_REGEX = /&lt;t:(?<time>\d+):(?<type>[tTdDfFR])&gt;/m;

const ONE_MINUTE_MS = 60 * 1000;
const ONE_HOUR_MS = 60 * ONE_MINUTE_MS;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;
const ONE_MONTH_MS = 30 * ONE_DAY_MS;
const ONE_YEAR_MS = 365 * ONE_DAY_MS;

let currentScrollArea: HTMLDivElement | null = null;
let intersectionObserver: IntersectionObserver | null = null;
let relativeDateSpanCounter = 0;

export function activate(refreshTime = DEFAULT_REFRESH_MS): Deactivate {
  let animationFrameRequestId = -1;
  let intervalId = -1;

  intervalId = setInterval(() => {
    if (animationFrameRequestId !== -1) {
      cancelAnimationFrame(animationFrameRequestId);
    }

    animationFrameRequestId = requestAnimationFrame(() => {
      updateScrollArea();
      replaceTimeTags();
    });
  }, refreshTime);

  return () => {
    clearInterval(intervalId);
    cancelAnimationFrame(animationFrameRequestId);
  };
}

function updateScrollArea(): void {
  const scrollArea = document.querySelector(
    ".messages-container .rc-scrollbars-view"
  );

  if (scrollArea === currentScrollArea) {
    return;
  }

  currentScrollArea = scrollArea as HTMLDivElement;
  intersectionObserver?.disconnect();

  intersectionObserver = new IntersectionObserver(
    (entries, _observer) => {
      for (const entry of entries) {
        const target = entry.target;
        if (!(target instanceof HTMLSpanElement)) {
          continue;
        }

        if (entry.isIntersecting) {
          const intervalId = setInterval(() => {
            let animationFrameRequestId = parseInt(
              target.dataset.animationFrameRequestId ?? ""
            );
            if (animationFrameRequestId > 0) {
              cancelAnimationFrame(animationFrameRequestId);
            }

            animationFrameRequestId = requestAnimationFrame(() => {
              const timeDiff =
                Date.now() - parseInt(target.dataset.targetTime ?? "");
              updateRelativeSpanTextContent(target, timeDiff);
            });

            target.dataset.animationFrameRequestId = `${animationFrameRequestId}`;
          }, 1_000);
          target.dataset.intervalId = `${intervalId}`;
        } else {
          const intervalId = parseInt(target.dataset.intervalId ?? "");
          const animationFrameRequestId = parseInt(
            target.dataset.animationFrameRequestId ?? ""
          );
          clearInterval(intervalId);
          cancelAnimationFrame(animationFrameRequestId);
        }
      }
    },
    {
      root: currentScrollArea,
    }
  );
}

function replaceTimeTags(): void {
  if (document.querySelector(".messages-list .loading-animation") != null) {
    return;
  }

  const messageBodyElements = Array.from(
    document.querySelectorAll(".rcx-message-body")
  );
  for (const messageBodyElement of messageBodyElements) {
    let match = messageBodyElement.innerHTML.match(TIMESTAMP_REGEX);
    while (match != null) {
      const time = match.groups?.time;
      const type = match.groups?.type;

      if (time == null || type == null) {
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `Match returned invalid data (time: ${time}, type: ${type})`
        );
      }

      let timeSpan = getTimeSpan(parseInt(time), type as TimestampType);
      messageBodyElement.innerHTML = messageBodyElement.innerHTML.replace(
        match[0],
        timeSpan.outerHTML
      );
      timeSpan = document.getElementById(
        `relative-date-span-${relativeDateSpanCounter - 1}`
      ) as HTMLSpanElement;

      if (type === "R") {
        intersectionObserver?.observe(timeSpan);
      }

      match = messageBodyElement.innerHTML.match(TIMESTAMP_REGEX);
    }
  }
}

function getTimeSpan(time: number, type: TimestampType): HTMLSpanElement {
  const span = document.createElement("span");
  const date = new Date(time * 1000);
  const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {};

  // Id
  span.id = `relative-date-span-${relativeDateSpanCounter}`;
  relativeDateSpanCounter += 1;

  // Title
  span.title = new Intl.DateTimeFormat(navigator.language, {
    dateStyle: "short",
    timeStyle: "long",
    timeZone: "UTC",
  }).format(date);

  // Style
  span.style.display = "inline-block";
  span.style.fontSize = "80%";
  span.style.paddingLeft = "10px";
  span.style.paddingRight = "10px";
  span.style.backgroundColor =
    "var(--rcx-tag-colors-default-background-color,var(--rcx-color-surface-neutral,var(--rcx-color-neutral-400,#e4e7ea)))";
  span.style.cursor = "default";
  span.style.fontWeight = "bold";
  span.style.borderRadius = "999999px";

  switch (type) {
    // Short time
    case "t":
      dateTimeFormatOptions.timeStyle = "short";
      break;
    // Long time
    case "T":
      dateTimeFormatOptions.timeStyle = "medium";
      break;
    // Short date
    case "d":
      dateTimeFormatOptions.dateStyle = "short";
      break;
    // Long date
    case "D":
      dateTimeFormatOptions.dateStyle = "long";
      break;
    // Long date with short time
    case "f":
      dateTimeFormatOptions.dateStyle = "long";
      dateTimeFormatOptions.timeStyle = "short";
      break;
    // Long date with day of week and short time
    case "F":
      dateTimeFormatOptions.dateStyle = "full";
      dateTimeFormatOptions.timeStyle = "short";
      break;
    // Relative
    case "R":
      // pass
      break;
    default:
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Something went wrong, received ${type} as timestamp parameter`
      );
  }

  if (type === "R") {
    const timeDiff = Date.now() - date.getTime();
    span.dataset.targetTime = `${date.getTime()}`;
    updateRelativeSpanTextContent(span, timeDiff);
  } else {
    const dateTimeFormat = new Intl.DateTimeFormat(
      navigator.language,
      dateTimeFormatOptions
    );
    span.textContent = dateTimeFormat.format(date);
  }

  return span;
}

function updateRelativeSpanTextContent(
  span: HTMLSpanElement,
  timeDiff: number
): void {
  const relativeTimeFormat = new Intl.RelativeTimeFormat(navigator.language, {
    numeric: "always",
  });

  const absTimeDiff = Math.abs(timeDiff);
  let content = "";

  let value!: number;
  let unit!: Intl.RelativeTimeFormatUnit;

  if (absTimeDiff < ONE_MINUTE_MS) {
    value = -timeDiffToSeconds(timeDiff);
    unit = "seconds";
  } else if (absTimeDiff < ONE_HOUR_MS) {
    value = -timeDiffToMinutes(timeDiff);
    unit = "minutes";
  } else if (absTimeDiff < ONE_DAY_MS) {
    value = -timeDiffToHours(timeDiff);
    unit = "hours";
  } else if (absTimeDiff < ONE_WEEK_MS) {
    value = -timeDiffToDays(timeDiff);
    unit = "days";
  } else if (absTimeDiff < ONE_MONTH_MS) {
    value = -timeDiffToWeeks(timeDiff);
    unit = "weeks";
  } else if (absTimeDiff < ONE_YEAR_MS) {
    value = -timeDiffToMonths(timeDiff);
    unit = "months";
  } else {
    value = -timeDiffToYears(timeDiff);
    unit = "years";
  }

  if (value < 0) {
    value = Math.ceil(value);
  } else {
    value = Math.floor(value);
  }
  content = relativeTimeFormat.format(value, unit);

  if (span.textContent !== content) {
    span.textContent = content;
  }
}

function timeDiffToSeconds(timeDiff: number): number {
  return timeDiff / 1_000;
}

function timeDiffToMinutes(timeDiff: number): number {
  return timeDiff / 1_000 / 60;
}

function timeDiffToHours(timeDiff: number): number {
  return timeDiff / 1_000 / 60 / 60;
}

function timeDiffToDays(timeDiff: number): number {
  return timeDiff / 1_000 / 60 / 60 / 24;
}

function timeDiffToWeeks(timeDiff: number): number {
  return timeDiff / 1_000 / 60 / 60 / 24 / 7;
}

function timeDiffToMonths(timeDiff: number): number {
  return timeDiff / 1_000 / 60 / 60 / 24 / 30;
}

function timeDiffToYears(timeDiff: number): number {
  return timeDiff / 1_000 / 60 / 60 / 24 / 365;
}
