/**
 * Page de succès après Stripe Checkout.
 * Design Philae : fond ivoire, or, typo site.
 */
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fetchOrderStatus } from '../lib/checkout.js'

function formatEurosFromCents(cents, currency = 'eur') {
  if (cents == null || Number.isNaN(Number(cents))) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: (currency || 'eur').toUpperCase(),
  }).format(Number(cents) / 100)
}

export default function CheckoutSuccessPage() {
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
            error: e.message || 'Impossible de confirmer le paiement',
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
    order?.status === 'complete' ||
    // Stripe source fallback
    order?.status === 'complete'

  return (
    <div className="page page-site page-full page-checkout page-checkout-success">
      <div className="checkout-card">
        <p className="section-kicker">Paiement</p>
        <h1 className="hero-title checkout-title">Merci</h1>

        {state.loading && (
          <p className="lead">Confirmation de votre paiement…</p>
        )}

        {!state.loading && state.error && (
          <>
            <p className="lead">
              Votre paiement a peut‑être abouti, mais la confirmation
              automatique n’est pas encore disponible.
            </p>
            <p className="hint">{state.error}</p>
            {(orderId || sessionId) && (
              <p className="hint">
                Référence à communiquer :{' '}
                <strong>{orderId || sessionId}</strong>
              </p>
            )}
          </>
        )}

        {!state.loading && !state.error && order && (
          <>
            <p className="lead">
              {paid
                ? 'Votre commande est confirmée. L’atelier Philae prépare la fabrication.'
                : 'Paiement enregistré — validation en cours.'}
            </p>

            <dl className="checkout-summary">
              <div>
                <dt>Commande</dt>
                <dd>{order.id || orderId || '—'}</dd>
              </div>
              <div>
                <dt>Réf. devis</dt>
                <dd>{order.quote_ref || '—'}</dd>
              </div>
              {order.product_label && (
                <div>
                  <dt>Meuble</dt>
                  <dd>{order.product_label}</dd>
                </div>
              )}
              <div>
                <dt>Montant réglé</dt>
                <dd className="product-price">
                  {formatEurosFromCents(
                    order.amount_charged_cents,
                    order.currency,
                  )}
                  {order.payment_mode === 'deposit' ? ' (acompte)' : ' TTC'}
                </dd>
              </div>
              {order.customer_email && (
                <div>
                  <dt>E‑mail</dt>
                  <dd>{order.customer_email}</dd>
                </div>
              )}
              <div>
                <dt>Statut</dt>
                <dd>{paid ? 'Payé' : order.status || '—'}</dd>
              </div>
            </dl>

            <p className="hint checkout-next">
              Un e‑mail de confirmation Stripe vous est adressé. Pour le suivi
              fabrication :{' '}
              <a href="mailto:contact@philae.design">contact@philae.design</a>
            </p>
          </>
        )}

        <div className="checkout-actions">
          <Link to="/boutique" className="btn btn-primary">
            Retour boutique
          </Link>
          <Link to="/" className="btn btn-wood">
            Accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
