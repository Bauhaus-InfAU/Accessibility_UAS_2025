import { useState } from 'react'

const VERSION = 'v2026.1'
const LICENSE = 'CC BY-NC 4.0'
const AUTHOR = 'Martin Bielik'
const REPO_URL = 'https://github.com/Bauhaus-InfAU/Accessibility_UAS_2025'

const COLLABORATORS = [
  'Egor Gaydukov',
]

const PARTNERS = [
  { name: 'InfAU', fullName: 'Bauhaus-Universität Weimar - Chair Informatics in Architecture and Urbanism', url: 'https://www.uni-weimar.de/en/architecture-and-urbanism/chairs/infau/news/' },
  { name: 'DecodingSpaces', fullName: 'DecodingSpaces', url: 'https://decodingspaces.de/' },
]

export function AppInfo() {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 text-[10px] sm:text-xs text-white/70 pointer-events-auto">
      <div className="flex items-center gap-1">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white transition-colors"
        >
          {VERSION}
        </a>
        <span>|</span>
        <span>{LICENSE}</span>
        <span>|</span>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-white transition-colors"
        >
          {AUTHOR}
        </a>
        <span className="mx-1">•</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="hover:text-white transition-colors flex items-center gap-1"
        >
          <span>Collaborators</span>
          <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>▾</span>
        </button>
      </div>

      {expanded && (
        <div className="mt-1 pl-2 border-l border-white/30">
          {COLLABORATORS.map((name, i) => (
            <div key={i}>{name}</div>
          ))}
        </div>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-1">
        <span>in partnership with</span>
        {PARTNERS.map((partner, i) => (
          <span key={partner.name} className="flex items-center">
            <a
              href={partner.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
              title={partner.fullName}
            >
              {partner.name}
            </a>
            {i < PARTNERS.length - 1 && <span className="mx-1">&</span>}
          </span>
        ))}
      </div>
    </div>
  )
}
