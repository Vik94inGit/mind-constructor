// Turn a prompt into a question: a ghost's prompt (Node.prompt, the question a
// template asks) is only a placeholder, so once the ghost is answered the
// question no longer shows anywhere. This puts it on the map as a Question
// node of its own, hung where the answer was, with the answer hanging from it,
// so the map keeps saying what the answer was about.
import { nodeRefId } from "./nodeType";
import { NODE_FOOTPRINT } from "./canvasLayout";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

const same = (a: string | undefined, b: string) => (a ?? "").trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Whether `node`'s prompt can become a Question node: it has a prompt, it is
 * answered (it has its own text or title), it is a thought rather than an
 * attack or a shield, and the question isn't on the map above it already.
 */
export function canTurnPromptIntoQuestion(node: NodeDoc, nodes: NodeDoc[]): boolean {
  const prompt = node.prompt?.trim();
  if (!prompt) return false;
  if (!node.text?.trim() && !node.title?.trim()) return false;
  if (node.isWeapon || node.isProtection) return false;
  const parentId = nodeRefId(node.parentId);
  const parent = parentId ? nodes.find((n) => n.nodeId === parentId) : undefined;
  if (parent && parent.type === "Question" && (same(parent.text, prompt) || same(parent.title, prompt))) return false;
  return true;
}

/**
 * Where the new Question goes before the zone rules settle it: between the
 * answer and its parent, so the line still reads parent → question → answer;
 * with no parent, just above the answer.
 */
export function questionSpot(answerAt: Pt, parentAt: Pt | null): Pt {
  if (!parentAt) return { x: answerAt.x, y: answerAt.y - NODE_FOOTPRINT.h * 1.5 };
  return { x: (answerAt.x + parentAt.x) / 2, y: (answerAt.y + parentAt.y) / 2 };
}
