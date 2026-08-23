import { useEffect } from 'react';

const SITE = 'Mathitis';

/**
 * Sets a unique document title and meta description per page.
 * Usage: usePageMeta('Descoberta de Padrinhos', 'Conheça os veteranos…');
 */
export function usePageMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;

    if (description) {
      let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = description;
    }

    return () => {
      document.title = SITE;
    };
  }, [title, description]);
}
