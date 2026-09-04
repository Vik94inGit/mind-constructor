const PALETTE = [
  "#e08a3e",
  "#22c55e",
  "#3b82f6",
  "#a855f7",
  "#ef4444",
  "#eab308",
  "#14b8a6",
  "#ec4899",
];

export function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-[0.4rem]">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          className={`h-[26px] w-[26px] cursor-pointer rounded-full border-2 border-line${
            value === c ? " outline outline-2 outline-accent outline-offset-2" : ""
          }`}
          style={{ background: c }}
          aria-label={c}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}
