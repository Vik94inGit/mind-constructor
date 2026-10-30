import type { ReactNode } from "react";
import type { NodeShape } from "../types";

// A node's outline on the canvas (NodeDoc.shape): the usual circle, a
// rounded square, or a triangle. Only the icon's body changes — the
// selection ring, health ring and badges keep their places around it.

/** The rounding for the ring around the icon and the icon body itself. */
export function shapeRoundClass(shape: NodeShape | null | undefined): string {
  return shape === "square" ? "rounded-[24%]" : "rounded-full";
}

/** The icon body's own look: a filled, bordered circle or square — or, for a triangle, nothing of its own (TriangleBody draws it). */
export function shapeBodyClass(shape: NodeShape | null | undefined): string {
  return shape === "triangle"
    ? "relative"
    : `node-body ${shapeRoundClass(shape)} overflow-hidden border-2 bg-[var(--node-fill)] shadow-card`;
}

/** Wraps the icon's content in its shape: a triangle draws its outline behind the content and sits it toward the wide base. */
export function ShapeContent({ shape, color, children }: { shape: NodeShape | null | undefined; color: string; children: ReactNode }) {
  if (shape !== "triangle") return <>{children}</>;
  return (
    <>
      <svg
        aria-hidden="true"
        className="node-body-triangle pointer-events-none absolute inset-[-8%] h-[116%] w-[116%] overflow-visible drop-shadow-sm"
        viewBox="0 0 100 100"
        data-testid="node-shape-triangle"
      >
        <polygon points="50,6 96,90 4,90" fill="var(--node-fill)" stroke={color} strokeWidth="4.5" strokeLinejoin="round" />
      </svg>
      <span className="relative flex h-full w-full translate-y-[14%] scale-[0.7] items-center justify-center">{children}</span>
    </>
  );
}
