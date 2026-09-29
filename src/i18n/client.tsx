'use client';
/**
 * Client-side i18n: a provider holding only the namespaces a client island
 * needs (see pickMessages on the server).
 */
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { createTranslator, type MessageTree, type Translator } from './format';

interface Ctx {
  locale: string;
  intl: string;
  messages: MessageTree;
}

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider(props: { locale: string; intl: string; messages: MessageTree; children: ReactNode }) {
  const value = useMemo(
    () => ({ locale: props.locale, intl: props.intl, messages: props.messages }),
    [props.locale, props.intl, props.messages],
  );
  return <I18nContext.Provider value={value}>{props.children}</I18nContext.Provider>;
}

export function useT(): Translator {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>');
  return useMemo(() => createTranslator(ctx.locale, ctx.intl, ctx.messages), [ctx]);
}

export function useLocale(): string {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useLocale must be used inside <I18nProvider>');
  return ctx.locale;
}
