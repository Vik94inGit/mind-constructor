import type { NodeType } from "../types";
import { useUserState } from "../context/UserStateContext";
import { loadEmojiFirst, loadTypeEmoji, typeEmojiFor } from "../utils/emojiFace";
import type { TypeEmoji } from "../utils/emojiFace";
import { NodeTypeSymbol } from "./NodeTypeSymbol";

interface Props {
  type: NodeType;
  size: number;
  emojiFirst: boolean;
  typeEmoji: TypeEmoji;
}

// How a type reads for this viewer wherever a type is offered: in emoji
// first its emoji (utils/emojiFace.ts), else — and for a type kept on its
// symbol — the symbol its nodes wear (NodeTypeSymbol).
export function TypeFace({ type, size, emojiFirst, typeEmoji }: Props) {
  const emoji = emojiFirst ? typeEmojiFor(type, typeEmoji) : null;
  if (!emoji) return <NodeTypeSymbol type={type} size={size} />;
  return (
    <span aria-hidden className="inline-block text-center leading-none" style={{ fontSize: size, width: size + 2 }}>
      {emoji}
    </span>
  );
}

/** The viewer's emoji first and type emoji outside the map page: the saved preferences, else this browser's. */
export function useTypeFacePrefs(): { emojiFirst: boolean; typeEmoji: TypeEmoji } {
  const { preferences } = useUserState();
  return {
    emojiFirst: preferences?.emojiUp ?? loadEmojiFirst(),
    typeEmoji: preferences?.typeEmoji ?? loadTypeEmoji(),
  };
}

/** TypeFace with the viewer's own preferences (useTypeFacePrefs) — for the text → nodes flows. */
export function ViewerTypeFace({ type, size }: { type: NodeType; size: number }) {
  const prefs = useTypeFacePrefs();
  return <TypeFace type={type} size={size} {...prefs} />;
}
