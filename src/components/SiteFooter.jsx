import { Link } from 'react-router-dom'

const year = new Date().getFullYear()

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <img src="/logo-philae.jpg" alt="" className="footer-logo" />
          <div>
            <p className="footer-name">Philae</p>
            <p className="footer-tag">Mobilier géométrique · Bois massif</p>
          </div>
        </div>

        <div className="footer-cols">
          <div className="footer-col">
            <h4>Navigation</h4>
            <Link to="/">Accueil</Link>
            <Link to="/boutique">Boutique</Link>
            <Link to="/configurateur">Configurateur</Link>
            <Link to="/concept">Le concept</Link>
            <Link to="/contact">Contact</Link>
          </div>

          <div className="footer-col">
            <h4>Atelier</h4>
            <a href="mailto:contact@philae.design">contact@philae.design</a>
            <p>France · Fabrication sur mesure</p>
            <a
              href="https://www.philae.design/"
              target="_blank"
              rel="noreferrer"
            >
              philae.design
            </a>
          </div>

          <div className="footer-col">
            <h4>Informations</h4>
            <Link to="/contact">Mentions légales</Link>
            <Link to="/contact">CGV</Link>
            <Link to="/contact">Confidentialité</Link>
            <Link to="/contact">Livraison & montage</Link>
          </div>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p>© {year} Philae. Tous droits réservés.</p>
        <p className="footer-credit">
          Conception & fabrication — atelier Philae
        </p>
      </div>
    </footer>
  )
}
