import { useEffect, useMemo, useState } from 'react'
import { getYoutubeThumbnailSources } from '../utils/youtubeVideo'

function YoutubeThumbnail({ src = '', youtubeVideoId = '', alt = '', className = '', placeholder = null }) {
  const sources = useMemo(() => getYoutubeThumbnailSources(src, youtubeVideoId), [src, youtubeVideoId])
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
