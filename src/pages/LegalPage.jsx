import { useI18n } from '@texte/I18nProvider.jsx'
import MarkdownDoc from '../components/MarkdownDoc.jsx'

import mentionsFr from '../2_BUILD/document/01-mentions-legales.md?raw'
import mentionsEn from '../2_BUILD/document/01-mentions-legales.en.md?raw'
import cgvFr from '../2_BUILD/document/02-cgv.md?raw'
import cgvEn from '../2_BUILD/document/02-cgv.en.md?raw'
import privacyFr from '../2_BUILD/document/03-politique-confidentialite.md?raw'
import privacyEn from '../2_BUILD/document/03-politique-confidentialite.en.md?raw'
import cookiesFr from '../2_BUILD/document/04-politique-cookies.md?raw'
import cookiesEn from '../2_BUILD/document/04-politique-cookies.en.md?raw'
import shippingFr from '../2_BUILD/document/06-livraison.md?raw'
import shippingEn from '../2_BUILD/document/06-livraison.en.md?raw'

const DOCS = {
  legal: { fr: mentionsFr, en: mentionsEn },
  terms: { fr: cgvFr, en: cgvEn },
  privacy: { fr: privacyFr, en: privacyEn },
  cookies: { fr: cookiesFr, en: cookiesEn },
  shipping: { fr: shippingFr, en: shippingEn },
}

export default function LegalPage({ kind }) {
  const { t, lang } = useI18n()
  const key = DOCS[kind] ? kind : 'legal'
  const source = DOCS[key][lang] || DOCS[key].fr

  return (
    <div className="page page-site page-legal">
      <header className="page-head">
        <p className="section-kicker">{t('legalPage.updated')}</p>
      </header>
      <MarkdownDoc source={source} />
    </div>
  )
}
