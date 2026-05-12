const GAP_LABEL_META = {
  trustworthy: {
    icon: '✓',
    text: '신뢰',
    tone: 'trustworthy',
    description: '제목과 본문이 같은 방향으로 이어져 신뢰도가 높은 흐름입니다.',
  },
  neutral: {
    icon: '–',
    text: '중립',
    tone: 'neutral',
    description: '제목과 본문 사이에 큰 괴리는 감지되지 않았습니다.',
  },
  clickbait: {
    icon: '⚠',
    text: '낚시성',
    tone: 'clickbait',
    description: '제목이 실제 본문보다 강하게 자극하는 흐름이 감지됐습니다.',
  },
  buried_lede: {
    icon: '⚠',
    text: '리드묻힘',
    tone: 'buried-lede',
    description: '핵심 정보가 제목보다 본문 뒤쪽에서 늦게 드러나는 흐름입니다.',
  },
}

function normalizeGapValue(value) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return null
  }

  return Math.min(1, Math.max(0, numericValue))
}

function formatGapValue(value) {
  const normalizedValue = normalizeGapValue(value)

  return normalizedValue === null ? '--' : normalizedValue.toFixed(2)
}

function getGapColor(value) {
  const normalizedValue = normalizeGapValue(value) ?? 0
  const hue = 145 - normalizedValue * 145
  const saturation = 72 + normalizedValue * 8
  const lightness = 42 + normalizedValue * 10

  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

function HeadlineBodyGapCard({
  score = null,
  lead = null,
  tail = null,
  label = 'neutral',
}) {
  const normalizedLabel = String(label || 'neutral').toLowerCase()
  const labelMeta = GAP_LABEL_META[normalizedLabel] || GAP_LABEL_META.neutral
  const bars = [
    { key: 'lead', label: '앞부분', value: lead },
    { key: 'tail', label: '뒷부분', value: tail },
    { key: 'score', label: '전체', value: score },
  ]

  return (
    <article
      className={`video-summary-detail-page__analysis-compact-card video-summary-detail-page__headline-gap-card video-summary-detail-page__headline-gap-card--${labelMeta.tone}`}
    >
      <div className="video-summary-detail-page__headline-gap-header">
        <div className="video-summary-detail-page__headline-gap-title-group">
          <span className="video-summary-detail-page__headline-gap-kicker">제목 - 본문</span>
          <strong className="video-summary-detail-page__headline-gap-label">
            <span aria-hidden="true">{labelMeta.icon}</span>
            {labelMeta.text}
          </strong>
        </div>
      </div>

      <p className="video-summary-detail-page__headline-gap-description">
        {labelMeta.description}
      </p>

      <div className="video-summary-detail-page__headline-gap-bar-list">
        {bars.map((bar) => {
          const normalizedValue = normalizeGapValue(bar.value)
          const width = `${(normalizedValue ?? 0) * 100}%`

          return (
            <div key={bar.key} className="video-summary-detail-page__headline-gap-bar-item">
              <div className="video-summary-detail-page__headline-gap-bar-meta">
                <strong>{bar.label}</strong>
                <span>{formatGapValue(bar.value)}</span>
              </div>
              <div className="video-summary-detail-page__analysis-bar-track">
                <span
                  className="video-summary-detail-page__headline-gap-bar-fill"
                  style={{
                    width,
                    '--headline-gap-color': getGapColor(bar.value),
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )
}

export default HeadlineBodyGapCard
