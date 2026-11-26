import { DestroyRef, Directive, ElementRef, afterNextRender, inject, input } from '@angular/core';

/**
 * Writes the element's text onto the board, letter by letter, the first time it scrolls into view.
 * Each character becomes a span with its index in `--i`; CSS (.chalk in styles.css) does the animation.
 * Only use it on static text: Angular bindings inside would be replaced by the split spans.
 */
@Directive({
  selector: '[chalk]',
  host: { class: 'chalk' },
})
export class Chalk {
  /** Milliseconds per letter. */
  readonly speed = input(28, { alias: 'chalkSpeed' });
  /** Milliseconds before the first letter. */
  readonly delay = input(0, { alias: 'chalkDelay' });

  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      const count = splitLetters(el);
      el.style.setProperty('--n', String(count));
      el.style.setProperty('--speed', `${this.speed()}ms`);
      el.style.setProperty('--delay', `${this.delay()}ms`);

      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          el.classList.add('written');
          io.disconnect();
        },
        { threshold: 0.35 },
      );
      io.observe(el);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }
}

function splitLetters(root: HTMLElement): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);

  let i = 0;
  for (const node of nodes) {
    if (node.parentElement?.closest('svg')) continue;
    const frag = document.createDocumentFragment();
    for (const part of node.data.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.append(' ');
        continue;
      }
      // Words stay unbroken; letters inside them get their own timing.
      const word = document.createElement('span');
      word.className = 'w';
      for (const ch of part) {
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = ch;
        c.style.setProperty('--i', String(i++));
        word.append(c);
      }
      frag.append(word);
    }
    node.replaceWith(frag);
  }
  return i;
}

/** Fades and lifts `.reveal` elements in the first time they scroll into view. */
@Directive({ selector: '.reveal' })
export class Reveal {
  constructor() {
    const el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const io = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          el.classList.add('shown');
          io.disconnect();
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
      );
      io.observe(el);
      destroyRef.onDestroy(() => io.disconnect());
    });
  }
}
