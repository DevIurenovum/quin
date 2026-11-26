import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject } from '@angular/core';
import { BIRD_EYE, BIRD_PATH, BIRD_VIEWBOX } from './bird-path';

/** The copilot drawn in chalk: the outline traces itself in when it scrolls into view. */
@Component({
  selector: 'app-chalk-bird',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="viewBox" fill="none" aria-hidden="true">
      <g filter="url(#chalk-rough)" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <path class="trace" [attr.d]="path" pathLength="1" stroke-width="2.6" />
        <path class="trace late" d="M96 50 C104 62 108 70 116 64" pathLength="1" stroke-width="1.8" opacity=".6" />
        <path class="trace late" d="M120 36 L136 22 M112 44 L130 30" pathLength="1" stroke-width="1.6" opacity=".5" />
      </g>
      <circle class="eye" [attr.cx]="eye.x" [attr.cy]="eye.y" [attr.r]="eye.r" fill="currentColor" />
    </svg>
  `,
  styles: `
    :host { display: block; color: var(--chalk); }
    svg { display: block; width: 100%; height: auto; overflow: visible; }
    .trace { stroke-dasharray: 1; stroke-dashoffset: 1; }
    :host(.drawn) .trace { animation: trace 1.8s cubic-bezier(.6,.1,.3,1) forwards; }
    :host(.drawn) .late { animation-delay: 1.4s; animation-duration: .8s; }
    .eye { opacity: 0; transform-box: fill-box; transform-origin: center; }
    :host(.drawn) .eye { animation: pop .3s 1.9s ease-out forwards, blink 5s 3s infinite; }
    @keyframes trace { to { stroke-dashoffset: 0; } }
    @keyframes pop { to { opacity: 1; } }
    @keyframes blink { 0%, 94%, 100% { transform: scaleY(1); } 97% { transform: scaleY(.1); } }
    @media (prefers-reduced-motion: reduce) {
      .trace { stroke-dashoffset: 0; } .eye { opacity: 1; }
      :host(.drawn) .trace, :host(.drawn) .eye { animation: none; }
    }
  `,
})
export class ChalkBird {
  protected readonly path = BIRD_PATH;
  protected readonly eye = BIRD_EYE;
  protected readonly viewBox = `0 0 ${BIRD_VIEWBOX.w} ${BIRD_VIEWBOX.h}`;

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        el.classList.add('drawn');
        io.disconnect();
      }, { threshold: 0.4 });
      io.observe(el);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }
}
