import { describe, expect, it } from "vitest";
import {
  dayReading,
  flagLabel,
  flagMarks,
  flagWindow,
  formatDay,
  nearFlags,
} from "./scrub";

const days = [
  { date: "2021-01-01" },
  { date: "2021-01-02" },
  { date: "2021-01-03" },
  { date: "2021-01-04" },
];

const flag = (name: string, createdAt: string, stars = 0) => ({
  name,
  createdAt,
  stars,
  reason: "notable" as const,
});

describe("formatDay", () => {
  it("formats an ISO day in US English, in UTC", () => {
    expect(formatDay("2021-03-04")).toBe("Mar 4, 2021");
    expect(formatDay("2021-03-04T23:59:59Z")).toBe("Mar 4, 2021");
  });

  it("returns what it cannot parse", () => {
    expect(formatDay("soon")).toBe("soon");
  });
});

describe("flagMarks", () => {
  it("places a flag on the day it was created, at the end of that day", () => {
    const [mark] = flagMarks([flag("a", "2021-01-02T10:00:00Z")], days);
    expect(mark).toMatchObject({
      dayIndex: 1,
      progress: 0.5,
      date: "2021-01-02",
    });
  });

  it("clamps flags outside the drawn range to its ends", () => {
    const marks = flagMarks(
      [
        flag("early", "2010-05-01T00:00:00Z"),
        flag("late", "2030-05-01T00:00:00Z"),
      ],
      days,
    );
    expect(marks.map((mark) => mark.dayIndex)).toEqual([0, 3]);
    // The label still carries the real date.
    expect(marks[0]?.date).toBe("2010-05-01");
  });

  it("places nothing without days", () => {
    expect(flagMarks([flag("a", "2021-01-02T00:00:00Z")], [])).toEqual([]);
  });
});

describe("nearFlags", () => {
  it("finds the flags within the window of the cursor", () => {
    const marks = flagMarks(
      [flag("a", "2021-01-01T00:00:00Z"), flag("b", "2021-01-04T00:00:00Z")],
      days,
    );
    expect(nearFlags(marks, 1, 1).map((mark) => mark.name)).toEqual(["a"]);
    expect(nearFlags(marks, 2, 1).map((mark) => mark.name)).toEqual(["b"]);
    expect(nearFlags(marks, 2, 5)).toHaveLength(2);
  });

  it("uses a window of at least 3 days, wider for long histories", () => {
    expect(flagWindow(100)).toBe(3);
    expect(flagWindow(5000)).toBe(30);
  });
});

describe("labels", () => {
  it("labels a flag with its repository, stars and date", () => {
    const [mark] = flagMarks([flag("lib", "2021-01-03T00:00:00Z", 240)], days);
    expect(mark && flagLabel(mark)).toBe(
      "Repository created: lib, 240 stars, Jan 3, 2021",
    );
    const [one] = flagMarks([flag("a", "2021-01-03T00:00:00Z", 1)], days);
    expect(one && flagLabel(one)).toContain("1 star,");
    const [none] = flagMarks([flag("a", "2021-01-03T00:00:00Z", 0)], days);
    expect(none && flagLabel(none)).toBe("Repository created: a, Jan 3, 2021");
  });

  it("reads the day as contributions so far, never commits", () => {
    const text = dayReading({ date: "2021-01-02", total: 1234, flags: [] });
    expect(text).toBe("Jan 2, 2021: 1,234 contributions so far");
    expect(text).not.toMatch(/commit/i);
  });

  it("adds the unattributed step and flags of that day", () => {
    const [mark] = flagMarks([flag("lib", "2021-01-02T00:00:00Z")], days);
    const text = dayReading({
      date: "2021-01-02",
      total: 900,
      step: {
        year: 2021,
        dayIndex: 1,
        amount: 120,
        progress: 0.5,
        time: 1,
        from: 780,
        to: 900,
      },
      flags: mark ? [mark] : [],
    });
    expect(text).toContain("+120 not attributed to a day");
    expect(text).toContain("Repository created: lib");
  });
});
