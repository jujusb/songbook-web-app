import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n';

const AllProviders = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

export function renderWithProviders(
  ui: ReactElement,
  options?: RenderOptions
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';