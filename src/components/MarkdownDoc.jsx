import { useMemo } from 'react'

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function inline(s) {
  let t = escapeHtml(s)
  t = t.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2">$1</a>',
  )
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  return t
}

function isTableSep(line) {
  return /^\s*\|?\s*:?-{3,}/.test(line)
}

export function mdToHtml(md) {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n')
  const out = []
  let i = 0
  let list = null

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`)
      list = null
    }
  }

  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trimEnd()
    const trim = line.trim()

    if (!trim) {
      closeList()
      i++
      continue
    }

    if (trim === '---') {
      closeList()
      out.push('<hr />')
      i++
      continue
    }

    const h = /^(#{1,4})\s+(.+)$/.exec(trim)
    if (h) {
      closeList()
      const n = h[1].length
      out.push(`<h${n}>${inline(h[2])}</h${n}>`)
      i++
      continue
    }

    if (trim.startsWith('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeList()
      const cells = (s) =>
        s
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((c) => c.trim())
      const head = cells(trim)
      i += 2
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(cells(lines[i]))
        i++
      }
      out.push('<table><thead><tr>')
      head.forEach((c) => out.push(`<th>${inline(c)}</th>`))
      out.push('</tr></thead><tbody>')
      rows.forEach((r) => {
        out.push('<tr>')
        r.forEach((c) => out.push(`<td>${inline(c)}</td>`))
        out.push('</tr>')
      })
      out.push('</tbody></table>')
      continue
    }

    if (/^[-*]\s+/.test(trim)) {
      if (list !== 'ul') {
        closeList()
        list = 'ul'
        out.push('<ul>')
      }
      out.push(`<li>${inline(trim.replace(/^[-*]\s+/, ''))}</li>`)
      i++
      continue
    }

    if (/^\d+\.\s+/.test(trim)) {
      if (list !== 'ol') {
        closeList()
        list = 'ol'
        out.push('<ol>')
      }
      out.push(`<li>${inline(trim.replace(/^\d+\.\s+/, ''))}</li>`)
      i++
      continue
    }

    closeList()
    const para = [trim]
    i++
    while (
      i < lines.length &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('#') &&
      !lines[i].trim().startsWith('|') &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      lines[i].trim() !== '---'
    ) {
      para.push(lines[i].trim())
      i++
    }
    out.push(`<p>${inline(para.join(' '))}</p>`)
  }
  closeList()
  return out.join('\n')
}

export default function MarkdownDoc({ source }) {
  const html = useMemo(() => mdToHtml(source), [source])
  return (
    <div className="legal-md" dangerouslySetInnerHTML={{ __html: html }} />
  )
}
