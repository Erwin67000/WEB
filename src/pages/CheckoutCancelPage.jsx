/**
 * Page d’annulation / abandon Stripe Checkout.
 */
import { Link, useSearchParams } from 'react-router-dom'

export default function CheckoutCancelPage() {
  const [params] = useSearchParams()
  const orderId = params.get('order_id') || ''

  return (
    <div className="page page-site page-full page-checkout page-checkout-cancel">
      <div className="checkout-card">
        <p className="section-kicker">Paiement</p>
        <h1 className="hero-title checkout-title">Paiement interrompu</h1>
        <p className="lead">
          Aucun montant n’a été débité. Vous pouvez reprendre la configuration
          de votre meuble et relancer le paiement quand vous le souhaitez.
        </p>
        {orderId && (
          <p className="hint">
            Référence session : <strong>{orderId}</strong>
          </p>
        )}
        <div className="checkout-actions">
          <Link to="/boutique" className="btn btn-primary">
            Boutique
          </Link>
          <Link to="/configurateur" className="btn btn-wood">
            Configurateur
          </Link>
          <Link to="/contact" className="btn">
            Nous contacter
          </Link>
        </div>
      </div>
    </div>
  )
}
