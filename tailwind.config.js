/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  // Habilita las clases dark:... (por ejemplo dark:text-white): se activan cuando <html data-theme="dark">.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      // Colores con nombre: usan las variables de src/tema.scss, asi cambian solos con el tema (bg-app-surface, text-app-muted...).
      colors: {
        app: {
          body: 'var(--app-body)',
          bg: 'var(--app-bg)',
          surface: 'var(--app-surface)',
          surface2: 'var(--app-surface-2)',
          surface3: 'var(--app-surface-3)',
          border: 'var(--app-border)',
          border2: 'var(--app-border-2)',
          heading: 'var(--app-heading)',
          text: 'var(--app-text)',
          text2: 'var(--app-text-2)',
          muted: 'var(--app-muted)',
          subtle: 'var(--app-subtle)'
        },
        // Bloques de color suave: bg-tint-sky + border-tint-sky-border (y emerald, amber, rose, indigo).
        tint: {
          sky: 'var(--tint-sky-bg)', 'sky-border': 'var(--tint-sky-border)',
          emerald: 'var(--tint-emerald-bg)', 'emerald-border': 'var(--tint-emerald-border)',
          amber: 'var(--tint-amber-bg)', 'amber-border': 'var(--tint-amber-border)',
          rose: 'var(--tint-rose-bg)', 'rose-border': 'var(--tint-rose-border)',
          indigo: 'var(--tint-indigo-bg)', 'indigo-border': 'var(--tint-indigo-border)'
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        planta: {
          primary: '#2563eb',
          secondary: '#14b8a6',
          accent: '#7c3aed',
          neutral: '#172033',
          'base-100': '#ffffff',
          info: '#0ea5e9',
          success: '#16a34a',
          warning: '#f59e0b',
          error: '#dc2626'
        }
      },
      // Tema oscuro propio (azul marino profundo). Mismos nombres que usa daisyUI, solo cambian los valores.
      {
        dark: {
          'color-scheme': 'dark',
          primary: '#6d7bff',
          'primary-content': '#0a0f1f',
          secondary: '#2dd4bf',
          accent: '#a78bfa',
          neutral: '#1a2338',
          'neutral-content': '#dbe3f3',
          'base-100': '#0f1626',
          'base-200': '#0a101d',
          'base-300': '#060b15',
          'base-content': '#e6ebf5',
          info: '#38bdf8',
          'info-content': '#04202e',
          success: '#2fd88a',
          'success-content': '#04261a',
          warning: '#fbbf24',
          'warning-content': '#2b1c02',
          error: '#ff5c6c',
          'error-content': '#2a0509',
          '--rounded-box': '1rem',
          '--rounded-btn': '0.65rem',
          '--rounded-badge': '9999px'
        }
      }
    ]
  }
};
