import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReadoutBox, SceneFrame } from "./SceneFrame";

describe("SceneFrame", () => {
  it("renders the header, the title and the content", () => {
    const html = renderToStaticMarkup(
      <SceneFrame sceneLabel="Big numbers" title="Big numbers.">
        <p>content</p>
      </SceneFrame>,
    );
    expect(html).toContain("Committed");
    expect(html).toContain("<h2");
    expect(html).toContain("content");
  });

  it("leaves the title row out when there is neither title nor note", () => {
    const html = renderToStaticMarkup(
      <SceneFrame sceneLabel="Big numbers">
        <p>content</p>
      </SceneFrame>,
    );
    expect(html).not.toContain("<h2");
  });
});

describe("ReadoutBox", () => {
  it("shows the title and the detail line", () => {
    const html = renderToStaticMarkup(
      <ReadoutBox title="2024" detail="701 contributions" />,
    );
    expect(html).toContain("2024");
    expect(html).toContain("701 contributions");
  });
});
