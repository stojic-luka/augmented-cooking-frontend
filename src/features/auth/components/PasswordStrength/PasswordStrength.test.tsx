import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PasswordStrength } from './PasswordStrength';

function bar(): HTMLElement {
  return screen.getByRole('progressbar');
}

/** The bar's color rides on the section's inline --progress-section-color. */
function barColor(element: HTMLElement): string {
  return element.getAttribute('style') ?? '';
}

describe('PasswordStrength', () => {
  it('starts gray and empty for an empty password', () => {
    render(<PasswordStrength password="" />);
    expect(bar()).toHaveAttribute('aria-valuenow', '0');
    expect(barColor(bar())).toContain('gray');
  });

  it('climbs the scale as requirements are met', () => {
    render(<PasswordStrength password="a" />);
    expect(bar()).toHaveAttribute('aria-valuenow', '20');
    expect(barColor(bar())).toContain('red');

    render(<PasswordStrength password="Abcdefg" />);
    expect(bar()).toHaveAttribute('aria-valuenow', '40');
    expect(barColor(bar())).toContain('orange');
  });

  it('shows a full green bar for a fully-compliant password, not gray', () => {
    // Regression: with all five requirements met the old metCount-1 index
    // fell off the end of the color array and rendered gray at 100%.
    render(<PasswordStrength password="Str0ng!pass" />);
    expect(bar()).toHaveAttribute('aria-valuenow', '100');
    expect(barColor(bar())).toContain('green');
    expect(barColor(bar())).not.toContain('gray');
  });
});
