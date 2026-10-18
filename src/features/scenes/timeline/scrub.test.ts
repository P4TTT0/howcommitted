import { describe, expect, it } from "vitest";
import { flagLabel, flagMarks, formatDay } from "./scrub";

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
});
