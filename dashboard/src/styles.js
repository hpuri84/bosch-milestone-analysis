// Global styles injected into document head
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap');

:root {
  --bg-primary: #f5f6f8;
  --bg-secondary: #ebedf2;
  --bg-card: #ffffff;
  --bg-card-hover: #f8f9fb;
  --bg-accent: #eef1f6;
  --border: #e2e6ed;
  --border-accent: #cdd3de;
  --text-primary: #1a1f36;
  --text-secondary: #4a5568;
  --text-muted: #8896a6;
  --accent-blue: #2563eb;
  --accent-cyan: #0891b2;
  --accent-green: #16a34a;
  --accent-amber: #d97706;
  --accent-red: #dc2626;
  --accent-purple: #7c3aed;
  --accent-maersk: #00a1de;
  --accent-bosch: #ea0016;
  --font-display: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: 'IBM Plex Mono', 'SF Mono', Menlo, monospace;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-lg: 0 4px 16px rgba(0,0,0,0.08);
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
