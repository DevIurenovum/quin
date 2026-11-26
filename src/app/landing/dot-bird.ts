import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  viewChild,
} from '@angular/core';
import { BIRD_EYE, BIRD_PATH, BIRD_VIEWBOX } from './bird-path';

const GAP = 11;
const DOT = 2.4;

interface Dot {
  x: number;
  y: number;
  /** 0 normal, 1 hidden (inside the silhouette), 2 eye. */
  kind: number;
  base: number;
  phase: number;
  /** Edge/vignette falloff, 0..1. */
  fade: number;
}

/**
 * A field of chalk-dust dots with the copilot carved out of it as negative space,
 * only its eye lit, like the reference. Dots brighten around the cursor.
 */
@Component({
  selector: 'app-dot-bird',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: `
    :host { position: absolute; inset: 0; display: block; pointer-events: none; }
    canvas { width: 100%; height: 100%; display: block; }
  `,
})
export class DotBird {
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  private dots: Dot[] = [];
  private mouse = { x: -1e4, y: -1e4 };
  private visible = false;
  private raf = 0;

  constructor() {
    afterNextRender(() => {
      const canvas = this.canvas().nativeElement;
      const ctx = canvas.getContext('2d')!;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

      const layout = () => {
        const dpr = Math.min(devicePixelRatio, 2);
        const { clientWidth: w, clientHeight: h } = this.host;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.dots = buildDots(w, h);
        draw(performance.now());
      };

      const draw = (now: number) => {
        const t = now / 1000;
        const { clientWidth: w, clientHeight: h } = this.host;
        ctx.clearRect(0, 0, w, h);
        // Blink: the eye goes dark for a moment every few seconds.
        const blink = t % 4.6 < 0.14 ? 0 : 1;
        for (const d of this.dots) {
          if (d.kind === 1) continue;
          let a: number;
          if (d.kind === 2) {
            a = (0.75 + 0.25 * Math.sin(t * 2.4)) * blink;
          } else {
            const dx = d.x - this.mouse.x;
            const dy = d.y - this.mouse.y;
            const near = Math.max(0, 1 - Math.hypot(dx, dy) / 140);
            a = (d.base * (0.6 + 0.4 * Math.sin(t * 1.3 + d.phase)) + near * 0.55) * d.fade;
          }
          if (a < 0.02) continue;
          ctx.fillStyle = `rgba(245,245,240,${a.toFixed(3)})`;
          const s = d.kind === 2 ? DOT + 1.2 : DOT;
          ctx.fillRect(d.x - s / 2, d.y - s / 2, s, s);
        }
      };

      const loop = (now: number) => {
        draw(now);
        this.raf = this.visible && !reduced ? requestAnimationFrame(loop) : 0;
      };

      const ro = new ResizeObserver(layout);
      ro.observe(this.host);
      const io = new IntersectionObserver(([e]) => {
        this.visible = e.isIntersecting;
        if (this.visible && !this.raf && !reduced) this.raf = requestAnimationFrame(loop);
      });
      io.observe(this.host);
      const onMove = (e: PointerEvent) => {
        const r = this.host.getBoundingClientRect();
        this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      };
      window.addEventListener('pointermove', onMove, { passive: true });

      this.destroyRef.onDestroy(() => {
        ro.disconnect();
        io.disconnect();
        cancelAnimationFrame(this.raf);
        window.removeEventListener('pointermove', onMove);
      });
    });
  }
}

/** Grid of dots, each tagged hidden/eye by sampling the silhouette drawn on an offscreen canvas. */
function buildDots(w: number, h: number): Dot[] {
  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = h;
  const m = mask.getContext('2d', { willReadFrequently: true })!;
  // Upper part of the field: the headline sits over the lower dots.
  const scale = Math.min((w * 0.5) / BIRD_VIEWBOX.w, (h * 0.62) / BIRD_VIEWBOX.h);
  m.translate(w / 2 - (BIRD_VIEWBOX.w * scale) / 2, h * 0.38 - (BIRD_VIEWBOX.h * scale) / 2);
  m.scale(scale, scale);
  m.fillStyle = '#f00';
  m.fill(new Path2D(BIRD_PATH));
  m.fillStyle = '#0f0';
  m.beginPath();
  m.arc(BIRD_EYE.x, BIRD_EYE.y, BIRD_EYE.r * 2.6, 0, Math.PI * 2);
  m.fill();
  const px = m.getImageData(0, 0, w, h).data;

  const dots: Dot[] = [];
  const cols = Math.floor(w / GAP);
  const rows = Math.floor(h / GAP);
  const ox = (w - (cols - 1) * GAP) / 2;
  const oy = (h - (rows - 1) * GAP) / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = ox + c * GAP;
      const y = oy + r * GAP;
      const i = (Math.round(y) * w + Math.round(x)) * 4;
      const kind = px[i + 1] > 128 ? 2 : px[i] > 128 ? 1 : 0;
      // Elliptical vignette, plus a soft fade at the top and bottom edges.
      const ex = (x - w / 2) / (w / 2);
      const ey = (y - h / 2) / (h / 2);
      const fade = Math.max(0, 1 - Math.pow(ex * ex * 0.55 + Math.pow(Math.max(0, ey), 2) * 0.6 + Math.pow(Math.min(0, ey), 2) * 0.35, 2.4));
      const bright = Math.random() < 0.05;
      dots.push({
        x,
        y,
        kind,
        base: bright ? 0.7 + Math.random() * 0.3 : 0.2 + Math.random() * 0.25,
        phase: Math.random() * Math.PI * 2,
        fade,
      });
    }
  }
  return dots;
}
