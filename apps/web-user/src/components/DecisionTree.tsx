/**
 * DecisionTree component — renders a tree and handles navigation.
 */
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { DecisionTree as DTree } from "@watany/types";
import { startTree, advanceTree, goBackTree, getCurrentNode, type TreeState } from "../lib/decision-tree";
import { useNavigateMode } from "../lib/routes";
import type { Mode } from "../store/app";

interface Props {
  tree: DTree;
  onComplete?: (nodeId: string) => void;
  onFreeform?: () => void;
}

const MODE_MAP: Record<string, Mode> = {
  salary: "salary",
  cases: "cases",
  forms: "procedures",
  procedures: "procedures",
  faq: "faq",
};

const ROUTE_MAP: Record<string, string> = {
  finance: "/salary",
  procedures: "/procedures",
  health: "/services/official",
  documents: "/documents",
  forms_catalog_open: "/forms",
  forms_general_open: "/forms/source/laf",
  forms_medical_open: "/forms/source/medical",
  forms_financial_open: "/forms/source/retirement",
  forms_family_open: "/forms/source/retirement?q=عائله",
  pension_attestation_open: "/salary",
  recruitment: "/services/recruitment",
  marketplace: "/marketplace",
  legal: "/legal",
};

const EVENT_MAP: Record<string, { name: string; detail?: Record<string, unknown> }> = {
  directory: { name: "watany-open-directory" },
  directory_banks_open: { name: "watany-open-directory", detail: { category: "banks" } },
};

export function DecisionTreeView({ tree, onComplete, onFreeform }: Readonly<Props>) {
  const [state, setState] = useState<TreeState>(() => startTree(tree));
  const navigateMode = useNavigateMode();
  const navigate = useNavigate();

  const node = getCurrentNode(tree, state);

  const handleButton = useCallback(
    (nextNodeId: string) => {
      const nextNode = tree.nodes[nextNodeId];

      // Action nodes navigate to app pages
      if (nextNode?.type === "action") {
        const eventConfig = EVENT_MAP[nextNodeId];
        if (eventConfig) {
          globalThis.dispatchEvent(new CustomEvent(eventConfig.name, { detail: eventConfig.detail ?? {} }));
          return;
        }

        const path = ROUTE_MAP[nextNodeId];
        if (path) {
          navigate(path);
          return;
        }
        const mode = MODE_MAP[nextNodeId];
        if (mode) {
          navigateMode(mode);
          return;
        }
        if (nextNodeId === "freeform") {
          onFreeform?.();
          return;
        }
      }

      setState(prev => advanceTree(prev, nextNodeId));
      onComplete?.(nextNodeId);
    },
    [tree, navigateMode, navigate, onComplete, onFreeform],
  );

  const handleBack = useCallback(() => {
    setState(prev => goBackTree(prev) ?? prev);
  }, []);

  if (!node) return null;

  return (
    <div className="decision-tree">
      {/* Breadcrumb */}
      {state.history.length > 0 && (
        <button className="dt-back" onClick={handleBack} type="button">
          → رجوع
        </button>
      )}

      <div className="dt-card">
        <h3 className="dt-title">{node.title}</h3>
        {node.body && <p className="dt-body">{node.body}</p>}

        {/* Result node */}
        {node.type === "result" && node.resultText && (
          <div className="dt-result">
            {node.resultText.split("\n").map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        )}

        {/* Buttons */}
        {node.buttons.length > 0 && (
          <div className="dt-buttons">
            {node.buttons.map((btn, index) => (
              <button
                key={`${state.currentNodeId}-${btn.nextNodeId}-${index}`}
                className="dt-btn"
                onClick={() => handleButton(btn.nextNodeId)}
                type="button"
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}

        {/* Leaf: show back to main */}
        {node.type === "result" && (
          <button
            className="dt-btn dt-btn-main"
            onClick={() => setState(startTree(tree))}
            type="button"
          >
            العودة للقائمة الرئيسية
          </button>
        )}
      </div>
    </div>
  );
}
