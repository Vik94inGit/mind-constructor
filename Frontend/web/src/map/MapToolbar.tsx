import { useState } from "react";
import type { TypeEmoji } from "../utils/emojiFace";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n/I18nContext";
import { ThemeToggle } from "../components/ThemeToggle";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { AddMenu } from "./AddMenu";
import { DisplayMenu } from "./DisplayMenu";
import { NodeSearch } from "./NodeSearch";
import type { MapBackground, NodeDoc, NodeType } from "../types";
import type { ZoneLayout } from "../utils/zoneLayout";

// Which commit this build is (Vercel fills VITE_VERCEL_GIT_COMMIT_SHA in on
// every deploy), shown small under the theme toggle so it's easy to tell
// whether a deploy has reached the browser. Empty in local builds.
const BUILD = (import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7);

interface Props {
  /** A demo session has exactly the one map it was seeded with — no way back to a dashboard. */
  isDemo: boolean;
  isOwner: boolean;
  isDiscussionMode: boolean;
  /** Offline: battle mode is paused and can't be switched (see MapPage). */
  offline?: boolean;
  /** Show the full cluster; false collapses it to a single "⋮" while a node's quick-add ring is up. */
  expanded: boolean;
  onExpand: () => void;
  moveMode: boolean;
  onToggleMove: () => void;
  /** Drawing a separator line (see DrawLineBar). */
  drawMode: boolean;
  onToggleDraw: () => void;
  compact: boolean;
  onToggleCompact: () => void;
  emojiFirst: boolean;
  onToggleEmojiFirst: () => void;
  /** The viewer's own emoji per type — see DisplayMenu. */
  typeEmoji?: TypeEmoji;
  onTypeEmoji?: (type: NodeType, emoji: string | null) => void;
  /** How the whole map draws its zones — see DisplayMenu. */
  zoneLayout?: ZoneLayout;
  onPickZoneLayout?: (layout: ZoneLayout) => void;
  /** The map's canvas — see DisplayMenu. onPickBackground only for the map's owner. */
  background?: MapBackground | null;
  onPickBackground?: (background: MapBackground) => void;
  /** Node search (see NodeSearch). */
  nodes: NodeDoc[];
  onLoadTexts: () => Promise<void>;
  onSearchMatches: (ids: Set<string> | null) => void;
  onPickSearchResult: (nodeId: string) => void;
  /** Node types picked in the search (empty = all); the rest dim. */
  nodeTypeFilter: NodeType[];
  onNodeTypeFilter: (types: NodeType[]) => void;
  onToggleMapMode: () => void;
  /** Discussion mode: opens the opponent's turn (see SiegePanel). */
  onOpponentTurn?: () => void;
  /** Ending the discussion (see utils/finish.ts): the owner's Finish, or another member's agree toggle. Absent: no button. */
  finish?: { title: string; pressed: boolean; muted: boolean; onClick: () => void };
  /** Opens the discussion's history of changes (map/HistoryPanel.tsx). */
  onHistory?: () => void;
  /** Demo sessions only: leave the demo (log out) to log in or register. */
  onExitDemo: () => void;
  onInvite: () => void;
  onCreateNode: () => void;
  onCreateCircle: () => void;
  onCopyMap: () => void;
  onPaste: () => void;
  onExportText: () => void;
  /** Deletes the whole map (owner only — see AddMenu). */
  onDeleteMap: () => void;
  /** Enters presentation mode (see MapPage's own presenting/PresentationOverlay) — offered from the display (layers icon) menu below. Not owner-gated — anyone viewing a map should be able to self-present it. */
  onPresent: () => void;
  /** Puts the last move back (hooks/useMoveUndo.ts); the button greys out with nothing to undo. */
  onUndo?: () => void;
  onTimeLapse?: () => void;
  canUndo?: boolean;
  /** Computer mode (see hooks/useDesktopLayout): a panel docked down the left edge instead of a floating top-left cluster. */
  vertical?: boolean;
}

const iconBtn =
  "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border text-[0.95rem] font-semibold hover:bg-surface-2";
const idle = "border-transparent bg-transparent text-ink";
const pressed = "border-accent bg-accent-soft text-accent-ink";

// The whole top toolbar collapses to this one compact floating cluster — Back
// + a single "+" menu (Invite/Create/Node types) + Move + display options —
// pinned top-left instead of a separate full-width bar. z-[45] like the
// minimap/zoom-controls cluster: above canvas/panel, below a real modal.
export function MapToolbar({
  isDemo,
  isOwner,
  isDiscussionMode,
  offline,
  onOpponentTurn,
  finish,
  onHistory,
  expanded,
  onExpand,
  moveMode,
  onToggleMove,
  drawMode,
  onToggleDraw,
  compact,
  onToggleCompact,
  emojiFirst,
  onToggleEmojiFirst,
  typeEmoji,
  onTypeEmoji,
  zoneLayout,
  onPickZoneLayout,
  background,
  onPickBackground,
  nodes,
  onLoadTexts,
  onSearchMatches,
  onPickSearchResult,
  nodeTypeFilter,
  onNodeTypeFilter,
  onToggleMapMode,
  onExitDemo,
  onInvite,
  onCreateNode,
  onCreateCircle,
  onCopyMap,
  onPaste,
  onExportText,
  onDeleteMap,
  onPresent,
  onUndo,
  onTimeLapse,
  canUndo = false,
  vertical = false,
}: Props) {
  const { t } = useI18n();
  // Each dropdown's own open/closed state.
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showDisplayMenu, setShowDisplayMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  // A menu item closes the menu, then does its thing.
  const closeAddThen = (action: () => void) => () => {
    setShowAddMenu(false);
    action();
  };

  // Menus open beside a docked panel's button rather than below it.
  const side = vertical ? "right" : "below";
  // The docked panel never covers the canvas, so it has no reason to collapse.
  const showAll = expanded || vertical;

  return (
    <div
      className={
        vertical
          ? "z-[45] flex h-full w-[4.75rem] shrink-0 flex-col items-center gap-1 border-r border-line bg-surface px-1 py-2 shadow-card"
          : // Wraps onto a second row rather than running off a phone's edge
            // (discussion mode adds the opponent, history and finish buttons).
            "absolute top-3 left-3 z-[45] flex max-w-[calc(100%-1.5rem)] flex-wrap items-center gap-1 rounded-card border border-line bg-surface p-1 shadow-card"
      }
      role={vertical ? "navigation" : undefined}
    >
      {showAll ? (
        <>
          {!isDemo && (
            <Link
              to="/"
              // Replaces the map's back guard (see useBackGuard) rather than
              // stacking the dashboard on top of it.
              replace
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
                side={side}
                isOwner={isOwner}
                onClose={() => setShowAddMenu(false)}
                onInvite={closeAddThen(onInvite)}
                onCreateNode={closeAddThen(onCreateNode)}
                onCreateCircle={closeAddThen(onCreateCircle)}
                onCopyMap={closeAddThen(onCopyMap)}
                onPaste={closeAddThen(onPaste)}
                onExportText={closeAddThen(onExportText)}
                onDeleteMap={isDemo ? undefined : closeAddThen(onDeleteMap)}
              />
            )}
          </div>
          {/* Off by default — arming drag from a bare pointerdown would read
              as accidental relocation on any touch imprecision. */}
          <button
            type="button"
            className={`${iconBtn} ${moveMode ? pressed : idle}`}
            title={moveMode ? t.map.toolbar.moveOn : t.map.toolbar.moveOff}
            onClick={onToggleMove}
          >
            ✥
          </button>
          {onUndo && (
            <button
              type="button"
              className={`${iconBtn} ${idle} disabled:cursor-not-allowed disabled:opacity-40`}
              title={t.map.toolbar.undo}
              aria-label={t.map.toolbar.undo}
              disabled={!canUndo}
              onClick={onUndo}
            >
              ↶
            </button>
          )}
          {/* Draw a separator line: click empty spots to place its points. */}
          <button
            type="button"
            className={`${iconBtn} ${drawMode ? pressed : idle}`}
            title={t.ui.lines.toolbar}
            onClick={onToggleDraw}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M2.5 13 L13.5 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
            </svg>
          </button>
          {/* Display options — compact view, emoji first, zone layouts and
              presentation. Layers icon, not an eye: the eye in the bottom-right
              corner (ViewCorner) owns how much detail the map shows, reading
              mode included, so this menu doesn't repeat it. */}
          <div className="relative">
            <button
              type="button"
              className={`${iconBtn} ${showDisplayMenu ? pressed : idle}`}
              title={t.map.toolbar.displayMenu}
              aria-expanded={showDisplayMenu}
              onClick={() => setShowDisplayMenu((v) => !v)}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M8 1.8 L14.5 5 L8 8.2 L1.5 5 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="none" />
                <path d="M1.5 8 L8 11.2 L14.5 8" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" fill="none" />
                <path d="M1.5 11 L8 14.2 L14.5 11" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" fill="none" />
              </svg>
            </button>
            {showDisplayMenu && (
              <DisplayMenu
                side={side}
                compact={compact}
                onToggleCompact={onToggleCompact}
                emojiFirst={emojiFirst}
                onToggleEmojiFirst={onToggleEmojiFirst}
                typeEmoji={typeEmoji}
                onTypeEmoji={onTypeEmoji}
                zoneLayout={zoneLayout}
                onPickZoneLayout={onPickZoneLayout}
                background={background}
                onPickBackground={onPickBackground}
                onPresent={() => {
                  setShowDisplayMenu(false);
                  onPresent();
                }}
                onTimeLapse={
                  onTimeLapse &&
                  (() => {
                    setShowDisplayMenu(false);
                    onTimeLapse();
                  })
                }
                onClose={() => setShowDisplayMenu(false)}
              />
            )}
          </div>
          {/* Node search — find a node by its title/text; the matches stay lit. */}
          <div className="relative">
            <button
              type="button"
              className={`${iconBtn} relative ${showSearch || nodeTypeFilter.length > 0 ? pressed : idle}`}
              title={nodeTypeFilter.length > 0 ? `${t.ui.search.title} · ${t.ui.search.filtered(nodeTypeFilter.length)}` : t.ui.search.title}
              onClick={() => setShowSearch((v) => !v)}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="6.5" cy="6.5" r="4.2" stroke="currentColor" strokeWidth="1.8" fill="none" />
                <path d="M9.8 9.8 L14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              {nodeTypeFilter.length > 0 && (
                <span className="absolute -right-[2px] -top-[2px] h-[7px] w-[7px] rounded-full bg-accent" aria-hidden="true" />
              )}
            </button>
            {showSearch && (
              <NodeSearch
                side={side}
                nodes={nodes}
                onLoadTexts={onLoadTexts}
                onMatches={onSearchMatches}
                onPick={onPickSearchResult}
                types={nodeTypeFilter}
                onTypes={onNodeTypeFilter}
                onClose={() => setShowSearch(false)}
              />
            )}
          </div>
          {/* The global Navbar (which normally hosts these) is hidden on the
              map route — see App.tsx's onMapPage check — so this is the only
              place a map-page user can reach them. */}
          {/* Docked: pinned to the bottom of the panel, like a taskbar's tray. */}
          <div
            className={
              vertical
                ? "order-last mt-auto flex flex-col items-center gap-1 border-t border-line pt-2"
                : "ml-1 flex items-center gap-1 border-l border-line pl-1"
            }
          >
            <LanguageSwitcher />
            <ThemeToggle />
            {BUILD && <span className="text-[0.6rem] text-ink-soft select-all">{BUILD}</span>}
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
          title={
            offline
              ? t.map.toolbar.discussionOffline
              : isDiscussionMode
                ? t.map.toolbar.discussionTooltip
                : t.map.toolbar.personalTooltip
          }
          disabled={offline}
          onClick={onToggleMapMode}
        >
          {/* Plain text-presentation glyphs (no emoji variation selector), not
              a colorful emoji — matches the rest of this cluster's
              monochrome icons. */}
          {isDiscussionMode ? "⚔" : "✎"}
        </button>
      )}
      {/* The opponent's turn: an imitated opponent attacks one of your
          castles (see SiegePanel). Owner-only for the same reason as the
          toggle — it attacks with whatever type the strategy calls for,
          which only the owner may do in battle mode. */}
      {isOwner && isDiscussionMode && onOpponentTurn && (
        <button type="button" className={`${iconBtn} ${idle}`} title={t.ui.siege.open} onClick={onOpponentTurn}>
          ♜
        </button>
      )}
      {/* Finish the discussion (owner) or agree to finish (everyone else) —
          muted while the owner may not finish yet; the press then says why. */}
      {isDiscussionMode && onHistory && (
        <button type="button" className={`${iconBtn} ${idle}`} title={t.ui.siege.history.open} onClick={onHistory}>
          ◷
        </button>
      )}
      {isDiscussionMode && finish && (
        <button
          type="button"
          className={`${iconBtn} ${finish.pressed ? pressed : idle} ${finish.muted ? "opacity-50" : ""}`}
          title={finish.title}
          aria-pressed={finish.pressed}
          onClick={finish.onClick}
        >
          ⚐
        </button>
      )}
      {/* A demo session has no dashboard to go back to (see ProtectedRoute) and
          the global Navbar is hidden here, so this is its only way out to the
          login page. Kept outside the collapse, like the mode toggle. */}
      {isDemo && (
        <button
          type="button"
          className={`${vertical ? "mt-1 w-full whitespace-normal" : "ml-1 whitespace-nowrap"} inline-flex min-h-7 cursor-pointer items-center justify-center rounded-md border border-line bg-transparent px-2 text-[0.72rem] font-semibold text-ink hover:bg-surface-2`}
          title={t.ui.demo.exitTitle}
          onClick={onExitDemo}
        >
          {t.ui.demo.exit}
        </button>
      )}
    </div>
  );
}
