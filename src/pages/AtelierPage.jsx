export default function AtelierPage() {
  return (
    <div className="page atelier-page">
      <div className="page-inner">
        <header className="page-hero">
          <p className="eyebrow">Atelier</p>
          <h1>Design bois massif, géométrie & assemblage</h1>
          <p className="lead">
            Philae renverse la conception du meuble : d’abord une ossature légère et
            rigide, ensuite les fonctions, enfin les panneaux là où ils sont utiles.
          </p>
        </header>

        <div className="atelier-grid">
          <section className="atelier-card">
            <h2>Ossature</h2>
            <p>
              Les arêtes en bois massif forment les arêtes d’un volume géométrique.
              En figeant les sommets identiques et en gardant des libertés sur
              d’autres variables, cette géométrie signature apparaît.
            </p>
            <p>
              Section type 40 × 40 mm. Douze arêtes, cent quarante-quatre points 3D
              paramétrés par longueur, profondeur et hauteur.
            </p>
          </section>

          <section className="atelier-card">
            <h2>Assemblage</h2>
            <p>
              Système d’assemblage déterminé pour faciliter le montage et le
              démontage — pas de colle, pas de vis, pas de clous en usage final.
            </p>
            <p>
              On monte son ossature en environ cinq minutes, avec une structure déjà
              rigide et légère.
            </p>
          </section>

          <section className="atelier-card">
            <h2>Fonctions</h2>
            <p>
              Tiroirs, tablettes, portes, façades, fonds, plateaux, joues… tout ce
              dont vous avez besoin s’ajoute ensuite. Les panneaux ne sont plus
              la structure : ce sont des options.
            </p>
          </section>

          <section className="atelier-card highlight">
            <h2>Impact</h2>
            <p>
              Un meuble environ 70 % plus léger qu’un équivalent caisson mélaminé.
              Moins de panneau, moins de masse, impact carbone réduit (valeurs
              indicatives).
            </p>
            <ul>
              <li>Bois massif issu de la région (hêtre, sapin, chêne)</li>
              <li>Démontable et reconfigurable</li>
              <li>Usinage CNC & production atelier</li>
            </ul>
          </section>
        </div>

        <section className="page-section process">
          <h2>Processus</h2>
          <ol className="process-steps">
            <li>
              <strong>Configurer</strong>
              <span>Dimensions, finition, modules dans le configurateur 3D</span>
            </li>
            <li>
              <strong>Devis</strong>
              <span>Demande analysée par l’atelier · contact@philae.design</span>
            </li>
            <li>
              <strong>Usinage</strong>
              <span>Arêtes CNC, clés d’assemblage, panneaux sur mesure</span>
            </li>
            <li>
              <strong>Livraison</strong>
              <span>Kit monable — structure rigide en quelques minutes</span>
            </li>
          </ol>
        </section>
      </div>
    </div>
  )
}
