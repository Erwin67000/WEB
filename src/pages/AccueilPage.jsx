import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SLIDES = [
  {
    kicker: 'Structure',
    title: "L'ossature d'abord",
    text: "Douze arêtes en bois massif définissent le volume. Le meuble naît d'une géométrie claire, pas d'un caisson fermé.",
  },
  {
    kicker: 'Liberté',
    title: 'L · W · H sur mesure',
    text: "Chaque dimension est un choix. Le configurateur déploie l'ossature en temps réel, prête pour l'atelier.",
  },
  {
    kicker: 'Fonctions',
    title: 'Portes, tablettes, tiroirs',
    text: "Les aménagements s'inscrivent dans le cadre. Panneaux et modules deviennent des décisions conscientes.",
  },
  {
    kicker: 'Atelier',
    title: 'Du pixel au plan de coupe',
    text: 'Une seule chaîne : configurateur, devis, fabrication, montage. Transparence et exigence.',
  },
]

const STRENGTHS = [
  {
    n: '01',
    title: 'Géométrie signature',
    text: "Les trois arêtes se rejoignent à chaque sommet. L\'angle porte la structure et l\'identité Philae.",
  },
  {
    n: '02',
    title: 'Bois massif',
    text: "Le cadre est en bois massif. Robuste, durable, et précis.",
  },
  {
    n: '03',
    title: 'Léger & compact',
    text: 'En remplaçant le caisson en panneau mélaminé, par une structure d\'arêtes, la taille des panneaux et le poids du meuble sont réduits.',
  },
  {
    n: '04',
    title: 'Montable / démontable',
    text: "Le système d\'assemblage permet un montage de l\'ossature complète en 5 minutes, et peut être réversible.",
  },
  {
    n: '05',
    title: 'Aménagements libres',
    text: "Tablettes, portes, tiroirs : vous composez l'intérieur.",
  },
  {
    n: '06',
    title: 'Sur mesure réel',
    text: "Dimensions, finitions, ensembles multi-meubles, scènes d'ambiance.",
  },
]

export default function AccueilPage() {
  const navigate = useNavigate()
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    const t = window.setInterval(() => {
      setSlide((s) => (s + 1) % SLIDES.length)
    }, 5500)
    return () => window.clearInterval(t)
  }, [])

  const current = SLIDES[slide]

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
          Forme & Fonctions
        </p>
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/configurateur')}
          >
            Configurer
          </button>
          <button
            type="button"
            className="btn btn-wood"
            onClick={() => navigate('/boutique')}
          >
            Voir la boutique
          </button>
        </div>
      </section>

      <section className="home-carousel" aria-roledescription="carousel">
        <div className="carousel-frame">
          <p className="section-kicker">{current.kicker}</p>
          <h2 className="carousel-title">{current.title}</h2>
          <p className="carousel-text">{current.text}</p>
          <div className="carousel-dots" role="tablist">
            {SLIDES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                aria-selected={i === slide}
                className={`carousel-dot${i === slide ? ' active' : ''}`}
                onClick={() => setSlide(i)}
                title={s.title}
              />
            ))}
          </div>
        </div>
        <div className="carousel-nav">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() =>
              setSlide((s) => (s - 1 + SLIDES.length) % SLIDES.length)
            }
          >
            ←
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setSlide((s) => (s + 1) % SLIDES.length)}
          >
            →
          </button>
        </div>
      </section>

      <section className="home-section">
        <div className="home-section-inner">
          <p className="section-kicker">Pourquoi Philae</p>
          <h2 className="section-title-lg">
            Une logique <span className="gold">inverse</span>
          </h2>
          <p className="section-body">
            L&apos;industrie du meuble a longtemps privilégié le volume fermé :
            des panneaux sur toutes les faces, une esthétique standardisée, une
            matière composite. Philae inverse le raisonnement. D&apos;abord le
            cadre — rigide, dimensionné, signature. Ensuite les fonctions.
            Enfin, les panneaux, s&apos;ils ont un vrai rôle.
          </p>
          <p className="section-body">
            Résultat : un meuble plus léger, plus lisible, plus honnête dans sa
            construction. Vous voyez la structure. Vous choisissez ce qui
            s&apos;y installe. Une seule matrice pilote le configurateur et
            l&apos;atelier.
          </p>
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

      <section className="home-section home-path">
        <div className="home-section-inner">
          <p className="section-kicker">Parcours client</p>
          <h2 className="section-title-lg">
            De l&apos;idée au <span className="gold">meuble</span>
          </h2>
          <div className="path-steps">
            <article className="path-step">
              <h3>1 · Explorer</h3>
              <p>
                Parcourez la boutique ou ouvrez le configurateur. Testez les
                proportions L · W · H et les finitions.
              </p>
            </article>
            <article className="path-step">
              <h3>2 · Composer</h3>
              <p>
                Ajoutez tablettes, portes, tiroirs. Placez les modules, affinez
                les hauteurs, visualisez l&apos;ensemble en 3D.
              </p>
            </article>
            <article className="path-step">
              <h3>3 · Valider</h3>
              <p>
                Demande, devis, échanges avec l&apos;atelier. La géométrie
                devient plan de fabrication.
              </p>
            </article>
            <article className="path-step">
              <h3>4 · Recevoir</h3>
              <p>
                Un meuble montable, documenté, pensé pour durer et évoluer avec
                votre espace.
              </p>
            </article>
          </div>
          <div className="hero-actions path-cta">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => navigate('/configurateur')}
            >
              Lancer le configurateur
            </button>
            <button
              type="button"
              className="btn btn-wood"
              onClick={() => navigate('/concept')}
            >
              Lire le concept
            </button>
          </div>
        </div>
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
