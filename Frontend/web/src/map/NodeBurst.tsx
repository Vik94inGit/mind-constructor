import type { CSSProperties } from "react";
// A deleted node's last moment, drawn where it stood: a bubble that pops
// (a ring and a few droplets), or for a negative node (Problem, Problematic
// option, Fail) a small boom — a flash, a shake and flying sparks. Purely
// decorative and gone after ~0.7s; MapPage removes it. Keyframes in index.css.
export const BURST_MS = 700;

const BITS = 8;

export function NodeBurst({ x, y, boom }: { x: number; y: number; boom: boolean }) {
  const size = boom ? 120 : 84;
  return (
    <div
      className="node-burst pointer-events-none absolute z-[35]"
      style={{ left: x, top: y, width: 0, height: 0, animation: boom ? "burst-shake 300ms ease-out" : undefined }}
      aria-hidden
    >
      {boom ? (
        <span
          className="absolute left-0 top-0 rounded-full"
          style={{
            width: size,
            height: size,
            background: "radial-gradient(circle, #fff6c2 0%, #ffb02e 35%, #e5482c 65%, transparent 72%)",
            animation: `burst-flash ${BURST_MS - 150}ms ease-out forwards`,
          }}
        />
      ) : (
        <span
          className="absolute left-0 top-0 rounded-full border-[3px] border-accent"
          style={{ width: size, height: size, animation: `burst-ring ${BURST_MS - 200}ms ease-out forwards` }}
        />
      )}
      {Array.from({ length: BITS }, (_, i) => {
        const a = (i / BITS) * Math.PI * 2 + (boom ? 0.2 : 0);
        const dist = boom ? 80 : 56;
        const bit = boom ? 9 : 10;
        return (
          <span
            key={i}
            className="absolute left-0 top-0 rounded-full"
            style={
              {
                width: bit,
                height: bit,
                background: boom ? (i % 2 ? "#ffb02e" : "#e5482c") : "color-mix(in srgb, var(--accent) 55%, transparent)",
                border: boom ? undefined : "1.5px solid var(--accent)",
                "--px": `${Math.round(Math.cos(a) * dist)}px`,
                "--py": `${Math.round(Math.sin(a) * dist)}px`,
                animation: `burst-bit ${BURST_MS - 100}ms cubic-bezier(.2,.7,.3,1) forwards`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
