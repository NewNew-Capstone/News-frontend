import { useEffect, useMemo, useState } from 'react'

const YOUTUBE_THUMBNAIL_HOSTS = new Set(['i.ytimg.com', 'img.youtube.com'])
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

function normalizeVideoId(value) {
  const videoId = typeof value === 'string' ? value.trim() : ''

  return YOUTUBE_VIDEO_ID_PATTERN.test(videoId) ? videoId : ''
}

function parseYoutubeThumbnailUrl(value) {
  const thumbnailUrl = typeof value === 'string' ? value.trim() : ''

  if (!thumbnailUrl) {
    return null
  }

  try {
    const url = new URL(thumbnailUrl)

    if (!YOUTUBE_THUMBNAIL_HOSTS.has(url.hostname.toLowerCase())) {
      return null
    }

    const [, directory, videoId, fileName] = url.pathname.split('/')

    if (!['vi', 'vi_webp'].includes(directory) || !videoId || !fileName) {
      return null
    }

    return {
      videoId: normalizeVideoId(decodeURIComponent(videoId)),
      fileName: fileName.toLowerCase(),
    }
  } catch {
    return null
  }
}

function buildYoutubeThumbnailUrl(videoId, fileName) {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${fileName}`
}

function unique(values) {
  return values.filter((value, index, array) => value && array.indexOf(value) === index)
}

function getThumbnailSources(src, youtubeVideoId) {
  const initialSrc = typeof src === 'string' ? src.trim() : ''
  const parsedThumbnail = parseYoutubeThumbnailUrl(initialSrc)
  const parsedVideoId = parsedThumbnail?.videoId || ''
  const normalizedVideoId = normalizeVideoId(youtubeVideoId) || parsedVideoId
  const isYoutubeHqThumbnail = parsedThumbnail?.fileName === 'hqdefault.jpg'
  const candidates = []

  if (isYoutubeHqThumbnail && normalizedVideoId) {
    candidates.push(buildYoutubeThumbnailUrl(normalizedVideoId, 'mqdefault.jpg'))
  } else {
    candidates.push(initialSrc)
  }

  if (normalizedVideoId) {
    candidates.push(buildYoutubeThumbnailUrl(normalizedVideoId, 'mqdefault.jpg'))
  }

  return unique(candidates)
}

function YoutubeThumbnail({ src = '', youtubeVideoId = '', alt = '', className = '', placeholder = null }) {
  const sources = useMemo(() => getThumbnailSources(src, youtubeVideoId), [src, youtubeVideoId])
  const sourceKey = sources.join('|')
  const [sourceIndex, setSourceIndex] = useState(0)
  const currentSrc = sources[sourceIndex]

  useEffect(() => {
    setSourceIndex(0)
  }, [sourceKey])

  if (!currentSrc) {
    return placeholder
  }

  return (
    <img
      className={className || undefined}
      src={currentSrc}
      alt={alt}
      loading="lazy"
      onError={() => {
        setSourceIndex((index) => index + 1)
      }}
    />
  )
}

export default YoutubeThumbnail
