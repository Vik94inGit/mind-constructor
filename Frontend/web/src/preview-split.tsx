import { createRoot } from "react-dom/client";
import "./index.css";
import { I18nProvider } from "./i18n/I18nContext";
import { PresentationOverlay } from "./map/PresentationOverlay";
import { computeSlideGroups } from "./utils/presentation";
import { makeNode } from "./test/fixtures";
localStorage.setItem("mc_language", "en");
const groups = computeSlideGroups([
  makeNode({ nodeId: "trip", text: "Plan the weekend trip to Prague", type: "Problem", createdAt: "2026-01-01T00:00:00Z" }),
  makeNode({ nodeId: "hotel", text: "Book the hotel near the old town", type: "Option", parentId: "trip", x: 100, createdAt: "2026-01-02T00:00:00Z" }),
  makeNode({ nodeId: "train", text: "Buy train tickets before Friday", type: "Option", parentId: "trip", x: 300, createdAt: "2026-01-03T00:00:00Z" }),
  makeNode({ nodeId: "anna", text: "Ask Anna if she wants to come", type: "Idea", parentId: "trip", x: 500, createdAt: "2026-01-04T00:00:00Z" }),
]);
createRoot(document.getElementById("root")!).render(
  <I18nProvider><PresentationOverlay slides={groups} index={0} onIndexChange={() => {}} onExit={() => {}} onOpenNode={() => {}} /></I18nProvider>,
);
