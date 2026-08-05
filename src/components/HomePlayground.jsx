/**
 * Terrain de jeu Philae — hub post-scrollytelling.
 * Gamification légère, scalable (mondes / missions / XP).
 * Vision : playground pour designers en herbe.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useConfigStore } from '../store/useConfigStore.js'
import { ENVIRONMENTS } from '../1_STRUCTURE/00_matrice/matrice_configuration.js'

const STORAGE_KEY = 'philae-playground-v1'

/** Mondes = environnements + teaser roadmap (scale). */
const WORLDS = [
  {
    id: 'chambre',
    envId: 'chambre',
    badge: 'LVL 01',
    title: 'Chambre',
    tagline: 'Premier territoire débloqué',
    blurb: 'Place un meuble dans une vraie pièce. Tourne, ajuste, respire.',
    status: 'open',
    accent: '#7a8f5c',
    icon: '◇',
  },
  {
    id: 'salon',
    envId: null,
    badge: 'LVL 02',
    title: 'Salon',
    tagline: 'Bientôt — en construction',
    blurb: 'Buffets, tables basses, volumes bas. Le prochain monde à cartographier.',
    status: 'soon',
    accent: '#c9a227',
    icon: '△',
  },
  {
    id: 'atelier',
    envId: null,
    badge: 'LVL 03',
    title: 'Atelier',
    tagline: 'Monde secret',
    blurb: 'La grille, le soleil, les arêtes nues. Pour les puristes de la structure.',
    status: 'soon',
    accent: '#6b8cae',
    icon: '⬡',
  },
  {
    id: 'exterieur',
    envId: null,
    badge: 'LVL ∞',
    title: 'Extérieur',
    tagline: 'Horizon ouvert',
    blurb: 'Lumière dure, ombres longues. Quand le mobilier sort de la boîte.',
    status: 'soon',
    accent: '#b87a5a',
    icon: '○',
  },
]

const MISSIONS = [
  {
    id: 'origin',
    xp: 100,
    rank: '01',
    title: 'Naissance d’une arête',
    text: 'Tu viens de voir une intention devenir volume. Garde ce fil.',
    cta: 'Rejouer le récit',
    to: null,
    action: 'scroll-top',
    tone: 'ivory',
  },
  {
    id: 'boutique',
    xp: 200,
    rank: '02',
    title: 'Choisir un allié',
    text: 'Un modèle préconfiguré. Dimensions figées, âme libre — finitions, tablettes, tiroirs.',
    cta: 'Entrer en boutique',
    to: '/boutique',
    tone: 'gold',
  },
  {
    id: 'forge',
    xp: 350,
    rank: '03',
    title: 'Forger sur mesure',
    text: 'L, P, H libres. Multi-meubles. Scènes. Le configurateur est ton établi.',
    cta: 'Ouvrir le configurateur',
    to: '/configurateur',
    tone: 'ink',
  },
  {
    id: 'world',
    xp: 250,
    rank: '04',
    title: 'Poser dans un monde',
    text: 'Le meuble n’existe vraiment qu’une fois dans une pièce. Entre dans la chambre.',
    cta: 'Monde · Chambre',
    to: '/configurateur?env=chambre',
    tone: 'olive',
  },
]

/** Duals polyédriques — clin d’œil géométrie Philae */
const DUALS = [
  { a: 'Cube', b: 'Octaèdre', note: '6 faces ↔ 8 sommets' },
  { a: 'Dodécaèdre', b: 'Icosaèdre', note: '12 faces ↔ 20 sommets' },
  { a: 'Tétraèdre', b: 'Tétraèdre', note: 'auto-dual · pureté' },
]

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { missionsDone: [], worldsVisited: [], xp: 0 }
    return { missionsDone: [], worldsVisited: [], xp: 0, ...JSON.parse(raw) }
  } catch {
    return { missionsDone: [], worldsVisited: [], xp: 0 }
  }
}

function saveProgress(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
}

function rankFromXp(xp) {
  if (xp >= 900) return { label: 'Architecte d’arêtes', tier: 4 }
  if (xp >= 550) return { label: 'Designer en herbe', tier: 3 }
  if (xp >= 300) return { label: 'Apprenti volume', tier: 2 }
  if (xp >= 100) return { label: 'Esquisse vivante', tier: 1 }
  return { label: 'Nouveau venu', tier: 0 }
}

export default function HomePlayground({ storyXp = 0 }) {
  const navigate = useNavigate()
  const setEnvironment = useConfigStore((s) => s.setEnvironment)
  const [progress, setProgress] = useState(loadProgress)
  const [flipDual, setFlipDual] = useState(0)
  const [pulseMission, setPulseMission] = useState(null)

  const totalXp = useMemo(
    () => Math.max(progress.xp, 0) + Math.min(storyXp, 150),
    [progress.xp, storyXp],
  )
  const rank = rankFromXp(totalXp)
  const xpCap = 900
  const xpPct = Math.min(100, Math.round((totalXp / xpCap) * 100))

  useEffect(() => {
    const t = setInterval(() => {
      setFlipDual((i) => (i + 1) % DUALS.length)
    }, 4200)
    return () => clearInterval(t)
  }, [])

  const markMission = useCallback((missionId, xpGain) => {
    setProgress((prev) => {
      if (prev.missionsDone.includes(missionId)) return prev
      const next = {
        ...prev,
        missionsDone: [...prev.missionsDone, missionId],
        xp: prev.xp + xpGain,
      }
      saveProgress(next)
      return next
    })
    setPulseMission(missionId)
    window.setTimeout(() => setPulseMission(null), 900)
  }, [])

  const enterWorld = useCallback(
    (world) => {
      if (world.status !== 'open' || !world.envId) return
      if (ENVIRONMENTS[world.envId]) {
        setEnvironment(world.envId)
      }
      setProgress((prev) => {
        const worldsVisited = prev.worldsVisited.includes(world.id)
          ? prev.worldsVisited
          : [...prev.worldsVisited, world.id]
        const next = {
          ...prev,
          worldsVisited,
          xp: prev.worldsVisited.includes(world.id) ? prev.xp : prev.xp + 80,
        }
        saveProgress(next)
        return next
      })
      navigate(`/configurateur?env=${encodeURIComponent(world.envId)}`)
    },
    [navigate, setEnvironment],
  )

  const onMission = (m) => {
    markMission(m.id, m.xp)
    if (m.action === 'scroll-top') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (m.to?.startsWith('/configurateur')) {
      const env = new URL(m.to, window.location.origin).searchParams.get('env')
      if (env && ENVIRONMENTS[env]) setEnvironment(env)
      navigate(m.to)
      return
    }
    if (m.to) navigate(m.to)
  }

  const dual = DUALS[flipDual]

  return (
    <section className="playground" aria-label="Terrain de jeu Philae">
      {/* ── Hero hub ── */}
      <header className="playground-hero">
        <div className="playground-hero-inner">
          <p className="section-kicker playground-kicker">
            Terrain de jeu · designers en herbe
          </p>
          <h2 className="playground-title">
            What better place
            <br />
            <span className="gold">than here ?</span>
          </h2>
          <p className="playground-lead">
            Philae n’est pas une vitrine. C’est un atelier où l’arête devient
            meuble, où les mondes se débloquent, où tu joues avec la géométrie
            avant de commander le bois.
          </p>

          <div className="playground-xp" aria-label={`Progression ${totalXp} XP`}>
            <div className="playground-xp-meta">
              <span className="playground-rank">{rank.label}</span>
              <span className="playground-xp-num">
                {totalXp} <abbr title="expérience">XP</abbr>
              </span>
            </div>
            <div className="playground-xp-track" role="progressbar" aria-valuenow={xpPct} aria-valuemin={0} aria-valuemax={100}>
              <div className="playground-xp-fill" style={{ width: `${xpPct}%` }} />
              <span className="playground-xp-ticks" aria-hidden>
                {[25, 50, 75].map((t) => (
                  <i key={t} style={{ left: `${t}%` }} />
                ))}
              </span>
            </div>
            <p className="playground-xp-hint">
              Scrolle le récit · lance des missions · entre dans un monde
            </p>
          </div>
        </div>

        {/* Dual polyèdre easter egg */}
        <aside className="playground-dual" aria-live="polite">
          <p className="playground-dual-kicker">Vortex · dual</p>
          <div className="playground-dual-pair" key={dual.a + dual.b}>
            <span className="playground-dual-a">{dual.a}</span>
            <span className="playground-dual-arrow" aria-hidden>
              ⇄
            </span>
            <span className="playground-dual-b">{dual.b}</span>
          </div>
          <p className="playground-dual-note">{dual.note}</p>
        </aside>
      </header>

      {/* ── Missions ── */}
      <div className="playground-section">
        <div className="playground-section-head">
          <p className="section-kicker">Quêtes</p>
          <h3 className="playground-section-title">
            Quatre portes pour <span className="gold">entrer</span>
          </h3>
        </div>
        <ul className="playground-missions">
          {MISSIONS.map((m) => {
            const done = progress.missionsDone.includes(m.id)
            return (
              <li
                key={m.id}
                className={`playground-mission tone-${m.tone}${done ? ' is-done' : ''}${
                  pulseMission === m.id ? ' is-pulse' : ''
                }`}
              >
                <div className="playground-mission-top">
                  <span className="playground-mission-rank">{m.rank}</span>
                  <span className="playground-mission-xp">+{m.xp} XP</span>
                </div>
                <h4>{m.title}</h4>
                <p>{m.text}</p>
                <button
                  type="button"
                  className="playground-mission-cta"
                  onClick={() => onMission(m)}
                >
                  {done ? 'Rejouer · ' : ''}
                  {m.cta}
                  <span aria-hidden> →</span>
                </button>
                {done && (
                  <span className="playground-mission-stamp" aria-hidden>
                    ✓
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Mondes / environnements ── */}
      <div className="playground-section playground-worlds-wrap">
        <div className="playground-section-head">
          <p className="section-kicker">Mondes</p>
          <h3 className="playground-section-title">
            Environnements comme <span className="gold">niveaux</span>
          </h3>
          <p className="playground-section-lead">
            Chaque scène 3D est un territoire de jeu. Un seul monde ouvert
            aujourd’hui — le reste se construit avec la carte.
          </p>
        </div>
        <ul className="playground-worlds">
          {WORLDS.map((w) => {
            const visited = progress.worldsVisited.includes(w.id)
            const open = w.status === 'open'
            return (
              <li
                key={w.id}
                className={`playground-world${open ? ' is-open' : ' is-locked'}${
                  visited ? ' is-visited' : ''
                }`}
                style={{ '--world-accent': w.accent }}
              >
                <div className="playground-world-badge">{w.badge}</div>
                <div className="playground-world-icon" aria-hidden>
                  {w.icon}
                </div>
                <h4>{w.title}</h4>
                <p className="playground-world-tag">{w.tagline}</p>
                <p className="playground-world-blurb">{w.blurb}</p>
                {open ? (
                  <button
                    type="button"
                    className="playground-world-cta"
                    onClick={() => enterWorld(w)}
                  >
                    {visited ? 'Revenir' : 'Entrer'} dans le monde
                  </button>
                ) : (
                  <span className="playground-world-lock">Bientôt débloqué</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {/* ── Split path ── */}
      <div className="playground-paths">
        <Link to="/boutique" className="playground-path playground-path-shop">
          <span className="playground-path-kicker">Parcours rapide</span>
          <strong>Boutique</strong>
          <span className="playground-path-desc">
            Modèles préconfigurés · L×P×H figés · personnalise le reste
          </span>
          <span className="playground-path-go">Explorer →</span>
        </Link>
        <Link
          to="/configurateur"
          className="playground-path playground-path-forge"
        >
          <span className="playground-path-kicker">Parcours libre</span>
          <strong>Configurateur</strong>
          <span className="playground-path-desc">
            Dimensions libres · multi-meubles · scènes · sur mesure réel
          </span>
          <span className="playground-path-go">Forger →</span>
        </Link>
      </div>

      <p className="playground-footer-note">
        What better time than now · Atelier Philae · mobilier géométrique
      </p>
    </section>
  )
}
