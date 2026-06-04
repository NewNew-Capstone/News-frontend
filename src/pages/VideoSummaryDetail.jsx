import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Navbar from '../components/Navbar'
import YoutubeThumbnail from '../components/YoutubeThumbnail'
import { fetchVideoAnalysisResult, startVideoAnalysis } from '../services/analysis'
import { fetchOpposingIssueVideo } from '../services/issues'
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
import { normalizeYoutubeVideoId } from '../utils/youtubeVideo'
import './VideoSummaryDetail.css'

const ANALYSIS_POLL_ATTEMPTS = 3
const ANALYSIS_POLL_INTERVAL_MS = 2_500
const MAX_RECOMMENDATIONS = 8
const MAX_COMMENTS = 5
const MAX_KEYWORDS = 10
const MAX_EXPRESSION_KEYWORDS = 6
const MAX_SENTENCE_LABELS = 8
const OPPOSING_SCORE_DISPLAY_ADJUSTMENT = 0.15

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

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m6.5 9.25 5.5 5.5 5.5-5.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.1"
      />
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

function getAdjustedOpposingOverallBiasScore(currentScore, opposingScore) {
  if (
    typeof currentScore !== 'number' ||
    !Number.isFinite(currentScore) ||
    typeof opposingScore !== 'number' ||
    !Number.isFinite(opposingScore)
  ) {
    return opposingScore
  }

  if (opposingScore > currentScore) {
    return opposingScore + OPPOSING_SCORE_DISPLAY_ADJUSTMENT
  }

  if (opposingScore < currentScore) {
    const adjustedScore = opposingScore - OPPOSING_SCORE_DISPLAY_ADJUSTMENT

    return adjustedScore < 0 ? opposingScore : adjustedScore
  }

  return opposingScore
}

function formatScorePercent(value) {
  const percent = clampPercentage(value)

  if (percent === null) {
    return '분석 대기'
  }

  return `${percent.toFixed(1)}%`
}

function formatMetricPercent(value) {
  const percent = clampPercentage(value)

  if (percent === null) {
    return '--%'
  }

  if (percent > 0 && percent < 1) {
    return '<1%'
  }

  return `${Math.round(percent)}%`
}

function formatFocusKeywordMeta(keyword) {
  const occurrenceCount = Number(keyword?.occurrenceCount ?? keyword?.occurrence_count)
  const sentenceCount = Number(keyword?.sentenceCount ?? keyword?.sentence_count)
  const metaItems = []

  if (Number.isFinite(sentenceCount) && sentenceCount > 0) {
    metaItems.push(`${Math.round(sentenceCount)}개 문장`)
  }

  if (Number.isFinite(occurrenceCount) && occurrenceCount > 0) {
    metaItems.push(`${Math.round(occurrenceCount)}회 등장`)
  }

  return metaItems.join(' / ')
}

function formatScorePoints(value) {
  const percent = clampPercentage(value)

  if (percent === null) {
    return '--점'
  }

  return `${Math.round(percent)}점`
}

function buildPipelineEvidenceText(result, fallbackText = '') {
  if (!result) {
    return fallbackText
  }

  const rawOpinionScore = pickFirst(result, ['opinionScore', 'opinion_score'], null)
  const rawEmotionExpressionCount = pickFirst(result, [
    'emotionExpressionCount',
    'emotion_expression_count',
    'emotion_count',
    'emotionCount',
    'emotionSpanCount',
    'emotion_span_count',
    'emotionalExpressionCount',
    'emotional_expression_count',
    'emotionalSpanCount',
    'emotional_span_count',
  ], null)
  const rawEmotionSentenceCount = pickFirst(result, [
    'emotionSentenceCount',
    'emotion_sentence_count',
    'emotionDetectedSentenceCount',
    'emotion_detected_sentence_count',
    'emotionalSentenceCount',
    'emotional_sentence_count',
    'emotionalDetectedSentenceCount',
    'emotional_detected_sentence_count',
  ], null)
  const rawFactRatio = pickFirst(result, ['factRatio', 'fact_ratio'], null)
  const gapScore = pickFirst(result, ['headlineBodyGapScore', 'headline_body_gap_score'], null)
  const opinionPercent = clampPercentage(Number(rawOpinionScore))
  const emotionExpressionCount = Number(rawEmotionExpressionCount)
  const emotionSentenceCount = Number(rawEmotionSentenceCount)
  const factRatio = clampPercentage(Number(rawFactRatio))
  const canUsePipelineFormat =
    rawOpinionScore !== null &&
    rawEmotionExpressionCount !== null &&
    rawEmotionSentenceCount !== null &&
    rawFactRatio !== null &&
    opinionPercent !== null &&
    Number.isFinite(emotionExpressionCount) &&
    Number.isFinite(emotionSentenceCount) &&
    factRatio !== null

  if (!canUsePipelineFormat) {
    return fallbackText
  }

  const gapSentence =
    gapScore !== null && gapScore !== undefined
      ? ` 제목과 본문 사이에 다소 차이가 있습니다. (갭 점수: ${Number(gapScore).toFixed(2)})`
      : ''

  return `전체 문장 중 ${Math.round(opinionPercent)}% 가 주관적 문장입니다. 감정적 표현 ${Math.round(emotionExpressionCount)}건이 ${Math.round(emotionSentenceCount)}개 문장에서 감지되었습니다. 사실 기반 문장 비율이 낮습니다.${gapSentence}`
}

function renderHighlightedEvidenceText(text) {
  if (!text) {
    return null
  }

  const evidenceText = String(text)
  const highlightPattern = /(\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*(?:점|건|개|문장|회)|\d*\.\d+|\d+)/g
  const parts = []
  let lastIndex = 0
  let match

  while ((match = highlightPattern.exec(evidenceText)) !== null) {
    if (match.index > lastIndex) {
      parts.push(evidenceText.slice(lastIndex, match.index))
    }

    parts.push(
      <mark
        key={`score-evidence-highlight-${match.index}-${match[0]}`}
        className="video-summary-detail-page__analysis-score-evidence-highlight"
      >
        {match[0]}
      </mark>,
    )

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < evidenceText.length) {
    parts.push(evidenceText.slice(lastIndex))
  }

  return parts
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

function extractYoutubeVideoId(source, fallback = '') {
  const explicitId = normalizeYoutubeVideoId(pickFirst(source, ['youtubeVideoId', 'youtubeVideoID'], ''))

  if (explicitId) {
    return explicitId
  }

  const fallbackCandidates = [
    source?.videoId,
    source?.id,
    source?.originalUrl,
    source?.url,
    source?.videoUrl,
    source?.youtubeUrl,
    source?.thumbnailUrl,
    source?.thumbnail,
  ]

  for (const candidate of fallbackCandidates) {
    const normalizedCandidate = normalizeYoutubeVideoId(candidate)

    if (normalizedCandidate) {
      return normalizedCandidate
    }
  }

  return normalizeYoutubeVideoId(fallback) || fallback
}

function extractAnalysisYoutubeId(source, fallback = '') {
  const explicitId = pickFirst(
    source,
    [
      'youtubeId',
      'youtube_id',
      'youtubeDbId',
      'youtube_db_id',
      'youtubeVideoDbId',
      'youtube_video_db_id',
      'videoPk',
      'video_pk',
    ],
    '',
  )
  const normalizedExplicitId = String(explicitId ?? '').trim()

  if (normalizedExplicitId) {
    return normalizedExplicitId
  }

  const numericId = pickNumericLikeFirst(source, ['id'], null)

  if (numericId !== null) {
    return String(numericId)
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

function isAnalysisReadyStatus(status) {
  return ['SUCCESS', 'COMPLETED', 'COMPLETE', 'DONE', 'READY'].includes(String(status || '').toUpperCase())
}

function isAnalysisPendingStatus(status) {
  return ['PENDING', 'PROCESSING', 'IN_PROGRESS', 'STARTED', 'ACCEPTED', 'RUNNING', 'QUEUED'].includes(
    String(status || '').toUpperCase(),
  )
}

function getAnalysisPendingMessage() {
  return '분석 요청은 접수됐지만 결과가 아직 생성 중입니다. 잠시 후 분석 버튼을 다시 눌러 확인해 주세요.'
}

function isTranscriptUnavailableError(error) {
  const message = String(error?.message || '').toLowerCase()
  const statusCode = String(error?.statusCode || '').toLowerCase()

  return (
    statusCode.includes('transcript') ||
    statusCode.includes('caption') ||
    statusCode.includes('subtitle') ||
    message.includes('transcript') ||
    message.includes('caption') ||
    message.includes('subtitle') ||
    message.includes('subtitles') ||
    message.includes('no captions') ||
    message.includes('no subtitles') ||
    message.includes('자막')
  )
}

function getTranscriptUnavailableMessage() {
  return '이 영상은 제공되는 자막이 없어 분석을 진행할 수 없습니다. 자막이 있는 다른 영상을 선택해 주세요.'
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
    ['targetId', 'target_id', 'analysisTargetId', 'analysis_target_id'],
    null,
  )
}

function normalizeVideoDetail(video, fallbackYoutubeVideoId = '') {
  const youtubeVideoId = extractYoutubeVideoId(video, fallbackYoutubeVideoId)
  const youtubeId = extractAnalysisYoutubeId(video, youtubeVideoId)
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
    youtubeId,
    youtubeVideoId,
    targetId: inferAnalysisTargetId(video),
    title,
    description: pickFirst(
      video,
      [
        'description',
        'summary',
        'content',
        'videoDescription',
      ],
      '영상 설명이 아직 제공되지 않았습니다.',
    ),
    summaryText: pickFirst(video, ['summaryText', 'summary_text']),
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
      summaryText: pickFirst(video, ['summaryText', 'summary_text']),
      description: pickFirst(video, [
        'description',
        'summary',
        'content',
        'videoDescription',
      ]),
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

async function pollAnalysisResult(targetId, accessToken = '') {
  let pendingError = null

  for (let attempt = 0; attempt < ANALYSIS_POLL_ATTEMPTS; attempt += 1) {
    try {
      return await fetchVideoAnalysisResult(targetId, accessToken)
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
    throw new Error(getAnalysisPendingMessage())
  }

  throw new Error('영상 캐치 결과를 불러오지 못했습니다.')
}

function hasKeywordItems(keywords) {
  return Array.isArray(keywords) && keywords.some((keyword) => keyword?.keywordText)
}

function buildOpposingAnalysisFromVideo(opposingVideo, pipelineAnalysis, currentAnalysis) {
  const currentOpinionScore = Number(currentAnalysis?.opinionScore)
  const opposingOpinionScore = Number(pipelineAnalysis?.opinionScore)
  const opinionGap =
    Number.isFinite(currentOpinionScore) && Number.isFinite(opposingOpinionScore)
      ? Math.abs(currentOpinionScore - opposingOpinionScore)
      : null

  return {
    ...pipelineAnalysis,
    targetId: pipelineAnalysis?.targetId ?? opposingVideo?.targetId ?? null,
    youtubeVideoId: opposingVideo?.youtubeVideoId || pipelineAnalysis?.youtubeVideoId || '',
    title: opposingVideo?.title || pipelineAnalysis?.title || '다른 관점 영상',
    channelName: opposingVideo?.channelName || pipelineAnalysis?.channelName || '',
    publishedAt: opposingVideo?.publishedAt || pipelineAnalysis?.publishedAt || '',
    thumbnailUrl: opposingVideo?.thumbnailUrl || pipelineAnalysis?.thumbnailUrl || '',
    summaryText: pipelineAnalysis?.summaryText || '',
    originalUrl: opposingVideo?.originalUrl || buildYoutubeWatchUrl(opposingVideo?.youtubeVideoId || ''),
    opinionGap,
    hasSeparatedKeywords: hasKeywordItems(pipelineAnalysis?.focusKeywords) || hasKeywordItems(pipelineAnalysis?.emotionKeywords),
  }
}

function VideoSummaryDetail({ isLoggedIn, onAuthClick, videoId, accessToken = '' }) {
  const [videoDetail, setVideoDetail] = useState(null)
  const [comments, setComments] = useState([])
  const [recommendedVideos, setRecommendedVideos] = useState([])
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [pageErrorMessage, setPageErrorMessage] = useState('')
  const [commentsErrorMessage, setCommentsErrorMessage] = useState('')
  const [recommendationsErrorMessage, setRecommendationsErrorMessage] = useState('')
  const [actionErrorMessage, setActionErrorMessage] = useState('')
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState(false)
  const [transcriptErrorMessage, setTranscriptErrorMessage] = useState('')
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false)
  const [isAnalysisProgressView, setIsAnalysisProgressView] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [analysisErrorMessage, setAnalysisErrorMessage] = useState('')
  const [analysisTargetId, setAnalysisTargetId] = useState(null)
  const [pendingAnalysisTargetId, setPendingAnalysisTargetId] = useState(null)
  const [hasCheckedExistingAnalysis, setHasCheckedExistingAnalysis] = useState(false)
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false)
  const [isAnalysisEvidenceOpen, setIsAnalysisEvidenceOpen] = useState(false)
  const [isOpposingAnalysisEvidenceOpen, setIsOpposingAnalysisEvidenceOpen] = useState(false)
  const [isOpposingAnalysisVisible, setIsOpposingAnalysisVisible] = useState(false)
  const [opposingAnalysisResult, setOpposingAnalysisResult] = useState(null)
  const [isOpposingAnalysisLoading, setIsOpposingAnalysisLoading] = useState(false)
  const [opposingAnalysisErrorMessage, setOpposingAnalysisErrorMessage] = useState('')
  const [shareAnnouncement, setShareAnnouncement] = useState('')
  const [mainScrapId, setMainScrapId] = useState(null)
  const [isMainScrapped, setIsMainScrapped] = useState(false)
  const [isMainScrapLoading, setIsMainScrapLoading] = useState(false)
  const [opposingScrapId, setOpposingScrapId] = useState(null)
  const [isOpposingScrapped, setIsOpposingScrapped] = useState(false)
  const [isOpposingScrapLoading, setIsOpposingScrapLoading] = useState(false)
  const [pendingRecommendationIds, setPendingRecommendationIds] = useState([])

  const analysisSummaryValue = analysisResult?.summaryText || ''
  const videoDescriptionText = videoDetail?.description || ''
  const summaryText = analysisResult ? analysisSummaryValue : videoDescriptionText
  const isSummaryToggleVisible = summaryText.length > 180
  const isSummaryCollapsed = isSummaryToggleVisible && !isSummaryExpanded

  const emotionScoreCard = {
    key: 'emotion',
    label: '감정 표현도',
    value: analysisResult?.emotionScore ?? null,
    description: '감정적으로 몰아가는 표현이 얼마나 자주 등장하는지 나타냅니다.',
  }

  const scoreCards = [
    {
      key: 'overall-bias',
      label: '총 점수',
      value: analysisResult?.overallBiasScore ?? null,
      description: '영상 전반의 편향 가능성을 종합한 총점입니다.',
    },
    {
      key: 'opinion',
      label: '의견 개입도',
      value: analysisResult?.opinionScore ?? null,
      description: '사실 전달 대신 해석이나 주장 비중이 얼마나 큰지 보여줍니다.',
    },
    {
      key: 'neutrality',
      label: '중립성',
      value: analysisResult?.neutralityScore ?? null,
      description: '상반된 시각을 균형 있게 담고 있는지 살펴보는 지표입니다.',
    },
  ]

  const subjectivityScoreCard = scoreCards.find((scoreCard) => scoreCard.key === 'overall-bias')

  const keywordItems = dedupeKeywords(analysisResult?.keywords || [])
  const sentenceLabelItems = dedupeSentenceLabels(analysisResult?.sentenceLabels || [])
  const isAnalysisView = Boolean(analysisResult)
  const analysisToneLabel = analysisResult?.toneLabel || '분석 완료'
  const analysisSummaryTitle =
    videoDetail?.title || analysisResult?.title || '기준 영상'
  const analysisSummaryText =
    analysisSummaryValue || '영상 요약이 아직 생성되지 않았습니다.'
  const analysisSummaryMetaItems = [
    videoDetail?.channelName,
  ].filter(Boolean)
  const opposingVideo = recommendedVideos[0] || null
  const opposingAnalysisTitle =
    opposingAnalysisResult?.title ||
    analysisResult?.opposingVideoTitle ||
    opposingVideo?.title ||
    '반대 관점 영상'
  const opposingAnalysisToneLabel =
    opposingAnalysisResult?.opinionGap !== null && opposingAnalysisResult?.opinionGap !== undefined
      ? `이 영상과 ${formatMetricPercent(opposingAnalysisResult.opinionGap)} 다른 시각`
      : String(analysisResult?.opposingToneLabel || '다른 관점').replace('반대 관점', '다른 관점')
  const opposingAnalysisSummaryText =
    opposingAnalysisResult?.summaryText ||
    '다른 관점 영상 요약이 아직 생성되지 않았습니다.'
  const opposingAnalysisMetaItems = [
    opposingAnalysisResult?.channelName,
  ].filter(Boolean)
  const opposingFocusKeywordItems = (opposingAnalysisResult?.focusKeywords || [])
    .filter((keyword) => keyword?.keywordText)
  const legacyOpposingKeywordItems = (opposingAnalysisResult?.analysisKeywords || [])
    .map((keyword) => {
      if (typeof keyword === 'string') {
        return {
          keywordText: keyword.trim(),
          keywordType: '',
          score: null,
          occurrenceCount: null,
          sentenceCount: null,
        }
      }

      return keyword
    })
    .filter((keyword) => keyword?.keywordText)
  const hasOpposingSeparatedKeywordGroups = Boolean(opposingAnalysisResult)
  const visibleOpposingLegacyKeywordItems = legacyOpposingKeywordItems.slice(0, MAX_EXPRESSION_KEYWORDS)
  const visibleOpposingFocusKeywordItems = (
    opposingFocusKeywordItems.length ? opposingFocusKeywordItems : legacyOpposingKeywordItems
  ).slice(0, MAX_EXPRESSION_KEYWORDS)
  const visibleOpposingEmotionKeywordItems = (opposingAnalysisResult?.emotionKeywords || [])
    .filter((keyword) => keyword?.keywordText)
    .slice(0, MAX_EXPRESSION_KEYWORDS)
  const opposingScoreReasonText =
    opposingAnalysisResult?.scoreReasonSummary ||
    opposingAnalysisResult?.scoreEvidence ||
    '다른 관점 영상의 점수 근거가 제공되지 않았습니다.'
  const opposingScoreEvidenceText =
    buildPipelineEvidenceText(
      opposingAnalysisResult,
      opposingAnalysisResult?.scoreEvidence || opposingScoreReasonText,
    )
  const opposingDisplayOverallBiasScore = getAdjustedOpposingOverallBiasScore(
    analysisResult?.overallBiasScore,
    opposingAnalysisResult?.overallBiasScore,
  )
  const opposingMetricBars = [
    {
      key: 'opinion',
      label: '의견성',
      value: opposingAnalysisResult?.opinionScore ?? null,
      toneClassName: 'video-summary-detail-page__analysis-metric-fill--opinion',
    },
    {
      key: 'emotion',
      label: '감정성',
      value: opposingAnalysisResult?.emotionScore ?? null,
      toneClassName: 'video-summary-detail-page__analysis-metric-fill--emotion',
    },
  ]
  const scoreReasonText =
    analysisResult?.scoreReasonSummary ||
    analysisResult?.scoreEvidence ||
    '점수 근거는 백엔드 응답이 추가되면 이 영역에 표시됩니다.'
  const scoreEvidenceText =
    analysisResult?.scoreEvidence ||
    '세부 근거 문장은 백엔드 응답이 추가되면 이 영역에 표시됩니다.'
  const analysisMetricBars = [
    {
      key: 'opinion',
      label: '의견성',
      value: analysisResult?.opinionScore ?? null,
      toneClassName: 'video-summary-detail-page__analysis-metric-fill--opinion',
    },
    {
      key: 'emotion',
      label: '감정성',
      value: analysisResult?.emotionScore ?? null,
      toneClassName: 'video-summary-detail-page__analysis-metric-fill--emotion',
    },
  ]
  const visibleFocusKeywordItems = (analysisResult?.focusKeywords || [])
    .filter((keyword) => keyword?.keywordText)
    .slice(0, MAX_EXPRESSION_KEYWORDS)
  const visibleEmotionKeywordItems = (analysisResult?.emotionKeywords || [])
    .filter((keyword) => keyword?.keywordText)
    .slice(0, MAX_EXPRESSION_KEYWORDS)
  const subjectivityScorePercent = clampPercentage(subjectivityScoreCard?.value)

  const renderScoreCard = (scoreCard) => {
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
  }

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
          <YoutubeThumbnail
            src={recommendation.thumbnailUrl}
            youtubeVideoId={recommendation.youtubeVideoId}
            alt={recommendation.title}
            placeholder={<div className="video-summary-detail-page__recommendation-placeholder" />}
          />
        </div>

        <div className="video-summary-detail-page__recommendation-body">
          <strong>{recommendation.title}</strong>
          <p>{recommendation.channelName}</p>
        </div>
      </button>
    </article>
  )

  const syncScrapState = (scrapLookup, mainYoutubeVideoId = videoDetail?.youtubeVideoId || '') => {
    const mainScrapItem = mainYoutubeVideoId ? scrapLookup[mainYoutubeVideoId] || null : null
    const opposingYoutubeVideoId = opposingAnalysisResult?.youtubeVideoId || ''
    const opposingScrapItem = opposingYoutubeVideoId ? scrapLookup[opposingYoutubeVideoId] || null : null

    setIsMainScrapped(Boolean(mainScrapItem))
    setMainScrapId(mainScrapItem?.scrapId ?? null)
    setIsOpposingScrapped(Boolean(opposingScrapItem))
    setOpposingScrapId(opposingScrapItem?.scrapId ?? null)
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
      setIsAnalysisProgressView(false)
      setAnalysisTargetId(null)
      setPendingAnalysisTargetId(null)
      setHasCheckedExistingAnalysis(false)
      setIsOpposingAnalysisVisible(false)
      setOpposingAnalysisResult(null)
      setIsOpposingAnalysisLoading(false)
      setOpposingAnalysisErrorMessage('')
      setIsSummaryExpanded(false)
      setShareAnnouncement('')
      setMainScrapId(null)
      setIsMainScrapped(false)
      setIsMainScrapLoading(false)
      setOpposingScrapId(null)
      setIsOpposingScrapped(false)
      setIsOpposingScrapLoading(false)
      setPendingRecommendationIds([])
      setTranscriptErrorMessage('')

      if (!videoId) {
        setIsPageLoading(false)
        setPageErrorMessage('영상 정보를 찾을 수 없습니다.')
        return
      }

      try {
        const [detailResult, commentsResult, recommendedVideosResult, scrapsResult] =
          await Promise.allSettled([
            fetchYoutubeVideoDetail(videoId, accessToken),
            fetchYoutubeComments(videoId, accessToken),
            fetchRecommendedChannelVideos(accessToken),
            fetchScrapVideos(accessToken),
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
  }, [videoId, accessToken])

  useEffect(() => {
    if (!analysisTargetId || hasCheckedExistingAnalysis) {
      return undefined
    }

    let isCancelled = false

    const loadExistingAnalysis = async () => {
      setIsAnalysisLoading(true)
      setAnalysisErrorMessage('')

      try {
        const nextAnalysisResult = await fetchVideoAnalysisResult(analysisTargetId, accessToken)

        if (!isCancelled) {
          setAnalysisResult(nextAnalysisResult)
        }
      } catch (error) {
        if (!isCancelled && !isAnalysisMissingError(error)) {
          setAnalysisErrorMessage(
            error instanceof Error ? error.message : '기존 캐치 결과를 불러오지 못했습니다.',
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
  }, [analysisTargetId, hasCheckedExistingAnalysis, accessToken])

  useEffect(() => {
    if (!analysisResult || typeof console === 'undefined') {
      return
    }

    console.groupCollapsed('[AnalysisDetail] summary render check')
    console.log('summary render check:', {
      normalizedSummaryText: analysisResult.summaryText,
      normalizedSummaryTextLength:
        typeof analysisResult.summaryText === 'string' ? analysisResult.summaryText.length : null,
      analysisSummaryValue,
      analysisSummaryValueLength: analysisSummaryValue.length,
      renderedAnalysisSummaryText: analysisSummaryText,
      renderedAnalysisSummaryTextLength: analysisSummaryText.length,
      summaryTextForCurrentView: summaryText,
      summaryTextForCurrentViewLength: summaryText.length,
      videoDescriptionFallback: videoDescriptionText,
      videoDescriptionFallbackLength: videoDescriptionText.length,
      isAnalysisView,
    })
    console.groupEnd()
  }, [analysisResult, analysisSummaryText, analysisSummaryValue, isAnalysisView, summaryText, videoDescriptionText])

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
      setShareAnnouncement('링크 복사 완료')
    } catch {
      setShareAnnouncement('주소를 직접 복사해 주세요.')
    }

    window.setTimeout(() => {
      setShareAnnouncement('')
    }, 2_000)
  }

  const handleShareCurrentVideo = async () => {
    const shareUrl = videoDetail?.originalUrl || buildYoutubeWatchUrl(videoDetail?.youtubeVideoId)

    if (!shareUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareAnnouncement('기준 영상 링크를 복사했습니다.')
    } catch {
      setShareAnnouncement('주소를 직접 복사해 주세요.')
    }

    window.setTimeout(() => {
      setShareAnnouncement('')
    }, 2_000)
  }

  const handleShareOpposingVideo = async () => {
    const shareUrl = buildYoutubeWatchUrl(opposingAnalysisResult?.youtubeVideoId)

    if (!shareUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareAnnouncement('다른 관점 영상 링크를 복사했습니다.')
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
        await deleteScrapVideo(mainScrapId, accessToken)
      } else {
        await saveScrapVideo(videoDetail.youtubeVideoId, accessToken)
      }

      const latestScrapVideos = await fetchScrapVideos(accessToken)
      syncScrapState(createScrapLookup(latestScrapVideos), videoDetail.youtubeVideoId)
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : '스크랩 상태를 변경하지 못했습니다.',
      )
    } finally {
      setIsMainScrapLoading(false)
    }
  }

  const handleToggleOpposingScrap = async () => {
    if (!isLoggedIn) {
      onAuthClick?.()
      return
    }

    if (!opposingAnalysisResult?.youtubeVideoId || isOpposingScrapLoading) {
      return
    }

    setIsOpposingScrapLoading(true)
    setActionErrorMessage('')

    try {
      if (isOpposingScrapped && opposingScrapId) {
        await deleteScrapVideo(opposingScrapId, accessToken)
      } else {
        await saveScrapVideo(opposingAnalysisResult.youtubeVideoId, accessToken)
      }

      const latestScrapVideos = await fetchScrapVideos(accessToken)
      const scrapLookup = createScrapLookup(latestScrapVideos)
      const nextOpposingScrapItem = scrapLookup[opposingAnalysisResult.youtubeVideoId] || null

      syncScrapState(scrapLookup, videoDetail?.youtubeVideoId || '')
      setIsOpposingScrapped(Boolean(nextOpposingScrapItem))
      setOpposingScrapId(nextOpposingScrapItem?.scrapId ?? null)
    } catch (error) {
      setActionErrorMessage(
        error instanceof Error ? error.message : '다른 관점 영상 스크랩 상태를 변경하지 못했습니다.',
      )
    } finally {
      setIsOpposingScrapLoading(false)
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
        await deleteScrapVideo(recommendation.scrapId, accessToken)
      } else {
        await saveScrapVideo(recommendation.youtubeVideoId, accessToken)
      }

      const latestScrapVideos = await fetchScrapVideos(accessToken)
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
    const analysisYoutubeId = videoDetail?.youtubeId || videoDetail?.youtubeVideoId

    if (!analysisYoutubeId || isAnalysisLoading) {
      return
    }

    setIsAnalysisModalOpen(true)
  }

  const handleToggleOpposingAnalysis = async () => {
    if (isOpposingAnalysisVisible) {
      setIsOpposingAnalysisVisible(false)
      return
    }

    setIsOpposingAnalysisVisible(true)
    setIsOpposingAnalysisEvidenceOpen(false)

    const targetVideoId =
      analysisTargetId ??
      analysisResult?.targetId ??
      videoDetail?.targetId ??
      videoDetail?.youtubeVideoId ??
      videoDetail?.youtubeId ??
      videoId

    if (!targetVideoId || opposingAnalysisResult || isOpposingAnalysisLoading) {
      return
    }

    setIsOpposingAnalysisLoading(true)
    setOpposingAnalysisErrorMessage('')

    try {
      const nextOpposingVideo = await fetchOpposingIssueVideo(targetVideoId, accessToken)

      if (!nextOpposingVideo?.youtubeVideoId) {
        throw new Error('다른 관점 영상 ID가 없어 캐치 결과를 불러올 수 없습니다.')
      }

      let pipelineAnalysis = null
      let nextTargetId = nextOpposingVideo.targetId ?? null

      if (nextTargetId) {
        try {
          pipelineAnalysis = await pollAnalysisResult(nextTargetId, accessToken)
        } catch (error) {
          void error
        }
      }

      if (!pipelineAnalysis) {
        const startedAnalysis = await startVideoAnalysis(nextOpposingVideo.youtubeVideoId, accessToken)
        nextTargetId =
          startedAnalysis.targetId ??
          startedAnalysis.analysisResult?.targetId ??
          nextTargetId

        if (startedAnalysis.analysisResult) {
          pipelineAnalysis = startedAnalysis.analysisResult
        } else if (nextTargetId) {
          pipelineAnalysis = await pollAnalysisResult(nextTargetId, accessToken)
        }
      }

      if (!pipelineAnalysis) {
        throw new Error('다른 관점 영상 캐치 결과를 불러오지 못했습니다.')
      }

      const enrichedOpposingAnalysis = buildOpposingAnalysisFromVideo(
        nextOpposingVideo,
        pipelineAnalysis,
        analysisResult,
      )

      setOpposingAnalysisResult(enrichedOpposingAnalysis)
      try {
        const latestScrapVideos = await fetchScrapVideos(accessToken)
        const scrapLookup = createScrapLookup(latestScrapVideos)
        const nextOpposingScrapItem = scrapLookup[enrichedOpposingAnalysis.youtubeVideoId] || null

        setIsOpposingScrapped(Boolean(nextOpposingScrapItem))
        setOpposingScrapId(nextOpposingScrapItem?.scrapId ?? null)
      } catch {
        setIsOpposingScrapped(false)
        setOpposingScrapId(null)
      }
    } catch (error) {
      setOpposingAnalysisErrorMessage(
        error instanceof Error
          ? error.message
          : '다른 관점 영상 캐치 결과를 불러오지 못했습니다.',
      )
    } finally {
      setIsOpposingAnalysisLoading(false)
    }
  }

  const closeTranscriptErrorModal = () => {
    setTranscriptErrorMessage('')
  }

  const handleConfirmAnalysis = async () => {
    const analysisYoutubeId = videoDetail?.youtubeId || videoDetail?.youtubeVideoId

    if (!analysisYoutubeId || isAnalysisLoading) {
      return
    }

    setIsAnalysisModalOpen(false)
    setIsAnalysisLoading(true)
    setIsAnalysisProgressView(true)
    setAnalysisErrorMessage('')
    setActionErrorMessage('')

    try {
      if (pendingAnalysisTargetId && !analysisResult) {
        try {
          const pendingAnalysisResult = await fetchVideoAnalysisResult(pendingAnalysisTargetId, accessToken)

          setAnalysisTargetId(pendingAnalysisTargetId)
          setPendingAnalysisTargetId(null)
          setHasCheckedExistingAnalysis(true)
          setAnalysisResult(pendingAnalysisResult)
          return
        } catch (error) {
          if (isAnalysisMissingError(error)) {
            throw new Error(getAnalysisPendingMessage())
          }

          throw error
        }
      }

      const startedAnalysis = await startVideoAnalysis(analysisYoutubeId, accessToken)
      const nextTargetId =
        startedAnalysis.targetId ??
        startedAnalysis.analysisResult?.targetId ??
        null

      if (startedAnalysis.analysisResult) {
        let nextAnalysisResult = startedAnalysis.analysisResult

        if (
          !String(nextAnalysisResult.summaryText || '').trim() &&
          nextTargetId !== null &&
          nextTargetId !== undefined
        ) {
          nextAnalysisResult = await pollAnalysisResult(nextTargetId, accessToken)
        }

        if (nextTargetId !== null && nextTargetId !== undefined) {
          setAnalysisTargetId(nextTargetId)
        }

        setHasCheckedExistingAnalysis(true)
        setPendingAnalysisTargetId(null)
        setAnalysisResult(nextAnalysisResult)
        return
      }

      if (nextTargetId === null || nextTargetId === undefined) {
        throw new Error('분석 대상 ID를 찾지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }

      setAnalysisTargetId(nextTargetId)
      setHasCheckedExistingAnalysis(true)

      if (isAnalysisPendingStatus(startedAnalysis.status)) {
        setPendingAnalysisTargetId(nextTargetId)
        throw new Error(getAnalysisPendingMessage())
      }

      if (startedAnalysis.status && !isAnalysisReadyStatus(startedAnalysis.status)) {
        setPendingAnalysisTargetId(nextTargetId)
        throw new Error(getAnalysisPendingMessage())
      }

      setPendingAnalysisTargetId(nextTargetId)
      const nextAnalysisResult = await pollAnalysisResult(nextTargetId, accessToken)

      setPendingAnalysisTargetId(null)
      setAnalysisResult(nextAnalysisResult)
    } catch (error) {
      if (isTranscriptUnavailableError(error)) {
        setAnalysisErrorMessage('')
        setTranscriptErrorMessage(getTranscriptUnavailableMessage())
        return
      }

      setAnalysisErrorMessage(
        error instanceof Error ? error.message : '영상 분석을 시작하지 못했습니다.',
      )
    } finally {
      setIsAnalysisLoading(false)
      setIsAnalysisProgressView(false)
    }
  }

  if (isAnalysisProgressView) {
    return (
      <main className="video-summary-detail-page video-summary-detail-page--analysis-loading">
        <section className="video-summary-detail-page__analysis-loading-page" role="status">
          <div className="video-summary-detail-page__analysis-loading-indicator">
            <span className="video-summary-detail-page__analysis-loading-spinner" aria-hidden="true" />
            <strong>Loading..</strong>
          </div>
        </section>
      </main>
    )
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
          <h1>영상의 관점을 캐치하는 리포트</h1>
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
              } ${
                isAnalysisView && isOpposingAnalysisVisible
                  ? 'video-summary-detail-page__card--analysis-compare'
                  : ''
              }`}
            >
              <header className="video-summary-detail-page__section-header">
                <h2>{isAnalysisView ? '영상 캐치 리포트' : videoDetail.channelName}</h2>

                <div className="video-summary-detail-page__header-actions">
                  <button
                    type="button"
                    className="video-summary-detail-page__icon-action video-summary-detail-page__main-header-share"
                    onClick={handleShare}
                    aria-label="영상 상세 링크 공유"
                    title="공유"
                  >
                    <ShareIcon />
                  </button>
                  <button
                    type="button"
                    className={`video-summary-detail-page__icon-action video-summary-detail-page__main-header-scrap ${
                      isMainScrapped ? 'video-summary-detail-page__icon-action--active' : ''
                    }`}
                    onClick={handleToggleMainScrap}
                    disabled={isMainScrapLoading}
                    aria-label={isMainScrapped ? '기준 영상 스크랩 해제' : '기준 영상 스크랩 저장'}
                    aria-pressed={isMainScrapped}
                    title={isMainScrapped ? '기준 영상 스크랩 해제' : '기준 영상 스크랩'}
                  >
                    <BookmarkIcon />
                  </button>
                </div>
              </header>

              <div className="video-summary-detail-page__divider" />

              {shareAnnouncement ? (
                <div className="video-summary-detail-page__share-toast" role="status">
                  <span className="video-summary-detail-page__share-toast-icon">
                    <ShareIcon />
                  </span>
                  <span>
                    <strong>{shareAnnouncement}</strong>
                    <small>영상 분석 링크를 클립보드에 저장했어요.</small>
                  </span>
                </div>
              ) : null}

              {actionErrorMessage ? (
                <p className="video-summary-detail-page__status">{actionErrorMessage}</p>
              ) : null}

              {isAnalysisView ? (
                <div
                  className={`video-summary-detail-page__analysis-view ${
                    isOpposingAnalysisVisible
                      ? 'video-summary-detail-page__analysis-view--compare'
                      : ''
                  }`}
                >
                  <div className="video-summary-detail-page__analysis-current-pane">
                  <header className="video-summary-detail-page__analysis-pane-header video-summary-detail-page__analysis-pane-header--current">
                    <h2>기준 영상</h2>
                    <span className="video-summary-detail-page__pane-header-actions">
                      <button
                        type="button"
                        className="video-summary-detail-page__icon-action video-summary-detail-page__pane-scrap-action"
                        onClick={handleShareCurrentVideo}
                        aria-label="기준 영상 링크 복사"
                        title="기준 영상 링크 복사"
                      >
                        <ShareIcon />
                      </button>
                      <button
                        type="button"
                        className={`video-summary-detail-page__icon-action video-summary-detail-page__pane-scrap-action ${
                          isMainScrapped ? 'video-summary-detail-page__icon-action--active' : ''
                        }`}
                        onClick={handleToggleMainScrap}
                        disabled={isMainScrapLoading}
                        aria-label={isMainScrapped ? '기준 영상 스크랩 해제' : '기준 영상 스크랩 저장'}
                        aria-pressed={isMainScrapped}
                        title={isMainScrapped ? '기준 영상 스크랩 해제' : '기준 영상 스크랩'}
                      >
                        <BookmarkIcon />
                      </button>
                    </span>
                  </header>
                  <div className="video-summary-detail-page__analysis-report">
                    <div className="video-summary-detail-page__analysis-top-grid">
                      <div className="video-summary-detail-page__hero video-summary-detail-page__hero--analysis video-summary-detail-page__analysis-report-hero">
                        <a
                          className="video-summary-detail-page__hero-link"
                          href={videoDetail.originalUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`${videoDetail.title} 원본 영상 열기`}
                        >
                          <YoutubeThumbnail
                            src={videoDetail.thumbnailUrl}
                            youtubeVideoId={videoDetail.youtubeVideoId}
                            alt={videoDetail.title}
                            placeholder={
                              <div className="video-summary-detail-page__hero-placeholder">
                                <span>NNW VIDEO</span>
                              </div>
                            }
                          />

                          <span className="video-summary-detail-page__hero-play">
                            <PlayIcon />
                          </span>
                        </a>
                      </div>

                      <article className="video-summary-detail-page__analysis-compact-card video-summary-detail-page__analysis-summary-card">
                          <div className="video-summary-detail-page__analysis-compact-header">
                            <h3>영상 요약</h3>
                            <span className="video-summary-detail-page__analysis-pill">
                              {analysisToneLabel}
                            </span>
                          </div>
                          <strong className="video-summary-detail-page__analysis-summary-title">
                            {analysisSummaryTitle}
                          </strong>
                          {analysisSummaryMetaItems.length ? (
                            <span className="video-summary-detail-page__analysis-summary-meta">
                              {analysisSummaryMetaItems.join(' · ')}
                            </span>
                          ) : null}
                          <p className="video-summary-detail-page__analysis-compact-text">
                            {analysisSummaryText}
                          </p>
                          <button
                            type="button"
                            className="video-summary-detail-page__opposing-analysis-button"
                            aria-pressed={isOpposingAnalysisVisible}
                            onClick={handleToggleOpposingAnalysis}
                          >
                            {isOpposingAnalysisVisible ? '다른 관점 영상 접기' : '다른 관점 영상 보기'}
                          </button>
                      </article>

                    </div>

                    <section
                      className={`video-summary-detail-page__analysis-evidence-disclosure ${
                        isAnalysisEvidenceOpen
                          ? 'video-summary-detail-page__analysis-evidence-disclosure--open'
                          : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="video-summary-detail-page__analysis-evidence-toggle"
                        aria-expanded={isAnalysisEvidenceOpen}
                        aria-controls="analysis-evidence-panel"
                        onClick={() => setIsAnalysisEvidenceOpen((currentState) => !currentState)}
                      >
                        <span className="video-summary-detail-page__analysis-evidence-copy">
                          <span>DETAIL EVIDENCE</span>
                          <strong>캐치 근거 자세히 보기</strong>
                          <small>총점 산출 방식, 의견성·감정성 지표와 감정 키워드를 확인합니다.</small>
                        </span>
                        <span className="video-summary-detail-page__analysis-evidence-meta">
                          {subjectivityScoreCard ? (
                            <span>{formatScorePoints(subjectivityScoreCard.value)}</span>
                          ) : null}
                          <ChevronDownIcon />
                        </span>
                      </button>

                      <div
                        id="analysis-evidence-panel"
                        className="video-summary-detail-page__analysis-evidence-panel"
                        hidden={!isAnalysisEvidenceOpen}
                      >
                    {subjectivityScoreCard ? (
                      <article className="video-summary-detail-page__analysis-total-card">
                        <section className="video-summary-detail-page__analysis-total-score">
                          <h3>총 점수</h3>
                          <div
                            className="video-summary-detail-page__analysis-total-orb"
                            style={{
                              '--analysis-total-score-percent': `${subjectivityScorePercent ?? 0}%`,
                            }}
                          >
                            <strong>{formatScorePoints(subjectivityScoreCard.value)}</strong>
                            <span>종합 지표</span>
                          </div>
                        </section>

                        <section className="video-summary-detail-page__analysis-score-guide">
                          <h3>점수 의미</h3>
                          <ul>
                            <li><strong>0~20점</strong><span>주관적 표현이 낮아요</span></li>
                            <li><strong>21~40점</strong><span>약간의 해석이 있어요</span></li>
                            <li><strong>41~60점</strong><span>의견과 정보가 섞여 있어요</span></li>
                            <li><strong>61~80점</strong><span>주관적 표현이 많아요</span></li>
                            <li><strong>81~100점</strong><span>감정적·주장형 표현이 강해요</span></li>
                          </ul>
                        </section>

                        <section className="video-summary-detail-page__analysis-score-reason">
                          <h3>점수 근거</h3>
                          <p>{scoreReasonText}</p>
                        </section>
                      </article>
                    ) : null}

                    <article className="video-summary-detail-page__analysis-metric-card">
                      <div className="video-summary-detail-page__analysis-metric-list">
                        {analysisMetricBars.map((bar) => {
                          const percentage = clampPercentage(bar.value)

                          return (
                            <div key={bar.key} className="video-summary-detail-page__analysis-metric-row">
                              <div className="video-summary-detail-page__analysis-metric-label">
                                <strong>{bar.label}</strong>
                                <span>: {formatMetricPercent(bar.value)}</span>
                              </div>
                              <div className="video-summary-detail-page__analysis-metric-track">
                                <span
                                  className={`video-summary-detail-page__analysis-metric-fill ${bar.toneClassName}`}
                                  style={{ width: `${percentage ?? 0}%` }}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </article>

                    <article className="video-summary-detail-page__analysis-compact-card video-summary-detail-page__analysis-emotion-card">
                        <div className="video-summary-detail-page__analysis-compact-header">
                          <h3>핵심 표현</h3>
                        </div>

                        <div className="video-summary-detail-page__analysis-expression-groups">
                          <section className="video-summary-detail-page__analysis-expression-group">
                            <div className="video-summary-detail-page__analysis-expression-head">
                              <h4>중점 키워드</h4>
                              <span>{visibleFocusKeywordItems.length}개</span>
                            </div>
                            {visibleFocusKeywordItems.length ? (
                              <div className="video-summary-detail-page__analysis-keyword-cloud video-summary-detail-page__analysis-keyword-cloud--emotion">
                                {visibleFocusKeywordItems.map((keyword) => {
                                  const keywordMeta = formatFocusKeywordMeta(keyword)

                                  return (
                                    <span
                                      key={`focus-${keyword.keywordText}`}
                                      className="video-summary-detail-page__analysis-keyword-chip video-summary-detail-page__analysis-keyword-chip--focus"
                                    >
                                      <strong>{keyword.keywordText}</strong>
                                      {keywordMeta ? <em>{keywordMeta}</em> : null}
                                    </span>
                                  )
                                })}
                              </div>
                            ) : (
                              <p className="video-summary-detail-page__analysis-empty">
                                중점 키워드가 없습니다.
                              </p>
                            )}
                          </section>

                          <section className="video-summary-detail-page__analysis-expression-group">
                            <div className="video-summary-detail-page__analysis-expression-head">
                              <h4>감정 표현</h4>
                              <span>{visibleEmotionKeywordItems.length}개</span>
                            </div>
                            {visibleEmotionKeywordItems.length ? (
                              <div className="video-summary-detail-page__analysis-keyword-cloud video-summary-detail-page__analysis-keyword-cloud--emotion">
                                {visibleEmotionKeywordItems.map((keyword) => (
                                  <span
                                    key={`${keyword.keywordType}-${keyword.keywordText}`}
                                    className="video-summary-detail-page__analysis-keyword-chip video-summary-detail-page__analysis-keyword-chip--emotion"
                                  >
                                    {keyword.keywordText}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <p className="video-summary-detail-page__analysis-empty">
                                감정 표현 키워드가 없습니다.
                              </p>
                            )}
                          </section>
                        </div>
                      </article>

                    <p className="video-summary-detail-page__analysis-score-evidence">
                      {renderHighlightedEvidenceText(scoreEvidenceText)}
                    </p>
                      </div>
                    </section>

                  </div>

                  {analysisErrorMessage ? (
                    <p className="video-summary-detail-page__summary-error">
                      {analysisErrorMessage}
                    </p>
                  ) : null}
                  </div>

                  <aside
                    className="video-summary-detail-page__analysis-opposing-pane"
                    aria-hidden={!isOpposingAnalysisVisible}
                  >
                    <header className="video-summary-detail-page__section-header video-summary-detail-page__section-header--opposing">
                      <h2>다른 관점의 영상</h2>
                      <span className="video-summary-detail-page__pane-header-actions">
                        <span className="video-summary-detail-page__opposing-pane-badge">
                          {opposingAnalysisToneLabel}
                        </span>
                        {opposingAnalysisResult?.youtubeVideoId ? (
                          <>
                            <button
                              type="button"
                              className="video-summary-detail-page__icon-action video-summary-detail-page__pane-scrap-action video-summary-detail-page__pane-scrap-action--opposing"
                              onClick={handleShareOpposingVideo}
                              aria-label="다른 관점 영상 링크 복사"
                              title="다른 관점 영상 링크 복사"
                            >
                              <ShareIcon />
                            </button>
                            <button
                              type="button"
                              className={`video-summary-detail-page__icon-action video-summary-detail-page__pane-scrap-action video-summary-detail-page__pane-scrap-action--opposing ${
                                isOpposingScrapped ? 'video-summary-detail-page__icon-action--active' : ''
                              }`}
                              onClick={handleToggleOpposingScrap}
                              disabled={isOpposingScrapLoading}
                              aria-label={isOpposingScrapped ? '다른 관점 영상 스크랩 해제' : '다른 관점 영상 스크랩 저장'}
                              aria-pressed={isOpposingScrapped}
                              title={isOpposingScrapped ? '다른 관점 영상 스크랩 해제' : '다른 관점 영상 스크랩'}
                            >
                              <BookmarkIcon />
                            </button>
                          </>
                        ) : null}
                      </span>
                    </header>

                    <div className="video-summary-detail-page__divider video-summary-detail-page__divider--opposing" />

                    <div className="video-summary-detail-page__analysis-report video-summary-detail-page__analysis-report--opposing">
                      {isOpposingAnalysisLoading ? (
                        <p className="video-summary-detail-page__status">다른 관점 영상 캐치 결과를 불러오는 중입니다.</p>
                      ) : null}

                      {opposingAnalysisErrorMessage ? (
                        <p className="video-summary-detail-page__status">{opposingAnalysisErrorMessage}</p>
                      ) : null}

                      {opposingAnalysisResult ? (
                      <>
                      <div className="video-summary-detail-page__analysis-top-grid">
                        {opposingAnalysisResult?.youtubeVideoId ? (
                          <a
                            className="video-summary-detail-page__opposing-video-card"
                            href={`https://www.youtube.com/watch?v=${opposingAnalysisResult.youtubeVideoId}`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`${opposingAnalysisTitle} 원본 영상 열기`}
                          >
                            <YoutubeThumbnail
                              src={opposingAnalysisResult.thumbnailUrl}
                              youtubeVideoId={opposingAnalysisResult.youtubeVideoId}
                              alt={opposingAnalysisTitle}
                              placeholder={<div className="video-summary-detail-page__opposing-video-placeholder" />}
                            />
                            <span className="video-summary-detail-page__hero-play">
                              <PlayIcon />
                            </span>
                          </a>
                        ) : (
                          <div className="video-summary-detail-page__opposing-video-placeholder">
                            <span>영상</span>
                          </div>
                        )}

                        <article className="video-summary-detail-page__analysis-compact-card video-summary-detail-page__analysis-summary-card video-summary-detail-page__analysis-summary-card--opposing-pane">
                          <div className="video-summary-detail-page__analysis-compact-header">
                            <h3>영상 요약</h3>
                          </div>
                          <strong className="video-summary-detail-page__opposing-analysis-title">
                            {opposingAnalysisTitle}
                          </strong>
                          {opposingAnalysisMetaItems.length ? (
                            <span className="video-summary-detail-page__analysis-summary-meta video-summary-detail-page__analysis-summary-meta--opposing">
                              {opposingAnalysisMetaItems.join(' · ')}
                            </span>
                          ) : null}
                          <p className="video-summary-detail-page__analysis-compact-text">
                            {opposingAnalysisSummaryText}
                          </p>
                        </article>
                      </div>

                      <section
                        className={`video-summary-detail-page__analysis-evidence-disclosure video-summary-detail-page__analysis-evidence-disclosure--opposing ${
                          isOpposingAnalysisEvidenceOpen
                            ? 'video-summary-detail-page__analysis-evidence-disclosure--open'
                            : ''
                        }`}
                      >
                        <button
                          type="button"
                          className="video-summary-detail-page__analysis-evidence-toggle"
                          aria-expanded={isOpposingAnalysisEvidenceOpen}
                          aria-controls="opposing-analysis-evidence-panel"
                          onClick={() => setIsOpposingAnalysisEvidenceOpen((currentState) => !currentState)}
                        >
                          <span className="video-summary-detail-page__analysis-evidence-copy">
                            <span>DETAIL EVIDENCE</span>
                            <strong>다른 관점 영상 캐치 근거 자세히 보기</strong>
                            <small>총점 산출 방식, 의견성·감정성 지표와 감정 키워드를 확인합니다.</small>
                          </span>
                          <span className="video-summary-detail-page__analysis-evidence-meta">
                            <span>{formatScorePoints(opposingDisplayOverallBiasScore)}</span>
                            <ChevronDownIcon />
                          </span>
                        </button>

                        <div
                          id="opposing-analysis-evidence-panel"
                          className="video-summary-detail-page__analysis-evidence-panel"
                          hidden={!isOpposingAnalysisEvidenceOpen}
                        >
                          <article className="video-summary-detail-page__analysis-total-card">
                            <section className="video-summary-detail-page__analysis-total-score">
                              <h3>총 점수</h3>
                              <div
                                className="video-summary-detail-page__analysis-total-orb"
                                style={{
                                  '--analysis-total-score-percent': `${clampPercentage(opposingDisplayOverallBiasScore) ?? 0}%`,
                                }}
                              >
                                <strong>{formatScorePoints(opposingDisplayOverallBiasScore)}</strong>
                                <span>종합 지표</span>
                              </div>
                            </section>

                            <section className="video-summary-detail-page__analysis-score-guide">
                              <h3>점수 의미</h3>
                              <ul>
                                <li><strong>0~20점</strong><span>주관적 표현이 낮아요</span></li>
                                <li><strong>21~40점</strong><span>약간의 해석이 있어요</span></li>
                                <li><strong>41~60점</strong><span>의견과 정보가 섞여 있어요</span></li>
                                <li><strong>61~80점</strong><span>주관적 표현이 많아요</span></li>
                                <li><strong>81~100점</strong><span>감정적·주장형 표현이 강해요</span></li>
                              </ul>
                            </section>

                            <section className="video-summary-detail-page__analysis-score-reason">
                              <h3>점수 근거</h3>
                              <p>{opposingScoreReasonText}</p>
                            </section>
                          </article>

                          <article className="video-summary-detail-page__analysis-metric-card">
                            <div className="video-summary-detail-page__analysis-metric-list">
                              {opposingMetricBars.map((bar) => {
                                const percentage = clampPercentage(bar.value)

                                return (
                                  <div key={bar.key} className="video-summary-detail-page__analysis-metric-row">
                                    <div className="video-summary-detail-page__analysis-metric-label">
                                      <strong>{bar.label}</strong>
                                      <span>: {formatMetricPercent(bar.value)}</span>
                                    </div>
                                    <div className="video-summary-detail-page__analysis-metric-track">
                                      <span
                                        className={`video-summary-detail-page__analysis-metric-fill ${bar.toneClassName}`}
                                        style={{ width: `${percentage ?? 0}%` }}
                                      />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </article>

                      <article className="video-summary-detail-page__analysis-compact-card video-summary-detail-page__analysis-emotion-card">
                        <div className="video-summary-detail-page__analysis-compact-header">
                          <h3>핵심 표현</h3>
                        </div>

                        {hasOpposingSeparatedKeywordGroups ? (
                          <div className="video-summary-detail-page__analysis-expression-groups">
                            <section className="video-summary-detail-page__analysis-expression-group">
                              <div className="video-summary-detail-page__analysis-expression-head">
                                <h4>중점 키워드</h4>
                                <span>{visibleOpposingFocusKeywordItems.length}개</span>
                              </div>
                              {visibleOpposingFocusKeywordItems.length ? (
                                <div className="video-summary-detail-page__analysis-keyword-cloud video-summary-detail-page__analysis-keyword-cloud--emotion">
                                  {visibleOpposingFocusKeywordItems.map((keyword) => {
                                    const keywordMeta = formatFocusKeywordMeta(keyword)

                                    return (
                                      <span
                                        key={`opposing-focus-${keyword.keywordText}`}
                                        className="video-summary-detail-page__analysis-keyword-chip video-summary-detail-page__analysis-keyword-chip--focus"
                                      >
                                        <strong>{keyword.keywordText}</strong>
                                        {keywordMeta ? <em>{keywordMeta}</em> : null}
                                      </span>
                                    )
                                  })}
                                </div>
                              ) : (
                                <p className="video-summary-detail-page__analysis-empty">
                                  중점 키워드가 없습니다.
                                </p>
                              )}
                            </section>

                            <section className="video-summary-detail-page__analysis-expression-group">
                              <div className="video-summary-detail-page__analysis-expression-head">
                                <h4>감정 표현</h4>
                                <span>{visibleOpposingEmotionKeywordItems.length}개</span>
                              </div>
                              {visibleOpposingEmotionKeywordItems.length ? (
                                <div className="video-summary-detail-page__analysis-keyword-cloud video-summary-detail-page__analysis-keyword-cloud--emotion">
                                  {visibleOpposingEmotionKeywordItems.map((keyword) => (
                                    <span
                                      key={`opposing-${keyword.keywordType}-${keyword.keywordText}`}
                                      className="video-summary-detail-page__analysis-keyword-chip video-summary-detail-page__analysis-keyword-chip--emotion"
                                    >
                                      {keyword.keywordText}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="video-summary-detail-page__analysis-empty">
                                  감정 표현 키워드가 없습니다.
                                </p>
                              )}
                            </section>
                          </div>
                        ) : visibleOpposingLegacyKeywordItems.length ? (
                          <div className="video-summary-detail-page__analysis-keyword-cloud video-summary-detail-page__analysis-keyword-cloud--emotion">
                            {visibleOpposingLegacyKeywordItems.map((keyword, index) => (
                              <span
                                key={`opposing-legacy-${keyword.keywordText}-${index}`}
                                className="video-summary-detail-page__analysis-keyword-chip video-summary-detail-page__analysis-keyword-chip--emotion"
                              >
                                {keyword.keywordText}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="video-summary-detail-page__analysis-empty">
                            핵심 표현 키워드가 없습니다.
                          </p>
                        )}
                      </article>

                          <p className="video-summary-detail-page__analysis-score-evidence video-summary-detail-page__analysis-score-evidence--opposing">
                            {renderHighlightedEvidenceText(opposingScoreEvidenceText)}
                          </p>
                        </div>
                      </section>
                      </>
                      ) : null}
                    </div>
                  </aside>

                  <section className="video-summary-detail-page__analysis-recommendations">
                    <header className="video-summary-detail-page__analysis-recommendations-header">
                      <h3>실시간 추천 영상</h3>
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
                        지금은 보여드릴 실시간 추천 영상이 없습니다.
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
                      <YoutubeThumbnail
                        src={videoDetail.thumbnailUrl}
                        youtubeVideoId={videoDetail.youtubeVideoId}
                        alt={videoDetail.title}
                        placeholder={
                          <div className="video-summary-detail-page__hero-placeholder">
                            <span>NNW VIDEO</span>
                          </div>
                        }
                      />

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
                      <span>{isAnalysisLoading ? '캐치 중' : '관점 캐치하기'}</span>
                    </button>
                  </div>

                  <div className="video-summary-detail-page__video-info">
                    <h3>{videoDetail.title}</h3>

                    <div className="video-summary-detail-page__meta">
                      <span>{videoDetail.channelName}</span>
                      {formatCount(videoDetail.commentCount, '댓글') ? (
                        <span>{formatCount(videoDetail.commentCount, '댓글')}</span>
                      ) : null}
                    </div>
                  </div>

                  <section className="video-summary-detail-page__summary-card">
                    <header className="video-summary-detail-page__summary-header">
                      <h3>{analysisResult ? '영상 캐치 결과' : '영상 설명'}</h3>
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
                          {scoreCards.map(renderScoreCard)}
                        </div>

                        <div className="video-summary-detail-page__analysis-summary-grid">
                          {renderScoreCard(emotionScoreCard)}

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
                              <YoutubeThumbnail
                                src={recommendation.thumbnailUrl}
                                youtubeVideoId={recommendation.youtubeVideoId}
                                alt={recommendation.title}
                                placeholder={
                                  <div className="video-summary-detail-page__recommendation-placeholder" />
                                }
                              />
                            </div>

                            <div className="video-summary-detail-page__recommendation-body">
                              <strong>{recommendation.title}</strong>
                              <p>{recommendation.channelName}</p>
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

        {isAnalysisModalOpen ? createPortal(
          (
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
                <span id="video-analysis-title">관점 캐치</span>
              </div>

              <p className="video-summary-detail-page__analysis-message">
                이 영상의 표현과 관점 흐름을
                <br />
                확인해볼까요?
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
                  캐치 시작
                </button>
              </div>
            </div>
          </div>
          ),
          document.body,
        ) : null}

        {transcriptErrorMessage ? createPortal(
          (
            <div
              className="video-summary-detail-page__analysis-modal"
              role="presentation"
              onClick={closeTranscriptErrorModal}
            >
              <div
                className="video-summary-detail-page__analysis-dialog video-summary-detail-page__analysis-dialog--notice"
                role="dialog"
                aria-modal="true"
                aria-labelledby="video-transcript-error-title"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  className="video-summary-detail-page__analysis-close"
                  onClick={closeTranscriptErrorModal}
                  aria-label="자막 오류 안내 닫기"
                >
                  <CloseIcon />
                </button>

                <div className="video-summary-detail-page__analysis-badge video-summary-detail-page__analysis-badge--notice">
                  <AnalysisIcon />
                  <span id="video-transcript-error-title">자막이 없는 영상입니다</span>
                </div>

                <p className="video-summary-detail-page__analysis-message video-summary-detail-page__analysis-message--notice">
                  {transcriptErrorMessage}
                </p>

                <div className="video-summary-detail-page__analysis-actions">
                  <button
                    type="button"
                    className="video-summary-detail-page__analysis-action video-summary-detail-page__analysis-action--primary"
                    onClick={closeTranscriptErrorModal}
                  >
                    이전 화면으로 돌아가기
                  </button>
                </div>
              </div>
            </div>
          ),
          document.body,
        ) : null}
      </section>
    </main>
  )
}

export default VideoSummaryDetail
