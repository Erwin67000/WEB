/**
 * Page d’annulation / abandon Stripe Checkout.
 */
import { Link, useSearchParams } from 'react-router-dom'
import { useI18n } from '../i18n/I18nProvider.jsx'

export default function CheckoutCancelPage() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const orderId = params.get('order_id') || ''

  return (
    <div className="page page-site page-full page-checkout page-checkout-cancel">
      <div className="checkout-card">
        <p className="section-kicker">{t('checkout.kicker')}</p>
        <h1 className="hero-title checkout-title">{t('checkout.cancelled')}</h1>
        <p className="lead">{t('checkout.cancelledLead')}</p>
        {orderId && (
          <p className="hint">
            {t('checkout.sessionRefLabel')} <strong>{orderId}</strong>
          </p>
        )}
        <div className="checkout-actions">
          <Link to="/boutique" className="btn btn-primary">
            {t('checkout.shop')}
          </Link>
          <Link to="/configurateur" className="btn btn-wood">
            {t('checkout.configurator')}
          </Link>
          <Link to="/contact" className="btn">
            {t('checkout.contactUs')}
          </Link>
        </div>
      </div>
    </div>
  )
}
