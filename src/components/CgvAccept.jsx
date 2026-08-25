import { Link } from 'react-router-dom'
import { useI18n } from '@texte/I18nProvider.jsx'

export default function CgvAccept({ checked, onChange, id = 'accept-cgv' }) {
  const { t } = useI18n()
  return (
    <label className="cgv-accept" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {t('checkout.acceptCgvBefore')}
        <Link to="/cgv" target="_blank" rel="noreferrer">
          {t('checkout.acceptCgvLink')}
        </Link>
        {t('checkout.acceptCgvAfter')}
      </span>
    </label>
  )
}
