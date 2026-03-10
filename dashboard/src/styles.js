// Global styles injected into document head
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Outfit:wght@300;400;500;600;700&display=swap');

:root {
  --bg-primary: #0a0e14;
  --bg-secondary: #111820;
  --bg-card: #151c27;
  --bg-card-hover: #1a2233;
  --bg-accent: #1c2536;
  --border: #1e2a3a;
  --border-accent: #2a3a50;
  --text-primary: #e8edf4;
  --text-secondary: #8494a7;
  --text-muted: #556373;
  --accent-blue: #3b82f6;
  --accent-cyan: #22d3ee;
  --accent-green: #34d399;
  --accent-amber: #fbbf24;
  --accent-red: #f87171;
  --accent-purple: #a78bfa;
  --accent-maersk: #00a1de;
  --accent-bosch: #ea0016;
  --font-display: 'Outfit', sans-serif;
  --font-mono: 'DM Mono', monospace;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-display);
  overflow-x: hidden;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: var(--bg-secondary);
}
::-webkit-scrollbar-thumb {
  background: var(--border-accent);
  border-radius: 3px;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulseGlow {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.8; }
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}
`;

export function injectGlobalStyles() {
  if (document.getElementById('bosch-dashboard-styles')) return;
  const style = document.createElement('style');
  style.id = 'bosch-dashboard-styles';
  style.textContent = GLOBAL_CSS;
  document.head.appendChild(style);
}
