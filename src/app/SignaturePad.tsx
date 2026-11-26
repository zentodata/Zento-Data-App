import { useEffect, useRef, useState } from "react";

// Lienzo de firma: funciona con dedo, lápiz táctil y mouse (Pointer Events)
export function SignaturePad({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [vacio, setVacio] = useState(!value);

  function blank() {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height); ctx.restore();
  }
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * dpr; c.height = c.offsetHeight * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr); ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#0b1220";
    blank();
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.offsetWidth / r.width), y: (e.clientY - r.top) * (c.offsetHeight / r.height) };
  };
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault(); ref.current!.setPointerCapture(e.pointerId);
    drawing.current = true; last.current = pos(e);
    const ctx = ref.current!.getContext("2d")!; const p = last.current;
    ctx.fillStyle = "#0b1220"; ctx.beginPath(); ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2); ctx.fill();
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    e.preventDefault();
    const ctx = ref.current!.getContext("2d")!; const p = pos(e);
    ctx.lineWidth = e.pointerType === "pen" && e.pressure > 0 ? 1.2 + e.pressure * 2.4 : 2.4;
    ctx.beginPath(); ctx.moveTo(last.current.x, last.current.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last.current = p;
    if (vacio) setVacio(false);
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false; last.current = null;
    setVacio(false);
    onChange(ref.current!.toDataURL("image/png"));
  }
  function limpiar() { blank(); setVacio(true); onChange(null); }

  return (
    <div>
      <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-[#1a2235] bg-white" style={{ height: 170 }}>
        <canvas ref={ref} className="w-full h-full block cursor-crosshair" style={{ touchAction: "none" }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
        {vacio && <span className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm pointer-events-none select-none">Firme aquí con el dedo o lápiz</span>}
        <div className="absolute left-4 right-4 bottom-7 border-b border-slate-300 pointer-events-none" />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className={`text-[11px] font-semibold ${vacio ? "text-[#5a6a80]" : "text-emerald-400"}`}>{vacio ? "Sin firma" : "✓ Firmado"}</span>
        <button type="button" onClick={limpiar} className="text-[11px] text-[#0ea5c8] hover:underline">Limpiar firma</button>
      </div>
    </div>
  );
}

