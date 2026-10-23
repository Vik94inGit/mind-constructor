import { memo, useMemo } from "react";
import type { ComponentProps, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { NodeCard } from "./NodeCard";
import type { NodeDoc, NodeType } from "../types";

/** What MapPage does when a card on the canvas is used. One object for every card, the same across renders (useStableActions). */
export type CanvasNodeActions = {
  inlineConfirm: (node: NodeDoc, text: string, type: NodeType) => void;
  inlineCancel: () => void;
  pointerDown: (node: NodeDoc, e: ReactPointerEvent) => void;
  click: (node: NodeDoc, e: ReactMouseEvent) => void;
  doubleClick: (node: NodeDoc) => void;
  contextMenu: (node: NodeDoc, e: ReactMouseEvent) => void;
  resize: (node: NodeDoc, size: { w: number; h: number }) => void;
  toggleBlockLock: (nodeId: string) => void;
  connectStart: (node: NodeDoc, e: ReactPointerEvent) => void;
  addBranch: (node: NodeDoc) => void;
  hoverText: (nodeId: string) => void;
  iconHover: (nodeId: string, hovered: boolean) => void;
};

type CardProps = ComponentProps<typeof NodeCard>;
type Callback =
  | "onInlineConfirm"
  | "onInlineCancel"
  | "onPointerDown"
  | "onClick"
  | "onDoubleClick"
  | "onContextMenu"
  | "onCardResize"
  | "onToggleBlockLock"
  | "onConnectStart"
  | "onAddBranch"
  | "onHoverText"
  | "onIconHover";

interface Props extends Omit<CardProps, Callback | "flightVector"> {
  actions: CanvasNodeActions;
  /** The viewer may resize this card (Node.cardW/cardH). */
  canResize: boolean;
  /** The viewer may lock or unlock this puzzle block. */
  canToggleLock: boolean;
  /** The viewer may link from this puzzle piece's tabs. */
  canConnect: boolean;
  /** This card's + button adds a branch. */
  canAddBranch: boolean;
  /** A strong attack: hovering its icon starts its Pac-Man run (utils/pacman.ts). */
  canChomp?: boolean;
  /** Weapon nodes only: NodeCard's flightVector, as plain numbers so an unchanged one doesn't look new. */
  flightX?: number;
  flightY?: number;
}

// One node on MapPage's canvas. MapPage re-renders on every pointer move of a
// drag or pan; this stays put unless something about its own node changed,
// because every prop it takes is a plain value or a stable object, and the
// per-node callbacks NodeCard wants are made here from the shared `actions`.
export const CanvasNodeCard = memo(function CanvasNodeCard({
  actions,
  canResize,
  canToggleLock,
  canConnect,
  canAddBranch,
  canChomp = false,
  flightX,
  flightY,
  ...card
}: Props) {
  const { node } = card;
  const flightVector = useMemo(
    () => (flightX === undefined || flightY === undefined ? undefined : { x: flightX, y: flightY }),
    [flightX, flightY],
  );
  return (
    <NodeCard
      {...card}
      flightVector={flightVector}
      onInlineConfirm={(text, type) => actions.inlineConfirm(node, text, type)}
      onInlineCancel={actions.inlineCancel}
      onPointerDown={card.inlineEditing ? undefined : (e) => actions.pointerDown(node, e)}
      onClick={(e) => actions.click(node, e)}
      onDoubleClick={() => actions.doubleClick(node)}
      onContextMenu={(e) => actions.contextMenu(node, e)}
      onCardResize={canResize ? (size) => actions.resize(node, size) : undefined}
      onToggleBlockLock={canToggleLock ? () => actions.toggleBlockLock(node.nodeId) : undefined}
      onConnectStart={canConnect ? (e) => actions.connectStart(node, e) : undefined}
      onAddBranch={canAddBranch ? () => actions.addBranch(node) : undefined}
      onHoverText={() => actions.hoverText(node.nodeId)}
      onIconHover={canChomp ? (hovered) => actions.iconHover(node.nodeId, hovered) : undefined}
    />
  );
});
