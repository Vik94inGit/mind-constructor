import { OutcomeBadge, ringKindFor } from "../OutcomeBadge";
import type { OutcomeType } from "../OutcomeBadge";
import { NodeTypeIcon } from "../NodeTypeIcon";
import { NodeFlipIcon } from "../NodeFlipIcon";
import { ShapeContent, shapeBodyClass, shapeRoundClass } from "../nodeShape";
import { nodeEmojiFace } from "../../utils/emojiFace";
import type { TypeEmoji } from "../../utils/emojiFace";
import { imageSrc } from "../../utils/images";
import { useI18n } from "../../i18n/I18nContext";
import type { NodeDoc, NodeType } from "../../types";

// Sized close to NodeTypeIcon's 21px, so an outcome type's filled symbol
// and an "unknown" node's line icon read as the same kind of glyph.
const OUTCOME_BADGE_SIZE = 26;

// A node's outline in its type's color, toned down so a map full of nodes
// doesn't read as a field of bright rims. --node-edge-mix: full strength over
// a picture background (index.css's canvas-on-picture), where a
// half-see-through rim gets lost.
export function softEdge(color: string): string {
  return `color-mix(in srgb, ${color} var(--node-edge-mix, 55%), transparent)`;
}

interface Props {
  node: NodeDoc;
  /** The type shown: the live draft while editing inline, else the node's own. */
  displayType: NodeType;
  /** The type's ring color (or under fire, or a check/cross override). */
  color: string;
  /** Editing inline: the face is a button that cycles the type. */
  editing: boolean;
  onCycleType: () => void;
  emojiFirst: boolean;
  typeEmoji: TypeEmoji;
  selected: boolean;
  flipToken?: number;
}

/**
 * Inside a node's round icon: its type's symbol (or picture icon), and, when
 * it has an emoji, the two-sided card that turns over when the node is
 * chosen (NodeFlipIcon). The inner fill is --node-fill, the same one the
 * quick-add ghosts use, so a ghost previews the real look.
 */
export function NodeFace({ node, displayType, color, editing, onCycleType, emojiFirst, typeEmoji, selected, flipToken }: Props) {
  const { t } = useI18n();
  const isOutcome = !!ringKindFor(displayType);
  return (
    <>
      {editing ? (
        <button
          type="button"
          className={`flex h-full w-full cursor-pointer items-center justify-center p-0 font-[inherit] hover:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_35%,transparent)] ${shapeBodyClass(node.shape)}`}
          style={{ borderColor: softEdge(color) }}
          title={t.ui.node.clickToChangeType}
          aria-label={`${t.ui.types[displayType]} — ${t.ui.node.clickToChangeType}`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onCycleType();
          }}
        >
          <ShapeContent shape={node.shape} color={color}>
            {isOutcome ? (
              <OutcomeBadge
                type={displayType as OutcomeType}
                size={OUTCOME_BADGE_SIZE}
                symbolOverride={node.symbolOverride}
              />
            ) : (
              <NodeTypeIcon type={displayType} size={21} />
            )}
          </ShapeContent>
        </button>
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center ${shapeBodyClass(node.shape)}`}
          style={{ borderColor: softEdge(color) }}
        >
          {(() => {
            // A picture icon (NodeDoc.iconImage) stands in for the type's
            // symbol; the ring's color still says the type. A node with a
            // picture card shows that picture only, never an icon too.
            const typeFace = node.iconImage && !node.cardImage ? (
              <img src={imageSrc(node.iconImage)} alt="" className={`h-full w-full ${shapeRoundClass(node.shape)} object-cover`} draggable={false} />
            ) : isOutcome ? (
              <OutcomeBadge
                type={displayType as OutcomeType}
                size={OUTCOME_BADGE_SIZE}
                symbolOverride={node.symbolOverride}
              />
            ) : (
              <NodeTypeIcon type={displayType} size={21} />
            );
            // With an emoji the icon is a two-sided card that turns over
            // once when the node is chosen (see NodeFlipIcon).
            // In emoji first a node without its own emoji wears its
            // type's, and a still one never turns (utils/emojiFace.ts).
            const face = nodeEmojiFace(node, emojiFirst, typeEmoji);
            return (
              <ShapeContent shape={node.shape} color={color}>
                {face.emoji ? (
                  <NodeFlipIcon
                    typeFace={typeFace}
                    emoji={face.emoji}
                    emojiFirst={face.emojiUp}
                    selected={selected}
                    flipToken={flipToken}
                    still={!face.flips}
                  />
                ) : (
                  typeFace
                )}
              </ShapeContent>
            );
          })()}
        </div>
      )}
    </>
  );
}
