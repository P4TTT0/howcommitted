import { describe, expect, it } from "vitest";
import { eras, mainRepo, topRepos } from "./repo-eras";
import type { Repo, RepoCommits } from "./types";

const repo = (name: string, commits: number): RepoCommits => ({
  repo: name,
  commits,
});

const years = [
  {
    year: 2022,
    repoCommits: [repo("ada/engine", 6), repo("org/lib", 2)],
  },
  {
    year: 2023,
    repoCommits: [repo("ada/engine", 3), repo("org/lib", 6)],
  },
  { year: 2024, repoCommits: [] },
];

const repos: Repo[] = [
  {
    name: "engine",
    createdAt: "2020-01-01T00:00:00Z",
    stars: 1,
    languages: [
      { name: "TypeScript", size: 5 },
      { name: "Rust", size: 10 },
    ],
  },
];

describe("mainRepo and topRepos", () => {
  it("are empty without public commits", () => {
    expect(mainRepo([])).toBeNull();
    expect(topRepos([])).toEqual([]);
    expect(mainRepo([{ year: 2024, repoCommits: [] }])).toBeNull();
  });

  it("finds the public repo with the most commits across years", () => {
    expect(mainRepo(years)).toEqual({
      repo: "ada/engine",
      commits: 9,
      firstYear: 2022,
      lastYear: 2023,
    });
    expect(topRepos(years).map((r) => r.repo)).toEqual([
      "ada/engine",
      "org/lib",
    ]);
  });

  it("handles a single commit", () => {
    expect(mainRepo([{ year: 2024, repoCommits: [repo("a/b", 1)] }])).toEqual({
      repo: "a/b",
      commits: 1,
      firstYear: 2024,
      lastYear: 2024,
    });
  });

  it("breaks ties by name", () => {
    const tie = [
      {
        year: 2024,
        repoCommits: [repo("z/three", 4), repo("x/one", 4), repo("y/two", 4)],
      },
    ];
    expect(topRepos(tie).map((r) => r.repo)).toEqual([
      "x/one",
      "y/two",
      "z/three",
    ]);
  });

  it("limits the list to five", () => {
    const many = [
      {
        year: 2024,
        repoCommits: Array.from({ length: 7 }, (_, i) =>
          repo(`a/r${i}`, i + 1),
        ),
      },
    ];
    const top = topRepos(many);
    expect(top).toHaveLength(5);
    expect(top[0]?.repo).toBe("a/r6");
  });
});

describe("eras", () => {
  it("picks the top public repo per year and maps the language of owned repos", () => {
    const result = eras(years, repos, "Ada");
    expect(result).toEqual([
      { year: 2022, repo: "ada/engine", commits: 6, language: "Rust" },
      { year: 2023, repo: "org/lib", commits: 6 },
    ]);
    expect(result[1]).not.toHaveProperty("language");
  });

  it("omits the language when the owned repo is not in the fetched list", () => {
    const [era] = eras(years, [], "ada");
    expect(era).not.toHaveProperty("language");
  });

  it("skips years without public commits and orders oldest first", () => {
    expect(
      eras([...years.slice(1, 3).reverse()], repos, "ada").map((e) => e.year),
    ).toEqual([2023]);
    expect(eras([], repos, "ada")).toEqual([]);
  });

  it("breaks a yearly tie by name", () => {
    const [era] = eras(
      [
        {
          year: 2024,
          repoCommits: [repo("b/x", 2), repo("a/x", 2)],
        },
      ],
      [],
      "ada",
    );
    expect(era?.repo).toBe("a/x");
  });
});
