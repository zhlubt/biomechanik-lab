import type { Prim } from "@/lib/jumpMotion";

/** Rendert eine Liste von SVG-Primitiven (aus lib/jumpMotion) als JSX. */
export function SvgPrims({ prims }: { prims: Prim[] }) {
  return (
    <>
      {prims.map((p, i) => {
        switch (p.k) {
          case "rect":
            return (
              <rect key={i} x={p.x} y={p.y} width={p.width} height={p.height} rx={p.rx} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} />
            );
          case "line":
            return (
              <line
                key={i}
                x1={p.x1}
                y1={p.y1}
                x2={p.x2}
                y2={p.y2}
                stroke={p.stroke}
                strokeWidth={p.sw}
                strokeDasharray={p.dash}
                strokeLinecap={p.cap as "round" | "butt" | "square" | undefined}
                opacity={p.opacity}
              />
            );
          case "circle":
            return (
              <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} stroke={p.stroke} strokeWidth={p.sw} opacity={p.opacity} />
            );
          case "ellipse":
            return <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} fill={p.fill} opacity={p.opacity} />;
          case "path":
            return (
              <path
                key={i}
                d={p.d}
                fill={p.fill}
                stroke={p.stroke}
                strokeWidth={p.sw}
                strokeDasharray={p.dash}
                strokeLinejoin={p.join as "round" | "miter" | "bevel" | undefined}
                strokeLinecap={p.cap as "round" | "butt" | "square" | undefined}
                opacity={p.opacity}
              />
            );
          case "text":
            return (
              <text
                key={i}
                x={p.x}
                y={p.y}
                fill={p.fill}
                fontSize={p.size}
                textAnchor={p.anchor as "start" | "middle" | "end" | undefined}
                fontWeight={p.weight}
                fontFamily={p.family}
              >
                {p.text}
              </text>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
