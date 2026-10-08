import type { ReactNode } from "react";

interface Props {
  /** The type's own symbol (OutcomeBadge / NodeTypeIcon). */
  typeFace: ReactNode;
  emoji: string;
  /** Emoji face up by default (the viewer's "emoji first" mode); otherwise the type is. */
  emojiFirst: boolean;
  /** Shows the back face — set while the node is selected, so a tap flips it on touch too. */
  flipped: boolean;
  /** Emoji glyph size, px. */
  size?: number;
}

// A node's icon as a two-sided card: the emoji on one face, the type's own
// symbol on the other, turning over (a 3D flip) to show the back while the
// node is hovered or selected. Which face is the front is the viewer's
// choice (utils/emojiFace.ts). Sits inside NodeCard's round icon, whose
// `group` class drives the hover flip.
export function NodeFlipIcon({ typeFace, emoji, emojiFirst, flipped, size = 22 }: Props) {
  const emojiFace = (
    <span aria-hidden="true" className="leading-none" style={{ fontSize: size }}>
      {emoji}
    </span>
  );
  const face = "absolute inset-0 flex items-center justify-center [backface-visibility:hidden]";
  return (
    <div className="relative h-full w-full [perspective:220px]" data-testid="node-flip-icon">
      <div
        className={`relative h-full w-full transition-transform duration-500 ease-[cubic-bezier(.4,1.4,.5,1)] [transform-style:preserve-3d] ${
          flipped ? "[transform:rotateY(180deg)]" : "group-hover:[transform:rotateY(180deg)]"
        }`}
      >
        <div className={face}>{emojiFirst ? emojiFace : typeFace}</div>
        <div className={`${face} [transform:rotateY(180deg)]`}>{emojiFirst ? typeFace : emojiFace}</div>
      </div>
    </div>
  );
}
