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

export default function ConceptPage() {
  const navigate = useNavigate()

  return (
    <div className="page page-concept page-site">
      <header className="page-head concept-head">
        <p className="section-kicker">Vision</p>
        <h1 className="hero-title">
          Le concept <span className="gold">Philae</span>
        </h1>
        <p className="hero-lead">
          Une structure d&apos;abord. Des fonctions ensuite. Une esthétique
          d&apos;arête, en bois massif — pilotée par une matrice unique.
        </p>
      </header>

      {/* ——— Ancien contenu accueil ——— */}
      <section className="hero hero-home concept-hero">
        <p className="section-kicker">Mobilier géométrique · Bois massif</p>
        <h2 className="hero-title hero-title-sm">
          L&apos;ossature
          <br />
          <span className="gold">comme signature</span>
        </h2>
        <p className="hero-lead">
          Forme &amp; fonctions — composez votre meuble en ligne.
        </p>
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/configurateur')}
          >
            Configurateur libre
          </button>
          <button
            type="button"
            className="btn btn-wood"
            onClick={() => navigate('/boutique')}
          >
            Boutique préconfigurée
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

      {/* ——— Vision détaillée ——— */}
      <article className="concept-prose">
        <section className="concept-block">
          <div className="concept-text">
            <h2>Sur les épaules des géants</h2>
            <p>
              Depuis toujours, les plus grands esprits ont cherché l&apos;harmonie
              du monde à travers la <strong>géométrie</strong>.
            </p>
            <p>
              <strong>Platon</strong> voyait dans les solides réguliers une
              structure fondamentale de l&apos;univers.{' '}
              <strong>Archimède</strong> en a exploré les propriétés pour
              concevoir machines et instruments.{' '}
              <strong>Léonard de Vinci</strong> a étudié proportions et
              symétries pour créer œuvres et inventions.
            </p>
            <p>
              Aujourd&apos;hui, <strong>Philae</strong> s&apos;inscrit dans
              cette tradition : appliquer les principes de la géométrie à la
              conception de meubles. Arêtes et sommets pour des structures
              élégantes et fonctionnelles — chaque pièce en quête d&apos;équilibre.
            </p>
          </div>
          <div className="concept-illu concept-illu-geo" aria-hidden>
            <span className="illu-label">12 arêtes · 8 sommets</span>
          </div>
        </section>

        <section className="concept-block reverse">
          <div className="concept-text">
            <h2>La nouvelle manière de concevoir le mobilier</h2>
            <p>
              Philae naît d&apos;une intuition simple et radicale : le meuble
              n&apos;est pas un volume fermé de panneaux mélaminés, mais une{' '}
              <strong>structure</strong>.
            </p>
            <p>
              Comme une architecture réduite à l&apos;essentiel, l&apos;ossature
              en bois massif dessine le meuble par ses arêtes. Le regard suit la
              ligne, pas le remplissage.
            </p>
          </div>
          <div className="concept-illu concept-illu-frame" aria-hidden>
            <img src="/logo-philae.jpg" alt="" />
          </div>
        </section>

        <section className="concept-block">
          <div className="concept-text">
            <h2>La logique inverse</h2>
            <p>
              L&apos;industrie réalise une grande part des agencements en caisson
              mélaminé : panneaux sur toutes les faces, matière composite, souvent
              une esthétique standardisée et une durabilité limitée.
            </p>
            <p>
              <strong>Philae inverse la logique.</strong> On crée d&apos;abord un{' '}
              <strong>cadre rigide</strong> aux dimensions souhaitées. Ce cadre
              se monte rapidement grâce à un système montable / démontable.
            </p>
            <ul className="concept-list">
              <li>
                <strong>Solide</strong> — par la géométrie des angles et le
                système d&apos;assemblage
              </li>
              <li>
                <strong>Léger</strong> — moins de matière inutile qu&apos;un
                caisson plein
              </li>
              <li>
                <strong>Durable</strong> — démontable, réutilisable, recyclable
              </li>
              <li>
                <strong>Esthétique</strong> — les arêtes restent visibles, look
                signature
              </li>
            </ul>
            <p>
              On ajoute ensuite les fonctions : tiroirs, tablettes, portes. On
              garde le contrôle sur l&apos;esthétique et la qualité. Les panneaux
              n&apos;apparaissent que s&apos;ils ont un vrai rôle — fonctionnel
              ou esthétique. Le panneau devient un choix conscient.
            </p>
          </div>
          <div className="concept-illu concept-illu-steps" aria-hidden>
            <div className="step-pill">1 · Cadre</div>
            <div className="step-pill">2 · Fonctions</div>
            <div className="step-pill">3 · Panneaux</div>
          </div>
        </section>

        <section className="concept-block reverse">
          <div className="concept-text">
            <h2>La matrice comme vérité unique</h2>
            <p>
              Longueur, largeur, hauteur : trois paramètres suffisent à déployer
              l&apos;ossature. Derrière l&apos;écran, une matrice de configuration
              relie géométrie, panneaux, modules, prix et export atelier.
            </p>
            <p>
              À l&apos;intérieur du configurateur : ensembles multi-meubles,
              scènes d&apos;ambiance, finitions, épaisseurs discrètes, devis et
              fichiers master_input.
            </p>
            <p>
              Du site web à l&apos;usinage CNC : une seule source de vérité.
            </p>
          </div>
          <div className="concept-illu concept-illu-dims" aria-hidden>
            <span>L</span>
            <span>W</span>
            <span>H</span>
          </div>
        </section>

        <section className="concept-block">
          <div className="concept-text">
            <h2>Une esthétique d&apos;arête</h2>
            <p>
              Philae ne cherche pas l&apos;effet décoratif : il cherche la{' '}
              <strong>puissance calme</strong> d&apos;un objet juste, libre dans
              ses proportions, exigeant dans sa matière.
            </p>
          </div>
          <div className="concept-illu concept-illu-palette" aria-hidden>
            <span className="swatch black" />
            <span className="swatch gold" />
            <span className="swatch ivory" />
          </div>
        </section>

        <blockquote className="concept-quote home-quote">
          « Crée ton propre meuble, et trouve l&apos;équilibre entre forme et
          fonction. »
          <cite>— Philae</cite>
        </blockquote>
      </article>
    </div>
  )
}
