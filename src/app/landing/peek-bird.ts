import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  inject,
  input,
  signal,
} from '@angular/core';
import type { Vector3Tuple } from 'three';
import { BirdViewer } from '../bird-viewer/bird-viewer';

/**
 * The 3D copilot peeking over the edge of whatever this sits on.
 * Place it with `bottom: 100%` on a card: the frame cuts the bird at the belly,
 * and it rises from behind the edge when it scrolls into view. The WebGL viewer
 * is only created once the spot gets close to the screen.
 */
@Component({
  selector: 'app-peek-bird',
  imports: [BirdViewer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.up]': 'up()', '[class.flip]': 'side() === "right"', 'aria-hidden': 'true' },
  template: `
    <div class="rise">
      @if (mounted()) {
        <app-bird-viewer [embedded]="true" [perch]="true" [cameraPosition]="camera" [target]="[0, 0.38, 0]" />
      }
    </div>
  `,
  styles: `
    :host {
      position: absolute;
      display: block;
      width: 220px;
      height: 180px;
      overflow: hidden;
      pointer-events: none;
      z-index: 3;
    }
    .rise {
      position: absolute;
      inset: 0;
      transform: translateY(85%);
      transition: transform 0.9s cubic-bezier(0.25, 1.4, 0.4, 1);
      pointer-events: auto;
    }
    :host(.up) .rise { transform: none; }
    /* canvas pushed down so the card edge hides the feet and belly */
    app-bird-viewer { position: absolute; inset: 22% 0 -50%; }
  `,
})
export class PeekBird {
  /** Which way the bird looks: toward the content on its left or right. */
  readonly side = input<'left' | 'right'>('left');
  protected readonly mounted = signal(false);
  protected readonly up = signal(false);
  protected camera: Vector3Tuple = [-1.44, 0.53, 0.68];

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // Beak points to -X: a camera on the +Z side sees it face left, on -Z face right.
      // Close-up framed so the edge cuts the bird at the chest.
      this.camera = this.side() === 'right' ? [-1.44, 0.53, -0.68] : [-1.44, 0.53, 0.68];
      const near = new IntersectionObserver(([e]) => e.isIntersecting && this.mounted.set(true), {
        rootMargin: '400px 0px',
      });
      const seen = new IntersectionObserver(([e]) => this.up.set(e.isIntersecting), { threshold: 0.6 });
      near.observe(el);
      seen.observe(el);
      destroyRef.onDestroy(() => {
        near.disconnect();
        seen.disconnect();
      });
    });
  }
}
