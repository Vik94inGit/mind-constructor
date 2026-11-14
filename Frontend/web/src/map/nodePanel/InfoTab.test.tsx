import { describe, expect, it, vi } from "vitest";
import { useRef, useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InfoTab } from "./InfoTab";
import { I18nProvider } from "../../i18n/I18nContext";
import type { NodeDoc } from "../../types";

const TEXT = "We get \\(N_{h}>2N_{h-2}\\) here";

function Harness({ text, onSave }: { text: string; onSave: () => Promise<boolean> }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const readonlyTextRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(text);
  const [expanded, setExpanded] = useState(false);
  const node = { nodeId: "n1", text, type: "Idea" } as unknown as NodeDoc;
  return (
    <InfoTab
      node={node}
      isCreator
      busy={false}
      textLocked={false}
      textareaRef={textareaRef}
      readonlyTextRef={readonlyTextRef}
      textDraft={draft}
      setTextDraft={setDraft}
      expanded={expanded}
      setExpanded={setExpanded}
      textHeight={null}
      copied={false}
      templateKind={null}
      onTextSave={onSave}
      onCopyText={vi.fn()}
      onDelete={vi.fn()}
      onTemplate={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

function setup(text: string) {
  const onSave = vi.fn(async () => true);
  const utils = render(
    <I18nProvider>
      <Harness text={text} onSave={onSave} />
    </I18nProvider>,
  );
  return { onSave, ...utils };
}

describe("InfoTab formulas", () => {
  it("shows a text with formulas only rendered, without its raw field", () => {
    const { container } = setup(TEXT);
    expect(screen.getByTestId("formula-rendered")).toBeTruthy();
    expect(container.querySelector("textarea")).toBeNull();
  });

  it("opens the raw text on a tap and renders it again when the field is left", async () => {
    const { container, onSave } = setup(TEXT);
    await userEvent.click(screen.getByTestId("formula-rendered"));
    const ta = container.querySelector("textarea")!;
    expect(ta).toBeTruthy();
    expect(ta.value).toBe(TEXT);
    expect(document.activeElement).toBe(ta);
    expect(screen.queryByTestId("formula-rendered")).toBeNull();
    ta.blur();
    expect(onSave).toHaveBeenCalled();
    expect(await screen.findByTestId("formula-rendered")).toBeTruthy();
  });

  it("keeps the plain text field for a text without formulas", () => {
    const { container } = setup("just words");
    expect(container.querySelector("textarea")).toBeTruthy();
    expect(screen.queryByTestId("formula-rendered")).toBeNull();
  });
});
