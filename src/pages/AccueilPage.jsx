import { useNavigate } from 'react-router-dom'

const STRENGTHS = [
  {
    n: '01',
    title: 'Géométrie signature',
    text: "Les trois arêtes se rejoignent à chaque sommet. L'angle porte la structure et l'identité Philae.",
  },
  {
    n: '02',
    title: 'Bois massif',
    text: 'Le cadre est en bois massif. Robuste, durable, et précis.',
  },
  {
    n: '03',
    title: 'Léger & compact',
    text: "En remplaçant le caisson mélaminé par une ossature d'arêtes, panneaux et poids sont réduits.",
  },
  {
    n: '04',
    title: 'Montable / démontable',
    text: "Assemblage de l'ossature en quelques minutes, réversible.",
  },
  {
    n: '05',
    title: 'Aménagements libres',
    text: "Tablettes, portes, tiroirs : vous composez l'intérieur.",
  },
  {
    n: '06',
    title: 'Sur mesure réel',
    text: 'Dimensions libres dans le configurateur ; modèles boutique figés en L×P×H pour choisir vite.',
  },
]

export default function AccueilPage() {
  const navigate = useNavigate()

  return (
    <div className="page page-accueil page-site">
      <section className="hero hero-home">
        <p className="section-kicker">Mobilier géométrique · Bois massif</p>
        <h1 className="hero-title">
          L&apos;ossature
          <br />
          <span className="gold">comme signature</span>
        </h1>
        <p className="hero-lead">
          Forme &amp; fonctions — composez votre meuble en ligne.
        </p>
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/histoire')}
          >
            Voir l&apos;histoire
          </button>
          <button
            type="button"
            className="btn btn-wood"
            onClick={() => navigate('/boutique')}
          >
            Boutique préconfigurée
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => navigate('/configurateur')}
          >
            Configurateur libre
          </button>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-inner">
          <p className="section-kicker">Deux parcours</p>
          <h2 className="section-title-lg">
            Choisir ou <span className="gold">créer</span>
          </h2>
          <div className="path-steps path-steps-2">
            <article className="path-step">
              <h3>Boutique</h3>
              <p>
                Modèles prêts à personnaliser : finitions, panneaux, tablettes.
                Les dimensions principales restent celles du modèle pour un
                choix clair.
              </p>
              <button
                type="button"
                className="btn btn-wood"
                onClick={() => navigate('/boutique')}
              >
                Voir la boutique
              </button>
            </article>
            <article className="path-step">
              <h3>Configurateur</h3>
              <p>
                Contrôle total : L, P, H, multi-meubles, scènes. Pour un projet
                vraiment sur mesure.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/configurateur')}
              >
                Ouvrir le configurateur
              </button>
            </article>
          </div>
        </div>
      </section>

      <section className="home-strengths">
        <div className="home-section-inner">
          <p className="section-kicker">Points forts</p>
          <h2 className="section-title-lg">
            Ce qui fait la <span className="gold">différence</span>
          </h2>
        </div>
        <ol className="strength-list">
          {STRENGTHS.map((item) => (
            <li key={item.n} className="strength-item">
              <span className="strength-n">{item.n}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="home-quote">
        <blockquote>
          « Crée ton propre meuble, et trouve l&apos;équilibre entre forme et
          fonction. »
          <cite>— Philae</cite>
        </blockquote>
      </section>
    </div>
  )
}
