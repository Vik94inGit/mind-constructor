import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nContext";
import { ThemeToggle } from "../components/ThemeToggle";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { AddMenu } from "./AddMenu";
import { ReadingModeMenu } from "./ReadingModeMenu";
import type { ReadingMode } from "../utils/readingMode";

interface Props {
  /** A demo session has exactly the one map it was seeded with — no way back to a dashboard. */
  isDemo: boolean;
  isOwner: boolean;
  isDiscussionMode: boolean;
  /** Show the full cluster; false collapses it to a single "⋮" while a node's quick-add ring is up. */
  expanded: boolean;
  onExpand: () => void;
  moveMode: boolean;
  onToggleMove: () => void;
  readingMode: ReadingMode;
  onPickReadingMode: (mode: ReadingMode) => void;
  onToggleMapMode: () => void;
  onInvite: () => void;
  onCreateNode: () => void;
  onCreateCircle: () => void;
  onNodeTypes: () => void;
  onExportText: () => void;
}

const iconBtn =
  "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border text-[0.95rem] font-semibold hover:bg-surface-2";
const idle = "border-transparent bg-transparent text-ink";
const pressed = "border-accent bg-accent-soft text-accent-ink";

// The whole top toolbar collapses to this one compact floating cluster — Back
// + a single "+" menu (Invite/Create/Node types) + Move + reading mode —
// pinned top-left instead of a separate full-width bar. z-[45] like the
// minimap/zoom-controls cluster: above canvas/panel, below a real modal.
export function MapToolbar({
  isDemo,
  isOwner,
  isDiscussionMode,
  expanded,
  onExpand,
  moveMode,
  onToggleMove,
  readingMode,
  onPickReadingMode,
  onToggleMapMode,
  onInvite,
  onCreateNode,
  onCreateCircle,
  onNodeTypes,
  onExportText,
}: Props) {
  const { t } = useI18n();
  // Each dropdown's own open/closed state.
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showReadingMenu, setShowReadingMenu] = useState(false);
  // A menu item closes the menu, then does its thing.
  const closeAddThen = (action: () => void) => () => {
    setShowAddMenu(false);
    action();
  };

  return (
    <div className="absolute top-3 left-3 z-[45] flex items-center gap-1 rounded-card border border-line bg-surface p-1 shadow-card">
      {expanded ? (
        <>
          {!isDemo && (
            <Link
              to="/"
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[0.95rem] font-semibold text-ink hover:bg-surface-2"
              title={t.map.toolbar.back}
            >
              &larr;
            </Link>
          )}
          <div className="relative">
            <button
              type="button"
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[1.05rem] font-semibold text-ink hover:bg-surface-2"
              title={t.map.toolbar.add}
              onClick={() => setShowAddMenu((v) => !v)}
            >
              +
            </button>
            {showAddMenu && (
              <AddMenu
                isOwner={isOwner}
                onClose={() => setShowAddMenu(false)}
                onInvite={closeAddThen(onInvite)}
                onCreateNode={closeAddThen(onCreateNode)}
                onCreateCircle={closeAddThen(onCreateCircle)}
                onNodeTypes={closeAddThen(onNodeTypes)}
                onExportText={closeAddThen(onExportText)}
              />
            )}
          </div>
          {/* Off by default (dragging used to arm from a bare pointerdown,
              which read as accidental relocation on any touch imprecision). */}
          <button
            type="button"
            className={`${iconBtn} ${moveMode ? pressed : idle}`}
            title={moveMode ? t.map.toolbar.moveOn : t.map.toolbar.moveOff}
            onClick={onToggleMove}
          >
            ✥
          </button>
          {/* Reading mode — how nodes read on the canvas (classic mind map /
              icons + text / actual). Highlighted whenever it isn't the
              default look. */}
          <div className="relative">
            <button
              type="button"
              className={`${iconBtn} text-[0.8rem] ${readingMode !== "actual" ? pressed : idle}`}
              title={t.map.toolbar.readingMode}
              onClick={() => setShowReadingMenu((v) => !v)}
            >
              Aa
            </button>
            {showReadingMenu && (
              <ReadingModeMenu
                mode={readingMode}
                onPick={(mode) => {
                  onPickReadingMode(mode);
                  setShowReadingMenu(false);
                }}
                onClose={() => setShowReadingMenu(false)}
              />
            )}
          </div>
          {/* The global Navbar (which normally hosts these) is hidden on the
              map route — see App.tsx's onMapPage check — so this is the only
              place a map-page user can reach them. */}
          <div className="ml-1 flex items-center gap-1 border-l border-line pl-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </>
      ) : (
        // Collapsed while a node's own quick-add ring is up: expands the full
        // cluster back (without waiting for quick-add to end) rather than
        // opening some separate menu of its own.
        <button
          type="button"
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent text-[0.95rem] font-semibold text-ink hover:bg-surface-2"
          title={t.map.toolbar.expandToolbar}
          onClick={onExpand}
        >
          ⋮
        </button>
      )}
      {/* Owner-only — updateMapDao's own ownerId filter would reject this from
          anyone else anyway, so the button just doesn't offer what the server
          would refuse. Discussion (the default) shows every combat control;
          Personal hides them. Exempted from the collapse above (unlike
          Back/+/Move): toggling combat visibility is just as likely to be
          wanted while a node's quick-add ring is up as any other time. */}
      {isOwner && (
        <button
          type="button"
          className={`${iconBtn} ${isDiscussionMode ? idle : pressed}`}
          title={isDiscussionMode ? t.map.toolbar.discussionTooltip : t.map.toolbar.personalTooltip}
          onClick={onToggleMapMode}
        >
          {/* Plain text-presentation glyphs (no emoji variation selector), not
              the colorful emoji this used to be — matches the rest of this
              cluster's monochrome icons. */}
          {isDiscussionMode ? "⚔" : "✎"}
        </button>
      )}
    </div>
  );
}
