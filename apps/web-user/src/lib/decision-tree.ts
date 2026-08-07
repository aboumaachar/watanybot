/**
 * Decision tree engine — manages navigation state through a tree of questions.
 */
import type { DecisionTree, DecisionNode } from "@watany/types";

export interface TreeState {
  treeId: string;
  currentNodeId: string;
  history: string[]; // stack of visited node IDs
}

/** Get the root node of a tree. */
export function startTree(tree: DecisionTree): TreeState {
  return {
    treeId: tree.id,
    currentNodeId: tree.rootNodeId,
    history: [],
  };
}

/** Navigate to a node via a button press. */
export function advanceTree(state: TreeState, nextNodeId: string): TreeState {
  return {
    ...state,
    history: [...state.history, state.currentNodeId],
    currentNodeId: nextNodeId,
  };
}

/** Go back one step. */
export function goBackTree(state: TreeState): TreeState | null {
  if (state.history.length === 0) return null;
  const history = [...state.history];
  const prev = history.pop()!;
  return {
    ...state,
    currentNodeId: prev,
    history,
  };
}

/** Get the current node from a tree. */
export function getCurrentNode(tree: DecisionTree, state: TreeState): DecisionNode | undefined {
  return tree.nodes[state.currentNodeId];
}

/** Check if the current node is a leaf (result/action/form/link). */
export function isLeaf(node: DecisionNode): boolean {
  return node.type !== "question" || node.buttons.length === 0;
}
