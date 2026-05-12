import { useMemo, useState } from 'react'
import { getYoutubeThumbnailSources } from '../utils/youtubeVideo'

const failedThumbnailSources = new Set()

function YoutubeThumbnail({ src = '', youtubeVideoId = '', alt = '', className = '', placeholder = null }) {
  const sources = useMemo(
    () => getYoutubeThumbnailSources(src, youtubeVideoId).filter((source) => !failedThumbnailSources.has(source)),
    [src, youtubeVideoId],
  )
  const sourceKey = sources.join('|')
  const [sourceState, setSourceState] = useState({ key: '', index: 0 })
  const sourceIndex = sourceState.key === sourceKey ? sourceState.index : 0
  const currentSrc = sources[sourceIndex]

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
        setSourceState({ key: sourceKey, index: sourceIndex + 1 })
      }}
    />
  )
}

export default YoutubeThumbnail
