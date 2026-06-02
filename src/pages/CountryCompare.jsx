import { Environment, Html, Text, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import Navbar from '../components/Navbar'
import YoutubeThumbnail from '../components/YoutubeThumbnail'
import mockComparisonThumbnail from '../assets/summary.jpg'
import {
  COMPARISON_COUNTRIES,
  fetchComparisonGraph,
  fetchComparisonVideoTarget,
  requestComparisonInsight,
  searchComparisonVideos,
} from '../services/comparison'
import { fetchVideoAnalysisResult } from '../services/analysis'
import './CountryCompare.css'

const countryDisplay = {
  KR: { name: 'Korea', localName: '대한민국', tone: 'kr' },
  US: { name: 'United States', localName: '미국', tone: 'us' },
  CN: { name: 'China', localName: '중국', tone: 'cn' },
}

const COMPARISON_COUNTRY_CODES = ['KR', 'US', 'CN']
const COMPARISON_SELECTED_VIDEO_KEY = 'comparison-selected-video'
const USE_COMPARISON_MOCK_DATA = false
const COMPARISON_RECOMMENDATION_LIMIT = 3
const DEFAULT_COMPARISON_SEARCH_KEYWORD = '트럼프-대만'
const COUNTRY_MODEL_CONFIGS = {
  KR: {
    url: '/models/lee.glb',
    bounds: {
      min: [-0.4601080119609833, -0.95023113489151, -0.18398495018482208],
      max: [0.4544369876384735, 0.9481990933418274, 0.183196023106575],
    },
    orientation: [0, 7.2, 0],
    inactiveHeight: 3.04,
    activeHeight: 3.84,
    inactiveBaseY: -1.38,
    activeBaseY: -1.74,
  },
  US: {
    url: '/models/us-presenter.glb',
    bounds: {
      min: [-0.6408320069313049, -0.9506081342697144, -0.2756750285625458],
      max: [0.6405829787254333, 0.9483711123466492, 0.2744660675525665],
    },
    orientation: [0, 7.2, 0],
    inactiveHeight: 3.04,
    activeHeight: 3.84,
    inactiveBaseY: -1.38,
    activeBaseY: -1.74,
  },
  CN: {
    url: '/models/china-presenter.glb',
    bounds: {
      min: [-0.4926140010356903, -0.9506081342697144, -0.21054603159427643],
      max: [0.48972299695014954, 0.948241114616394, 0.209026038646698],
    },
    orientation: [0, 7.2, 0],
    inactiveHeight: 3.04,
    activeHeight: 3.84,
    inactiveBaseY: -1.38,
    activeBaseY: -1.74,
  },
}
const COUNTRY_MODEL_STYLE = {
  KR: {
    primary: '#0047a0',
    secondary: '#cd2e3a',
    glow: '#a8c7ff',
  },
  US: {
    primary: '#3182f6',
    secondary: '#77d9d5',
    glow: '#8fb8ff',
  },
  CN: {
    primary: '#de2910',
    secondary: '#ffde00',
    glow: '#fb7185',
  },
}
const COMPARISON_BACKGROUND_MODEL_CONFIG = {
  url: '/models/earth.glb',
  bounds: {
    min: [-0.9502419829368591, -0.9507431387901306, -0.9497981071472168],
    max: [0.9484429955482483, 0.947309136390686, 0.9443271160125732],
  },
  orientation: [-8, -24, 0],
  position: [0, -0.68, -3.24],
  targetWidth: 4.65,
  opacity: 0.42,
  centerOnOrigin: true,
}
const WHITE_HOUSE_RECOMMENDATION_MODEL_CONFIG = {
  url: '/models/us-white-house-stage.glb',
  bounds: {
    min: [-0.950652003288269, -0.3757970929145813, -0.6471550464630127],
    max: [0.9488509893417358, 0.3737460672855377, 0.6441850662231445],
  },
  orientation: [0, 0, 0],
  position: [0, -0.28, -0.08],
  targetWidth: 0.86,
  opacity: 0.48,
}
const MAX_COMPARISON_EXPRESSION_KEYWORDS = 6

function getSelectedCenteredCountryCodes(selectedCountryCode = 'KR') {
  const centerCountryCode = COMPARISON_COUNTRY_CODES.includes(selectedCountryCode)
    ? selectedCountryCode
    : 'KR'
  const sideCountryCodes = COMPARISON_COUNTRY_CODES.filter((countryCode) => countryCode !== centerCountryCode)

  return [sideCountryCodes[0], centerCountryCode, sideCountryCodes[1]]
}

function cacheSelectedComparisonVideo(video) {
  try {
    window.sessionStorage.setItem(COMPARISON_SELECTED_VIDEO_KEY, JSON.stringify(video))
  } catch {
    // Graph navigation should still work if storage is blocked.
  }
}

function readCachedSelectedComparisonVideo(videoId = '') {
  try {
    const rawVideo = window.sessionStorage.getItem(COMPARISON_SELECTED_VIDEO_KEY)

    if (!rawVideo) {
      return null
    }

    const video = JSON.parse(rawVideo)

    if (!videoId || video?.videoId === videoId || video?.id === videoId) {
      return video
    }
  } catch {
    return null
  }

  return null
}

const fallbackKeywords = ['트럼프 대만', 'AI 반도체', '미중 갈등', '기후 정상회의', '전기차 관세']

function normalizeSearchKeyword(keyword = '') {
  return String(keyword).replace(/^#+/, '').trim()
}

function isTrumpTaiwanKeyword(keyword = '') {
  const normalizedKeyword = normalizeSearchKeyword(keyword).toLowerCase()

  return (
    (normalizedKeyword.includes('트럼프') || normalizedKeyword.includes('trump') || normalizedKeyword.includes('特朗普')) &&
    (normalizedKeyword.includes('대만') || normalizedKeyword.includes('타이완') || normalizedKeyword.includes('taiwan') || normalizedKeyword.includes('台湾'))
  )
}

function createYoutubeThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
}

function getYoutubeWatchUrl(video) {
  return video?.originalUrl || (video?.videoId ? `https://www.youtube.com/watch?v=${video.videoId}` : '')
}

function openYoutubeVideo(video) {
  const youtubeUrl = getYoutubeWatchUrl(video)

  if (youtubeUrl) {
    window.open(youtubeUrl, '_blank', 'noopener,noreferrer')
  }
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  )
}

function getKeywordText(keyword) {
  if (typeof keyword === 'string') {
    return keyword
  }

  return keyword?.keywordText || keyword?.keyword_text || keyword?.keyword || keyword?.text || keyword?.name || ''
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

function getCountryMeta(countryCode = '') {
  return countryDisplay[countryCode] || {
    name: countryCode || 'Unknown',
    localName: countryCode || '기타',
    tone: 'other',
  }
}

function createMockComparisonGraph(videoId, selectedVideoOverride = null) {
  const selectedVideoId = videoId || 'mock-selected-video'
  const selectedCountryCode = COMPARISON_COUNTRY_CODES.includes(selectedVideoOverride?.countryCode)
    ? selectedVideoOverride.countryCode
    : 'KR'
  const selectedCountry = getCountryMeta(selectedCountryCode)
  const fallbackSelectedVideo = createTrumpTaiwanMockSections()
    .flatMap((section) => section.videos)
    .find((video) => video.videoId === selectedVideoId) || null
  const selectedVideo = {
    id: selectedVideoOverride?.id || fallbackSelectedVideo?.id || selectedVideoId,
    videoId: selectedVideoOverride?.videoId || fallbackSelectedVideo?.videoId || selectedVideoId,
    title: selectedVideoOverride?.title || fallbackSelectedVideo?.title || '선택한 영상: 트럼프 대만 이슈를 다룬 보도',
    thumbnailUrl: selectedVideoOverride?.thumbnailUrl || fallbackSelectedVideo?.thumbnailUrl || createYoutubeThumbnailUrl(selectedVideoId),
    channelName: selectedVideoOverride?.channelName || fallbackSelectedVideo?.channelName || `${selectedCountry.name} News`,
    viewCount: selectedVideoOverride?.viewCount ?? fallbackSelectedVideo?.viewCount ?? 128400,
    durationSeconds: selectedVideoOverride?.durationSeconds ?? fallbackSelectedVideo?.durationSeconds ?? 118,
    publishedAt: selectedVideoOverride?.publishedAt || fallbackSelectedVideo?.publishedAt || '2026-05-21T13:39:03',
    countryCode: selectedCountryCode,
    countryName: selectedCountry.name,
    countryLocalLabel: selectedCountry.localName,
    language: selectedVideoOverride?.language || fallbackSelectedVideo?.language || (selectedCountryCode === 'KR' ? 'ko' : selectedCountryCode === 'CN' ? 'zh' : 'en'),
    analysisStatus: 'MOCK_READY',
    nodeType: 'selected',
    focusKeywords: selectedVideoOverride?.focusKeywords || fallbackSelectedVideo?.focusKeywords || ['트럼프', '대만', '미중 갈등'],
    emotionKeywords: selectedVideoOverride?.emotionKeywords || fallbackSelectedVideo?.emotionKeywords || ['긴장', '압박', '우려'],
  }
  const relatedNodes = createTrumpTaiwanMockSections()
    .filter((section) => section.countryCode !== selectedCountryCode)
    .flatMap((section) =>
      section.videos.slice(0, COMPARISON_RECOMMENDATION_LIMIT).map((video) => ({
        ...video,
        nodeType: 'related',
        reasons: [
          `${section.countryLocalLabel} 관점에서 트럼프와 대만 이슈를 다룬 비교 후보입니다.`,
          '실제 그래프 API 실패 시 표시하는 트럼프 대만 고정 목데이터입니다.',
        ],
        sharedKeywords: ['트럼프', '대만', '미중 갈등'],
        sharedEntities: ['트럼프', '대만', '중국', '미국'],
        sameIssueCluster: '트럼프 대만 이슈',
      })),
    )
  const edgeWeights = [0.91, 0.86, 0.82, 0.78, 0.74, 0.7]

  return {
    selectedVideo,
    mainKeywords: ['트럼프', '대만', '미중 갈등', '대만 해협'],
    nodes: [selectedVideo, ...relatedNodes],
    edges: relatedNodes.map((node, index) => ({
      id: `mock-trump-taiwan-edge-${index + 1}`,
      source: selectedVideo.videoId,
      target: node.videoId,
      relationType: 'RELATED_COUNTRY_COVERAGE',
      keywords: node.sharedKeywords,
      reasons: node.reasons,
      sharedEntities: node.sharedEntities,
      sameIssueCluster: node.sameIssueCluster,
      weight: edgeWeights[index] || 0.68,
    })),
    connectionReasons: [
      '테스트용 mock 데이터입니다. compare-on-click API 응답이 성공하면 실제 응답이 우선 표시됩니다.',
      '트럼프 대만 키워드에 맞춘 국가별 비교 후보 3개씩을 연결했습니다.',
    ],
    countryPerspectives: [
      { countryCode: 'KR', summary: '한국 관점은 대만 해협 긴장과 한반도 안보 파장을 함께 봅니다.' },
      { countryCode: 'US', summary: '미국 관점은 트럼프의 대중국 압박과 동맹 부담을 중심으로 전개됩니다.' },
      { countryCode: 'CN', summary: '중국 관점은 하나의 중국 원칙과 미국 압박 대응 프레임을 강조합니다.' },
    ],
    sharedKeywords: ['트럼프', '대만', '미중 갈등', '대만 해협'],
    sharedEntities: ['트럼프', '대만', '미국', '중국'],
    clusterInfo: {
      id: 'mock-cluster-trump-taiwan',
      title: '트럼프 대만 이슈',
    },
    isMock: true,
  }
}

function goToHashRoute(route) {
  window.location.hash = route.replace(/^#/, '')
}

function ComparisonSearchBar({ value, isLoading, onChange, onSubmit }) {
  return (
    <form className="country-compare-page__searchbar" onSubmit={onSubmit}>
      <SearchIcon />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="비교할 이슈나 키워드를 입력하세요"
        aria-label="국가별 비교 영상 검색"
      />
      <button type="submit" disabled={isLoading}>
        {isLoading ? '검색 중' : '검색'}
      </button>
    </form>
  )
}

function IssueKeywordChips({ keywords, activeKeyword, disabled, onSelect }) {
  const displayKeywords = keywords.length ? keywords : fallbackKeywords

  return (
    <div className="country-compare-page__issue-chips" aria-label="오늘의 비교 이슈">
      {displayKeywords.slice(0, 5).map((keyword) => {
        const searchKeyword = normalizeSearchKeyword(keyword)

        return (
          <button
            key={keyword}
            className={activeKeyword === searchKeyword ? 'country-compare-page__issue-chip country-compare-page__issue-chip--active' : 'country-compare-page__issue-chip'}
            type="button"
            disabled={disabled || !searchKeyword}
            aria-label={`${searchKeyword} 키워드로 검색`}
            onClick={() => onSelect(searchKeyword)}
          >
            #{searchKeyword}
          </button>
        )
      })}
    </div>
  )
}

function StatePanel({ title, message, tone = 'default' }) {
  return (
    <div className={`country-compare-page__state country-compare-page__state--${tone}`}>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  )
}

function ComparisonVideoCard({ video, onClick }) {
  const country = getCountryMeta(video.countryCode)

  return (
    <button
      className={`country-compare-page__video-card country-compare-page__video-card--${country.tone}`}
      type="button"
      onClick={() => onClick(video.videoId)}
      disabled={!video.videoId}
    >
      <div className="country-compare-page__video-thumb">
        <YoutubeThumbnail
          src={video.thumbnailUrl}
          youtubeVideoId={video.videoId}
          alt={video.title}
          placeholder={<div className="country-compare-page__video-placeholder" />}
        />
        <span className={`country-compare-page__country-badge country-compare-page__country-badge--${country.tone}`}>
          {country.localName}
        </span>
      </div>
      <div className="country-compare-page__video-body">
        <strong>{video.title}</strong>
        <p>{video.channelName}</p>
        <div className="country-compare-page__video-tags">
          <span>{video.language || '언어 정보 없음'}</span>
          <span>{video.analysisStatus || '분석 상태 없음'}</span>
        </div>
      </div>
    </button>
  )
}

function normalizeCarouselIndex(index, length) {
  if (!length) {
    return 0
  }

  return ((index % length) + length) % length
}

function getCarouselOffset(index, activeIndex, length) {
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

function CountryVideoCarousel({ section, videos, onOpenVideo }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const activeVideoIndex = normalizeCarouselIndex(activeIndex, videos.length)

  useEffect(() => {
    if (videos.length < 2 || isPaused) {
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) => normalizeCarouselIndex(currentIndex + 1, videos.length))
    }, 4200)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [videos.length, isPaused])

  const handleCardClick = (video, index, isActive) => {
    if (!isActive) {
      setActiveIndex(index)
      return
    }

    onOpenVideo(video.videoId, video)
  }

  return (
    <div
      className="country-compare-page__country-carousel"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      aria-label={`${section.countryCode} 추천 영상 캐러셀`}
    >
      <div className="country-compare-page__country-carousel-stage">
        {videos.map((video, index) => {
          const offset = getCarouselOffset(index, activeVideoIndex, videos.length)
          const distance = Math.abs(offset)
          const isActive = index === activeVideoIndex
          const isVisible = distance <= 1

          return (
            <div
              key={`${section.countryCode}-${video.videoId || video.id}`}
              className={`country-compare-page__carousel-item ${
                isActive ? 'country-compare-page__carousel-item--active' : ''
              } ${!isVisible ? 'country-compare-page__carousel-item--hidden' : ''}`}
              aria-hidden={!isVisible}
              style={{
                '--compare-carousel-offset': offset,
                '--compare-carousel-scale': isActive ? 1 : 0.84,
                '--compare-carousel-opacity': isActive ? 1 : isVisible ? 0.42 : 0,
                zIndex: String(isActive ? 20 : 10 - distance),
              }}
            >
              <ComparisonVideoCard
                video={video}
                onClick={() => handleCardClick(video, index, isActive)}
              />
            </div>
          )
        })}
      </div>

      {videos.length > 1 ? (
        <div className="country-compare-page__carousel-controls">
          <button
            type="button"
            aria-label={`${section.countryCode} 이전 영상`}
            onClick={() => setActiveIndex((currentIndex) => normalizeCarouselIndex(currentIndex - 1, videos.length))}
          >
            ‹
          </button>
          <span>{String(activeVideoIndex + 1).padStart(2, '0')} / {String(videos.length).padStart(2, '0')}</span>
          <button
            type="button"
            aria-label={`${section.countryCode} 다음 영상`}
            onClick={() => setActiveIndex((currentIndex) => normalizeCarouselIndex(currentIndex + 1, videos.length))}
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  )
}

function CountryVideoSection({ section, isLoading, onOpenVideo }) {
  const country = getCountryMeta(section.countryCode)
  const videos = section.videos || []

  return (
    <section className={`country-compare-page__country-section country-compare-page__country-section--${country.tone}`}>
      <header className="country-compare-page__country-head">
        <div>
          <span>{country.localName}</span>
          <h2>{country.name}</h2>
        </div>
        <strong>{videos.length}개 영상</strong>
      </header>

      {isLoading ? (
        <div className="country-compare-page__video-grid">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={`${section.countryCode}-skeleton-${index}`} className="country-compare-page__video-skeleton" />
          ))}
        </div>
      ) : videos.length ? (
        <CountryVideoCarousel section={section} videos={videos.slice(0, COMPARISON_RECOMMENDATION_LIMIT)} onOpenVideo={onOpenVideo} />
      ) : (
        <StatePanel title="표시할 영상이 없습니다" message="이 국가 섹션에 해당하는 비교 영상이 아직 없어요." />
      )}
    </section>
  )
}

function normalizeSections(sections = []) {
  const byCountry = new Map(sections.map((section) => [section.countryCode, section]))

  return COMPARISON_COUNTRIES.map((country) => ({
    ...country,
    ...(byCountry.get(country.code) || {}),
    countryCode: country.code,
    videos: byCountry.get(country.code)?.videos || [],
  }))
}

function createMockComparisonHomeSections() {
  const mockGraph = createMockComparisonGraph('mock-home-selected-video')
  const nodesByCountry = new Map(COMPARISON_COUNTRIES.map((country) => [country.code, []]))

  mockGraph.nodes
    .filter((node) => node.videoId !== mockGraph.selectedVideo.videoId)
    .forEach((node) => {
      const countryCode = COMPARISON_COUNTRY_CODES.includes(node.countryCode) ? node.countryCode : 'KR'
      nodesByCountry.get(countryCode)?.push({
        ...node,
        channelName: node.channelName || `${getCountryMeta(countryCode).name} News`,
        viewCount: node.viewCount ?? 43808,
        publishedAt: node.publishedAt || '2026-05-05T00:00:00Z',
      })
    })

  return COMPARISON_COUNTRIES.map((country) => ({
    ...country,
    countryCode: country.code,
    countryName: country.label,
    countryLocalLabel: country.localLabel,
    videos: (nodesByCountry.get(country.code) || []).slice(0, 5),
  }))
}

function createTrumpTaiwanMockSections() {
  const mockVideosByCountry = {
    KR: [
      {
        id: 'q0Jo5F8pHbs',
        videoId: 'q0Jo5F8pHbs',
        title: '시진핑의 대만 야욕과 미중 충돌에 숨겨진 계산법',
        channelName: '교양이를 부탁해',
        viewCount: 45121,
        publishedAt: '2026-05-21T13:39:03',
        durationSeconds: 1955,
        focusKeywords: ['시진핑', '대만', '트럼프', '미중 충돌'],
        emotionKeywords: ['야욕', '충돌', '계산'],
      },
      {
        id: 'isE_8nX2v3c',
        videoId: 'isE_8nX2v3c',
        title: '대만 문제 정리되나, 트럼프가 밝힌 중국과 대만 인식',
        channelName: 'MBCNEWS',
        viewCount: 68946,
        publishedAt: '2026-02-05T11:30:41',
        durationSeconds: 118,
        focusKeywords: ['트럼프', '대만 문제', '중국'],
        emotionKeywords: ['정리', '이해', '머쓱'],
      },
      {
        id: 'I045QBD4sWA',
        videoId: 'I045QBD4sWA',
        title: '대만 상황과 트럼프의 대응을 짚어보는 뉴스 분석',
        channelName: '연합뉴스TV',
        viewCount: 10390,
        publishedAt: '2025-12-30T04:00:41',
        durationSeconds: 473,
        focusKeywords: ['대만 상황', '트럼프', '중국'],
        emotionKeywords: ['우려', '천하태평', '긴장'],
      },
    ],
    US: [
      {
        id: 'mock-us-trump-taiwan-1',
        videoId: 'Ueo0LrAiiVk',
        title: '미국 언론: 트럼프의 대만 전략과 중국 압박',
        channelName: 'US Global Brief',
        viewCount: 184230,
        publishedAt: '2026-05-19T14:00:00',
        durationSeconds: 182,
        focusKeywords: ['Trump', 'Taiwan', 'China pressure'],
        emotionKeywords: ['pressure', 'risk', 'warning'],
      },
      {
        id: 'mock-us-trump-taiwan-2',
        videoId: 'FIdnD5j231M',
        title: '워싱턴이 보는 대만 해협 리스크와 동맹 부담',
        channelName: 'Washington Desk',
        viewCount: 97014,
        publishedAt: '2026-05-20T22:40:00',
        durationSeconds: 246,
        focusKeywords: ['Taiwan Strait', 'alliance', 'security risk'],
        emotionKeywords: ['burden', 'concern', 'uncertainty'],
      },
      {
        id: 'mock-us-trump-taiwan-3',
        videoId: 'DbnKSTIklls',
        title: '트럼프 캠프의 대중국 강경 노선과 반도체 공급망',
        channelName: 'Market & Policy',
        viewCount: 76490,
        publishedAt: '2026-05-22T16:15:00',
        durationSeconds: 208,
        focusKeywords: ['China policy', 'semiconductor', 'Taiwan'],
        emotionKeywords: ['hardline', 'pressure', 'competition'],
      },
    ],
    CN: [
      {
        id: 'mock-cn-trump-taiwan-1',
        videoId: 'xzPivhBgyvE',
        title: '중국 관점: 트럼프 발언과 하나의 중국 원칙',
        channelName: 'China Current',
        viewCount: 132840,
        publishedAt: '2026-05-19T10:20:00',
        durationSeconds: 176,
        focusKeywords: ['特朗普', '台湾', '一个中国'],
        emotionKeywords: ['原则', '警告', '反对'],
      },
      {
        id: 'mock-cn-trump-taiwan-2',
        videoId: 'gGnK-6CcCMk',
        title: '중국 매체가 보는 대만 문제와 미국 압박',
        channelName: 'Beijing Focus',
        viewCount: 88912,
        publishedAt: '2026-05-21T12:05:00',
        durationSeconds: 224,
        focusKeywords: ['台湾问题', '美国压力', '中美关系'],
        emotionKeywords: ['施压', '反制', '紧张'],
      },
      {
        id: 'mock-cn-trump-taiwan-3',
        videoId: 'sSdnbMbCK5Y',
        title: '대만 해협 긴장 속 중국의 대응 프레임',
        channelName: 'Global China News',
        viewCount: 70128,
        publishedAt: '2026-05-22T09:45:00',
        durationSeconds: 193,
        focusKeywords: ['台海局势', '反制措施', '地区安全'],
        emotionKeywords: ['风险', '应对', '稳定'],
      },
    ],
  }

  return COMPARISON_COUNTRIES.map((country) => ({
    ...country,
    countryCode: country.code,
    countryName: country.label,
    countryLocalLabel: country.localLabel,
    videos: (mockVideosByCountry[country.code] || []).map((video) => ({
      ...video,
      originalUrl: getYoutubeWatchUrl(video),
      thumbnailUrl: createYoutubeThumbnailUrl(video.videoId),
      countryCode: country.code,
      countryName: country.label,
      countryLocalLabel: country.localLabel,
      language: country.code === 'KR' ? 'ko' : country.code === 'CN' ? 'zh' : 'en',
      analysisStatus: 'MOCK_READY',
      emotionKeywords: video.emotionKeywords || [],
    })),
  }))
}

function hasCompleteCountryVideos(sections = []) {
  const sectionByCountry = new Map(sections.map((section) => [section.countryCode, section]))

  return COMPARISON_COUNTRY_CODES.every(
    (countryCode) => (sectionByCountry.get(countryCode)?.videos || []).length >= COMPARISON_RECOMMENDATION_LIMIT,
  )
}

function orderSectionsBySelectedCountry(sections = [], selectedCountryCode = 'KR') {
  const byCountry = new Map(sections.map((section) => [section.countryCode, section]))

  return getSelectedCenteredCountryCodes(selectedCountryCode)
    .map((countryCode) => byCountry.get(countryCode))
    .filter(Boolean)
}

function CountryCompare({ isLoggedIn, onAuthClick, accessToken }) {
  const hasRunDefaultSearchRef = useRef(false)
  const [query, setQuery] = useState(DEFAULT_COMPARISON_SEARCH_KEYWORD)
  const [activeKeyword, setActiveKeyword] = useState(DEFAULT_COMPARISON_SEARCH_KEYWORD)
  const [issueKeywords, setIssueKeywords] = useState(fallbackKeywords)
  const [sections, setSections] = useState(() => normalizeSections([]))
  const [isHomeLoading, setIsHomeLoading] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [resultTitle, setResultTitle] = useState(`"${DEFAULT_COMPARISON_SEARCH_KEYWORD}" 국가별 검색 결과`)

  useEffect(() => {
    if (!USE_COMPARISON_MOCK_DATA) {
      return undefined
    }

    setIsHomeLoading(true)
    setIssueKeywords(fallbackKeywords)
    setSections(createMockComparisonHomeSections())
    setErrorMessage('테스트용 mock 국가별 추천 영상을 표시합니다.')
    setIsHomeLoading(false)

    return undefined
  }, [])

  const runSearch = useCallback(async (keyword) => {
    const trimmedKeyword = normalizeSearchKeyword(keyword)

    if (!trimmedKeyword) {
      return
    }

    setQuery(trimmedKeyword)
    setActiveKeyword(trimmedKeyword)
    setIsSearching(true)
    setErrorMessage('')
    setResultTitle(`"${trimmedKeyword}" 국가별 검색 결과`)

    try {
      if (USE_COMPARISON_MOCK_DATA) {
        setSections(isTrumpTaiwanKeyword(trimmedKeyword) ? createTrumpTaiwanMockSections() : createMockComparisonHomeSections())
        return
      }

      if (isTrumpTaiwanKeyword(trimmedKeyword)) {
        setSections(createTrumpTaiwanMockSections())
        return
      }

      const searchData = await searchComparisonVideos({ keyword: trimmedKeyword, limit: COMPARISON_RECOMMENDATION_LIMIT, accessToken })
      const normalizedSections = normalizeSections(searchData.sections)

      setSections(
        isTrumpTaiwanKeyword(trimmedKeyword) && !hasCompleteCountryVideos(normalizedSections)
          ? createTrumpTaiwanMockSections()
          : normalizedSections,
      )
    } catch {
      if (isTrumpTaiwanKeyword(trimmedKeyword)) {
        setSections(createTrumpTaiwanMockSections())
      } else {
        setSections(normalizeSections([]))
        setErrorMessage('검색 결과를 불러오지 못했습니다. 키워드를 바꾸거나 다시 시도해 주세요.')
      }
    } finally {
      setIsSearching(false)
    }
  }, [accessToken])

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    runSearch(query)
  }

  useEffect(() => {
    if (hasRunDefaultSearchRef.current) {
      return
    }

    hasRunDefaultSearchRef.current = true
    runSearch(DEFAULT_COMPARISON_SEARCH_KEYWORD)
  }, [runSearch])

  const handleOpenVideo = (videoId, video = null) => {
    if (!videoId) {
      return
    }

    if (video) {
      cacheSelectedComparisonVideo(video)
    }

    goToHashRoute(`comparison/graph/${encodeURIComponent(videoId)}`)
  }

  const isLoading = isHomeLoading || isSearching

  return (
    <main className="country-compare-page">
      <section className="country-compare-page__shell">
        <Navbar activeKey="compare" serviceHref="#home" isLoggedIn={isLoggedIn} onAuthClick={onAuthClick} maxWidth="1360px" />

        <section className="country-compare-page__main-panel">
          <div className="country-compare-page__hero-panel">
            <p className="country-compare-page__eyebrow">Country Perspective Graph</p>
            <h1>같은 이슈를, 나라별 시선으로 비교하세요</h1>
            <p className="country-compare-page__lead">
              한국, 미국, 중국의 추천 영상과 검색 결과를 한 화면에서 보고 선택한 영상의 비교 그래프로 이어집니다.
            </p>

            <ComparisonSearchBar
              value={query}
              isLoading={isSearching}
              onChange={setQuery}
              onSubmit={handleSearchSubmit}
            />

            <IssueKeywordChips
              keywords={issueKeywords}
              activeKeyword={activeKeyword}
              disabled={isLoading}
              onSelect={runSearch}
            />
          </div>

          {errorMessage ? (
            <StatePanel title="데이터를 불러오지 못했습니다" message={errorMessage} tone="error" />
          ) : null}

          <div className="country-compare-page__sections-panel">
            <header className="country-compare-page__sections-title">
              <div>
                <span>{isSearching ? 'Searching' : 'Explore'}</span>
                <h2>{resultTitle}</h2>
              </div>
              <p>영상 카드를 선택하면 국가별 비교 그래프로 이동합니다.</p>
            </header>

            <div className="country-compare-page__country-stack">
              {orderSectionsBySelectedCountry(sections, 'KR').map((section) => (
                <CountryVideoSection
                  key={section.countryCode}
                  section={section}
                  isLoading={isLoading}
                  onOpenVideo={handleOpenVideo}
                />
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  )
}

function SpatialPointCloud() {
  const pointsRef = useRef(null)
  const positions = useMemo(() => {
    const dotCount = 1200
    const nextPositions = new Float32Array(dotCount * 3)

    for (let index = 0; index < dotCount; index += 1) {
      const t = index / dotCount
      const angle = t * Math.PI * 16
      const tunnel = 1.6 + t * 4.8
      const wave = Math.sin(t * Math.PI * 10) * 0.72
      const jitter = (Math.sin(index * 12.9898) * 43758.5453 % 1 - 0.5) * 0.56
      const radius = 0.86 + Math.sin(t * Math.PI * 6) * 0.32 + jitter

      nextPositions[index * 3] = Math.cos(angle) * (radius + wave) + Math.cos(t * Math.PI * 2) * 2.5
      nextPositions[index * 3 + 1] = Math.sin(angle) * radius + Math.sin(t * Math.PI * 3) * 1.12
      nextPositions[index * 3 + 2] = -tunnel + Math.sin(angle * 0.7) * 1.12
    }

    return nextPositions
  }, [])

  useFrame(({ clock }) => {
    if (!pointsRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    pointsRef.current.rotation.y = elapsed * 0.045
    pointsRef.current.rotation.z = Math.sin(elapsed * 0.18) * 0.06
    pointsRef.current.position.y = Math.sin(elapsed * 0.4) * 0.08
  })

  return (
    <points ref={pointsRef} position={[0.15, 0.08, 0.8]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#d9f8ff"
        size={0.014}
        sizeAttenuation
        transparent
        opacity={0.46}
        depthWrite={false}
      />
    </points>
  )
}

function GraphConnector({ from, to, active = false }) {
  const points = useMemo(() => new Float32Array([...from, ...to]), [from, to])
  const materialRef = useRef(null)

  useFrame(({ clock }) => {
    if (!materialRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    materialRef.current.opacity = active
      ? 0.56 + Math.sin(elapsed * 2.2) * 0.16
      : 0.24 + Math.sin(elapsed * 1.4) * 0.08
  })

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial ref={materialRef} color={active ? '#ffffff' : '#6f7683'} transparent opacity={active ? 0.72 : 0.32} />
    </line>
  )
}

function ClusterFocusRings({ activeCountryCode, position }) {
  const groupRef = useRef(null)

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    groupRef.current.rotation.z = elapsed * 0.34
    groupRef.current.scale.setScalar(1.04 + Math.sin(elapsed * 1.65) * 0.055)
  })

  if (!activeCountryCode) {
    return null
  }

  const color = activeCountryCode === 'US' ? '#3182f6' : '#6da9ff'

  return (
    <group ref={groupRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <torusGeometry args={[1.15, 0.014, 10, 120]} />
        <meshBasicMaterial color={color} transparent opacity={0.42} />
      </mesh>
      <mesh scale={[1.42, 1.42, 1.42]}>
        <torusGeometry args={[1.15, 0.01, 10, 120]} />
        <meshBasicMaterial color={color} transparent opacity={0.24} />
      </mesh>
    </group>
  )
}

function ActiveLightMarker({ activeCountryCode, position }) {
  const markerRef = useRef(null)

  useFrame(({ clock }) => {
    if (!markerRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    markerRef.current.position.x = position[0] + Math.cos(elapsed * 1.45) * 0.44
    markerRef.current.position.y = position[1] + 0.76 + Math.sin(elapsed * 1.18) * 0.18
    markerRef.current.position.z = position[2] + Math.sin(elapsed * 1.28) * 0.4
  })

  if (!activeCountryCode) {
    return null
  }

  const color = activeCountryCode === 'US' ? '#3182f6' : '#6da9ff'

  return (
    <group ref={markerRef} position={[position[0], position[1] + 0.72, position[2]]}>
      <pointLight color={color} intensity={26} distance={5.8} />
      <mesh>
        <sphereGeometry args={[0.066, 18, 18]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

function CameraRig({ activeCountryCode, activePosition = [0, -0.05, -0.65] }) {
  const { camera } = useThree()
  const eyeRef = useRef(new THREE.Vector3(0, 0.25, 6.4))
  const lookAtRef = useRef(new THREE.Vector3(0, -0.05, -0.65))
  const upRef = useRef(new THREE.Vector3(0, 1, 0))

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime()
    const cameraEase = 1 - Math.exp(-3.4 * delta)
    const focusEase = 1 - Math.exp(-4.2 * delta)
    const focus = activeCountryCode
      ? new THREE.Vector3(activePosition[0], activePosition[1] - 0.08, activePosition[2] - 0.3)
      : new THREE.Vector3(Math.sin(elapsed * 0.22) * 0.08, -0.05 + Math.sin(elapsed * 0.28) * 0.035, -0.65)
    const idleYaw = Math.sin(elapsed * 0.18) * 0.12
    const yaw = activeCountryCode ? (activePosition[0] < 0 ? -0.78 : 0.78) : idleYaw
    const pitch = activeCountryCode ? 0.27 + Math.sin(elapsed * 0.45) * 0.025 : 0.05
    const distance = activeCountryCode ? 5.78 : 6.42
    const roll = activeCountryCode ? (activePosition[0] < 0 ? 0.16 : -0.16) : 0
    const targetEye = new THREE.Vector3(
      focus.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      focus.y + Math.sin(pitch) * distance + 0.12 + Math.sin(elapsed * 0.36) * 0.06,
      focus.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    )
    const targetUp = new THREE.Vector3(Math.sin(roll), Math.cos(roll), 0).normalize()

    eyeRef.current.lerp(targetEye, cameraEase)
    lookAtRef.current.lerp(focus, focusEase)
    upRef.current.lerp(targetUp, 1 - Math.exp(-3.8 * delta)).normalize()
    camera.position.copy(eyeRef.current)
    camera.up.copy(upRef.current)
    camera.lookAt(lookAtRef.current)
  })

  return null
}

function MovingGroup({
  position,
  children,
  drift = 0,
  initialPosition = null,
  initialScale = 1,
  isActive = true,
}) {
  const groupRef = useRef(null)
  const startPosition = initialPosition || position

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    const ease = 1 - Math.exp(-5.8 * delta)
    const floatAmount = isActive ? 0.078 : 0.032
    groupRef.current.position.lerp(
      {
        x: position[0],
        y: position[1] + Math.sin(elapsed * 0.74 + drift) * floatAmount,
        z: position[2] + Math.cos(elapsed * 0.5 + drift) * (isActive ? 0.035 : 0.012),
      },
      ease,
    )
    groupRef.current.scale.x += (1 - groupRef.current.scale.x) * ease
    groupRef.current.scale.y += (1 - groupRef.current.scale.y) * ease
    groupRef.current.scale.z += (1 - groupRef.current.scale.z) * ease
    groupRef.current.rotation.set(
      Math.sin(elapsed * 0.42 + drift) * 0.018,
      Math.cos(elapsed * 0.36 + drift) * 0.022,
      Math.sin(elapsed * 0.5 + drift) * 0.012,
    )
  })

  return (
    <group ref={groupRef} position={startPosition} scale={[initialScale, initialScale, initialScale]}>
      {children}
    </group>
  )
}

function CameraFacingConnector({ from, toRef, active = false }) {
  const points = useMemo(() => new Float32Array([...from, ...from]), [from])
  const geometryRef = useRef(null)
  const materialRef = useRef(null)

  useFrame(({ clock }) => {
    const target = toRef?.current || toRef
    const geometry = geometryRef.current

    if (!target || !geometry) {
      return
    }

    const positions = geometry.attributes.position.array
    positions[0] = from[0]
    positions[1] = from[1]
    positions[2] = from[2]
    positions[3] = target.x
    positions[4] = target.y
    positions[5] = target.z
    geometry.attributes.position.needsUpdate = true

    if (materialRef.current) {
      materialRef.current.opacity = active ? 0.5 + Math.sin(clock.getElapsedTime() * 2.4) * 0.12 : 0.22
    }
  })

  return (
    <line>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial ref={materialRef} color="#ffffff" transparent opacity={active ? 0.58 : 0.22} />
    </line>
  )
}

function CameraFacingVideoGroup({
  anchor,
  focus,
  children,
  drift = 0,
  frontOffset = 1.25,
  initialPosition = null,
  initialScale = 1,
  positionRef,
}) {
  const { camera } = useThree()
  const groupRef = useRef(null)
  const forwardRef = useRef(new THREE.Vector3())
  const rightRef = useRef(new THREE.Vector3())
  const upRef = useRef(new THREE.Vector3())
  const targetRef = useRef(new THREE.Vector3(...(initialPosition || focus)))

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    const ease = 1 - Math.exp(-6.4 * delta)
    camera.getWorldDirection(forwardRef.current).normalize()
    upRef.current.copy(camera.up).normalize()
    rightRef.current.crossVectors(forwardRef.current, upRef.current).normalize()
    targetRef.current
      .set(focus[0], focus[1], focus[2])
      .addScaledVector(rightRef.current, anchor[0])
      .addScaledVector(upRef.current, anchor[1] + Math.sin(elapsed * 0.86 + drift) * 0.07)
      .addScaledVector(forwardRef.current, -frontOffset)

    groupRef.current.position.lerp(targetRef.current, ease)
    const breatheScale = 1 + Math.sin(elapsed * 1.05 + drift) * 0.018
    groupRef.current.scale.x += (breatheScale - groupRef.current.scale.x) * ease
    groupRef.current.scale.y += (breatheScale - groupRef.current.scale.y) * ease
    groupRef.current.scale.z += (breatheScale - groupRef.current.scale.z) * ease
    groupRef.current.rotation.set(
      Math.sin(elapsed * 0.36 + drift) * 0.012,
      Math.cos(elapsed * 0.44 + drift) * 0.014,
      0,
    )

    const targetPosition = positionRef?.current || positionRef
    if (targetPosition) {
      targetPosition.copy(groupRef.current.position)
    }
  })

  return (
    <group ref={groupRef} position={initialPosition || focus} scale={[initialScale, initialScale, initialScale]}>
      {children}
    </group>
  )
}

function FlagMark({ countryCode, position = [-0.31, 0, 0.04], scale = [0.16, 0.105, 1] }) {
  if (countryCode === 'KR') {
    return (
      <group position={position} scale={scale}>
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[1, 0.66]} />
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[-0.035, 0, 0.018]}>
          <circleGeometry args={[0.18, 32, 0, Math.PI]} />
          <meshBasicMaterial color="#cd2e3a" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0.035, 0, 0.019]} rotation={[0, 0, Math.PI]}>
          <circleGeometry args={[0.18, 32, 0, Math.PI]} />
          <meshBasicMaterial color="#0047a0" side={THREE.DoubleSide} />
        </mesh>
      </group>
    )
  }

  if (countryCode === 'US') {
    return (
      <group position={position} scale={scale}>
        <mesh>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        {Array.from({ length: 7 }).map((_, index) => (
          <mesh key={`us-stripe-${index}`} position={[0, 0.43 - index * 0.143, 0.004]}>
            <planeGeometry args={[1, 0.072]} />
            <meshBasicMaterial color="#d72828" />
          </mesh>
        ))}
        <mesh position={[-0.27, 0.24, 0.008]} scale={[0.46, 0.46, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#174a9c" />
        </mesh>
        {Array.from({ length: 9 }).map((_, index) => (
          <mesh
            key={`us-star-${index}`}
            position={[-0.42 + (index % 3) * 0.14, 0.38 - Math.floor(index / 3) * 0.13, 0.012]}
          >
            <circleGeometry args={[0.018, 8]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        ))}
      </group>
    )
  }

  if (countryCode === 'CN') {
    return (
      <group position={position} scale={scale}>
        <mesh>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color="#de2910" />
        </mesh>
        <mesh position={[-0.28, 0.22, 0.008]}>
          <circleGeometry args={[0.07, 10]} />
          <meshBasicMaterial color="#ffde00" />
        </mesh>
        {[
          [-0.08, 0.34],
          [0.02, 0.2],
          [0.03, 0.04],
          [-0.08, -0.1],
        ].map(([x, y], index) => (
          <mesh key={`cn-star-${index}`} position={[x, y, 0.012]}>
            <circleGeometry args={[0.028, 8]} />
            <meshBasicMaterial color="#ffde00" />
          </mesh>
        ))}
      </group>
    )
  }

  return null
}

function SurfaceAnchor({ angle, y = 0, radius = 1.045, children }) {
  return (
    <group
      position={[Math.sin(angle) * radius, y, Math.cos(angle) * radius]}
      rotation={[0, angle, 0]}
    >
      {children}
    </group>
  )
}

function CurvedTextLine({ text, y, span = 0.72, radius = 1.055, fontSize = 0.11, color = '#f7f9ff' }) {
  const letters = Array.from(text)
  const lastIndex = Math.max(letters.length - 1, 1)

  return letters.map((letter, index) => {
    if (letter === ' ') {
      return null
    }

    const angle = (index / lastIndex - 0.5) * span

    return (
      <SurfaceAnchor key={`${text}-${letter}-${index}`} angle={angle} y={y} radius={radius}>
        <Text
          fontSize={fontSize}
          anchorX="center"
          anchorY="middle"
          color={color}
          fontWeight={950}
          outlineWidth={0.012}
          outlineColor="#0c2d68"
          outlineOpacity={0.62}
        >
          {letter}
        </Text>
      </SurfaceAnchor>
    )
  })
}

function SurfaceTextLine({
  text,
  angle = 0,
  y = 0,
  radius = 1.08,
  fontSize = 0.08,
  maxWidth = 0.78,
  color = '#f8fbff',
  anchorX = 'center',
}) {
  if (!text) {
    return null
  }

  return (
    <SurfaceAnchor angle={angle} y={y} radius={radius}>
      <Text
        fontSize={fontSize}
        maxWidth={maxWidth}
        textAlign="left"
        anchorX={anchorX}
        anchorY="middle"
        color={color}
        fontWeight={950}
        outlineWidth={0.018}
        outlineColor="rgba(5, 22, 54, 0.82)"
      >
        {text}
      </Text>
    </SurfaceAnchor>
  )
}

function splitTextLines(text, maxChars = 9, maxLines = 3) {
  const source = String(text || '').trim()

  if (!source) {
    return []
  }

  const words = source.split(/\s+/)
  const lines = []
  let currentLine = ''

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word

    if (nextLine.length <= maxChars) {
      currentLine = nextLine
      return
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    if (word.length > maxChars) {
      for (let index = 0; index < word.length; index += maxChars) {
        lines.push(word.slice(index, index + maxChars))
      }
      currentLine = ''
      return
    }

    currentLine = word
  })

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.slice(0, maxLines)
}

function getVideoThumbnailSource(node) {
  if (node?.thumbnailUrl) {
    return node.thumbnailUrl
  }

  if (node?.videoId) {
    return `https://i.ytimg.com/vi/${node.videoId}/mqdefault.jpg`
  }

  return ''
}

function createCountrySphereTexture(countryCode) {
  if (!countryCode) {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 512
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  if (countryCode === 'KR') {
    context.fillStyle = '#f8fbff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#cd2e3a'
    context.beginPath()
    context.arc(canvas.width * 0.5, canvas.height * 0.5, 68, 0, Math.PI)
    context.fill()
    context.fillStyle = '#0047a0'
    context.beginPath()
    context.arc(canvas.width * 0.5, canvas.height * 0.5, 68, Math.PI, Math.PI * 2)
    context.fill()
    context.fillStyle = '#111827'
    ;[
      [0.24, 0.25],
      [0.76, 0.25],
      [0.24, 0.75],
      [0.76, 0.75],
    ].forEach(([x, y]) => {
      context.save()
      context.translate(canvas.width * x, canvas.height * y)
      context.rotate(x < 0.5 ? -0.58 : 0.58)
      for (let index = -1; index <= 1; index += 1) {
        context.fillRect(-38, index * 18 - 4, 76, 8)
      }
      context.restore()
    })
  } else if (countryCode === 'US') {
    const stripeHeight = canvas.height / 13
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)

    for (let index = 0; index < 13; index += 1) {
      if (index % 2 === 0) {
        context.fillStyle = '#b31b34'
        context.fillRect(0, index * stripeHeight, canvas.width, stripeHeight)
      }
    }

    const cantonWidth = canvas.width * 0.42
    const cantonHeight = stripeHeight * 7
    context.fillStyle = '#17345f'
    context.fillRect(0, 0, cantonWidth, cantonHeight)
    context.fillStyle = '#ffffff'

    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 6; column += 1) {
        context.beginPath()
        context.arc(
          cantonWidth * (0.1 + column * 0.16),
          cantonHeight * (0.14 + row * 0.18),
          7,
          0,
          Math.PI * 2,
        )
        context.fill()
      }
    }
  } else if (countryCode === 'CN') {
    context.fillStyle = '#de2910'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ffde00'
    context.beginPath()
    context.arc(canvas.width * 0.2, canvas.height * 0.25, 42, 0, Math.PI * 2)
    context.fill()

    ;[
      [0.33, 0.14, 16],
      [0.4, 0.24, 14],
      [0.4, 0.37, 14],
      [0.32, 0.47, 14],
    ].forEach(([x, y, radius]) => {
      context.beginPath()
      context.arc(canvas.width * x, canvas.height * y, radius, 0, Math.PI * 2)
      context.fill()
    })
  } else {
    return null
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.needsUpdate = true

  return texture
}

function createGeneratedVideoThumbnailTexture(node) {
  const canvas = document.createElement('canvas')
  canvas.width = 768
  canvas.height = 432
  const context = canvas.getContext('2d')

  if (!context) {
    return null
  }

  const countryCode = node?.countryCode || 'US'
  const accentColor = countryCode === 'CN' ? '#de2910' : countryCode === 'KR' ? '#0047a0' : '#3182f6'
  const secondaryColor = countryCode === 'CN' ? '#ffde00' : countryCode === 'KR' ? '#cd2e3a' : '#77d9d5'
  const title = String(node?.title || 'Related news video')

  const background = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  background.addColorStop(0, '#071b36')
  background.addColorStop(0.55, accentColor)
  background.addColorStop(1, '#dcecff')
  context.fillStyle = background
  context.fillRect(0, 0, canvas.width, canvas.height)

  context.fillStyle = 'rgba(255, 255, 255, 0.18)'
  for (let index = 0; index < 8; index += 1) {
    context.beginPath()
    context.arc(90 + index * 95, 74 + (index % 3) * 42, 34 + (index % 2) * 16, 0, Math.PI * 2)
    context.fill()
  }

  context.fillStyle = 'rgba(3, 18, 40, 0.56)'
  context.fillRect(0, canvas.height * 0.58, canvas.width, canvas.height * 0.42)

  context.fillStyle = secondaryColor
  context.fillRect(0, 0, canvas.width, 18)
  context.fillStyle = 'rgba(255, 255, 255, 0.92)'
  context.font = '900 46px Arial, sans-serif'
  context.fillText(countryCode === 'CN' ? 'CHINA NEWS' : countryCode === 'KR' ? 'KOREA NEWS' : 'US NEWS', 42, 82)

  context.fillStyle = '#ffffff'
  context.font = '900 38px Arial, sans-serif'
  const words = title.split(/\s+/).slice(0, 8)
  const firstLine = words.slice(0, 4).join(' ')
  const secondLine = words.slice(4, 8).join(' ')
  context.fillText(firstLine || 'Related coverage', 42, 310)
  if (secondLine) {
    context.fillText(secondLine, 42, 358)
  }

  context.fillStyle = 'rgba(255, 255, 255, 0.92)'
  context.beginPath()
  context.arc(canvas.width - 92, canvas.height - 82, 42, 0, Math.PI * 2)
  context.fill()
  context.fillStyle = accentColor
  context.beginPath()
  context.moveTo(canvas.width - 104, canvas.height - 106)
  context.lineTo(canvas.width - 104, canvas.height - 58)
  context.lineTo(canvas.width - 64, canvas.height - 82)
  context.closePath()
  context.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true

  return texture
}

function VideoThumbnailPlate({ node }) {
  const texture = useMemo(() => createGeneratedVideoThumbnailTexture(node), [node])
  const geometry = useMemo(() => {
    const radius = 1.108
    const centerAngle = 0
    const angleSpan = 1.12
    const yCenter = 0.34
    const height = 0.44
    const columns = 24
    const rows = 8
    const positions = []
    const uvs = []
    const indices = []

    for (let row = 0; row <= rows; row += 1) {
      const v = row / rows
      const y = yCenter + (0.5 - v) * height

      for (let column = 0; column <= columns; column += 1) {
        const u = column / columns
        const angle = centerAngle + (u - 0.5) * angleSpan
        const horizontalRadius = Math.sqrt(Math.max(radius * radius - y * y, 0))

        positions.push(
          Math.sin(angle) * horizontalRadius,
          y,
          Math.cos(angle) * horizontalRadius,
        )
        uvs.push(u, 1 - v)
      }
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const a = row * (columns + 1) + column
        const b = a + 1
        const c = a + columns + 1
        const d = c + 1

        indices.push(a, c, b, b, c, d)
      }
    }

    const nextGeometry = new THREE.BufferGeometry()
    nextGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    nextGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    nextGeometry.setIndex(indices)
    nextGeometry.computeVertexNormals()

    return nextGeometry
  }, [])

  useEffect(() => {
    return () => {
      texture?.dispose()
    }
  }, [texture])

  return (
    <group>
      <mesh geometry={geometry}>
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} side={THREE.DoubleSide} />
        ) : (
          <meshBasicMaterial color="#dce8f8" side={THREE.DoubleSide} />
        )}
      </mesh>
    </group>
  )
}

function CurvedVideoLabel({ node, countryCode }) {
  const country = getCountryMeta(countryCode || node?.countryCode)
  const titleLines = splitTextLines(node?.title, 11, 3)
  const thumbnailSource = getVideoThumbnailSource(node)

  return (
    <group rotation={[0, 0, 0]}>
      <Html
        transform
        sprite
        center
        distanceFactor={5.2}
        position={[0, 0.36, 1.15]}
        className="comparison-graph-page__sphere-thumbnail-wrap"
      >
        <div className="comparison-graph-page__sphere-thumbnail">
          {thumbnailSource ? (
            <YoutubeThumbnail
              src={thumbnailSource}
              youtubeVideoId={node?.videoId}
              alt=""
              placeholder={<span>{country.name}</span>}
            />
          ) : (
            <span>{country.name}</span>
          )}
        </div>
      </Html>
      <SurfaceTextLine
        text={country.name.toUpperCase()}
        angle={0}
        y={-0.08}
        radius={1.13}
        fontSize={0.086}
        maxWidth={0.92}
        color="#cfe2ff"
      />
      {titleLines.map((line, index) => (
        <SurfaceTextLine
          key={`${node?.videoId || node?.id || 'video-title'}-${index}`}
          text={line}
          angle={0}
          y={-0.2 - index * 0.128}
          radius={1.132}
          fontSize={0.102}
          maxWidth={0.98}
          color="#f8fbff"
        />
      ))}
    </group>
  )
}

function CurvedSphereLabel({ label, subLabel = '', selected = false, flagCode = '' }) {
  if (!label) {
    return null
  }

  if (selected) {
    return (
      <group rotation={[0, 0, -0.02]}>
        <CurvedTextLine text="SELECTED" y={0.12} span={0.7} fontSize={0.118} color="#f8fbff" />
        <CurvedTextLine text="VIDEO" y={-0.04} span={0.48} fontSize={0.14} color="#f8fbff" />
        {subLabel ? (
          <CurvedTextLine text="RELATED ISSUE" y={-0.18} span={0.72} fontSize={0.038} color="#dbe8ff" />
        ) : null}
      </group>
    )
  }

  const span = label.length > 8 ? 0.78 : 0.5
  const flagAngle = -span / 2 - 0.12

  return (
    <group rotation={[0, 0, flagCode === 'CN' ? 0.01 : -0.01]}>
      {flagCode ? (
        <SurfaceAnchor angle={flagAngle} y={-0.02} radius={1.06}>
          <FlagMark countryCode={flagCode} position={[0, 0, 0.012]} scale={[0.18, 0.118, 1]} />
        </SurfaceAnchor>
      ) : null}
      <CurvedTextLine
        text={label}
        y={-0.02}
        span={span}
        fontSize={label.length > 8 ? 0.085 : 0.105}
        color="#f8fbff"
      />
    </group>
  )
}

function degreesToRadians(degrees) {
  return (degrees * Math.PI) / 180
}

function getModelBoundsMetrics(bounds) {
  const size = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ]
  const center = [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ]

  return { size, center }
}

function CountryModelNode({ config, active = false }) {
  const { scene } = useGLTF(config.url)
  const model = useMemo(() => {
    const clonedScene = scene.clone(true)

    clonedScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })

    return clonedScene
  }, [scene])
  const { size, center } = useMemo(() => getModelBoundsMetrics(config.bounds), [config.bounds])
  const targetHeight = active ? config.activeHeight : config.inactiveHeight
  const modelScale = targetHeight / Math.max(size[1], 0.001)
  const baseY = active ? config.activeBaseY : config.inactiveBaseY
  const orientation = config.orientation.map((degrees) => degreesToRadians(degrees))

  return (
    <group rotation={orientation} position={[0, baseY, 0]} scale={[modelScale, modelScale, modelScale]}>
      <primitive object={model} position={[-center[0], -config.bounds.min[1], -center[2]]} />
    </group>
  )
}

function BackgroundSceneModel() {
  const { scene } = useGLTF(COMPARISON_BACKGROUND_MODEL_CONFIG.url)
  const groupRef = useRef(null)
  const model = useMemo(() => {
    const clonedScene = scene.clone(true)

    clonedScene.traverse((child) => {
      if (!child.isMesh) {
        return
      }

      child.castShadow = false
      child.receiveShadow = false
      child.renderOrder = -1

      if (!child.material) {
        return
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      const fadedMaterials = materials.map((material) => {
        const clonedMaterial = material.clone()
        clonedMaterial.transparent = true
        clonedMaterial.opacity = COMPARISON_BACKGROUND_MODEL_CONFIG.opacity
        clonedMaterial.depthWrite = false
        clonedMaterial.depthTest = true

        if ('roughness' in clonedMaterial) {
          clonedMaterial.roughness = Math.min(0.92, clonedMaterial.roughness + 0.18)
        }

        return clonedMaterial
      })

      child.material = Array.isArray(child.material) ? fadedMaterials : fadedMaterials[0]
    })

    return clonedScene
  }, [scene])
  const { size, center } = useMemo(
    () => getModelBoundsMetrics(COMPARISON_BACKGROUND_MODEL_CONFIG.bounds),
    [],
  )
  const largestHorizontalSize = Math.max(size[0], size[2], 0.001)
  const modelScale = COMPARISON_BACKGROUND_MODEL_CONFIG.targetWidth / largestHorizontalSize
  const orientation = COMPARISON_BACKGROUND_MODEL_CONFIG.orientation.map((degrees) => degreesToRadians(degrees))
  const modelPosition = COMPARISON_BACKGROUND_MODEL_CONFIG.centerOnOrigin
    ? [-center[0], -center[1], -center[2]]
    : [
        -center[0],
        -COMPARISON_BACKGROUND_MODEL_CONFIG.bounds.min[1],
        -center[2],
      ]

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return
    }

    groupRef.current.rotation.x = orientation[0] + Math.sin(clock.getElapsedTime() * 0.16) * 0.035
    groupRef.current.rotation.y = orientation[1] + clock.getElapsedTime() * 0.035
    groupRef.current.rotation.z = orientation[2]
  })

  return (
    <group
      ref={groupRef}
      position={COMPARISON_BACKGROUND_MODEL_CONFIG.position}
      rotation={orientation}
      scale={[modelScale, modelScale, modelScale]}
    >
      <primitive
        object={model}
        position={modelPosition}
      />
      <mesh position={modelPosition} scale={[1.05, 1.05, 1.05]} renderOrder={-2}>
        <sphereGeometry args={[Math.max(size[0], size[1], size[2]) / 2, 64, 64]} />
        <meshBasicMaterial
          color="#76f0ff"
          transparent
          opacity={0.13}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

function WhiteHouseRecommendationModel() {
  const { scene } = useGLTF(WHITE_HOUSE_RECOMMENDATION_MODEL_CONFIG.url)
  const model = useMemo(() => {
    const clonedScene = scene.clone(true)

    clonedScene.traverse((child) => {
      if (!child.isMesh) {
        return
      }

      child.castShadow = false
      child.receiveShadow = false

      if (!child.material) {
        return
      }

      const materials = Array.isArray(child.material) ? child.material : [child.material]
      const softenedMaterials = materials.map((material) => {
        const clonedMaterial = material.clone()
        clonedMaterial.transparent = true
        clonedMaterial.opacity = WHITE_HOUSE_RECOMMENDATION_MODEL_CONFIG.opacity
        clonedMaterial.depthWrite = false

        if ('roughness' in clonedMaterial) {
          clonedMaterial.roughness = Math.min(0.86, clonedMaterial.roughness + 0.12)
        }

        return clonedMaterial
      })

      child.material = Array.isArray(child.material) ? softenedMaterials : softenedMaterials[0]
    })

    return clonedScene
  }, [scene])
  const { size, center } = useMemo(
    () => getModelBoundsMetrics(WHITE_HOUSE_RECOMMENDATION_MODEL_CONFIG.bounds),
    [],
  )
  const modelScale = WHITE_HOUSE_RECOMMENDATION_MODEL_CONFIG.targetWidth / Math.max(size[0], 0.001)
  const orientation = WHITE_HOUSE_RECOMMENDATION_MODEL_CONFIG.orientation.map((degrees) => degreesToRadians(degrees))

  return (
    <group
      position={WHITE_HOUSE_RECOMMENDATION_MODEL_CONFIG.position}
      rotation={orientation}
      scale={[modelScale, modelScale, modelScale]}
    >
      <primitive
        object={model}
        position={[
          -center[0],
          -WHITE_HOUSE_RECOMMENDATION_MODEL_CONFIG.bounds.min[1],
          -center[2],
        ]}
      />
    </group>
  )
}

function ModelNodeLabel({ label, subLabel = '', tone = 'us', active = false }) {
  return (
    <Html
      center
      distanceFactor={5}
      position={[0, active ? -1.88 : -1.58, 0]}
      className={`comparison-graph-page__model-node-label comparison-graph-page__model-node-label--${tone} ${active ? 'comparison-graph-page__model-node-label--active' : ''}`}
    >
      <strong>{label}</strong>
      {subLabel ? <span>{subLabel}</span> : null}
    </Html>
  )
}

function ModelNodeStage({ countryCode = 'US', active = false }) {
  const style = COUNTRY_MODEL_STYLE[countryCode] || COUNTRY_MODEL_STYLE.US

  return (
    <group position={[0, active ? -1.76 : -1.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <torusGeometry args={[active ? 0.94 : 0.74, 0.018, 14, 108]} />
        <meshBasicMaterial color={style.primary} transparent opacity={active ? 0.48 : 0.36} />
      </mesh>
      <mesh scale={[1.28, 1.28, 1.28]}>
        <torusGeometry args={[active ? 0.94 : 0.74, 0.01, 12, 108]} />
        <meshBasicMaterial color={style.secondary} transparent opacity={active ? 0.26 : 0.18} />
      </mesh>
      <mesh position={[0, 0, -0.015]}>
        <circleGeometry args={[active ? 0.66 : 0.52, 72]} />
        <meshBasicMaterial color={style.glow} transparent opacity={active ? 0.13 : 0.09} />
      </mesh>
    </group>
  )
}

function SpatialNode({
  label,
  subLabel = '',
  tone = 'default',
  size = 0.44,
  selected = false,
  flagCode = '',
  videoNode = null,
  onClick,
}) {
  const { camera } = useThree()
  const meshRef = useRef(null)
  const labelRef = useRef(null)
  const sphereCenterRef = useRef(new THREE.Vector3())
  const cameraDirectionRef = useRef(new THREE.Vector3())
  const labelRightRef = useRef(new THREE.Vector3())
  const labelUpRef = useRef(new THREE.Vector3())
  const labelMatrixRef = useRef(new THREE.Matrix4())
  const labelQuaternionRef = useRef(new THREE.Quaternion())
  const modelRotationRef = useRef({ x: 0, y: 0 })
  const modelDragRef = useRef(null)
  const countryTexture = useMemo(
    () => (!videoNode && COMPARISON_COUNTRY_CODES.includes(flagCode) ? createCountrySphereTexture(flagCode) : null),
    [flagCode, videoNode],
  )
  const color =
    tone === 'cn'
      ? '#d84b42'
      : tone === 'us'
        ? '#1d4f9f'
        : selected
          ? '#3182f6'
          : '#8fb8ff'
  const emissive = tone === 'cn' ? '#5a120e' : tone === 'us' ? '#0b2b6c' : '#1b6ee8'
  const modelConfig = !videoNode ? COUNTRY_MODEL_CONFIGS[flagCode] : null

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    const pulse = Math.sin(elapsed * (selected ? 1.45 : 1.15)) * (selected ? 0.032 : 0.018)
    const shimmer = Math.sin(elapsed * 2.3 + size) * (selected ? 0.01 : 0.006)
    const rotationSpeed = modelConfig ? (selected ? 0.86 : 0.64) : selected ? 0.22 : 0.16
    meshRef.current.scale.setScalar(size + pulse + shimmer)
    if (modelConfig) {
      if (!modelDragRef.current) {
        modelRotationRef.current.y += delta * rotationSpeed
      }
      meshRef.current.rotation.y = modelRotationRef.current.y
      meshRef.current.rotation.x = modelRotationRef.current.x + Math.sin(elapsed * 0.46 + size) * 0.018
    } else {
      meshRef.current.rotation.y += delta * rotationSpeed
      meshRef.current.rotation.x = Math.sin(elapsed * 0.46 + size) * 0.028
    }
    if (labelRef.current) {
      meshRef.current.getWorldPosition(sphereCenterRef.current)
      cameraDirectionRef.current.subVectors(camera.position, sphereCenterRef.current).normalize()
      labelUpRef.current.copy(camera.up)
      labelUpRef.current.addScaledVector(
        cameraDirectionRef.current,
        -labelUpRef.current.dot(cameraDirectionRef.current),
      )
      labelUpRef.current.normalize()
      labelRightRef.current.crossVectors(labelUpRef.current, cameraDirectionRef.current).normalize()
      labelMatrixRef.current.makeBasis(labelRightRef.current, labelUpRef.current, cameraDirectionRef.current)
      labelQuaternionRef.current.setFromRotationMatrix(labelMatrixRef.current)
      labelRef.current.quaternion.copy(labelQuaternionRef.current)
    }
  })

  if (modelConfig) {
    const handleModelPointerDown = (event) => {
      event.stopPropagation()
      modelDragRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        rotationX: modelRotationRef.current.x,
        rotationY: modelRotationRef.current.y,
        moved: false,
      }
      event.target.setPointerCapture?.(event.pointerId)
    }
    const handleModelPointerMove = (event) => {
      const dragState = modelDragRef.current

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }

      event.stopPropagation()
      const deltaX = event.clientX - dragState.x
      const deltaY = event.clientY - dragState.y

      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        dragState.moved = true
      }

      modelRotationRef.current.y = dragState.rotationY + deltaX * 0.012
      modelRotationRef.current.x = THREE.MathUtils.clamp(
        dragState.rotationX + deltaY * 0.01,
        -0.58,
        0.58,
      )
    }
    const handleModelPointerUp = (event) => {
      const dragState = modelDragRef.current

      if (!dragState || dragState.pointerId !== event.pointerId) {
        return
      }

      event.stopPropagation()
      modelDragRef.current = null
      event.target.releasePointerCapture?.(event.pointerId)

      if (!dragState.moved) {
        onClick?.(event)
      }
    }

    return (
      <group
        ref={meshRef}
        onPointerDown={handleModelPointerDown}
        onPointerMove={handleModelPointerMove}
        onPointerUp={handleModelPointerUp}
        onPointerCancel={handleModelPointerUp}
      >
        <ModelNodeStage countryCode={flagCode} active={selected} />
        <Suspense fallback={null}>
          <CountryModelNode config={modelConfig} active={selected} />
        </Suspense>
        <ModelNodeLabel label={label} subLabel={subLabel} tone={tone} active={selected} />
      </group>
    )
  }

  return (
    <mesh ref={meshRef} onClick={onClick}>
      <sphereGeometry args={[1, 48, 48]} />
      <meshStandardMaterial
        color={color}
        map={countryTexture}
        emissive={emissive}
        emissiveIntensity={countryTexture ? 0.02 : selected ? 0.12 : 0.06}
        metalness={countryTexture ? 0.42 : 0.58}
        roughness={countryTexture ? 0.28 : 0.18}
        envMapIntensity={countryTexture ? 1.45 : 1.85}
      />
      <group ref={labelRef}>
        {videoNode ? (
          <CurvedVideoLabel node={videoNode} countryCode={videoNode.countryCode || flagCode} />
        ) : (
          <CurvedSphereLabel label={label} subLabel={subLabel} selected={selected} flagCode={flagCode} />
        )}
      </group>
    </mesh>
  )
}

Object.values(COUNTRY_MODEL_CONFIGS).forEach((config) => {
  useGLTF.preload(config.url)
})
useGLTF.preload(COMPARISON_BACKGROUND_MODEL_CONFIG.url)
useGLTF.preload(WHITE_HOUSE_RECOMMENDATION_MODEL_CONFIG.url)

function RecommendationVideoCard({ node, countryCode, onClick }) {
  const country = getCountryMeta(countryCode || node?.countryCode)

  return (
    <Html
      sprite
      center
      distanceFactor={3}
      className="comparison-graph-page__recommendation-card-wrap"
    >
      <button
        className={`comparison-graph-page__recommendation-card comparison-graph-page__recommendation-card--${country.tone}`}
        type="button"
        onClick={() => openYoutubeVideo(node)}
      >
        <div className="comparison-graph-page__recommendation-thumb">
          <YoutubeThumbnail
            src={node.thumbnailUrl}
            youtubeVideoId={node.videoId}
            alt={node.title}
            placeholder={<div className="comparison-graph-page__recommendation-placeholder" />}
          />
        </div>
        <div className="comparison-graph-page__recommendation-copy">
          <strong>{node.title}</strong>
          <span>{node.channelName || `${country.name} News`}</span>
        </div>
        <span
          className="comparison-graph-page__recommendation-compare"
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.stopPropagation()
            onClick(node)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              event.stopPropagation()
              onClick(node)
            }
          }}
        >
          <span className="comparison-graph-page__recommendation-compare-label">비교 보기</span>
          <span className="comparison-graph-page__recommendation-compare-label comparison-graph-page__recommendation-compare-label--hover">
            비교 하기
          </span>
        </span>
      </button>
    </Html>
  )
}

function SelectedVideoCard({ video }) {
  const country = getCountryMeta(video?.countryCode)

  return (
    <Html
      sprite
      center
      distanceFactor={3}
      className="comparison-graph-page__recommendation-card-wrap"
    >
      <button
        className={`comparison-graph-page__recommendation-card comparison-graph-page__recommendation-card--${country.tone}`}
        type="button"
        onClick={() => openYoutubeVideo(video)}
      >
        <div className="comparison-graph-page__recommendation-thumb">
          <YoutubeThumbnail
            src={video?.thumbnailUrl}
            youtubeVideoId={video?.videoId}
            alt={video?.title || '선택 영상'}
            placeholder={<div className="comparison-graph-page__recommendation-placeholder" />}
          />
        </div>
        <div className="comparison-graph-page__recommendation-copy">
          <strong>{video?.title || '선택한 영상'}</strong>
          <span>{video?.channelName || `${country.name} News`}</span>
        </div>
      </button>
    </Html>
  )
}

function createFallbackComparisonInsight({ selectedVideo, comparedVideo, relationEdge }) {
  const selectedCountry = getCountryMeta(selectedVideo?.countryCode)
  const comparedCountry = getCountryMeta(comparedVideo?.countryCode)
  const sharedKeywords = relationEdge?.keywords?.length ? relationEdge.keywords.join(', ') : '트럼프, 대만'

  return {
    summary: `${selectedCountry.localName} 영상은 "${selectedVideo?.title || '원본 영상'}"의 맥락을 중심으로 이슈를 설명하고, ${comparedCountry.localName} 영상은 "${comparedVideo?.title || '비교 영상'}" 관점에서 같은 이슈를 다룹니다. 두 영상은 ${sharedKeywords} 키워드를 공유하지만, 강조하는 국가적 이해관계와 표현 톤이 다릅니다.`,
    points: [
      `${selectedCountry.localName} 영상의 초점: ${selectedVideo?.focusKeywords?.slice(0, 3).join(', ') || '선택 영상의 제목/키워드 맥락'}`,
      `${comparedCountry.localName} 영상의 초점: ${comparedVideo?.focusKeywords?.slice(0, 3).join(', ') || '비교 영상의 제목/키워드 맥락'}`,
      relationEdge?.reasons?.[0] || '두 영상은 같은 이슈를 서로 다른 국가 관점에서 설명합니다.',
    ],
    recommendationReason: relationEdge?.reasons?.join(' ') || '공유 키워드와 국가별 관점 차이를 기준으로 비교 대상으로 연결했습니다.',
  }
}

function WhiteHouseStagePreview({ node }) {
  const thumbnailSource = getVideoThumbnailSource(node) || mockComparisonThumbnail
  const texture = useLoader(THREE.TextureLoader, thumbnailSource, (loader) => {
    loader.setCrossOrigin('anonymous')
  })
  const displayTexture = useMemo(() => {
    const nextTexture = texture.clone()
    nextTexture.colorSpace = THREE.SRGBColorSpace
    nextTexture.anisotropy = 8
    nextTexture.needsUpdate = true

    return nextTexture
  }, [texture])
  const title = String(node?.title || 'Related news video')

  useEffect(() => {
    return () => {
      displayTexture.dispose()
    }
  }, [displayTexture])

  return (
    <group position={[0, 0.34, 0.44]}>
      <mesh>
        <planeGeometry args={[0.82, 0.46]} />
        <meshBasicMaterial
          map={displayTexture}
          toneMapped={false}
          transparent
          opacity={0.98}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Text
        position={[0, -0.31, 0.018]}
        fontSize={0.075}
        maxWidth={0.86}
        textAlign="center"
        anchorX="center"
        anchorY="top"
        color="#182033"
        fontWeight={950}
        outlineWidth={0.018}
        outlineColor="rgba(255, 255, 255, 0.94)"
      >
        {title}
      </Text>
    </group>
  )
}

function WhiteHouseRecommendationStage({ node, onClick }) {
  const stageRef = useRef(null)
  const rotationRef = useRef({ x: 0, y: 0 })
  const dragRef = useRef(null)

  useFrame(() => {
    if (!stageRef.current) {
      return
    }

    stageRef.current.rotation.x = rotationRef.current.x
    stageRef.current.rotation.y = rotationRef.current.y
  })

  const beginDrag = (pointerId, clientX, clientY, source = 'stage') => {
    dragRef.current = {
      pointerId,
      source,
      x: clientX,
      y: clientY,
      rotationX: rotationRef.current.x,
      rotationY: rotationRef.current.y,
      moved: false,
    }
  }

  const updateDrag = (pointerId, clientX, clientY) => {
    const dragState = dragRef.current

    if (!dragState || dragState.pointerId !== pointerId) {
      return
    }

    const deltaX = clientX - dragState.x
    const deltaY = clientY - dragState.y

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      dragState.moved = true
    }

    rotationRef.current.y = dragState.rotationY + deltaX * 0.012
    rotationRef.current.x = THREE.MathUtils.clamp(
      dragState.rotationX + deltaY * 0.01,
      -0.52,
      0.52,
    )
  }

  const endDrag = (pointerId) => {
    const dragState = dragRef.current

    if (!dragState || dragState.pointerId !== pointerId) {
      return null
    }

    dragRef.current = null

    return dragState
  }

  const handleStagePointerDown = (event) => {
    event.stopPropagation()
    beginDrag(event.pointerId, event.clientX, event.clientY)
    event.target.setPointerCapture?.(event.pointerId)
  }

  const handleStagePointerMove = (event) => {
    if (!dragRef.current) {
      return
    }

    event.stopPropagation()
    updateDrag(event.pointerId, event.clientX, event.clientY)
  }

  const handleStagePointerUp = (event) => {
    const dragState = endDrag(event.pointerId)

    if (!dragState) {
      return
    }

    event.stopPropagation()
    event.target.releasePointerCapture?.(event.pointerId)

    if (!dragState.moved) {
      onClick(node)
    }
  }

  return (
    <group
      ref={stageRef}
      onPointerDown={handleStagePointerDown}
      onPointerMove={handleStagePointerMove}
      onPointerUp={handleStagePointerUp}
      onPointerCancel={handleStagePointerUp}
    >
      <Suspense fallback={null}>
        <WhiteHouseRecommendationModel />
      </Suspense>
      <WhiteHouseStagePreview node={node} />
    </group>
  )
}

function getCountryVideos(graphData, countryCode) {
  const selectedVideoId = graphData.selectedVideo.videoId
  const videos = graphData.nodes.filter(
    (node) => node.countryCode === countryCode && node.videoId !== selectedVideoId && Number(node.durationSeconds || 61) > 60,
  )

  return videos.length
    ? videos.slice(0, COMPARISON_RECOMMENDATION_LIMIT)
    : graphData.nodes
        .filter((node) => node.videoId !== selectedVideoId && Number(node.durationSeconds || 61) > 60)
        .slice(0, COMPARISON_RECOMMENDATION_LIMIT)
}

function ComparisonGraph({ graphData, onCompareVideo }) {
  const [activeCountryCode, setActiveCountryCode] = useState('')
  const [revealedCountryCode, setRevealedCountryCode] = useState('')
  const [visibleNodeCount, setVisibleNodeCount] = useState(0)
  const selectedVideo = graphData.selectedVideo
  const selectedCountryCode = selectedVideo?.countryCode || 'KR'
  const [leftCountryCode, , rightCountryCode] = getSelectedCenteredCountryCodes(selectedCountryCode)
  const sideCountryCodes = [leftCountryCode, rightCountryCode]
  const activeCountryVideos = revealedCountryCode ? getCountryVideos(graphData, revealedCountryCode) : []
  const visibleCountryVideos = activeCountryVideos.slice(0, visibleNodeCount)
  const selectedPosition = [0, 0.82, 0.36]
  const leftCountryPosition = activeCountryCode === leftCountryCode ? [-1.2, -0.1, -0.72] : [-1.65, -0.72, 0.24]
  const rightCountryPosition = activeCountryCode === rightCountryCode ? [1.2, -0.1, -0.72] : [1.65, -0.72, 0.24]
  const sideCountryPositions = {
    [leftCountryCode]: leftCountryPosition,
    [rightCountryCode]: rightCountryPosition,
  }
  const activeCountryPosition = sideCountryPositions[activeCountryCode] || selectedPosition
  const videoAnchorSide = revealedCountryCode === rightCountryCode ? 1 : -1
  const videoAnchors =
    revealedCountryCode === 'US'
      ? [
          [videoAnchorSide * 1.86, 0.76],
          [videoAnchorSide * 0.48, 0.82],
          [videoAnchorSide * 1.82, -0.74],
        ]
      : [
          [videoAnchorSide * 1.05, 0.68],
          [videoAnchorSide * 2.28, 0.68],
          [videoAnchorSide * 1.05, -0.92],
        ]
  const videoPositionRefs = useMemo(
    () => visibleCountryVideos.map(() => new THREE.Vector3(...activeCountryPosition)),
    [activeCountryPosition, visibleCountryVideos],
  )

  const handleCountryClick = (countryCode) => {
    const nextCountryCode = activeCountryCode === countryCode ? '' : countryCode
    setRevealedCountryCode('')
    setVisibleNodeCount(0)
    setActiveCountryCode(nextCountryCode)
  }

  useEffect(() => {
    if (!activeCountryCode) {
      return undefined
    }

    let revealInterval = null
    const revealTimer = window.setTimeout(() => {
      setRevealedCountryCode(activeCountryCode)
      revealInterval = window.setInterval(() => {
        setVisibleNodeCount((currentCount) => {
          const nextCount = Math.min(currentCount + 1, COMPARISON_RECOMMENDATION_LIMIT)

          if (nextCount >= COMPARISON_RECOMMENDATION_LIMIT && revealInterval) {
            window.clearInterval(revealInterval)
          }

          return nextCount
        })
      }, 170)
    }, 720)

    return () => {
      window.clearTimeout(revealTimer)
      if (revealInterval) {
        window.clearInterval(revealInterval)
      }
    }
  }, [activeCountryCode])

  return (
    <div className={`comparison-graph-page__map ${activeCountryCode ? 'comparison-graph-page__map--expanded' : ''}`}>
      <Canvas
        camera={{ position: [0, 0.25, 6.4], fov: 40 }}
        className="comparison-graph-page__canvas"
        dpr={[1, 1.8]}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight color="#ffffff" intensity={1.7} position={[3.4, 4.2, 4]} />
        <pointLight color="#8fb8ff" intensity={8} position={[-3.8, 0.6, 2.8]} />
        <pointLight color="#ffffff" intensity={4} position={[3.2, -1.8, 3.2]} />
        <CameraRig activeCountryCode={activeCountryCode} activePosition={activeCountryPosition} />
        <Suspense fallback={null}>
          <BackgroundSceneModel />
        </Suspense>
        <SpatialPointCloud />
        <ClusterFocusRings
          activeCountryCode={activeCountryCode}
          position={activeCountryPosition}
        />
        {sideCountryCodes.map((countryCode) => (
          <GraphConnector
            key={`country-connector-${countryCode}`}
            from={selectedPosition}
            to={sideCountryPositions[countryCode]}
            active={activeCountryCode === countryCode}
          />
        ))}
        {visibleCountryVideos.map((node, index) => {
          const countryPosition = sideCountryPositions[revealedCountryCode] || activeCountryPosition

          return (
            <CameraFacingConnector
              key={`connector-${revealedCountryCode}-${node.videoId || node.id}`}
              from={countryPosition}
              toRef={videoPositionRefs[index]}
              active
            />
          )
        })}

        <MovingGroup position={selectedPosition} drift={0} isActive={Boolean(activeCountryCode)}>
          <SelectedVideoCard
            video={selectedVideo}
          />
        </MovingGroup>

        {sideCountryCodes.map((countryCode, index) => {
          const country = getCountryMeta(countryCode)
          const isActiveCountry = activeCountryCode === countryCode
          const isOtherCountryActive = activeCountryCode && !isActiveCountry
          const inactivePosition = index === 0 ? [-1.9, -0.95, -1.18] : [1.9, -0.95, -1.18]

          return (
            <MovingGroup
              key={`country-node-${countryCode}`}
              position={isOtherCountryActive ? inactivePosition : sideCountryPositions[countryCode]}
              drift={index === 0 ? 1.2 : 2.4}
              isActive={Boolean(activeCountryCode)}
            >
                <SpatialNode
                  label={country.name.toUpperCase()}
                  subLabel={isActiveCountry ? '관련 영상' : ''}
                  tone={country.tone}
                  flagCode={countryCode}
                  size={isActiveCountry ? 0.48 : 0.42}
                selected={isActiveCountry}
                onClick={() => handleCountryClick(countryCode)}
              />
            </MovingGroup>
          )
        })}

        {visibleCountryVideos.map((node, index) => {
          const countryPosition = sideCountryPositions[revealedCountryCode] || activeCountryPosition

          return (
            <CameraFacingVideoGroup
              key={`${revealedCountryCode}-${node.videoId || node.id}`}
              anchor={videoAnchors[index]}
              focus={countryPosition}
              initialPosition={countryPosition}
              initialScale={0.18}
              drift={index * 0.72 + 3}
              positionRef={videoPositionRefs[index]}
            >
              <RecommendationVideoCard
                node={{ ...node, countryCode: revealedCountryCode }}
                countryCode={revealedCountryCode}
                onClick={onCompareVideo}
              />
            </CameraFacingVideoGroup>
          )
        })}

        <Environment preset="city" />
      </Canvas>
    </div>
  )
}

function getComparisonExpressionGroups(video) {
  return {
    focusKeywords: (Array.isArray(video?.focusKeywords) ? video.focusKeywords : [])
      .filter((keyword) => getKeywordText(keyword))
      .slice(0, MAX_COMPARISON_EXPRESSION_KEYWORDS),
    emotionKeywords: (Array.isArray(video?.emotionKeywords) ? video.emotionKeywords : [])
      .filter((keyword) => getKeywordText(keyword))
      .slice(0, MAX_COMPARISON_EXPRESSION_KEYWORDS),
  }
}

function getComparisonExpressionFallbacks({ video, graphData, relationEdge, isSelectedVideo }) {
  const expressionGroups = getComparisonExpressionGroups(video)
  const fallbackFocusKeywords = [
    ...(isSelectedVideo ? graphData?.mainKeywords || [] : []),
    ...(relationEdge?.keywords || []),
    ...(graphData?.sharedKeywords || []),
  ].filter(Boolean)
  const fallbackEmotionKeywords = isSelectedVideo && graphData?.isMock ? ['긴장', '압박', '우려'] : []

  return {
    focusKeywords: expressionGroups.focusKeywords.length
      ? expressionGroups.focusKeywords
      : fallbackFocusKeywords.slice(0, MAX_COMPARISON_EXPRESSION_KEYWORDS),
    emotionKeywords: expressionGroups.emotionKeywords.length
      ? expressionGroups.emotionKeywords
      : fallbackEmotionKeywords.slice(0, MAX_COMPARISON_EXPRESSION_KEYWORDS),
  }
}

function findComparisonEdge(graphData, comparedVideo) {
  const selectedVideo = graphData?.selectedVideo

  if (!selectedVideo || !comparedVideo) {
    return null
  }

  const selectedIds = new Set([selectedVideo.id, selectedVideo.videoId].filter(Boolean).map(String))
  const comparedIds = new Set([comparedVideo.id, comparedVideo.videoId].filter(Boolean).map(String))

  return graphData.edges.find((edge) => {
    const source = String(edge.source || '')
    const target = String(edge.target || '')

    return (
      (selectedIds.has(source) && comparedIds.has(target)) ||
      (selectedIds.has(target) && comparedIds.has(source))
    )
  }) || null
}

function ComparisonVideoModalCard({ video, title, relationEdge = null, graphData = null }) {
  const country = getCountryMeta(video?.countryCode)
  const { focusKeywords, emotionKeywords } = getComparisonExpressionFallbacks({
    video,
    graphData,
    relationEdge,
    isSelectedVideo: video?.videoId === graphData?.selectedVideo?.videoId,
  })

  return (
    <article className={`comparison-graph-page__compare-card comparison-graph-page__compare-card--${country.tone}`}>
      <header className="comparison-graph-page__compare-card-head">
        <span className={`country-compare-page__country-badge country-compare-page__country-badge--${country.tone}`}>
          {country.localName}
        </span>
        <strong>{title}</strong>
      </header>

      <button
        className="comparison-graph-page__compare-thumb"
        type="button"
        onClick={() => openYoutubeVideo(video)}
        aria-label={`${video?.title || title} 유튜브에서 열기`}
      >
        <YoutubeThumbnail
          src={video?.thumbnailUrl}
          youtubeVideoId={video?.videoId}
          alt={video?.title || title}
          placeholder={<div className="comparison-graph-page__recommendation-placeholder" />}
        />
      </button>

      <div className="comparison-graph-page__compare-copy">
        <strong>{video?.title || '영상 제목 정보 없음'}</strong>
        <span>{video?.channelName || `${country.name} News`}</span>
      </div>

      <section className="comparison-graph-page__compare-keywords">
        <h4>핵심 표현</h4>
        <div className="comparison-graph-page__compare-keyword-group">
          <div className="comparison-graph-page__compare-keyword-head">
            <strong>중점 키워드</strong>
            <em>{focusKeywords.length}개</em>
          </div>
          {focusKeywords.length ? (
            <div className="comparison-graph-page__compare-keyword-list">
              {focusKeywords.map((keyword, index) => {
                const keywordText = getKeywordText(keyword)
                const keywordMeta = formatFocusKeywordMeta(keyword)

                return (
                  <span
                    key={`${video?.videoId || title}-focus-${keywordText}-${index}`}
                    className="comparison-graph-page__compare-keyword-chip comparison-graph-page__compare-keyword-chip--focus"
                  >
                    <strong>{keywordText}</strong>
                    {keywordMeta ? <em>{keywordMeta}</em> : null}
                  </span>
                )
              })}
            </div>
          ) : (
            <p>중점 키워드가 없습니다.</p>
          )}
        </div>

        <div className="comparison-graph-page__compare-keyword-group">
          <div className="comparison-graph-page__compare-keyword-head">
            <strong>감정 표현</strong>
            <em>{emotionKeywords.length}개</em>
          </div>
          {emotionKeywords.length ? (
            <div className="comparison-graph-page__compare-keyword-list">
              {emotionKeywords.map((keyword, index) => {
                const keywordText = getKeywordText(keyword)

                return (
                  <span
                    key={`${video?.videoId || title}-emotion-${keywordText}-${index}`}
                    className="comparison-graph-page__compare-keyword-chip"
                  >
                    {keywordText}
                  </span>
                )
              })}
            </div>
          ) : (
            <p>감정 표현 키워드가 없습니다.</p>
          )}
        </div>
      </section>
    </article>
  )
}

function mergeVideoAnalysis(video, analysisTarget, analysisResult) {
  if (!video) {
    return video
  }

  const focusKeywords = Array.isArray(analysisResult?.focusKeywords) ? analysisResult.focusKeywords : []
  const emotionKeywords = Array.isArray(analysisResult?.emotionKeywords) ? analysisResult.emotionKeywords : []

  return {
    ...video,
    targetId: analysisTarget?.targetId ?? video.targetId,
    analysisAvailable: analysisTarget?.analysisAvailable ?? video.analysisAvailable,
    analysisUrl: analysisTarget?.analysisUrl || video.analysisUrl,
    focusKeywords: focusKeywords.length ? focusKeywords : video.focusKeywords,
    emotionKeywords: emotionKeywords.length ? emotionKeywords : video.emotionKeywords,
  }
}

async function fetchVideoExpressionAnalysis(video, accessToken) {
  if (!video?.videoId && !video?.targetId) {
    return video
  }

  let analysisTarget = null
  let targetId = video.targetId

  if (video.videoId) {
    try {
      analysisTarget = await fetchComparisonVideoTarget({ videoId: video.videoId, accessToken })
      targetId = analysisTarget?.targetId ?? targetId
    } catch {
      analysisTarget = null
    }
  }

  if (!targetId) {
    return mergeVideoAnalysis(video, analysisTarget, null)
  }

  try {
    const analysisResult = await fetchVideoAnalysisResult(targetId, accessToken)

    return mergeVideoAnalysis(video, analysisTarget, analysisResult)
  } catch {
    return mergeVideoAnalysis(video, analysisTarget, null)
  }
}

function ComparisonVideoModal({ graphData, comparedVideo, accessToken, onClose }) {
  const [comparisonInsight, setComparisonInsight] = useState(null)
  const [analysisVideos, setAnalysisVideos] = useState({ key: '', selected: null, compared: null })

  const relationEdge = findComparisonEdge(graphData, comparedVideo)
  const analysisKey = `${graphData?.selectedVideo?.videoId || graphData?.selectedVideo?.id || ''}:${comparedVideo?.videoId || comparedVideo?.id || ''}`
  const selectedDisplayVideo = analysisVideos.key === analysisKey && analysisVideos.selected
    ? analysisVideos.selected
    : graphData?.selectedVideo
  const comparedDisplayVideo = analysisVideos.key === analysisKey && analysisVideos.compared
    ? analysisVideos.compared
    : comparedVideo
  const displayGraphData = useMemo(() => (
    graphData ? { ...graphData, selectedVideo: selectedDisplayVideo } : graphData
  ), [graphData, selectedDisplayVideo])
  const fallbackInsight = useMemo(() => (
    selectedDisplayVideo && comparedDisplayVideo
      ? createFallbackComparisonInsight({
          selectedVideo: selectedDisplayVideo,
          comparedVideo: comparedDisplayVideo,
          relationEdge,
        })
      : null
  ), [comparedDisplayVideo, relationEdge, selectedDisplayVideo])
  const displayedInsight = comparisonInsight || fallbackInsight

  useEffect(() => {
    if (!graphData?.selectedVideo || !comparedVideo || graphData.isMock) {
      return undefined
    }

    let isCancelled = false
    const nextAnalysisKey = analysisKey

    Promise.all([
      fetchVideoExpressionAnalysis(graphData.selectedVideo, accessToken),
      fetchVideoExpressionAnalysis(comparedVideo, accessToken),
    ]).then(([selected, compared]) => {
      if (!isCancelled) {
        setAnalysisVideos({ key: nextAnalysisKey, selected, compared })
      }
    })

    return () => {
      isCancelled = true
    }
  }, [accessToken, analysisKey, comparedVideo, graphData?.isMock, graphData?.selectedVideo])

  useEffect(() => {
    if (!graphData?.selectedVideo || !comparedVideo) {
      return undefined
    }

    let isCancelled = false

    if (graphData.isMock) {
      return undefined
    }

    requestComparisonInsight({
      selectedVideo: graphData.selectedVideo,
      comparedVideo,
      relationEdge,
      graphData,
      accessToken,
    })
      .then((nextInsight) => {
        if (!isCancelled && (nextInsight.summary || nextInsight.points.length || nextInsight.recommendationReason)) {
          setComparisonInsight(nextInsight)
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setComparisonInsight(null)
        }
      })

    return () => {
      isCancelled = true
    }
  }, [accessToken, comparedVideo, graphData, relationEdge])

  if (!graphData?.selectedVideo || !comparedVideo) {
    return null
  }

  return createPortal(
    <div className="comparison-graph-page__compare-modal" role="presentation" onClick={onClose}>
      <section
        className="comparison-graph-page__compare-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comparison-video-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="comparison-graph-page__compare-close"
          aria-label="비교 영상 모달 닫기"
          onClick={onClose}
        >
          ×
        </button>

        <header className="comparison-graph-page__compare-title">
          <span>영상 비교</span>
          <h2 id="comparison-video-modal-title">원본 영상과 비교 영상</h2>
        </header>

        <div className="comparison-graph-page__compare-grid">
          <ComparisonVideoModalCard
            video={selectedDisplayVideo}
            title="원본 영상"
            relationEdge={relationEdge}
            graphData={displayGraphData}
          />
          <ComparisonVideoModalCard
            video={comparedDisplayVideo}
            title="비교 영상"
            relationEdge={relationEdge}
            graphData={displayGraphData}
          />
        </div>

        <section className="comparison-graph-page__compare-difference">
          <div className="comparison-graph-page__compare-difference-head">
            <h3>LLM 핵심 차이 요약</h3>
            {comparisonInsight ? <span>LLM 응답</span> : <span>기본 요약</span>}
          </div>
          <p>{displayedInsight?.summary || '두 영상이 같은 이슈를 서로 다른 국가 관점에서 다루고 있습니다.'}</p>
          {displayedInsight?.points?.length ? (
            <ul>
              {displayedInsight.points.slice(0, 4).map((point, index) => (
                <li key={`comparison-point-${index}`}>{point}</li>
              ))}
            </ul>
          ) : null}
          {displayedInsight?.recommendationReason ? (
            <div className="comparison-graph-page__compare-reason">
              <strong>비교 대상으로 연결된 이유</strong>
              <p>{displayedInsight.recommendationReason}</p>
            </div>
          ) : null}
        </section>
      </section>
    </div>,
    document.body,
  )
}

export function ComparisonGraphPage({ isLoggedIn, onAuthClick, accessToken, videoId }) {
  const [graphData, setGraphData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [comparisonModalVideo, setComparisonModalVideo] = useState(null)

  useEffect(() => {
    let isCancelled = false

    const loadGraph = async () => {
      setIsLoading(true)
      setErrorMessage('')
      setComparisonModalVideo(null)
      const cachedSelectedVideo = readCachedSelectedComparisonVideo(videoId)

      try {
        if (USE_COMPARISON_MOCK_DATA) {
          setGraphData(createMockComparisonGraph(videoId, cachedSelectedVideo))
          setErrorMessage('테스트용 mock 비교 그래프를 표시합니다.')
          return
        }

        if (cachedSelectedVideo?.analysisStatus === 'MOCK_READY') {
          setGraphData(createMockComparisonGraph(videoId, cachedSelectedVideo))
          setErrorMessage('테스트용 mock 비교 그래프를 표시합니다.')
          return
        }

        const nextGraphData = await fetchComparisonGraph({ videoId, accessToken })

        if (!isCancelled) {
          setGraphData(
            cachedSelectedVideo
              ? {
                  ...nextGraphData,
                  selectedVideo: {
                    ...nextGraphData.selectedVideo,
                    ...cachedSelectedVideo,
                    nodeType: 'selected',
                  },
                }
              : nextGraphData,
          )
        }
      } catch {
        if (!isCancelled) {
          setGraphData(createMockComparisonGraph(videoId, cachedSelectedVideo))
          setErrorMessage('비교 그래프 API가 아직 준비되지 않아 테스트용 mock 그래프를 표시합니다.')
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadGraph()

    return () => {
      isCancelled = true
    }
  }, [videoId, accessToken])

  const selectedVideo = graphData?.selectedVideo
  const country = getCountryMeta(selectedVideo?.countryCode)

  const handleOpenComparisonModal = (node) => {
    if (!node) {
      return
    }

    setComparisonModalVideo(node)
  }

  return (
    <main className="comparison-graph-page">
      <section className="comparison-graph-page__shell">
        <Navbar activeKey="compare" serviceHref="#home" isLoggedIn={isLoggedIn} onAuthClick={onAuthClick} maxWidth="1440px" />

        <div className="comparison-graph-page__topbar">
          <a href="#comparison" className="comparison-graph-page__back-link">비교 홈으로</a>
          <div>
            <span className="country-compare-page__eyebrow">Comparison Knowledge Map</span>
            <h1>{selectedVideo?.title || '국가별 비교 그래프'}</h1>
          </div>
          {selectedVideo ? (
            <div className="comparison-graph-page__badges">
              <span className={`country-compare-page__country-badge country-compare-page__country-badge--${country.tone}`}>
                {country.localName}
              </span>
              <span>{selectedVideo.language || '언어 정보 없음'}</span>
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <StatePanel title="그래프를 구성하는 중입니다" message="선택한 영상과 다른 국가의 관련 영상을 연결하고 있어요." />
        ) : null}

        {!isLoading && errorMessage && !graphData?.isMock ? (
          <StatePanel
            title={graphData?.isMock ? 'Mock 그래프 표시 중' : '그래프를 불러오지 못했습니다'}
            message={errorMessage}
            tone={graphData?.isMock ? 'default' : 'error'}
          />
        ) : null}

        {!isLoading && graphData ? (
          <>
            <section className="comparison-graph-page__keyword-strip">
              <strong>주요 키워드</strong>
              <div className="comparison-graph-page__pill-list">
                {(graphData.mainKeywords.length ? graphData.mainKeywords : graphData.sharedKeywords).slice(0, 8).map((keyword) => (
                  <span key={keyword}>{keyword}</span>
                ))}
                {!graphData.mainKeywords.length && !graphData.sharedKeywords.length ? <span>키워드 정보 없음</span> : null}
              </div>
            </section>

            <section className="comparison-graph-page__workspace">
              <ComparisonGraph
                graphData={graphData}
                onCompareVideo={handleOpenComparisonModal}
              />
            </section>
          </>
        ) : null}

        <ComparisonVideoModal
          graphData={graphData}
          comparedVideo={comparisonModalVideo}
          accessToken={accessToken}
          onClose={() => setComparisonModalVideo(null)}
        />
      </section>
    </main>
  )
}

export default CountryCompare
