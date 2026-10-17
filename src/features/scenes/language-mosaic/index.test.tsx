import { describe, expect, it } from "vitest";
import { labSceneData } from "@/features/experience/labData";
import { makeHistory } from "@/test-support/historyFixture";
import { languageMosaicScene } from "./index";

describe("languageMosaicScene", () => {
  const history = {
    ...makeHistory("ada", []),
    languages: [
      { name: "TypeScript", size: 700, share: 0.7, isOther: false },
      { name: "Other", size: 300, share: 0.3, isOther: true },
    ],
  };

  it("is skipped without a history (the lab)", () => {
    expect(languageMosaicScene.create(labSceneData())).toBeNull();
  });

  it("is skipped when there are no languages", () => {
    const data = { ...labSceneData(), history: makeHistory("ada", []) };
    expect(languageMosaicScene.create(data)).toBeNull();
  });

  it("plays with languages", () => {
    const scene = languageMosaicScene.create({ ...labSceneData(), history });
    expect(scene?.duration).toBeGreaterThan(0);
    expect(scene?.explore).toBeTypeOf("function");
  });
});
