import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { BIRD_EYE, BIRD_PATH } from './bird-path';

interface Step {
  title: string;
  text: string;
  /** How long the "video" stays on this chapter, ms. */
  hold: number;
  /** Device angle for this chapter, degrees: [rotateX, rotateY]. */
  angle: [number, number];
}

/** Side thickness of the device, built from stacked layers (px). */
const DEPTH = 12;

/**
 * "Así funciona", Apple-style: a CSS 3D iPhone that turns around when it enters the
 * screen, then plays the whole flow as chapters — SATJE check, new providencia,
 * WhatsApp alert, chat summary, deadline in the calendar. Each screen is re-created
 * on chapter change, so its CSS keyframes replay from the start.
 */
@Component({
  selector: 'app-phone-demo',
  templateUrl: './phone-demo.html',
  styleUrl: './phone-demo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.live]': 'started()',
    '(pointermove)': 'tilt($event)',
    '(pointerleave)': 'pointer.set([0, 0])',
  },
})
export class PhoneDemo {
  protected readonly birdPath = BIRD_PATH;
  protected readonly eye = BIRD_EYE;
  protected readonly layers = Array.from({ length: DEPTH }, (_, i) => i + 1);
  protected readonly depth = DEPTH;

  protected readonly steps: Step[] = [
    { title: 'Revisa el SATJE por ti.', text: 'Cada hora consulta todos los procesos que registraste. Tú no abres nada.', hold: 4400, angle: [6, -16] },
    { title: 'Detecta el movimiento.', text: 'Una providencia nueva en el juicio 17230-2025-04821, apenas se publica.', hold: 3600, angle: [3, 12] },
    { title: 'Te avisa por WhatsApp.', text: 'La alerta llega en segundos, donde ya estás todo el día.', hold: 3600, angle: [10, -6] },
    { title: 'Te explica qué pasó.', text: 'Resumen, qué te piden y cuándo vence. Respondes como a un colega.', hold: 7600, angle: [2, 0] },
    { title: 'Agenda el plazo.', text: 'Queda en tu panel con recordatorio. Cero plazos perdidos.', hold: 5200, angle: [5, 15] },
  ];

  protected readonly cases = [
    { id: '17230-2025-04821', who: 'U.J. Civil · Quito' },
    { id: '09332-2025-01177', who: 'U.J. Laboral · Guayaquil' },
    { id: '01283-2024-00932', who: 'U.J. Familia · Cuenca' },
    { id: '17294-2025-02210', who: 'U.J. Penal · Quito' },
    { id: '18282-2025-00415', who: 'U.J. Civil · Ambato' },
  ];

  /** Mon 23 Nov – Tue 1 Dec 2026; today is Wed 25, the deadline Mon 30. */
  protected readonly week = [
    ['L', 23], ['M', 24], ['X', 25], ['J', 26], ['V', 27], ['S', 28], ['D', 29], ['L', 30], ['M', 1],
  ] as const;

  protected readonly step = signal(0);
  protected readonly paused = signal(false);
  /** True once the device has turned around for the first time. */
  protected readonly started = signal(false);
  protected readonly pointer = signal<[number, number]>([0, 0]);
  /** Clock is ticking (not paused, on screen): drives the chapter bar's play state. */
  protected readonly running = signal(false);
  /** Full length of the current chapter, for its progress bar. */
  protected readonly chapterMs = signal(this.steps[0].hold);

  protected readonly transform = computed(() => {
    const [rx, ry] = this.steps[this.step()].angle;
    const [px, py] = this.pointer();
    return `rotateX(${rx - py * 8}deg) rotateY(${ry + px * 14}deg)`;
  });

  private timer = 0;
  private visible = false;
  private startedAt = 0;
  private remaining = 0;

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const io = new IntersectionObserver(
        ([e]) => {
          this.visible = e.isIntersecting;
          if (!this.visible) return this.halt();
          if (!this.started()) {
            this.started.set(true);
            // Let the turn-around intro play before the first chapter starts counting.
            this.remaining = this.steps[0].hold + 1600;
            this.chapterMs.set(this.remaining);
          }
          this.run();
        },
        { threshold: 0.35 },
      );
      io.observe(el);
      destroyRef.onDestroy(() => {
        io.disconnect();
        clearTimeout(this.timer);
      });
    });
  }

  go(i: number): void {
    this.step.set(i);
    this.remaining = this.steps[i].hold;
    this.chapterMs.set(this.remaining);
    this.paused.set(false);
    this.run();
  }

  toggle(): void {
    if (this.paused()) {
      this.paused.set(false);
      this.run();
    } else {
      this.halt();
      this.paused.set(true);
    }
  }

  protected tilt(e: PointerEvent): void {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.pointer.set([((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1]);
  }

  private run(): void {
    clearTimeout(this.timer);
    if (!this.visible || this.paused()) return;
    this.startedAt = performance.now();
    this.running.set(true);
    this.timer = window.setTimeout(() => {
      const next = (this.step() + 1) % this.steps.length;
      this.step.set(next);
      this.remaining = this.steps[next].hold;
      this.chapterMs.set(this.remaining);
      this.run();
    }, this.remaining || this.steps[this.step()].hold);
  }

  /** Stops the clock and remembers how much of the chapter was left. */
  private halt(): void {
    clearTimeout(this.timer);
    this.running.set(false);
    if (this.startedAt) {
      const left = (this.remaining || this.steps[this.step()].hold) - (performance.now() - this.startedAt);
      this.remaining = Math.max(400, left);
      this.startedAt = 0;
    }
  }
}
