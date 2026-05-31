const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_THUMBNAIL_HOSTS = new Set(['i.ytimg.com', 'img.youtube.com'])
const YOUTUBE_THUMBNAIL_FALLBACK_FILES = ['mqdefault.jpg', 'default.jpg', 'hqdefault.jpg']

function normalizeHost(hostname) {
  return hostname.toLowerCase().replace(/^www\./, '')
}

function pickPathVideoId(url) {
  const segments = url.pathname.split('/').filter(Boolean)
  const firstSegment = segments[0]

  if (url.hostname.toLowerCase() === 'youtu.be') {
    return segments[0] || ''
  }

  if (['embed', 'shorts', 'live', 'v', 'vi', 'vi_webp'].includes(firstSegment)) {
    return segments[1] || ''
  }

  return ''
}

export function normalizeYoutubeVideoId(value) {
  const rawValue = typeof value === 'string' ? value.trim() : String(value ?? '').trim()

  if (!rawValue) {
    return ''
  }

  if (YOUTUBE_VIDEO_ID_PATTERN.test(rawValue)) {
    return rawValue
  }

  const urlValue =
    rawValue.startsWith('http://') || rawValue.startsWith('https://')
      ? rawValue
      : rawValue.startsWith('www.')
        ? `https://${rawValue}`
        : ''

  if (urlValue) {
    try {
      const url = new URL(urlValue)
      const host = normalizeHost(url.hostname)

      if (
        host === 'youtube.com' ||
        host.endsWith('.youtube.com') ||
        host === 'youtube-nocookie.com' ||
        host.endsWith('.youtube-nocookie.com') ||
        host === 'youtu.be' ||
        YOUTUBE_THUMBNAIL_HOSTS.has(url.hostname.toLowerCase())
      ) {
        const queryVideoId = url.searchParams.get('v')
        const pathVideoId = pickPathVideoId(url)
        const candidate = queryVideoId || pathVideoId

        if (YOUTUBE_VIDEO_ID_PATTERN.test(candidate)) {
          return candidate
        }
      }
    } catch {
      return ''
    }
  }

  const matchedVideoId = rawValue.match(
    /(?:v=|youtu\.be\/|\/(?:embed|shorts|live|v|vi|vi_webp)\/)([A-Za-z0-9_-]{11})/,
  )

  return matchedVideoId?.[1] || ''
}

export function isYoutubeThumbnailUrl(value) {
  const thumbnailUrl = typeof value === 'string' ? value.trim() : ''

  if (!thumbnailUrl) {
    return false
  }

  try {
    const url = new URL(thumbnailUrl)

    return YOUTUBE_THUMBNAIL_HOSTS.has(url.hostname.toLowerCase())
  } catch {
    return false
  }
}

export function buildYoutubeThumbnailUrl(videoId, fileName = 'mqdefault.jpg') {
  const normalizedVideoId = normalizeYoutubeVideoId(videoId)

  return normalizedVideoId
    ? `https://i.ytimg.com/vi/${encodeURIComponent(normalizedVideoId)}/${fileName}`
    : ''
}

export function getYoutubeThumbnailSources(src = '', youtubeVideoId = '', options = {}) {
  const initialSrc = typeof src === 'string' ? src.trim() : ''
  const candidates = []
  const isInitialYoutubeThumbnail = isYoutubeThumbnailUrl(initialSrc)
  const normalizedVideoId = normalizeYoutubeVideoId(youtubeVideoId || initialSrc)

  if (normalizedVideoId && (options.allowGenerated === true || youtubeVideoId || isInitialYoutubeThumbnail)) {
    YOUTUBE_THUMBNAIL_FALLBACK_FILES.forEach((fileName) => {
      candidates.push(buildYoutubeThumbnailUrl(normalizedVideoId, fileName))
    })
  }

  if (initialSrc && !isInitialYoutubeThumbnail) {
    candidates.push(initialSrc)
  }

  if (initialSrc && isInitialYoutubeThumbnail && !normalizedVideoId) {
    candidates.push(initialSrc)
  }

  return candidates.filter((candidate, index, array) => candidate && array.indexOf(candidate) === index)
}
