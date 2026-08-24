/**
 * Page de succès après Stripe Checkout.
 * Design Philae : fond ivoire, or, typo site.
 */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchOrderStatus } from '../lib/checkout.js'
import { useI18n } from '../i18n/I18nProvider.jsx'

function formatEurosFromCents(cents, currency = 'eur') {
  if (cents == null || Number.isNaN(Number(cents))) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: (currency || 'eur').toUpperCase(),
  }).format(Number(cents) / 100)
}

export default function CheckoutSuccessPage() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const sessionId = params.get('session_id') || ''
  const orderId = params.get('order_id') || ''
  const [state, setState] = useState({ loading: true, order: null, error: null })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await fetchOrderStatus({ orderId, sessionId })
        if (!cancelled) {
          setState({ loading: false, order: data.order, error: null })
        }
      } catch (e) {
        if (!cancelled) {
          setState({
            loading: false,
            order: null,
            error: e.message || 'confirm',
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [orderId, sessionId])

  const order = state.order
  const paid =
    order?.status === 'paid' ||
    order?.status === 'complete'

  return (
    <div className="page page-site page-full page-checkout page-checkout-success">
      <div className="checkout-card">
        <p className="section-kicker">{t('checkout.kicker')}</p>
        <h1 className="hero-title checkout-title">{t('checkout.thanks')}</h1>

        {state.loading && (
          <p className="lead">{t('checkout.confirming')}</p>
        )}

        {!state.loading && state.error && (
          <>
            <p className="lead">{t('checkout.maybePaid')}</p>
            <p className="hint">{state.error === 'confirm' ? '' : state.error}</p>
            {(orderId || sessionId) && (
              <p className="hint">
                {t('checkout.refToShare', { ref: orderId || sessionId })}
              </p>
            )}
          </>
        )}

        {!state.loading && !state.error && order && (
          <>
            <p className="lead">
              {paid ? t('checkout.confirmed') : t('checkout.pending')}
            </p>

            <dl className="checkout-summary">
              <div>
                <dt>{t('checkout.order')}</dt>
                <dd>{order.id || orderId || '—'}</dd>
              </div>
              <div>
                <dt>{t('checkout.quoteRef')}</dt>
                <dd>{order.quote_ref || '—'}</dd>
              </div>
              {order.product_label && (
                <div>
                  <dt>{t('checkout.piece')}</dt>
                  <dd>{order.product_label}</dd>
                </div>
              )}
              <div>
                <dt>{t('checkout.amount')}</dt>
                <dd className="product-price">
                  {formatEurosFromCents(
                    order.amount_charged_cents,
                    order.currency,
                  )}
                  {order.payment_mode === 'deposit'
                    ? t('checkout.deposit')
                    : t('checkout.ttc')}
                </dd>
              </div>
              {order.customer_email && (
                <div>
                  <dt>{t('checkout.email')}</dt>
                  <dd>{order.customer_email}</dd>
                </div>
              )}
              <div>
                <dt>{t('checkout.status')}</dt>
                <dd>{paid ? t('checkout.paid') : order.status || '—'}</dd>
              </div>
            </dl>

            <p className="hint checkout-next">
              {t('checkout.nextLead')}{' '}
              <a href="mailto:contact@philae.design">contact@philae.design</a>
            </p>
          </>
        )}

        <div className="checkout-actions">
          <Link to="/boutique" className="btn btn-primary">
            {t('checkout.backShop')}
          </Link>
          <Link to="/" className="btn btn-wood">
            {t('checkout.home')}
          </Link>
        </div>
      </div>
    </div>
  )
}
