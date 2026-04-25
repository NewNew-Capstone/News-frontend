import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import {
  fetchRecommendedChannelVideos,
  fetchYoutubeComments,
  fetchYoutubeTranscript,
  fetchYoutubeVideoDetail,
} from '../services/youtube'
import './VideoSummaryDetail.css'

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M16.38 8.4a3 3 0 1 0-1.18-2.4c0 .22.02.43.07.64l-6.2 3.1a3 3 0 0 0-5.07 2.16 3 3 0 0 0 5.07 2.16l6.2 3.1a3.09 3.09 0 0 0-.07.64 3 3 0 1 0 1.18-2.4l-6.2-3.1c.04-.2.07-.42.07-.64 0-.22-.03-.44-.07-.64l6.2-3.1Z"
        fill="currentColor"
      />
    </svg>
  )
}

function BookmarkIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8.25 4.5h7.5c.41 0 .75.34.75.75v13.19l-4.5-2.79-4.5 2.79V5.25c0-.41.34-.75.75-.75Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function AnalysisIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4.5v15m-5.5-11.25h11M9 8.25l-4.5 8.25h9L9 8.25Zm10.5 0L15 16.5h9l-4.5-8.25ZM8.25 4.5h7.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8.5 6.25 18 12l-9.5 5.75V6.25Z" fill="currentColor" />
    </svg>
  )
}

function pickFirst(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source?.[key]

    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return fallback
}

function formatPublishedDate(value) {
  if (!value) {
    return '날짜 정보 없음'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function formatCount(value, label) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return ''
  }

  return `${label} ${value.toLocaleString()}`
}

function mapRecommendedVideo(video) {
  return {
    youtubeVideoId: pickFirst(video, ['youtubeVideoId', 'videoId', 'id']),
    title: pickFirst(video, ['title', 'videoTitle', 'name'], '영상 제목 정보가 없습니다.'),
    channelName: pickFirst(video, ['channelName', 'channelTitle', 'channel'], '채널 정보 없음'),
    date: formatPublishedDate(
      pickFirst(video, ['publishedAt', 'publishedDate', 'published_at', 'uploadDate']),
    ),
    image: pickFirst(video, ['thumbnailUrl', 'thumbnail', 'imageUrl']),
    scrapped: false,
  }
}

function VideoSummaryDetail({ isLoggedIn, onAuthClick, videoId }) {
  const [videoDetail, setVideoDetail] = useState(null)
  const [transcript, setTranscript] = useState(null)
  const [comments, setComments] = useState([])
  const [recommendedVideos, setRecommendedVideos] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isMainScrapped, setIsMainScrapped] = useState(false)
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false)
  const [hasRequestedTranscript, setHasRequestedTranscript] = useState(false)
  const [isTranscriptLoading, setIsTranscriptLoading] = useState(false)
  const [transcriptErrorMessage, setTranscriptErrorMessage] = useState('')
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)
  const [shareAnnouncement, setShareAnnouncement] = useState('')

  useEffect(() => {
    if (!videoId) {
      setErrorMessage('영상 정보가 없습니다.')
      setIsLoading(false)
      return undefined
    }

    let isCancelled = false

    const loadVideoSummaryDetail = async () => {
      setIsLoading(true)
      setErrorMessage('')
      setTranscript(null)
      setHasRequestedTranscript(false)
      setIsTranscriptLoading(false)
      setTranscriptErrorMessage('')
      setIsSummaryExpanded(false)

      try {
        const [detailResult, commentsResult, recommendationResult] =
          await Promise.allSettled([
            fetchYoutubeVideoDetail(videoId),
            fetchYoutubeComments(videoId),
            fetchRecommendedChannelVideos(),
          ])

        if (isCancelled) {
          return
        }

        if (detailResult.status !== 'fulfilled' || !detailResult.value) {
          throw detailResult.status === 'rejected'
            ? detailResult.reason
            : new Error('영상 상세 정보를 불러오지 못했습니다.')
        }

        setVideoDetail(detailResult.value)
        setComments(commentsResult.status === 'fulfilled' ? commentsResult.value : [])
        setRecommendedVideos(
          recommendationResult.status === 'fulfilled'
            ? recommendationResult.value
                .filter(
                  (video) =>
                    pickFirst(video, ['youtubeVideoId', 'videoId', 'id']) &&
                    pickFirst(video, ['youtubeVideoId', 'videoId', 'id']) !== videoId,
                )
                .slice(0, 6)
                .map((video) => mapRecommendedVideo(video))
            : [],
        )
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : '영상 상세 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadVideoSummaryDetail()

    return () => {
      isCancelled = true
    }
  }, [videoId])

  useEffect(() => {
    if (!isAnalysisModalOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAnalysisModalOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isAnalysisModalOpen])

  useEffect(() => {
    setIsSummaryExpanded(false)
  }, [videoId, transcript])

  useEffect(() => {
    if (!shareAnnouncement) {
      return undefined
    }

    const timerId = window.setTimeout(() => {
      setShareAnnouncement('')
    }, 2000)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [shareAnnouncement])

  const handleOpenVideo = (nextVideoId) => {
    if (!nextVideoId) {
      return
    }

    window.location.hash = `#summary/video/${encodeURIComponent(nextVideoId)}`
  }

  const scrollToSummarySection = () => {
    window.requestAnimationFrame(() => {
      document
        .getElementById('video-summary-detail-summary')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const handleToggleRecommendationScrap = (recommendedVideoId) => {
    setRecommendedVideos((currentVideos) =>
      currentVideos.map((video) =>
        video.youtubeVideoId === recommendedVideoId
          ? { ...video, scrapped: !video.scrapped }
          : video,
      ),
    )
  }

  const mainVideoTitle = pickFirst(videoDetail, ['title', 'videoTitle', 'name'], '영상 제목 정보가 없습니다.')
  const mainVideoImage = pickFirst(videoDetail, ['thumbnailUrl', 'thumbnail', 'imageUrl'])
  const mainChannelName = pickFirst(
    videoDetail,
    ['channelName', 'channelTitle', 'channel'],
    '채널 정보 없음',
  )
  const mainOriginalUrl = pickFirst(
    videoDetail,
    ['originalUrl', 'url', 'videoUrl', 'youtubeUrl'],
    videoId ? `https://www.youtube.com/watch?v=${videoId}` : '',
  )
  const mainVideoDescription = pickFirst(videoDetail, [
    'description',
    'videoDescription',
    'summaryDescription',
    'content',
  ])
  const viewCountValue = Number(pickFirst(videoDetail, ['viewCount', 'views', 'view_count'], NaN))
  const likeCountValue = Number(pickFirst(videoDetail, ['likeCount', 'likes', 'like_count'], NaN))
  const analysisResultTitle = pickFirst(
    transcript,
    ['title', 'summaryTitle', 'headline'],
    mainVideoTitle,
  )
  const analysisResultDescription = pickFirst(transcript, [
    'description',
    'summaryDescription',
    'transcriptText',
    'text',
    'content',
  ])
  const currentSummaryDescription = hasRequestedTranscript
    ? analysisResultDescription
    : mainVideoDescription
  const shouldShowSummaryToggle =
    currentSummaryDescription.length > 140 || currentSummaryDescription.includes('\n')
  const summarySourceLabel = transcript?.transcriptSource
    ? `${transcript.transcriptSource} · ${transcript.languageCode || '언어 정보 없음'}`
    : ''

  const handleShareVideo = async () => {
    if (!mainOriginalUrl) {
      setShareAnnouncement('공유할 링크가 없습니다.')
      return
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: mainVideoTitle,
          url: mainOriginalUrl,
        })
        setShareAnnouncement('영상 링크 공유 창을 열었습니다.')
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
      }
    }

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(mainOriginalUrl)
        setShareAnnouncement('영상 링크를 복사했습니다.')
        return
      } catch (error) {
        console.error(error)
      }
    }

    setShareAnnouncement('공유 기능을 사용할 수 없습니다.')
  }

  const handleConfirmAnalysis = async () => {
    if (isTranscriptLoading) {
      return
    }

    setIsAnalysisModalOpen(false)
    scrollToSummarySection()

    if (hasRequestedTranscript && transcript && !transcriptErrorMessage) {
      return
    }

    setHasRequestedTranscript(true)
    setIsTranscriptLoading(true)
    setTranscriptErrorMessage('')

    try {
      const transcriptPayload = await fetchYoutubeTranscript(videoId)
      setTranscript(transcriptPayload)
    } catch (error) {
      setTranscript(null)
      setTranscriptErrorMessage(
        error instanceof Error ? error.message : '자막을 불러오지 못했습니다.',
      )
    } finally {
      setIsTranscriptLoading(false)
    }
  }

  return (
    <main id="summary-detail-top" className="video-summary-detail-page">
      <section className="video-summary-detail-page__shell">
        <Navbar
          activeKey="summary"
          serviceHref="#home"
          isLoggedIn={isLoggedIn}
          onAuthClick={onAuthClick}
        />

        <div className="video-summary-detail-page__intro">
          <h1>보시던 동영상을 요약해보세요</h1>
        </div>

        <div className="video-summary-detail-page__panel">
          {isLoading ? (
            <p className="video-summary-detail-page__status">영상 요약 정보를 불러오는 중입니다.</p>
          ) : errorMessage ? (
            <p className="video-summary-detail-page__status">{errorMessage}</p>
          ) : (
            <section className="video-summary-detail-page__card">
              <div className="video-summary-detail-page__section-header">
                <h2>검색한 영상</h2>
                <div className="video-summary-detail-page__header-actions">
                  <button
                    className="video-summary-detail-page__icon-action"
                    type="button"
                    onClick={handleShareVideo}
                    aria-label="영상 공유"
                    title="공유"
                  >
                    <ShareIcon />
                  </button>

                  <button
                    className={`video-summary-detail-page__icon-action video-summary-detail-page__icon-action--bookmark ${
                      isMainScrapped
                        ? 'video-summary-detail-page__icon-action--active'
                        : ''
                    }`}
                    type="button"
                    onClick={() => setIsMainScrapped((currentValue) => !currentValue)}
                    aria-label={isMainScrapped ? '나의 스크랩에서 제거' : '나의 스크랩에 저장'}
                    aria-pressed={isMainScrapped}
                    title={isMainScrapped ? '스크랩 해제' : '스크랩'}
                  >
                    <BookmarkIcon filled={isMainScrapped} />
                  </button>
                </div>
              </div>

              <p className="video-summary-detail-page__sr-only" aria-live="polite">
                {shareAnnouncement}
              </p>

              <div className="video-summary-detail-page__divider" />

              <div className="video-summary-detail-page__content-layout">
                <div className="video-summary-detail-page__main-content">
                  <div className="video-summary-detail-page__hero">
                    {mainOriginalUrl ? (
                      <a
                        className="video-summary-detail-page__hero-link"
                        href={mainOriginalUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {mainVideoImage ? (
                          <img src={mainVideoImage} alt={mainVideoTitle} />
                        ) : (
                          <div className="video-summary-detail-page__hero-placeholder">
                            <span>영상 화면</span>
                          </div>
                        )}
                        <span className="video-summary-detail-page__hero-play">
                          <PlayIcon />
                        </span>
                      </a>
                    ) : (
                      <div className="video-summary-detail-page__hero-link">
                        {mainVideoImage ? (
                          <img src={mainVideoImage} alt={mainVideoTitle} />
                        ) : (
                          <div className="video-summary-detail-page__hero-placeholder">
                            <span>영상 화면</span>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      className="video-summary-detail-page__analysis-button"
                      type="button"
                      disabled={isTranscriptLoading}
                      onClick={() => setIsAnalysisModalOpen(true)}
                    >
                      <AnalysisIcon />
                      {isTranscriptLoading ? '분석 중...' : '영상 분석하기'}
                    </button>
                  </div>

                  <div className="video-summary-detail-page__video-info">
                    <h3>{mainVideoTitle}</h3>
                    <div className="video-summary-detail-page__meta">
                      <span>{mainChannelName}</span>
                      <span>
                        {formatPublishedDate(
                          pickFirst(videoDetail, ['publishedAt', 'publishedDate', 'published_at']),
                        )}
                      </span>
                      {formatCount(viewCountValue, '조회수') ? (
                        <span>{formatCount(viewCountValue, '조회수')}</span>
                      ) : null}
                      {formatCount(likeCountValue, '좋아요') ? (
                        <span>{formatCount(likeCountValue, '좋아요')}</span>
                      ) : null}
                    </div>
                  </div>
                  
                  <div
                    id="video-summary-detail-summary"
                    className="video-summary-detail-page__summary-card"
                  >
                    <div className="video-summary-detail-page__summary-header">
                      <h3>영상 소개</h3>
                      {summarySourceLabel ? <span>{summarySourceLabel}</span> : null}
                    </div>

                    {isTranscriptLoading ? (
                      <p className="video-summary-detail-page__summary-text">
                        자막을 조회하고 있습니다.
                      </p>
                    ) : transcriptErrorMessage ? (
                      <p className="video-summary-detail-page__summary-text">
                        {transcriptErrorMessage}
                      </p>
                    ) : !hasRequestedTranscript ? (
                      currentSummaryDescription ? (
                        <div className="video-summary-detail-page__summary-result">
                          <p
                            className={`video-summary-detail-page__summary-text ${
                              !isSummaryExpanded && shouldShowSummaryToggle
                                ? 'video-summary-detail-page__summary-text--collapsed'
                                : ''
                            }`}
                          >
                            {currentSummaryDescription}
                          </p>
                          {shouldShowSummaryToggle ? (
                            <button
                              className="video-summary-detail-page__summary-toggle"
                              type="button"
                              onClick={() => setIsSummaryExpanded((currentValue) => !currentValue)}
                            >
                              {isSummaryExpanded ? '접기' : '더보기'}
                            </button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="video-summary-detail-page__summary-text">
                          영상 분석하기 버튼을 누르면 자막을 조회해 요약 결과를 보여드립니다.
                        </p>
                      )
                    ) : transcript?.isAvailable === false ? (
                      <p className="video-summary-detail-page__summary-text">
                        현재 이 영상의 자막을 불러올 수 없습니다.
                      </p>
                    ) : analysisResultDescription ? (
                      <div className="video-summary-detail-page__summary-result">
                        <h4 className="video-summary-detail-page__summary-result-title">
                          {analysisResultTitle}
                        </h4>
                        <p
                          className={`video-summary-detail-page__summary-text ${
                            !isSummaryExpanded && shouldShowSummaryToggle
                              ? 'video-summary-detail-page__summary-text--collapsed'
                              : ''
                          }`}
                        >
                          {analysisResultDescription}
                        </p>
                        {shouldShowSummaryToggle ? (
                          <button
                            className="video-summary-detail-page__summary-toggle"
                            type="button"
                            onClick={() => setIsSummaryExpanded((currentValue) => !currentValue)}
                          >
                            {isSummaryExpanded ? '접기' : '더보기'}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <p className="video-summary-detail-page__summary-text">
                        자막 데이터가 아직 없습니다.
                      </p>
                    )}
                  </div>

                  <section className="video-summary-detail-page__comments">
                    <div className="video-summary-detail-page__comments-header">
                      <h3>댓글 {comments.length}개</h3>
                      <span>좋아요 순 · 상위 댓글 우선</span>
                    </div>

                    <div className="video-summary-detail-page__comment-list">
                      {comments.length ? (
                        comments.map((comment) => (
                          <article key={comment.commentId} className="video-summary-detail-page__comment">
                            <div className="video-summary-detail-page__comment-top">
                              <strong>{comment.authorName || '작성자 정보 없음'}</strong>
                              <span>{formatPublishedDate(comment.publishedAt)}</span>
                            </div>
                            <p>{comment.content || '댓글 내용이 없습니다.'}</p>
                            <div className="video-summary-detail-page__comment-meta">
                              <span>{formatCount(comment.likeCount, '좋아요')}</span>
                              {comment.isTopComment ? <span>상위 댓글</span> : null}
                            </div>
                          </article>
                        ))
                      ) : (
                        <p className="video-summary-detail-page__empty">표시할 댓글이 아직 없습니다.</p>
                      )}
                    </div>
                  </section>
                </div>

                <aside className="video-summary-detail-page__recommendations">
                  <div className="video-summary-detail-page__side-header">
                    <h3>추천 영상</h3>
                  </div>

                  <div className="video-summary-detail-page__recommendation-list">
                    {recommendedVideos.length ? (
                      recommendedVideos.map((video) => (
                        <article
                          key={video.youtubeVideoId}
                          className="video-summary-detail-page__recommendation-card"
                        >
                          <button
                            className={`video-summary-detail-page__recommendation-bookmark ${
                              video.scrapped
                                ? 'video-summary-detail-page__recommendation-bookmark--active'
                                : ''
                            }`}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              handleToggleRecommendationScrap(video.youtubeVideoId)
                            }}
                            aria-label={video.scrapped ? '추천 영상을 스크랩 해제' : '추천 영상을 스크랩'}
                            aria-pressed={video.scrapped}
                            title={video.scrapped ? '스크랩 해제' : '스크랩'}
                          >
                            <span className="video-summary-detail-page__sr-only">스크랩</span>
                          </button>

                          <button
                            className="video-summary-detail-page__recommendation-main"
                            type="button"
                            onClick={() => handleOpenVideo(video.youtubeVideoId)}
                          >
                            <div className="video-summary-detail-page__recommendation-thumb">
                              {video.image ? (
                                <img src={video.image} alt={video.title} />
                              ) : (
                                <div className="video-summary-detail-page__recommendation-placeholder" />
                              )}
                            </div>
                            <div className="video-summary-detail-page__recommendation-body">
                              <strong>{video.title}</strong>
                              <p>{video.channelName}</p>
                              <span>{video.date}</span>
                            </div>
                          </button>
                        </article>
                      ))
                    ) : (
                      <p className="video-summary-detail-page__empty">
                        표시할 추천 영상이 아직 없습니다.
                      </p>
                    )}
                  </div>
                </aside>
              </div>
            </section>
          )}
        </div>

        <a
          className="video-summary-detail-page__floating-top"
          href="#summary-detail-top"
          aria-label="맨 위로 이동"
        >
          ↑
        </a>

        {isAnalysisModalOpen ? (
          <div
            className="video-summary-detail-page__analysis-modal"
            role="presentation"
            onClick={() => setIsAnalysisModalOpen(false)}
          >
            <div
              className="video-summary-detail-page__analysis-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="video-analysis-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="video-summary-detail-page__analysis-close"
                type="button"
                onClick={() => setIsAnalysisModalOpen(false)}
                aria-label="분석 모달 닫기"
              >
                <CloseIcon />
              </button>

              <div className="video-summary-detail-page__analysis-badge">
                <AnalysisIcon />
                <span id="video-analysis-modal-title">영상분석</span>
              </div>

              <p className="video-summary-detail-page__analysis-message">
                해당 영상을 분석하시겠습니까?
              </p>

              <div className="video-summary-detail-page__analysis-actions">
                <button
                  className="video-summary-detail-page__analysis-action video-summary-detail-page__analysis-action--secondary"
                  type="button"
                  onClick={() => setIsAnalysisModalOpen(false)}
                >
                  이전
                </button>
                <button
                  className="video-summary-detail-page__analysis-action video-summary-detail-page__analysis-action--primary"
                  type="button"
                  disabled={isTranscriptLoading}
                  onClick={handleConfirmAnalysis}
                >
                  {isTranscriptLoading ? '분석 중입니다.' : '네 생성하겠습니다.'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default VideoSummaryDetail
