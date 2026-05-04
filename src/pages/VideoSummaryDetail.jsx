import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { fetchVideoAnalysisResult, startVideoAnalysis } from '../services/analysis'
import {
  createScrapLookup,
  deleteScrapVideo,
  fetchScrapVideos,
  saveScrapVideo,
} from '../services/scraps'
import {
  fetchRecommendedChannelVideos,
  fetchYoutubeComments,
  fetchYoutubeVideoDetail,
} from '../services/youtube'
import './VideoSummaryDetail.css'

const ANALYSIS_POLL_ATTEMPTS = 8
const ANALYSIS_POLL_INTERVAL_MS = 2_500
const MAX_RECOMMENDATIONS = 8
const MAX_COMMENTS = 5
const MAX_KEYWORDS = 10
const MAX_SENTENCE_LABELS = 8

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15 8a3 3 0 1 0-2.82-4H12a3 3 0 0 0 .18 1.02L7.91 7.26A3 3 0 0 0 6 6.5a3 3 0 1 0 1.91 5.32l4.27 2.24A3 3 0 0 0 12 15a3 3 0 1 0 .85-2.08L8.54 10.7a3.18 3.18 0 0 0 0-1.4l4.31-2.22A3 3 0 0 0 15 8Z"
        fill="currentColor"
      />
    </svg>
  )
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 4.75A1.75 1.75 0 0 1 8.75 3h6.5A1.75 1.75 0 0 1 17 4.75v15.04a.45.45 0 0 1-.74.35L12 16.5l-4.26 3.64a.45.45 0 0 1-.74-.35Z"
        fill="currentColor"
      />
    </svg>
  )
}

function AnalysisIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 18.5h14M7.5 15V9.5M12 15V6.5M16.5 15v-3.25"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
      <circle cx="7.5" cy="8.5" r="1.25" fill="currentColor" />
      <circle cx="12" cy="5.5" r="1.25" fill="currentColor" />
      <circle cx="16.5" cy="10.75" r="1.25" fill="currentColor" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m7 7 10 10M17 7 7 17"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.9"
      />
    </svg>
  )
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m8.2 6.8 9.4 5.2-9.4 5.2Z" fill="currentColor" />
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

function pickNumericLikeFirst(source, keys, fallback = null) {
  for (const key of keys) {
    const value = source?.[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }

    if (typeof value === 'string') {
      const trimmedValue = value.trim()

      if (/^\d+$/.test(trimmedValue)) {
        return Number(trimmedValue)
      }
    }
  }

  return fallback
}

function clampPercentage(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null
  }

  return Math.min(100, Math.max(0, value * 100))
}

function formatScorePercent(value) {
  const percent = clampPercentage(value)

  if (percent === null) {
    return '분석 대기'
  }

  return `${percent.toFixed(1)}%`
}

function formatCount(value, label) {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : null

  if (numericValue === null || Number.isNaN(numericValue)) {
    return ''
  }

  return `${label} ${numericValue.toLocaleString()}`
}

function formatDateLabel(value, fallback = '날짜 정보 없음') {
  if (!value) {
    return fallback
  }

  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return `${parsedDate.getFullYear()}.${String(parsedDate.getMonth() + 1).padStart(2, '0')}.${String(
    parsedDate.getDate(),
  ).padStart(2, '0')}`
}

function extractYoutubeVideoId(source, fallback = '') {
  const explicitId = pickFirst(source, ['youtubeVideoId', 'youtubeVideoID', 'youtubeId', 'youtube_id'], '')

  if (typeof explicitId === 'string' && explicitId.trim()) {
    return explicitId.trim()
  }

  const fallbackCandidates = [source?.videoId, source?.id]

  for (const candidate of fallbackCandidates) {
    if (typeof candidate === 'string' && candidate.trim() && !/^\d+$/.test(candidate.trim())) {
      return candidate.trim()
    }
  }

  return fallback
}

function buildYoutubeWatchUrl(youtubeVideoId) {
  return youtubeVideoId ? `https://www.youtube.com/watch?v=${encodeURIComponent(youtubeVideoId)}` : ''
}

function buildDetailHashUrl(youtubeVideoId) {
  return youtubeVideoId
    ? `${window.location.origin}/#summary/video/${encodeURIComponent(youtubeVideoId)}`
    : window.location.href
}

function sleep(delay) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delay)
  })
}

function isAnalysisMissingError(error) {
  return error?.status === 404 || error?.statusCode === 'A003'
}

function formatKeywordType(keywordType) {
  const normalizedType = String(keywordType || '').toUpperCase()

  if (normalizedType === 'FRAME') {
    return '프레임'
  }

  if (normalizedType === 'TOPIC') {
    return '주제'
  }

  if (!normalizedType) {
    return '키워드'
  }

  return normalizedType.replace(/_/g, ' ').toLowerCase()
}

function formatSentenceLabelType(labelType) {
  const normalizedType = String(labelType || '').toUpperCase()

  if (normalizedType === 'EMOTIONALLY_LOADED') {
    return '감정 과잉 표현'
  }

  if (normalizedType === 'OPINIONATED') {
    return '주관적 의견'
  }

  if (normalizedType === 'ANONYMOUS_SOURCE') {
    return '익명 출처 사용'
  }

  if (normalizedType === 'HEADLINE_BODY_GAP') {
    return '제목-본문 괴리'
  }

  return normalizedType ? normalizedType.replace(/_/g, ' ').toLowerCase() : '분석 포인트'
}

function inferAnalysisTargetId(source) {
  return pickNumericLikeFirst(
    source,
    [
      'targetId',
      'target_id',
      'analysisTargetId',
      'analysis_target_id',
      'videoPk',
      'video_pk',
      'youtubeVideoPk',
      'youtube_video_pk',
      'youtubeVideoDbId',
      'youtube_video_db_id',
      'dbId',
      'db_id',
      'pk',
      'videoId',
      'id',
    ],
    null,
  )
}

function normalizeVideoDetail(video, fallbackYoutubeVideoId = '') {
  const youtubeVideoId = extractYoutubeVideoId(video, fallbackYoutubeVideoId)
  const title = pickFirst(video, ['title', 'videoTitle', 'name'], '영상 제목 정보가 없습니다.')
  const thumbnailUrl = pickFirst(
    video,
    ['thumbnailUrl', 'thumbnail', 'thumbnailURL', 'thumbUrl', 'imageUrl'],
    '',
  )
  const originalUrl = pickFirst(
    video,
    ['originalUrl', 'url', 'videoUrl', 'youtubeUrl'],
    buildYoutubeWatchUrl(youtubeVideoId),
  )

  return {
    raw: video,
    youtubeVideoId,
    targetId: inferAnalysisTargetId(video),
    title,
    description: pickFirst(
      video,
      ['description', 'summary', 'content', 'videoDescription'],
      '영상 설명이 아직 제공되지 않았습니다.',
    ),
    thumbnailUrl,
    originalUrl,
    channelName: pickFirst(video, ['channelName', 'channelTitle', 'channel', 'publisher'], '채널 정보 없음'),
    publishedAt: pickFirst(video, ['publishedAt', 'publishedDate', 'published_at', 'uploadDate'], ''),
    viewCount: pickFirst(video, ['viewCount', 'views', 'view_count'], null),
    commentCount: pickFirst(video, ['commentCount', 'commentsCount', 'comment_count'], null),
    likeCount: pickFirst(video, ['likeCount', 'likes', 'like_count'], null),
    scrapId: null,
    scrapped: false,
  }
}

function normalizeComments(comments) {
  return (Array.isArray(comments) ? comments : [])
    .map((comment, index) => ({
      id:
        pickFirst(comment, ['commentId', 'id'], '') ||
        `${pickFirst(comment, ['authorDisplayName', 'authorName', 'name'], 'comment')}-${index}`,
      author: pickFirst(
        comment,
        ['authorDisplayName', 'authorName', 'name', 'nickname', 'userName'],
        '익명 사용자',
      ),
      text: pickFirst(comment, ['textDisplay', 'textOriginal', 'content', 'text', 'message'], ''),
      publishedAt: pickFirst(comment, ['publishedAt', 'updatedAt', 'createdAt', 'created_date'], ''),
      likeCount: pickFirst(comment, ['likeCount', 'likes', 'like_count'], null),
      replyCount: pickFirst(comment, ['replyCount', 'replies', 'reply_count'], null),
    }))
    .filter((comment) => comment.text)
}

function createRecommendedVideoCards(videos, currentYoutubeVideoId, scrapLookup) {
  const uniqueVideos = []
  const seenYoutubeVideoIds = new Set()

  ;(Array.isArray(videos) ? videos : []).forEach((video, index) => {
    const youtubeVideoId = extractYoutubeVideoId(video)

    if (!youtubeVideoId || youtubeVideoId === currentYoutubeVideoId || seenYoutubeVideoIds.has(youtubeVideoId)) {
      return
    }

    seenYoutubeVideoIds.add(youtubeVideoId)

    const scrapItem = scrapLookup[youtubeVideoId] || null

    uniqueVideos.push({
      id:
        pickFirst(video, ['youtubeVideoId', 'videoId', 'id', 'originalUrl', 'url'], '') ||
        `recommend-${index + 1}`,
      youtubeVideoId,
      targetId: inferAnalysisTargetId(video),
      title: pickFirst(video, ['title', 'videoTitle', 'name'], '추천 영상 제목 정보가 없습니다.'),
      thumbnailUrl: pickFirst(
        video,
        ['thumbnailUrl', 'thumbnail', 'thumbnailURL', 'thumbUrl', 'imageUrl'],
        '',
      ),
      channelName: pickFirst(
        video,
        ['channelName', 'channelTitle', 'channel', 'publisher'],
        '채널 정보 없음',
      ),
      publishedAt: pickFirst(video, ['publishedAt', 'publishedDate', 'published_at', 'uploadDate'], ''),
      viewCount: pickFirst(video, ['viewCount', 'views', 'view_count'], null),
      originalUrl: pickFirst(
        video,
        ['originalUrl', 'url', 'videoUrl', 'youtubeUrl'],
        buildYoutubeWatchUrl(youtubeVideoId),
      ),
      scrapId: scrapItem?.scrapId ?? null,
      scrapped: Boolean(scrapItem),
    })
  })

  return uniqueVideos.slice(0, MAX_RECOMMENDATIONS)
}

function applyScrapLookupToVideoDetail(videoDetail, scrapLookup) {
  if (!videoDetail) {
    return null
  }

  const scrapItem = scrapLookup[videoDetail.youtubeVideoId] || null

  return {
    ...videoDetail,
    scrapId: scrapItem?.scrapId ?? null,
    scrapped: Boolean(scrapItem),
  }
}

function applyScrapLookupToRecommendedVideos(recommendedVideos, scrapLookup) {
  return recommendedVideos.map((video) => {
    const scrapItem = scrapLookup[video.youtubeVideoId] || null

    return {
      ...video,
      scrapId: scrapItem?.scrapId ?? null,
      scrapped: Boolean(scrapItem),
    }
  })
}

function dedupeKeywords(keywords) {
  const keywordMap = new Map()

  ;(Array.isArray(keywords) ? keywords : []).forEach((keyword) => {
    if (!keyword?.keywordText) {
      return
    }

    const key = `${keyword.keywordType}:${keyword.keywordText}`.toLowerCase()
    const existingKeyword = keywordMap.get(key)

    if (!existingKeyword || keyword.score > existingKeyword.score) {
      keywordMap.set(key, keyword)
    }
  })

  return Array.from(keywordMap.values()).slice(0, MAX_KEYWORDS)
}

function dedupeSentenceLabels(sentenceLabels) {
  const sentenceLabelMap = new Map()

  ;(Array.isArray(sentenceLabels) ? sentenceLabels : []).forEach((label) => {
    const key = `${label.contentSentenceId || 'sentence'}:${label.labelType || 'label'}`
    const existingLabel = sentenceLabelMap.get(key)

    if (!existingLabel || label.score > existingLabel.score) {
      sentenceLabelMap.set(key, label)
    }
  })

  return Array.from(sentenceLabelMap.values())
    .sort((left, right) => (right.score || 0) - (left.score || 0))
    .slice(0, MAX_SENTENCE_LABELS)
}

async function pollAnalysisResult(targetId) {
  let pendingError = null

  for (let attempt = 0; attempt < ANALYSIS_POLL_ATTEMPTS; attempt += 1) {
    try {
      return await fetchVideoAnalysisResult(targetId)
    } catch (error) {
      if (!isAnalysisMissingError(error)) {
        throw error
      }

      pendingError = error

      if (attempt < ANALYSIS_POLL_ATTEMPTS - 1) {
        await sleep(ANALYSIS_POLL_INTERVAL_MS)
      }
    }
  }

  if (pendingError) {
    throw new Error('분석 요청은 접수됐지만 결과를 만드는 중입니다. 잠시 후 다시 확인해 주세요.')
  }

  throw new Error('영상 분석 결과를 불러오지 못했습니다.')
}

function VideoSummaryDetail({ isLoggedIn, onAuthClick, videoId }) {
  const [videoDetail, setVideoDetail] = useState(null)
  const [comments, setComments] = useState([])
  const [recommendedVideos, setRecommendedVideos] = useState([])
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [pageErrorMessage, setPageErrorMessage] = useState('')
  const [commentsErrorMessage, setCommentsErrorMessage] = useState('')
  const [recommendationsErrorMessage, setRecommendationsErrorMessage] = useState('')
  const [actionErrorMessage, setActionErrorMessage] = useState('')
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false)
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisErrorMessage, setAnalysisErrorMessage] = useState('')
  const [analysisTargetId, setAnalysisTargetId] = useState(null)
  const [hasCheckedExistingAnalysis, setHasCheckedExistingAnalysis] = useState(false)
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)
  const [shareAnnouncement, setShareAnnouncement] = useState('')
  const [mainScrapId, setMainScrapId] = useState(null)
  const [isMainScrapped, setIsMainScrapped] = useState(false)
  const [isMainScrapLoading, setIsMainScrapLoading] = useState(false)
  const [pendingRecommendationIds, setPendingRecommendationIds] = useState([])

  const summaryText = analysisResult?.summaryText || videoDetail?.description || ''
  const isSummaryToggleVisible = summaryText.length > 180
  const isSummaryCollapsed = isSummaryToggleVisible && !isSummaryExpanded

  const scoreCards = [
    {
      key: 'overall-bias',
      label: '전체 편향도',
      value: analysisResult?.overallBiasScore ?? null,
      description: '영상 전반의 편향 가능성을 종합한 지표입니다.',
    },
    {
      key: 'opinion',
      label: '의견 개입도',
      value: analysisResult?.opinionScore ?? null,
      description: '사실 전달 대신 해석이나 주장 비중이 얼마나 큰지 보여줍니다.',
    },
    {
      key: 'emotion',
      label: '감정 표현도',
      value: analysisResult?.emotionScore ?? null,
      description: '감정적으로 몰아가는 표현이 얼마나 자주 등장하는지 나타냅니다.',
    },
    {
      key: 'anonymous-source',
      label: '익명 출처 의존도',
      value: analysisResult?.anonymousSourceScore ?? null,
      description: '익명 제보나 불명확한 근거를 얼마나 많이 쓰는지 확인합니다.',
    },
    {
      key: 'headline-gap',
      label: '제목-본문 괴리',
      value: analysisResult?.headlineBodyGapScore ?? null,
      description: '제목과 실제 내용 사이의 온도 차를 추적합니다.',
    },
    {
      key: 'neutrality',
      label: '중립성',
      value: analysisResult?.neutralityScore ?? null,
      description: '상반된 시각을 균형 있게 담고 있는지 살펴보는 지표입니다.',
    },
  ]

  const keywordItems = dedupeKeywords(analysisResult?.keywords || [])
  const sentenceLabelItems = dedupeSentenceLabels(analysisResult?.sentenceLabels || [])
  const isAnalysisView = Boolean(analysisResult)
  const analysisToneLabel = analysisResult?.toneLabel || '분석 완료'
  const analysisSummaryText =
    summaryText || '영상 분석이 완료되면 여기에서 요약된 내용을 확인할 수 있습니다.'
  const analysisDescriptionText =
    analysisResult?.evidenceSummary ||
    videoDetail?.description ||
    '영상 설명이 아직 준비되지 않았습니다.'
  const analysisOverviewBars = [
    {
      key: 'opinion',
      label: '의견성',
      value: analysisResult?.opinionScore ?? null,
      toneClassName: 'video-summary-detail-page__analysis-bar-fill--blue',
    },
    {
      key: 'emotion',
      label: '감정성',
      value: analysisResult?.emotionScore ?? null,
      toneClassName: 'video-summary-detail-page__analysis-bar-fill--amber',
    },
    {
      key: 'anonymous-source',
      label: '출처 불명',
      value: analysisResult?.anonymousSourceScore ?? null,
      toneClassName: 'video-summary-detail-page__analysis-bar-fill--green',
    },
  ]
  const analysisKeywordItems = keywordItems.slice(0, 8)
  const analysisHighlightItems = sentenceLabelItems.slice(0, 4)

  const renderRecommendationCard = (recommendation) => (
    <article
      key={recommendation.id}
      className="video-summary-detail-page__recommendation-card"
    >
      <button
        type="button"
        className={`video-summary-detail-page__recommendation-bookmark ${
          recommendation.scrapped
            ? 'video-summary-detail-page__recommendation-bookmark--active'
            : ''
        }`}
        onClick={(event) => handleToggleRecommendationScrap(event, recommendation)}
        disabled={pendingRecommendationIds.includes(recommendation.id)}
        aria-label={recommendation.scrapped ? '스크랩 해제' : '스크랩 저장'}
        aria-pressed={recommendation.scrapped}
        title={recommendation.scrapped ? '스크랩 해제' : '스크랩'}
      >
        <BookmarkIcon />
      </button>

      <button
        type="button"
        className="video-summary-detail-page__recommendation-main"
        onClick={() => handleOpenRecommendation(recommendation.youtubeVideoId)}
      >
        <div className="video-summary-detail-page__recommendation-thumb">
          {recommendation.thumbnailUrl ? (
            <img src={recommendation.thumbnailUrl} alt={recommendation.title} />
          ) : (
            <div className="video-summary-detail-page__recommendation-placeholder" />
          )}
        </div>

        <div className="video-summary-detail-page__recommendation-body">
          <strong>{recommendation.title}</strong>
          <p>{recommendation.channelName}</p>
          <span>
            {[
              formatCount(recommendation.viewCount, '조회수'),
              formatDateLabel(recommendation.publishedAt, '게시일 없음'),
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        </div>
      </button>
    </article>
  )

  const syncScrapState = (scrapLookup, mainYoutubeVideoId = videoDetail?.youtubeVideoId || '') => {
    const mainScrapItem = mainYoutubeVideoId ? scrapLookup[mainYoutubeVideoId] || null : null

    setIsMainScrapped(Boolean(mainScrapItem))
    setMainScrapId(mainScrapItem?.scrapId ?? null)
    setVideoDetail((currentVideoDetail) =>
      applyScrapLookupToVideoDetail(currentVideoDetail, scrapLookup),
    )
    setRecommendedVideos((currentRecommendedVideos) =>
      applyScrapLookupToRecommendedVideos(currentRecommendedVideos, scrapLookup),
    )
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [videoId])

  useEffect(() => {
    let isCancelled = false

    const loadVideoSummaryDetail = async () => {
      setIsPageLoading(true)
      setPageErrorMessage('')
      setCommentsErrorMessage('')
      setRecommendationsErrorMessage('')
      setActionErrorMessage('')
      setVideoDetail(null)
      setComments([])
      setRecommendedVideos([])
      setAnalysisResult(null)
      setAnalysisErrorMessage('')
      setAnalysisTargetId(null)
      setHasCheckedExistingAnalysis(false)
      setIsSummaryExpanded(false)
      setShareAnnouncement('')
      setMainScrapId(null)
      setIsMainScrapped(false)
      setIsMainScrapLoading(false)
      setPendingRecommendationIds([])

      if (!videoId) {
        setIsPageLoading(false)
        setPageErrorMessage('영상 정보를 찾을 수 없습니다.')
        return
      }

      try {
        const [detailResult, commentsResult, recommendedVideosResult, scrapsResult] =
          await Promise.allSettled([
            fetchYoutubeVideoDetail(videoId),
            fetchYoutubeComments(videoId),
            fetchRecommendedChannelVideos(),
            fetchScrapVideos(),
          ])

        if (isCancelled) {
          return
        }

        if (detailResult.status !== 'fulfilled' || !detailResult.value) {
          throw detailResult.status === 'rejected'
            ? detailResult.reason
            : new Error('영상 정보를 찾을 수 없습니다.')
        }

        const scrapLookup =
          scrapsResult.status === 'fulfilled' ? createScrapLookup(scrapsResult.value) : {}
        const nextVideoDetail = applyScrapLookupToVideoDetail(
          normalizeVideoDetail(detailResult.value, videoId),
          scrapLookup,
        )

        setVideoDetail(nextVideoDetail)
        setAnalysisTargetId(nextVideoDetail.targetId)
        setIsMainScrapped(nextVideoDetail.scrapped)
        setMainScrapId(nextVideoDetail.scrapId)

        if (commentsResult.status === 'fulfilled') {
          setComments(normalizeComments(commentsResult.value).slice(0, MAX_COMMENTS))
          setCommentsErrorMessage('')
        } else {
          setComments([])
          setCommentsErrorMessage(
            commentsResult.reason instanceof Error
              ? commentsResult.reason.message
              : '댓글을 불러오지 못했습니다.',
          )
        }

        if (recommendedVideosResult.status === 'fulfilled') {
          setRecommendedVideos(
            createRecommendedVideoCards(
              recommendedVideosResult.value,
              nextVideoDetail.youtubeVideoId,
              scrapLookup,
            ),
          )
          setRecommendationsErrorMessage('')
        } else {
          setRecommendedVideos([])
          setRecommendationsErrorMessage(
            recommendedVideosResult.reason instanceof Error
              ? recommendedVideosResult.reason.message
              : '추천 영상을 불러오지 못했습니다.',
          )
        }
      } catch (error) {
        if (!isCancelled) {
          setPageErrorMessage(
            error instanceof Error ? error.message : '영상 정보를 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsPageLoading(false)
        }
      }
    }

    loadVideoSummaryDetail()

    return () => {
      isCancelled = true
    }
  }, [videoId])

  useEffect(() => {
    if (!analysisTargetId || hasCheckedExistingAnalysis) {
      return undefined
    }

    let isCancelled = false

    const loadExistingAnalysis = async () => {
      setIsAnalysisLoading(true)
      setAnalysisErrorMessage('')

      try {
        const nextAnalysisResult = await fetchVideoAnalysisResult(analysisTargetId)

        if (!isCancelled) {
          setAnalysisResult(nextAnalysisResult)
        }
      } catch (error) {
        if (!isCancelled && !isAnalysisMissingError(error)) {
          setAnalysisErrorMessage(
            error instanceof Error ? error.message : '기존 분석 결과를 불러오지 못했습니다.',
          )
        }
      } finally {
        if (!isCancelled) {
          setHasCheckedExistingAnalysis(true)
          setIsAnalysisLoading(false)
        }
      }
    }

    loadExistingAnalysis()

    return () => {
      isCancelled = true
    }
  }, [analysisTargetId, hasCheckedExistingAnalysis])

  useEffect(() => {
    if (!isAnalysisModalOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsAnalysisModalOpen(false)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isAnalysisModalOpen])

  const handleOpenRecommendation = (nextYoutubeVideoId) => {
    if (!nextYoutubeVideoId) {
      return
    }

    window.location.hash = `#summary/video/${encodeURIComponent(nextYoutubeVideoId)}`
  }

  const handleShare = async () => {
    if (!videoDetail?.youtubeVideoId) {
      return
    }

    const shareUrl = buildDetailHashUrl(videoDetail.youtubeVideoId)

    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareAnnouncement('링크를 복사했어요.')
    } catch {
      setShareAnnouncement('주소를 직접 복사해 주세요.')
    }

    window.setTimeout(() => {
      setShareAnnouncement('')
    }, 2_000)
  }

  const handleToggleMainScrap = async () => {
    if (!isLoggedIn) {
      onAuthClick?.()
      return
    }

    if (!videoDetail?.youtubeVideoId || isMainScrapLoading) {
      return
    }

    setIsMainScrapLoading(true)
    setActionErrorMessage('')

    try {
      if (isMainScrapped && mainScrapId) {
        await deleteScrapVideo(mainScrapId)
      } else {
        await saveScrapVideo(videoDetail.youtubeVideoId)
      }

      const latestScrapVideos = await fetchScrapVideos()
      syncScrapState(createScrapLookup(latestScrapVideos), videoDetail.youtubeVideoId)
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : '스크랩 상태를 변경하지 못했습니다.',
      )
    } finally {
      setIsMainScrapLoading(false)
    }
  }

  const handleToggleRecommendationScrap = async (event, recommendation) => {
    event.preventDefault()
    event.stopPropagation()

    if (!isLoggedIn) {
      onAuthClick?.()
      return
    }

    if (!recommendation?.youtubeVideoId || pendingRecommendationIds.includes(recommendation.id)) {
      return
    }

    setPendingRecommendationIds((currentIds) => [...currentIds, recommendation.id])
    setActionErrorMessage('')

    try {
      if (recommendation.scrapped && recommendation.scrapId) {
        await deleteScrapVideo(recommendation.scrapId)
      } else {
        await saveScrapVideo(recommendation.youtubeVideoId)
      }

      const latestScrapVideos = await fetchScrapVideos()
      syncScrapState(createScrapLookup(latestScrapVideos), videoDetail?.youtubeVideoId || '')
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : '추천 영상 스크랩 상태를 변경하지 못했습니다.',
      )
    } finally {
      setPendingRecommendationIds((currentIds) =>
        currentIds.filter((currentId) => currentId !== recommendation.id),
      )
    }
  }

  const handleOpenAnalysisModal = () => {
    if (!videoDetail?.youtubeVideoId || isAnalysisLoading) {
      return
    }

    setIsAnalysisModalOpen(true)
  }

  const handleConfirmAnalysis = async () => {
    if (!videoDetail?.youtubeVideoId || isAnalysisLoading) {
      return
    }

    setIsAnalysisModalOpen(false)
    setIsAnalysisLoading(true)
    setAnalysisErrorMessage('')
    setActionErrorMessage('')

    try {
      const startedAnalysis = await startVideoAnalysis(videoDetail.youtubeVideoId)
      const nextTargetId =
        startedAnalysis.targetId || analysisTargetId || inferAnalysisTargetId(videoDetail.raw)

      if (!nextTargetId) {
        throw new Error('분석 대상 ID를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }

      setAnalysisTargetId(nextTargetId)
      setHasCheckedExistingAnalysis(true)

      const nextAnalysisResult = await pollAnalysisResult(nextTargetId)

      setAnalysisResult(nextAnalysisResult)
    } catch (error) {
      setAnalysisErrorMessage(
        error instanceof Error ? error.message : '영상 분석을 시작하지 못했습니다.',
      )
    } finally {
      setIsAnalysisLoading(false)
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
          maxWidth="1320px"
        />

        <section className="video-summary-detail-page__intro">
          <h1>영상을 더 깊게 읽는 편향 분석 리포트</h1>
        </section>

        <section className="video-summary-detail-page__panel">
          {isPageLoading ? (
            <p className="video-summary-detail-page__status">영상 정보를 불러오는 중입니다.</p>
          ) : pageErrorMessage ? (
            <p className="video-summary-detail-page__status">{pageErrorMessage}</p>
          ) : videoDetail ? (
            <article
              className={`video-summary-detail-page__card ${
                isAnalysisView ? 'video-summary-detail-page__card--analysis' : ''
              }`}
            >
              <header className="video-summary-detail-page__section-header">
                <h2>{isAnalysisView ? '영상 분석 결과' : videoDetail.channelName}</h2>

                <div className="video-summary-detail-page__header-actions">
                  <button
                    type="button"
                    className="video-summary-detail-page__icon-action"
                    onClick={handleShare}
                    aria-label="영상 상세 링크 공유"
                    title="공유"
                  >
                    <ShareIcon />
                  </button>
                  <button
                    type="button"
                    className={`video-summary-detail-page__icon-action ${
                      isMainScrapped ? 'video-summary-detail-page__icon-action--active' : ''
                    }`}
                    onClick={handleToggleMainScrap}
                    disabled={isMainScrapLoading}
                    aria-label={isMainScrapped ? '스크랩 해제' : '스크랩 저장'}
                    aria-pressed={isMainScrapped}
                    title={isMainScrapped ? '스크랩 해제' : '스크랩'}
                  >
                    <BookmarkIcon />
                  </button>
                </div>
              </header>

              <div className="video-summary-detail-page__divider" />

              {shareAnnouncement ? (
                <p className="video-summary-detail-page__status">{shareAnnouncement}</p>
              ) : null}

              {actionErrorMessage ? (
                <p className="video-summary-detail-page__status">{actionErrorMessage}</p>
              ) : null}

              {isAnalysisView ? (
                <div className="video-summary-detail-page__analysis-view">
                  <div className="video-summary-detail-page__analysis-hero-grid">
                    <section className="video-summary-detail-page__analysis-primary-column">
                      <div className="video-summary-detail-page__hero video-summary-detail-page__hero--analysis">
                        <a
                          className="video-summary-detail-page__hero-link"
                          href={videoDetail.originalUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${videoDetail.title} 원본 영상 열기`}
                        >
                          {videoDetail.thumbnailUrl ? (
                            <img src={videoDetail.thumbnailUrl} alt={videoDetail.title} />
                          ) : (
                            <div className="video-summary-detail-page__hero-placeholder">
                              <span>NNW VIDEO</span>
                            </div>
                          )}

                          <span className="video-summary-detail-page__hero-play">
                            <PlayIcon />
                          </span>
                        </a>
                      </div>

                      <article className="video-summary-detail-page__analysis-caption-card">
                        <h3>{videoDetail.title}</h3>
                        <p>{analysisDescriptionText}</p>
                      </article>
                    </section>

                    <aside className="video-summary-detail-page__analysis-sidepanel">
                      <article className="video-summary-detail-page__analysis-compact-card">
                        <div className="video-summary-detail-page__analysis-compact-header">
                          <h3>영상 요약</h3>
                          <span className="video-summary-detail-page__analysis-pill">
                            {analysisToneLabel}
                          </span>
                        </div>
                        <p className="video-summary-detail-page__analysis-compact-text">
                          {analysisSummaryText}
                        </p>
                      </article>

                      <article className="video-summary-detail-page__analysis-compact-card">
                        <div className="video-summary-detail-page__analysis-compact-header">
                          <h3>편향 유형 분류</h3>
                        </div>

                        <div className="video-summary-detail-page__analysis-bar-list">
                          {analysisOverviewBars.map((bar) => {
                            const percentage = clampPercentage(bar.value)

                            return (
                              <div
                                key={bar.key}
                                className="video-summary-detail-page__analysis-bar-item"
                              >
                                <div className="video-summary-detail-page__analysis-bar-meta">
                                  <strong>{bar.label}</strong>
                                  <span>{formatScorePercent(bar.value)}</span>
                                </div>
                                <div className="video-summary-detail-page__analysis-bar-track">
                                  <span
                                    className={`video-summary-detail-page__analysis-bar-fill ${bar.toneClassName}`}
                                    style={{ width: `${percentage ?? 0}%` }}
                                  />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </article>

                      <article className="video-summary-detail-page__analysis-compact-card">
                        <div className="video-summary-detail-page__analysis-compact-header">
                          <h3>편향 단어 보기</h3>
                        </div>

                        {analysisKeywordItems.length ? (
                          <div className="video-summary-detail-page__analysis-keyword-cloud">
                            {analysisKeywordItems.map((keyword) => (
                              <span
                                key={`${keyword.keywordType}-${keyword.keywordText}`}
                                className="video-summary-detail-page__analysis-keyword-chip"
                              >
                                {keyword.keywordText}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="video-summary-detail-page__analysis-empty">
                            아직 표시할 편향 단어가 없습니다.
                          </p>
                        )}
                      </article>
                    </aside>
                  </div>

                  {analysisErrorMessage ? (
                    <p className="video-summary-detail-page__summary-error">
                      {analysisErrorMessage}
                    </p>
                  ) : null}

                  <div className="video-summary-detail-page__analysis-detail-layout">
                    <div className="video-summary-detail-page__analysis-detail-stack">
                      {analysisResult?.perspectiveSummary ? (
                        <article className="video-summary-detail-page__analysis-detail-card">
                          <div className="video-summary-detail-page__analysis-detail-head">
                            <h3>관점 요약</h3>
                          </div>
                          <p>{analysisResult.perspectiveSummary}</p>
                        </article>
                      ) : null}

                      {analysisResult?.evidenceSummary ? (
                        <article className="video-summary-detail-page__analysis-detail-card">
                          <div className="video-summary-detail-page__analysis-detail-head">
                            <h3>근거 요약</h3>
                          </div>
                          <p>{analysisResult.evidenceSummary}</p>
                        </article>
                      ) : null}
                    </div>

                    <div className="video-summary-detail-page__analysis-detail-stack">
                      <article className="video-summary-detail-page__analysis-detail-card">
                        <div className="video-summary-detail-page__analysis-detail-head">
                          <h3>세부 분석 지표</h3>
                          <span>{scoreCards.length}개 지표</span>
                        </div>

                        <div className="video-summary-detail-page__analysis-score-grid video-summary-detail-page__analysis-score-grid--detail">
                          {scoreCards.map((scoreCard) => {
                            const percentage = clampPercentage(scoreCard.value)

                            return (
                              <article
                                key={scoreCard.key}
                                className="video-summary-detail-page__analysis-score-card"
                              >
                                <div className="video-summary-detail-page__analysis-score-head">
                                  <strong>{scoreCard.label}</strong>
                                  <span>{formatScorePercent(scoreCard.value)}</span>
                                </div>
                                <div className="video-summary-detail-page__analysis-score-track">
                                  <span
                                    className="video-summary-detail-page__analysis-score-fill"
                                    style={{ width: `${percentage ?? 0}%` }}
                                  />
                                </div>
                                <p>{scoreCard.description}</p>
                              </article>
                            )
                          })}
                        </div>
                      </article>

                      <article className="video-summary-detail-page__analysis-detail-card">
                        <div className="video-summary-detail-page__analysis-detail-head">
                          <h3>하이라이트 포인트</h3>
                          <span>{analysisHighlightItems.length}개 문장</span>
                        </div>

                        {analysisHighlightItems.length ? (
                          <div className="video-summary-detail-page__analysis-label-list">
                            {analysisHighlightItems.map((label) => (
                              <article
                                key={label.id}
                                className="video-summary-detail-page__analysis-label-item"
                              >
                                <div>
                                  <strong>{formatSentenceLabelType(label.labelType)}</strong>
                                  <p>문장 ID {label.contentSentenceId ?? '-'} 에서 감지됐습니다.</p>
                                </div>
                                <span>{formatScorePercent(label.score)}</span>
                              </article>
                            ))}
                          </div>
                        ) : (
                          <p className="video-summary-detail-page__analysis-empty">
                            아직 표시할 하이라이트 포인트가 없습니다.
                          </p>
                        )}
                      </article>
                    </div>
                  </div>

                  <section className="video-summary-detail-page__analysis-recommendations">
                    <header className="video-summary-detail-page__analysis-recommendations-header">
                      <h3>유사한 영상 추천</h3>
                      <span>{recommendedVideos.length}개</span>
                    </header>

                    {recommendationsErrorMessage ? (
                      <p className="video-summary-detail-page__status">
                        {recommendationsErrorMessage}
                      </p>
                    ) : recommendedVideos.length ? (
                      <div className="video-summary-detail-page__recommendation-list video-summary-detail-page__recommendation-list--grid">
                        {recommendedVideos.map(renderRecommendationCard)}
                      </div>
                    ) : (
                      <p className="video-summary-detail-page__empty">
                        지금은 보여드릴 유사한 영상이 없습니다.
                      </p>
                    )}
                  </section>
                </div>
              ) : null}

              {!isAnalysisView ? (
              <div className="video-summary-detail-page__content-layout">
                <section className="video-summary-detail-page__main-content">
                  <div className="video-summary-detail-page__hero">
                    <a
                      className="video-summary-detail-page__hero-link"
                      href={videoDetail.originalUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${videoDetail.title} 원본 영상 열기`}
                    >
                      {videoDetail.thumbnailUrl ? (
                        <img src={videoDetail.thumbnailUrl} alt={videoDetail.title} />
                      ) : (
                        <div className="video-summary-detail-page__hero-placeholder">
                          <span>NNW VIDEO</span>
                        </div>
                      )}

                      <span className="video-summary-detail-page__hero-play">
                        <PlayIcon />
                      </span>
                    </a>

                    <button
                      type="button"
                      className="video-summary-detail-page__analysis-button"
                      onClick={handleOpenAnalysisModal}
                      disabled={isAnalysisLoading}
                    >
                      <AnalysisIcon />
                      <span>{isAnalysisLoading ? '분석 중' : '영상 분석하기'}</span>
                    </button>
                  </div>

                  <div className="video-summary-detail-page__video-info">
                    <h3>{videoDetail.title}</h3>

                    <div className="video-summary-detail-page__meta">
                      <span>{videoDetail.channelName}</span>
                      <span>{formatDateLabel(videoDetail.publishedAt, '게시일 없음')}</span>
                      {formatCount(videoDetail.viewCount, '조회수') ? (
                        <span>{formatCount(videoDetail.viewCount, '조회수')}</span>
                      ) : null}
                      {formatCount(videoDetail.commentCount, '댓글') ? (
                        <span>{formatCount(videoDetail.commentCount, '댓글')}</span>
                      ) : null}
                    </div>
                  </div>

                  <section className="video-summary-detail-page__summary-card">
                    <header className="video-summary-detail-page__summary-header">
                      <h3>{analysisResult ? '영상 분석 결과' : '영상 설명'}</h3>
                      <span>
                        {analysisResult
                          ? 'AI 분석 완료'
                          : isAnalysisLoading
                            ? '분석 요청 처리 중'
                            : '분석 전'}
                      </span>
                    </header>

                    {analysisErrorMessage ? (
                      <p className="video-summary-detail-page__summary-error">
                        {analysisErrorMessage}
                      </p>
                    ) : null}

                    {analysisResult ? (
                      <div className="video-summary-detail-page__summary-result">
                        <div className="video-summary-detail-page__summary-kicker">
                          <span className="video-summary-detail-page__analysis-pill">
                            {analysisResult.toneLabel || '분석 완료'}
                          </span>
                        </div>

                        <h4 className="video-summary-detail-page__summary-result-title">
                          {analysisResult.toneLabel
                            ? `${analysisResult.toneLabel} 톤이 감지됐어요`
                            : '영상 분석이 완료됐어요'}
                        </h4>

                        {summaryText ? (
                          <p
                            className={`video-summary-detail-page__summary-text ${
                              isSummaryCollapsed
                                ? 'video-summary-detail-page__summary-text--collapsed'
                                : ''
                            }`}
                          >
                            {summaryText}
                          </p>
                        ) : null}

                        {isSummaryToggleVisible ? (
                          <button
                            type="button"
                            className="video-summary-detail-page__summary-toggle"
                            onClick={() => setIsSummaryExpanded((currentState) => !currentState)}
                          >
                            {isSummaryExpanded ? '접기' : '더 보기'}
                          </button>
                        ) : null}

                        <div className="video-summary-detail-page__analysis-score-grid">
                          {scoreCards.map((scoreCard) => {
                            const percentage = clampPercentage(scoreCard.value)

                            return (
                              <article
                                key={scoreCard.key}
                                className="video-summary-detail-page__analysis-score-card"
                              >
                                <div className="video-summary-detail-page__analysis-score-head">
                                  <strong>{scoreCard.label}</strong>
                                  <span>{formatScorePercent(scoreCard.value)}</span>
                                </div>
                                <div className="video-summary-detail-page__analysis-score-track">
                                  <span
                                    className="video-summary-detail-page__analysis-score-fill"
                                    style={{ width: `${percentage ?? 0}%` }}
                                  />
                                </div>
                                <p>{scoreCard.description}</p>
                              </article>
                            )
                          })}
                        </div>

                        <div className="video-summary-detail-page__analysis-summary-grid">
                          {analysisResult.perspectiveSummary ? (
                            <article className="video-summary-detail-page__analysis-summary-block">
                              <h5>관점 요약</h5>
                              <p>{analysisResult.perspectiveSummary}</p>
                            </article>
                          ) : null}

                          {analysisResult.evidenceSummary ? (
                            <article className="video-summary-detail-page__analysis-summary-block">
                              <h5>근거 요약</h5>
                              <p>{analysisResult.evidenceSummary}</p>
                            </article>
                          ) : null}
                        </div>

                        {keywordItems.length ? (
                          <div className="video-summary-detail-page__analysis-section">
                            <div className="video-summary-detail-page__analysis-section-head">
                              <h5>핵심 키워드</h5>
                              <span>{keywordItems.length}개 포인트</span>
                            </div>
                            <div className="video-summary-detail-page__analysis-keywords">
                              {keywordItems.map((keyword) => (
                                <span
                                  key={`${keyword.keywordType}-${keyword.keywordText}`}
                                  className="video-summary-detail-page__analysis-keyword"
                                >
                                  <strong>{keyword.keywordText}</strong>
                                  <em>{formatKeywordType(keyword.keywordType)}</em>
                                  <span>{formatScorePercent(keyword.score)}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {sentenceLabelItems.length ? (
                          <div className="video-summary-detail-page__analysis-section">
                            <div className="video-summary-detail-page__analysis-section-head">
                              <h5>감지 포인트</h5>
                              <span>{sentenceLabelItems.length}개 문장</span>
                            </div>
                            <div className="video-summary-detail-page__analysis-label-list">
                              {sentenceLabelItems.map((label) => (
                                <article
                                  key={label.id}
                                  className="video-summary-detail-page__analysis-label-item"
                                >
                                  <div>
                                    <strong>{formatSentenceLabelType(label.labelType)}</strong>
                                    <p>문장 ID {label.contentSentenceId ?? '-'}에서 감지되었습니다.</p>
                                  </div>
                                  <span>{formatScorePercent(label.score)}</span>
                                </article>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <>
                        <p
                          className={`video-summary-detail-page__summary-text ${
                            isSummaryCollapsed
                              ? 'video-summary-detail-page__summary-text--collapsed'
                              : ''
                          }`}
                        >
                          {summaryText || '영상 설명이 아직 제공되지 않았습니다.'}
                        </p>

                        {isSummaryToggleVisible ? (
                          <button
                            type="button"
                            className="video-summary-detail-page__summary-toggle"
                            onClick={() => setIsSummaryExpanded((currentState) => !currentState)}
                          >
                            {isSummaryExpanded ? '접기' : '더 보기'}
                          </button>
                        ) : null}
                      </>
                    )}
                  </section>

                  <section className="video-summary-detail-page__comments">
                    <header className="video-summary-detail-page__comments-header">
                      <h3>주요 댓글</h3>
                      <span>
                        {comments.length
                          ? `${comments.length}개 표시 중`
                          : commentsErrorMessage
                            ? '댓글 로딩 실패'
                            : '댓글 없음'}
                      </span>
                    </header>

                    {commentsErrorMessage ? (
                      <p className="video-summary-detail-page__status">{commentsErrorMessage}</p>
                    ) : comments.length ? (
                      <div className="video-summary-detail-page__comment-list">
                        {comments.map((comment) => (
                          <article key={comment.id} className="video-summary-detail-page__comment">
                            <div className="video-summary-detail-page__comment-top">
                              <strong>{comment.author}</strong>
                              <span>{formatDateLabel(comment.publishedAt, '작성일 없음')}</span>
                            </div>
                            <p>{comment.text}</p>
                            <div className="video-summary-detail-page__comment-meta">
                              {formatCount(comment.likeCount, '좋아요') ? (
                                <span>{formatCount(comment.likeCount, '좋아요')}</span>
                              ) : null}
                              {formatCount(comment.replyCount, '답글') ? (
                                <span>{formatCount(comment.replyCount, '답글')}</span>
                              ) : null}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className="video-summary-detail-page__empty">
                        아직 불러온 댓글이 없습니다.
                      </p>
                    )}
                  </section>
                </section>

                <aside className="video-summary-detail-page__recommendations">
                  <header className="video-summary-detail-page__side-header">
                    <h3>추천 영상</h3>
                    <span>{recommendedVideos.length}개</span>
                  </header>

                  {recommendationsErrorMessage ? (
                    <p className="video-summary-detail-page__status">
                      {recommendationsErrorMessage}
                    </p>
                  ) : recommendedVideos.length ? (
                    <div className="video-summary-detail-page__recommendation-list">
                      {recommendedVideos.map((recommendation) => (
                        <article
                          key={recommendation.id}
                          className="video-summary-detail-page__recommendation-card"
                        >
                          <button
                            type="button"
                            className={`video-summary-detail-page__recommendation-bookmark ${
                              recommendation.scrapped
                                ? 'video-summary-detail-page__recommendation-bookmark--active'
                                : ''
                            }`}
                            onClick={(event) =>
                              handleToggleRecommendationScrap(event, recommendation)
                            }
                            disabled={pendingRecommendationIds.includes(recommendation.id)}
                            aria-label={recommendation.scrapped ? '스크랩 해제' : '스크랩 저장'}
                            aria-pressed={recommendation.scrapped}
                            title={recommendation.scrapped ? '스크랩 해제' : '스크랩'}
                          >
                            <BookmarkIcon />
                          </button>

                          <button
                            type="button"
                            className="video-summary-detail-page__recommendation-main"
                            onClick={() => handleOpenRecommendation(recommendation.youtubeVideoId)}
                          >
                            <div className="video-summary-detail-page__recommendation-thumb">
                              {recommendation.thumbnailUrl ? (
                                <img
                                  src={recommendation.thumbnailUrl}
                                  alt={recommendation.title}
                                />
                              ) : (
                                <div className="video-summary-detail-page__recommendation-placeholder" />
                              )}
                            </div>

                            <div className="video-summary-detail-page__recommendation-body">
                              <strong>{recommendation.title}</strong>
                              <p>{recommendation.channelName}</p>
                              <span>
                                {[
                                  formatCount(recommendation.viewCount, '조회수'),
                                  formatDateLabel(recommendation.publishedAt, '게시일 없음'),
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            </div>
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="video-summary-detail-page__empty">
                      지금은 보여드릴 추천 영상이 없습니다.
                    </p>
                  )}
                </aside>
              </div>
              ) : null}
            </article>
          ) : null}
        </section>

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
              aria-labelledby="video-analysis-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="video-summary-detail-page__analysis-close"
                onClick={() => setIsAnalysisModalOpen(false)}
                aria-label="분석 모달 닫기"
              >
                <CloseIcon />
              </button>

              <div className="video-summary-detail-page__analysis-badge">
                <AnalysisIcon />
                <span id="video-analysis-title">편향 분석 시작</span>
              </div>

              <p className="video-summary-detail-page__analysis-message">
                이 영상을 분석해서
                <br />
                편향 요약 리포트를 만들어볼까요?
              </p>

              <div className="video-summary-detail-page__analysis-actions">
                <button
                  type="button"
                  className="video-summary-detail-page__analysis-action video-summary-detail-page__analysis-action--secondary"
                  onClick={() => setIsAnalysisModalOpen(false)}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="video-summary-detail-page__analysis-action video-summary-detail-page__analysis-action--primary"
                  onClick={handleConfirmAnalysis}
                >
                  분석 시작
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
