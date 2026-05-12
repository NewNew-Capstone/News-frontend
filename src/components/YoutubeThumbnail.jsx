import { useEffect, useMemo, useState } from 'react'
import { getYoutubeThumbnailSources } from '../utils/youtubeVideo'

const failedThumbnailSources = new Set()

function YoutubeThumbnail({ src = '', youtubeVideoId = '', alt = '', className = '', placeholder = null }) {
  const sources = useMemo(
    () => getYoutubeThumbnailSources(src, youtubeVideoId).filter((source) => !failedThumbnailSources.has(source)),
    [src, youtubeVideoId],
  )
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
        failedThumbnailSources.add(currentSrc)
        setSourceIndex((index) => index + 1)
      }}
    />
  )
}

export default YoutubeThumbnail
