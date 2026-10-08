import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

interface Props {
  /** The type's own symbol (OutcomeBadge / NodeTypeIcon). */
  typeFace: ReactNode;
  emoji: string;
  /** Emoji face up by default (the viewer's "emoji first" mode); otherwise the type is. */
  emojiFirst: boolean;
  /** Turning true (the node was just chosen) flips the card over once and back. */
  selected: boolean;
  /** Each new non-zero value flips the card over once and back — MapPage's chosen-zone sequence (see useFlipSequence). */
  flipToken?: number;
  /** Emoji glyph size, px. */
  size?: number;
}

/** How long the back face stays up before the card turns home again, ms. */
export const FLIP_HOLD_MS = 900;

// A node's icon as a two-sided card: the emoji on one face, the type's own
// symbol on the other. Choosing the node turns it over once — a quick peek at
// the back — and it settles home again on its own, so the face that's up is
// always the viewer's choice (utils/emojiFace.ts), never stuck halfway.
export function NodeFlipIcon({ typeFace, emoji, emojiFirst, selected, flipToken = 0, size = 22 }: Props) {
  const [showBack, setShowBack] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function peek() {
    if (timer.current) clearTimeout(timer.current);
    setShowBack(true);
    timer.current = setTimeout(() => setShowBack(false), FLIP_HOLD_MS);
  }
  useEffect(() => {
    if (selected) peek();
  }, [selected]);
  useEffect(() => {
    if (flipToken) peek();
  }, [flipToken]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const emojiFace = (
    <span aria-hidden="true" className="leading-none" style={{ fontSize: size }}>
      {emoji}
    </span>
  );
  const face = "absolute inset-0 flex items-center justify-center [backface-visibility:hidden]";
  return (
    <div className="relative h-full w-full [perspective:220px]" data-testid="node-flip-icon" data-flipped={showBack}>
      <div
        className={`relative h-full w-full transition-transform duration-500 ease-[cubic-bezier(.4,1.4,.5,1)] [transform-style:preserve-3d] ${
          showBack ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        <div className={face}>{emojiFirst ? emojiFace : typeFace}</div>
        <div className={`${face} [transform:rotateY(180deg)]`}>{emojiFirst ? typeFace : emojiFace}</div>
      </div>
    </div>
  );
}
