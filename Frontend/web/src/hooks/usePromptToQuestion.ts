import type { Dispatch, SetStateAction } from "react";
import * as nodesApi from "../api/nodes";
import { ApiRequestError } from "../api/client";
import { nodeRefId } from "../utils/nodeType";
import { NEW_NODE_ID } from "../utils/zoneRules";
import type { MovingNode } from "../utils/zoneRules";
import { questionSpot } from "../utils/promptQuestion";
import { feature, track } from "../utils/usage";
import type { Translation } from "../i18n/translations";
import type { NodeDoc } from "../types";

type Pt = { x: number; y: number };

interface Params {
  mapId: string | undefined;
  nodes: NodeDoc[];
  posFor: (node: NodeDoc) => Pt;
  placeNode: (desired: Pt, moving: MovingNode[]) => Pt;
  upsertNode: (node: NodeDoc) => void;
  /** useNodeDragAndDrop's own save of a node (and its branch) hung from a new parent. */
  redirectParent: (child: NodeDoc, parent: NodeDoc) => Promise<boolean>;
  setCelebrateIds: Dispatch<SetStateAction<Set<string>>>;
  showNodes: (ids: string[]) => void;
  showNotice: (message: string) => void;
  setActionError: (message: string | null) => void;
  t: Translation;
}

// Turn a prompt into a question (utils/promptQuestion.ts): a Question node
// carrying the answered ghost's prompt is made where the answer hung, and
// the answer moves under it. The answer keeps its prompt, so Quiz me still
// asks it as before and nothing is lost if the Question is deleted later.
export function usePromptToQuestion({ mapId, nodes, posFor, placeNode, upsertNode, redirectParent, setCelebrateIds, showNodes, showNotice, setActionError, t }: Params) {
  async function promptToQuestion(answer: NodeDoc): Promise<boolean> {
    const prompt = answer.prompt?.trim();
    if (!mapId || !prompt) return false;
    feature("prompt_to_question");
    setActionError(null);
    const parentId = nodeRefId(answer.parentId) ?? null;
    const parent = parentId ? nodes.find((n) => n.nodeId === parentId) : undefined;
    const desired = questionSpot(posFor(answer), parent ? posFor(parent) : null);
    const at = placeNode(desired, [{ nodeId: NEW_NODE_ID, parentId }]);
    let question: NodeDoc;
    try {
      question = await nodesApi.createNode(mapId, { text: prompt, type: "Question", x: at.x, y: at.y, parentId });
    } catch (err) {
      setActionError(err instanceof ApiRequestError ? err.message : t.ui.canvas.promptToQuestionFailed);
      return false;
    }
    track({ name: "node_created", props: { type: "Question" } });
    upsertNode(question);
    setCelebrateIds((prev) => new Set(prev).add(question.nodeId));
    if (!(await redirectParent(answer, question))) return false;
    showNodes([question.nodeId, answer.nodeId]);
    showNotice(t.ui.canvas.promptToQuestionDone);
    return true;
  }
  return { promptToQuestion };
}
