import React, { useEffect, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

const W = 320;
const H = 110;

// A box where a signature is drawn with the mouse, a finger or a pen. `onChange` gets a small PNG picture (a data address) when the person
// lifts the pen, and '' when the box is cleared. The box is always white with a dark pen, so the signature is clear on a printout.
export const SignaturePad: React.FC<{ label: string; value: string; onChange: (png: string) => void }> = ({ label, value, onChange }) => {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [touched, setTouched] = useState(Boolean(value));

  const paintBackground = () => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(14, H - 26);
    ctx.lineTo(W - 14, H - 26);
    ctx.stroke(); // the line to sign on
  };

  useEffect(() => {
    paintBackground();
    if (value) {
      const img = new Image();
      img.onload = () => canvas.current?.getContext('2d')?.drawImage(img, 0, 0, W, H);
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = point(e);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    setTouched(true);
    if (canvas.current) onChange(canvas.current.toDataURL('image/png'));
  };
  const clear = () => {
    paintBackground();
    setTouched(false);
    onChange('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="block text-xs font-medium text-slate-700">{label}</span>
        <button type="button" onClick={clear} disabled={!touched} className="text-[11px] text-blue-600 hover:underline disabled:text-slate-400 disabled:no-underline flex items-center gap-1">
          <Eraser className="w-3 h-3" />
          Clear
        </button>
      </div>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        aria-label={label}
        className="w-full rounded-lg border border-slate-300 touch-none cursor-crosshair bg-white"
        style={{ aspectRatio: `${W} / ${H}` }}
      />
      <p className="text-[11px] text-slate-400 mt-1">Draw the signature in the box with the mouse or a finger.</p>
    </div>
  );
};
