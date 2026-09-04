/**
 * Route interne DAE + CSV — uniquement `vite` (configureServer).
 * Absente du build et de Cloudflare Pages : en production ces URLs n’existent pas.
 */
const PAGE_PATH = '/atelier-cad'
const DOWNLOAD_PATH = '/atelier-cad/download'
const LOCAL_KEY = 'philae-saved-config'

function pathnameOf(req) {
  const raw = (req.originalUrl || req.url || '').split('?')[0]
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function send(res, status, body, headers = {}) {
  if (res.writableEnded) return
  res.statusCode = status
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function cadPageHtml() {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="robots" content="noindex,nofollow"/>
  <title>Export DAE + CSV — Philae (dev)</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0; font-family: Georgia, "Times New Roman", serif;
      background: #f4efe6; color: #1a1714;
    }
    main { max-width: 40rem; margin: 0 auto; padding: 2.5rem 1.4rem 4rem; }
    .kicker { font-size: .75rem; letter-spacing: .08em; color: #6b645c; }
    h1 { font-size: 1.6rem; margin: .3rem 0 .8rem; font-weight: 500; }
    p { line-height: 1.5; }
    .muted { color: #6b645c; font-size: .85rem; }
    ul { padding-left: 1.1rem; }
    code { font-family: ui-monospace, Consolas, monospace; font-size: .9em; }
    button {
      font: inherit; cursor: pointer; border: 0; padding: .7rem 1.2rem;
      background: #1a1714; color: #f4efe6;
    }
    button:disabled { opacity: .45; cursor: not-allowed; }
    .err { color: #8a1f1f; margin-top: 1rem; }
  </style>
</head>
<body>
  <main>
    <p class="kicker">USAGE INTERNE · PHILAE · DEV ONLY</p>
    <h1>Export DAE + CSV</h1>
    <p>
      Cette page n’existe que sur le serveur Vite local.
      Elle exporte la configuration actuelle (ossature, panneaux découpés,
      tablettes, traverses, tiroirs et façades).
    </p>
    <p class="muted" id="ref">Réf. —</p>
    <ul id="parts"></ul>
    <button type="button" id="dl" disabled>Télécharger DAE + CSV</button>
    <p class="err" id="err" hidden></p>
  </main>
  <script>
    const KEY = ${JSON.stringify(LOCAL_KEY)}
    const partsEl = document.getElementById('parts')
    const refEl = document.getElementById('ref')
    const dl = document.getElementById('dl')
    const errEl = document.getElementById('err')

    function cm(mm) {
      const n = Number(mm)
      if (!Number.isFinite(n)) return '—'
      return (n / 10).toFixed(n % 10 ? 1 : 0)
    }

    function readState() {
      try {
        const snap = JSON.parse(localStorage.getItem(KEY) || 'null')
        if (!Array.isArray(snap?.units) || !snap.units.length) return null
        return snap
      } catch { return null }
    }

    function showError(msg) {
      errEl.hidden = !msg
      errEl.textContent = msg || ''
    }

    function trigger(name, text, mime) {
      const blob = new Blob([text], { type: mime })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = name
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 1500)
    }

    const state = readState()
    if (!state) {
      refEl.textContent = 'Aucune configuration locale. Ouvre d’abord le configurateur.'
    } else {
      refEl.textContent = 'Réf. ' + (state.quoteRef || '—')
      for (const u of state.units) {
        const li = document.createElement('li')
        li.textContent =
          (u.label || u.id || 'Meuble') +
          ' — ' + cm(u.dims?.L) + ' × ' + cm(u.dims?.W) + ' × ' + cm(u.dims?.H) + ' cm'
        partsEl.appendChild(li)
      }
      dl.disabled = false
    }

    dl.addEventListener('click', async () => {
      const current = readState()
      if (!current) {
        showError('Aucune configuration à exporter.')
        return
      }
      dl.disabled = true
      showError('')
      try {
        const res = await fetch(${JSON.stringify(DOWNLOAD_PATH)}, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(current),
        })
        if (res.status === 404) {
          showError('Route absente (404). Relance npm run dev.')
          return
        }
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          showError(data.error || ('Erreur ' + res.status))
          return
        }
        const base = data.base || 'philae-meuble'
        trigger(base + '.csv', '\\uFEFF' + data.csv, 'text/csv;charset=utf-8')
        trigger(base + '.dae', data.dae, 'model/vnd.collada+xml')
      } catch (e) {
        showError(e.message || 'Téléchargement impossible')
      } finally {
        dl.disabled = !readState()
      }
    })
  </script>
</body>
</html>`
}

export function cadExportDevPlugin() {
  return {
    name: 'philae-cad-dev-only',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = pathnameOf(req)
        const isPage = path === PAGE_PATH || path === `${PAGE_PATH}/`
        const isDownload = path === DOWNLOAD_PATH
        if (!isPage && !isDownload) {
          next()
          return
        }

        if (isPage) {
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' })
            return
          }
          const html = cadPageHtml()
          send(res, 200, req.method === 'HEAD' ? '' : html, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          })
          return
        }

        if (req.method !== 'POST') {
          send(res, 405, 'POST JSON config required', {
            Allow: 'POST',
            'Content-Type': 'text/plain; charset=utf-8',
          })
          return
        }

        readBody(req)
          .then(async (raw) => {
            let state
            try {
              state = JSON.parse(raw || '{}')
            } catch {
              send(res, 400, JSON.stringify({ error: 'JSON invalide' }), {
                'Content-Type': 'application/json; charset=utf-8',
              })
              return
            }
            if (!Array.isArray(state.units) || !state.units.length) {
              send(res, 400, JSON.stringify({ error: 'Aucune configuration (units vide)' }), {
                'Content-Type': 'application/json; charset=utf-8',
              })
              return
            }
            const mod = await server.ssrLoadModule('/src/lib/furnitureExport.js')
            const files = mod.buildFurnitureCadFiles(state)
            send(res, 200, JSON.stringify(files), {
              'Content-Type': 'application/json; charset=utf-8',
              'Cache-Control': 'no-store',
            })
          })
          .catch((e) => {
            send(
              res,
              500,
              JSON.stringify({ error: e?.message || 'export failed' }),
              { 'Content-Type': 'application/json; charset=utf-8' },
            )
          })
      })
    },
  }
}
