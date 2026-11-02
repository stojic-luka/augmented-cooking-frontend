import {
  createTheme,
  defaultVariantColorsResolver,
  type AlertProps,
  type MantineColorsTuple,
  type MantineTheme,
  type VariantColorsResolver,
} from '@mantine/core';

/*
 * Meridian design system — Mantine theme.
 *
 * Color EXACTNESS lives in `src/styles/globals.css`: Mantine 9 derives every
 * variant (filled/light/outline…) from per-color semantic CSS variables
 * (`--mantine-color-<name>-filled`, `-light`, …). Those are pinned there to the
 * Meridian tokens per color scheme, which is why the tuples below only need to
 * be sane ramps — the semantic vars override the shade-derived defaults.
 *
 * Mantine 9 shade derivation for reference: light scheme filled = shade 6,
 * filled-hover = shade 7; dark scheme filled = shade 8, filled-hover = shade 9.
 */

/* Brand — indigo #5e6ad2. Tint ramp for `light` backgrounds + direct shade refs. */
const brand: MantineColorsTuple = [
  '#eef0f9',
  '#e0e3f5',
  '#c3c9ee',
  '#a5abea',
  '#8f99e2',
  '#767fdb',
  '#5e6ad2',
  '#4d59c9',
  '#3f45a0',
  '#323687',
];

/* Cool neutrals. gray[2] ≈ hairline border, gray[3] = border-strong, gray[6] = secondary text. */
const gray: MantineColorsTuple = [
  '#ffffff',
  '#f7f7f8',
  '#e9e9ec',
  '#d5d6db',
  '#b9bcc3',
  '#a5a8b0',
  '#5d6470',
  '#454b55',
  '#22252c',
  '#191a20',
];

/* Mantine reads the "dark" scale for dark-scheme surfaces/text:
   [0] primary text · [2] dimmed · [4] borders · [7]/[8]/[9] page tones. */
const dark: MantineColorsTuple = [
  '#f2f3f5',
  '#c9ced6',
  '#a9b0ba',
  '#8f96a2',
  '#22252c',
  '#1a1d23',
  '#171a20',
  '#101216',
  '#0e1013',
  '#08090b',
];

const green: MantineColorsTuple = [
  '#e7f5ed',
  '#cfe9da',
  '#a6dcbf',
  '#79cd9f',
  '#52c492',
  '#46b58a',
  '#2e9964',
  '#1c7a4d',
  '#166040',
  '#0f472c',
];

const yellow: MantineColorsTuple = [
  '#fdf3e0',
  '#f8e5ba',
  '#f2d290',
  '#f7c95c',
  '#ffc53d',
  '#ffb224',
  '#ec9a2c',
  '#b7791f',
  '#9a6708',
  '#6f4a05',
];

const red: MantineColorsTuple = [
  '#fdeced',
  '#fad3d4',
  '#f5adaf',
  '#f28b8e',
  '#ff7075',
  '#ff5d63',
  '#e5484d',
  '#cf222e',
  '#a0181e',
  '#7d1116',
];

/* Extra categorical hue (avatar/tag tint) — see --pink-subtle/--pink-text tokens. */
const pink: MantineColorsTuple = [
  '#fce8f1',
  '#f8d0e0',
  '#f2aac6',
  '#ea85ae',
  '#e3679c',
  '#d64d8a',
  '#c2427c',
  '#a5326a',
  '#8a2958',
  '#6d1f46',
];

/* Meridian ghost: `variant="subtle"` with no explicit color is a neutral ghost
   control — transparent, secondary text, neutral hover fill. Colored subtles
   keep Mantine's tinted behavior through the pinned semantic CSS variables. */
const meridianVariantColorResolver: VariantColorsResolver = (input) => {
  const resolved = defaultVariantColorsResolver(input);
  if (input.variant === 'subtle' && !input.color) {
    return {
      ...resolved,
      hover: 'var(--surface-hover)',
      color: 'var(--text-secondary)',
      hoverColor: 'var(--text)',
    };
  }
  return resolved;
};

/* Meridian border token for a tinted container, keyed by Mantine color name. */
const TINTED_BORDER: Record<string, string> = {
  brand: 'accent',
  green: 'success',
  yellow: 'warning',
  red: 'danger',
  pink: 'pink',
};

export default createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 8 },
  variantColorResolver: meridianVariantColorResolver,

  colors: { dark, gray, brand, green, yellow, red, pink },
  white: '#ffffff',
  black: '#1a1c23', // light-scheme text (var(--mantine-color-black))

  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontFamilyMonospace: "ui-monospace, 'SF Mono', 'Cascadia Code', 'JetBrains Mono', Menlo, Consolas, monospace",

  headings: {
    fontWeight: '600',
    sizes: {
      h1: { fontSize: '30px', lineHeight: '1.15' },
      h2: { fontSize: '22px', lineHeight: '1.25' },
      h3: { fontSize: '17px', lineHeight: '1.35' },
      h4: { fontSize: '15px', lineHeight: '1.4' },
      h5: { fontSize: '15px', lineHeight: '1.4' },
      h6: { fontSize: '13px', lineHeight: '1.4' },
    },
  },

  fontSizes: {
    xs: '12px',
    sm: '13px',
    md: '14px',
    lg: '15px',
    xl: '17px',
  },

  radius: { xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '14px' },
  defaultRadius: 'md',

  shadows: {
    xs: '0 1px 2px rgba(16, 17, 24, 0.05)',
    sm: '0 1px 2px rgba(16, 17, 24, 0.04), 0 2px 8px rgba(16, 17, 24, 0.05)',
    md: '0 2px 4px rgba(16, 17, 24, 0.05), 0 8px 24px rgba(16, 17, 24, 0.09)',
    lg: '0 4px 8px rgba(16, 17, 24, 0.06), 0 16px 48px rgba(16, 17, 24, 0.14)',
    xl: '0 4px 8px rgba(16, 17, 24, 0.06), 0 24px 64px rgba(16, 17, 24, 0.20)',
  },
  // Dark-scheme shadow overrides happen via CSS vars in globals.css — Mantine
  // emits one static set and light shadows are invisible on dark backgrounds.

  respectReducedMotion: true,
  focusRing: 'auto',

  components: {
    Button: {
      defaultProps: { size: 'sm' },
      vars: () => ({
        root: {
          '--button-padding-x-xs': '10px',
          '--button-padding-x-sm': '14px',
          '--button-padding-x-md': '18px',
        },
      }),
      styles: {
        root: {
          fontWeight: 500,
          transition: 'background-color .13s ease, border-color .13s ease, color .13s ease, transform .06s ease',
          '&:active': { transform: 'translateY(1px)' },
        },
        inner: { gap: 8 },
      },
    },

    Input: {
      defaultProps: { size: 'sm' },
      styles: {
        input: {
          borderColor: 'var(--border-strong)',
          background: 'var(--input-bg)',
          transition: 'border-color .15s ease, box-shadow .15s ease',
          '&:hover:not(:disabled)': { borderColor: 'var(--text-tertiary)' },
          '&:focus': {
            outline: 'none',
            borderColor: 'var(--accent)',
            boxShadow: '0 0 0 3px var(--ring)',
          },
          '&[dataError], &[dataError]:hover': { borderColor: 'var(--danger)' },
          '&[dataError]:focus': { boxShadow: '0 0 0 3px var(--ring-danger)' },
        },
      },
    },

    Card: {
      defaultProps: { radius: 12, padding: 'lg', shadow: 'xs' },
      styles: {
        root: {
          background: 'var(--surface)',
          border: '1px solid var(--border)',
        },
      },
    },

    Paper: {
      styles: {
        root: { background: 'var(--surface)' },
      },
    },

    Modal: {
      defaultProps: {
        radius: 14,
        centered: true,
        overlayProps: { background: 'var(--scrim)', blur: 3 },
      },
      styles: {
        content: {
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
        },
        title: { fontWeight: 600, fontSize: '15px', letterSpacing: '-0.01em' },
      },
    },

    Notification: {
      defaultProps: { radius: 12 },
      styles: {
        root: {
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
        },
        title: { fontSize: '13.5px', fontWeight: 600 },
        description: { fontSize: '12.5px' },
      },
    },

    Menu: {
      defaultProps: { radius: 12 },
      styles: {
        dropdown: {
          padding: 6,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
        },
        item: {
          height: 32,
          borderRadius: 7,
          fontSize: '13.5px',
          paddingLeft: 10,
          paddingRight: 10,
          '&:hover': { backgroundColor: 'var(--surface-hover)' },
          '&:where([dataDisabled])': { opacity: 0.45 },
        },
        label: {
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--text-tertiary)',
        },
        divider: { borderColor: 'var(--border)' },
      },
    },

    Combobox: {
      styles: {
        dropdown: {
          padding: 6,
          background: 'var(--surface-raised)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg)',
        },
        option: { borderRadius: 7, fontSize: '13.5px' },
      },
    },

    Tooltip: {
      defaultProps: { offset: 8 },
      styles: {
        tooltip: {
          background: 'var(--tooltip-bg)',
          color: 'var(--tooltip-text)',
          fontSize: 12,
          fontWeight: 500,
          padding: '5px 8px',
          borderRadius: 6,
          boxShadow: 'var(--shadow-md)',
        },
      },
    },

    Badge: {
      vars: () => ({
        root: {
          '--badge-height': '22px',
          '--badge-fz': '12px',
          '--badge-padding-x': '9px',
          '--badge-radius': '999px',
        },
      }),
      styles: {
        root: {
          fontWeight: 500,
          '&:where([dataVariant="default"])': {
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--text-secondary)',
          },
        },
      },
    },

    Alert: {
      defaultProps: { radius: 10, variant: 'light' },
      // `vars` is typed `any` by MantineThemeComponent — annotate the resolver
      // explicitly so the parameters aren't implicit anys.
      vars: (_theme: MantineTheme, props: AlertProps) => ({
        root: {
          '--alert-bd': TINTED_BORDER[props.color as string]
            ? `1px solid var(--${TINTED_BORDER[props.color as string]}-border)`
            : '1px solid transparent',
        },
      }),
      styles: {
        root: { fontSize: '13.5px' },
        title: { fontWeight: 600 },
      },
    },

    ActionIcon: {
      defaultProps: { size: 28, radius: 7 },
    },

    ThemeIcon: {
      defaultProps: { radius: 'lg' },
    },

    Kbd: {
      styles: {
        root: {
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          height: 20,
          lineHeight: '20px',
          padding: '0 6px',
          borderRadius: 5,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderBottom: '1px solid var(--border-strong)',
          color: 'var(--text-secondary)',
        },
      },
    },

    Switch: {
      vars: () => ({
        root: {
          '--switch-width': '34px',
          '--switch-height': '20px',
          '--switch-thumb-size': '14px',
          '--switch-label-font-size': '14px',
        },
      }),
      // Track off/on colors are set in globals.css against Mantine's scheme
      // rules — a static background here would shadow the checked state,
      // which flows through the `--switch-bg` variable.
    },

    Checkbox: {
      vars: () => ({
        root: {
          '--checkbox-size': '16px',
          '--checkbox-radius': '5px',
        },
      }),
    },

    SegmentedControl: {
      styles: {
        root: {
          background: 'var(--bg-subtle)',
          padding: 3,
          borderRadius: 10,
          border: '1px solid var(--border)',
          gap: 2,
        },
        control: { height: 28 },
        indicator: {
          background: 'var(--tab-active-bg)',
          borderRadius: 7,
          boxShadow: 'var(--shadow-xs)',
        },
        label: { fontSize: '13.5px', fontWeight: 500 },
      },
    },

    Tabs: {
      styles: {
        tab: { fontSize: '13.5px', fontWeight: 500 },
      },
    },

    Table: {
      defaultProps: { highlightOnHover: true, verticalSpacing: 11 },
      vars: () => ({
        table: {
          '--table-border-color': 'var(--border)',
          '--table-highlight-on-hover-color': 'var(--surface-hover)',
        },
      }),
      styles: {
        th: {
          background: 'var(--bg-subtle)',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-tertiary)',
          padding: '10px 16px',
          whiteSpace: 'nowrap',
        },
        td: { padding: '11px 16px', fontSize: '13.5px' },
      },
    },

    Pagination: {
      defaultProps: { siblings: 1 },
      styles: {
        control: {
          minWidth: 32,
          height: 32,
          borderRadius: 8,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
          transition: 'background-color .12s ease, color .12s ease',
          '&:where([data-active])': {
            background: 'var(--accent-subtle)',
            color: 'var(--accent-text)',
            borderColor: 'transparent',
          },
          '&:where([data-active]):hover': {
            background: 'var(--accent-subtle)',
            color: 'var(--accent-text)',
          },
        },
      },
    },

    Progress: {
      defaultProps: { size: 6, radius: 999 },
    },

    Loader: {
      defaultProps: { color: 'brand' },
    },

    NavLink: {
      styles: {
        root: { borderRadius: 7, fontSize: '13.5px' },
      },
    },

    AppShell: {
      styles: {
        header: {
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(12px) saturate(160%)',
          WebkitBackdropFilter: 'blur(12px) saturate(160%)',
          borderBottom: '1px solid var(--border)',
        },
        navbar: {
          background: 'var(--bg)',
          borderRight: '1px solid var(--border)',
        },
        aside: {
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border)',
        },
        footer: {
          background: 'var(--bg)',
          borderTop: '1px solid var(--border)',
        },
      },
    },
  },
});
