// Vanilla-DOM particle burst (no React state churn per particle — matches
// how short-lived, purely-visual effects are usually done: mutate the DOM
// directly, let a CSS animation carry it out, then remove the node).
export function burstParticles(container: HTMLElement | null, colors: string[], count = 12, velocityRange = 55) {
  if (!container) return;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement("div");
    particle.className = "absolute rounded-full pointer-events-none animate-outcome-particle-out";

    const size = Math.random() * 3 + 2;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];
    particle.style.boxShadow = `0 0 5px ${particle.style.background}`;
    particle.style.left = `calc(50% + ${Math.random() * 12 - 6}px)`;
    particle.style.top = `calc(50% + ${Math.random() * 12 - 6}px)`;

    const angle = Math.random() * Math.PI * 2;
    const velocity = Math.random() * velocityRange + 15;
    particle.style.setProperty("--px", `${Math.cos(angle) * velocity}px`);
    particle.style.setProperty("--py", `${Math.sin(angle) * velocity}px`);

    container.appendChild(particle);
    setTimeout(() => particle.remove(), 700);
  }
}

export const ANGEL_PARTICLE_COLORS = ["#00b0ff", "#90caf9", "#ffe082", "#ffffff"];
export const DEVIL_PARTICLE_COLORS = ["#ff3d00", "#ff9100", "#d50000", "#ffeb3b"];
// Every other node type doesn't have an angel/devil identity to draw a
// palette from — this is the generic "a node was just created" sparkle,
// in the app's own accent/gold tones instead of the outcome colors.
export const DEFAULT_PARTICLE_COLORS = ["#e08a3e", "#ffd166", "#ffffff", "#f1e1cc"];
// Impact spark for a weapon node landing at the end of its fly-in animation.
export const WEAPON_PARTICLE_COLORS = ["#c9ccd4", "#8a8f98", "#ff9100", "#ffffff"];
