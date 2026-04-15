import confetti from 'canvas-confetti';

/**
 * Fires a confetti burst inside the Shadow DOM by creating a canvas element.
 * @param {ShadowRoot} shadowRoot
 */
export function fireConfetti(shadowRoot) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    pointer-events: none;
    z-index: 2147483647;
  `;
  shadowRoot.appendChild(canvas);

  const myConfetti = confetti.create(canvas, { resize: true, useWorker: false });
  myConfetti({
    particleCount: 120,
    spread: 80,
    origin: { y: 0.6 },
    colors: ['#4f46e5', '#7c3aed', '#22c55e', '#f59e0b', '#ec4899']
  });

  setTimeout(() => canvas.remove(), 4000);
}
