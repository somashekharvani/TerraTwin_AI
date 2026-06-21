# TerraTwin AI - Accessibility Guidelines (WCAG 2.1 AA)

Accessibility is a core quality requirement. TerraTwin AI conforms to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards.

---

## 1. Core Implementation Rules

### Semantic HTML
Avoid nested `div` elements for functional wrappers. Use standard semantic containers:
- Use `<main>` for the core viewport.
- Use `<nav>` for menus.
- Use `<section>` for logical components (Dashboard, OCR Scanner, IoT Meter).
- Use `<button>` for clickable elements (never attach click handlers to static elements).

### ARIA Attributes
- Custom buttons and inputs must have descriptive `aria-label` settings.
- Forms and modal panels must use `aria-describedby` or `aria-labelledby` to tie explanations to correct form fields.
- Set `aria-live="polite"` on real-time elements, such as chatbot responses and IoT power updates.

### Keyboard Navigation
- All interactive controls must be focusable using `Tab`.
- Clear focus indicators (e.g. Tailwind `focus:ring-2 focus:ring-green-500`) must be visible.
- Buttons must trigger actions when pressing `Space` or `Enter`.
- Chat and modal layers must support closing via `Escape`.

---

## 2. Automated & Manual Auditing

### axe-core Test Suite
Every page view is audited for WCAG violations using `@axe-core/react` in development and `jest-axe` in unit tests:
```typescript
import { axe, toHaveNoViolations } from 'jest-axe';
expect.extend(toHaveNoViolations);

test('dashboard has no accessibility violations', async () => {
  const { container } = render(<Dashboard />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### Contrast Ratio Standard
- Normal text (under 18pt): Minimum contrast ratio of **4.5:1** against the background.
- Large text (18pt+ or bold 14pt+): Minimum contrast ratio of **3:1**.
