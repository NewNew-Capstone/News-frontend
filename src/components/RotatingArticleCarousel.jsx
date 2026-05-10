import { useEffect, useState } from 'react'
import YoutubeThumbnail from './YoutubeThumbnail'
import './RotatingArticleCarousel.css'

function ArrowIcon({ direction = 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      style={{ transform: direction === 'left' ? 'rotate(180deg)' : 'none' }}
    >
      <path
        d="m9 5 7 7-7 7"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function normalizeIndex(index, length) {
  if (!length) {
    return 0
  }

  return ((index % length) + length) % length
}

function getCircularOffset(index, activeIndex, length) {
  if (!length) {
    return 0
  }

  let offset = index - activeIndex
  const half = length / 2

  if (offset > half) {
    offset -= length
  } else if (offset < -half) {
    offset += length
  }

  return offset
}

function getCardOpacity(distance) {
  if (distance === 0) {
    return 1
  }

  if (distance === 1) {
    return 0.72
  }

  return 0
}

function getCardTransform(offset) {
  const distance = Math.abs(offset)

  if (distance === 0) {
    return {
      translateX: '0px',
      translateY: '0px',
      translateZ: 'var(--carousel-active-depth)',
      rotateY: '0deg',
      scale: 1,
    }
  }

  return {
    translateX: `calc(var(--carousel-side-offset) * ${offset})`,
    translateY: '30px',
    translateZ: 'var(--carousel-side-depth)',
    rotateY: `${offset * 78}deg`,
    scale: 0.74,
  }
}

function RotatingArticleCarousel({
  articles,
  sectionName,
  onOpenArticle,
  autoRotateMs = 4200,
  publisherId = '',
  onToggleScrap,
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    setActiveIndex(0)
  }, [articles])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    updateMotionPreference()
    mediaQuery.addEventListener('change', updateMotionPreference)

    return () => {
      mediaQuery.removeEventListener('change', updateMotionPreference)
    }
  }, [])

  useEffect(() => {
    if (articles.length < 2 || isPaused || prefersReducedMotion) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => normalizeIndex(currentIndex + 1, articles.length))
    }, autoRotateMs)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [articles.length, autoRotateMs, isPaused, prefersReducedMotion])

  if (!articles.length) {
    return null
  }

  const handleMove = (direction) => {
    setActiveIndex((currentIndex) =>
      normalizeIndex(currentIndex + (direction === 'left' ? -1 : 1), articles.length),
    )
  }

  const handleCardClick = (article, index, isActive) => {
    if (!isActive) {
      setActiveIndex(index)
      return
    }

    if (article.youtubeVideoId) {
      onOpenArticle(article.youtubeVideoId)
    }
  }

  const handleToggleScrap = (event, articleId) => {
    event.stopPropagation()

    if (typeof onToggleScrap === 'function' && publisherId) {
      onToggleScrap(publisherId, articleId)
    }
  }

  return (
    <div
      className="rotating-article-carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label={`${sectionName} 기사 캐러셀`}
      aria-roledescription="carousel"
    >
      {articles.length > 1 ? (
        <button
          className="rotating-article-carousel__arrow rotating-article-carousel__arrow--left"
          type="button"
          aria-label={`${sectionName} 이전 기사 보기`}
          onClick={() => handleMove('left')}
        >
          <ArrowIcon direction="left" />
        </button>
      ) : null}

      <div className="rotating-article-carousel__viewport">
        <div className="rotating-article-carousel__stage">
          {articles.map((article, index) => {
            const offset = getCircularOffset(index, activeIndex, articles.length)
            const distance = Math.abs(offset)
            const isActive = index === activeIndex
            const isVisible = distance <= 1
            const transform = getCardTransform(offset)

            return (
              <article
                key={article.id}
                className={`rotating-article-carousel__card ${
                  isActive ? 'rotating-article-carousel__card--active' : ''
                } ${
                  !isVisible ? 'rotating-article-carousel__card--hidden' : ''
                }`}
                aria-hidden={!isVisible}
                style={{
                  '--carousel-translate-x': transform.translateX,
                  '--carousel-translate-y': transform.translateY,
                  '--carousel-translate-z': transform.translateZ,
                  '--carousel-rotate-y': transform.rotateY,
                  '--carousel-scale': transform.scale,
                  '--carousel-item-opacity': getCardOpacity(distance),
                  zIndex: String(isActive ? 30 : 20),
                }}
              >
                <div className="rotating-article-carousel__card-frame">
                  {typeof onToggleScrap === 'function' ? (
                    <button
                      type="button"
                      className={`rotating-article-carousel__bookmark ${
                        article.scrapped ? 'rotating-article-carousel__bookmark--active' : ''
                      }`}
                      aria-label={article.scrapped ? '스크랩 해제' : '스크랩'}
                      aria-pressed={article.scrapped}
                      onClick={(event) => handleToggleScrap(event, article.id)}
                      title={article.scrapped ? '스크랩 해제' : '스크랩'}
                    >
                      <span className="rotating-article-carousel__bookmark-label">스크랩</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    className="rotating-article-carousel__card-hitarea"
                    onClick={() => handleCardClick(article, index, isActive)}
                    aria-current={isActive ? 'true' : undefined}
                    aria-label={
                      isActive ? `${article.title} 열기` : `${article.title} 앞으로 보기`
                    }
                    tabIndex={isVisible ? 0 : -1}
                  >
                    <div className="rotating-article-carousel__media">
                      <YoutubeThumbnail
                        src={article.image}
                        youtubeVideoId={article.youtubeVideoId}
                        alt={article.title}
                        placeholder={<div className="rotating-article-carousel__placeholder" />}
                      />
                    </div>

                    <div className="rotating-article-carousel__body">
                      <div className="rotating-article-carousel__meta">
                        <span className="rotating-article-carousel__publisher">
                          {article.description || article.reporter}
                        </span>
                        <span className="rotating-article-carousel__date">{article.date}</span>
                      </div>
                      <strong>{article.title}</strong>
                    </div>
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      {articles.length > 1 ? (
        <button
          className="rotating-article-carousel__arrow rotating-article-carousel__arrow--right"
          type="button"
          aria-label={`${sectionName} 다음 기사 보기`}
          onClick={() => handleMove('right')}
        >
          <ArrowIcon direction="right" />
        </button>
      ) : null}
    </div>
  )
}

export default RotatingArticleCarousel
