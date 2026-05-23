import { Environment, Html, Text } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import Navbar from '../components/Navbar'
import YoutubeThumbnail from '../components/YoutubeThumbnail'
import mockComparisonThumbnail from '../assets/summary.jpg'
import {
  COMPARISON_COUNTRIES,
  fetchComparisonHome,
  fetchComparisonGraph,
  searchComparisonVideos,
} from '../services/comparison'
import './CountryCompare.css'

const countryDisplay = {
  KR: { name: 'Korea', localName: '대한민국', tone: 'kr' },
  US: { name: 'United States', localName: '미국', tone: 'us' },
  CN: { name: 'China', localName: '중국', tone: 'cn' },
}

const COMPARISON_COUNTRY_CODES = ['KR', 'US', 'CN']
const COMPARISON_SELECTED_VIDEO_KEY = 'comparison-selected-video'
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

const fallbackKeywords = ['AI 반도체', '미중 갈등', '기후 정상회의', '전기차 관세', '중동 정세']

function normalizeSearchKeyword(keyword = '') {
  return String(keyword).replace(/^#+/, '').trim()
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  )
}

function formatViewCount(value) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return '조회수 정보 없음'
  }

  return `조회수 ${numberValue.toLocaleString()}`
}

function formatPublishedDate(value, fallback = '게시일 정보 없음') {
  if (!value) {
    return fallback
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
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
  const mockThumbnail = () => mockComparisonThumbnail
  const selectedCountryCode = COMPARISON_COUNTRY_CODES.includes(selectedVideoOverride?.countryCode)
    ? selectedVideoOverride.countryCode
    : 'KR'
  const selectedCountry = getCountryMeta(selectedCountryCode)

  return {
    selectedVideo: {
      id: selectedVideoOverride?.id || selectedVideoId,
      videoId: selectedVideoOverride?.videoId || selectedVideoId,
      title: selectedVideoOverride?.title || '선택한 영상: 같은 이슈를 다룬 국내 보도',
      thumbnailUrl: selectedVideoOverride?.thumbnailUrl || mockThumbnail('dQw4w9WgXcQ'),
      channelName: selectedVideoOverride?.channelName || `Mock ${selectedCountry.name} News`,
      viewCount: selectedVideoOverride?.viewCount ?? 128400,
      publishedAt: selectedVideoOverride?.publishedAt || '2026-05-12T09:00:00Z',
      countryCode: selectedCountryCode,
      countryName: selectedCountry.name,
      countryLocalLabel: selectedCountry.localName,
      language: selectedVideoOverride?.language || (selectedCountryCode === 'KR' ? 'ko' : selectedCountryCode === 'CN' ? 'zh' : 'en'),
      analysisStatus: 'MOCK_READY',
      nodeType: 'selected',
    },
    mainKeywords: ['관세', '반도체', '외교 갈등', '공급망'],
    nodes: [
      {
        id: selectedVideoId,
        videoId: selectedVideoId,
        title: '선택한 영상: 같은 이슈를 다룬 국내 보도',
        thumbnailUrl: mockThumbnail('dQw4w9WgXcQ'),
        countryCode: 'KR',
        language: 'ko',
        nodeType: 'selected',
        analysisStatus: 'MOCK_READY',
      },
      {
        id: 'mock-us-1',
        videoId: 'mock-us-1',
        title: 'US coverage focuses on trade pressure and market impact',
        thumbnailUrl: mockThumbnail('ysz5S6PUM-U'),
        countryCode: 'US',
        language: 'en',
        nodeType: 'related',
        analysisStatus: 'MOCK_READY',
      },
      {
        id: 'mock-cn-1',
        videoId: 'mock-cn-1',
        title: '중국 보도: 기술 자립과 대응 조치를 강조',
        thumbnailUrl: mockThumbnail('aqz-KE-bpKQ'),
        countryCode: 'CN',
        language: 'zh',
        nodeType: 'related',
        analysisStatus: 'MOCK_READY',
      },
      {
        id: 'mock-kr-2',
        videoId: 'mock-kr-2',
        title: '국내 후속 보도: 수출 기업과 소비자 영향 분석',
        thumbnailUrl: mockThumbnail('ScMzIvxBSi4'),
        countryCode: 'KR',
        language: 'ko',
        nodeType: 'related',
        analysisStatus: 'MOCK_READY',
      },
      {
        id: 'mock-us-2',
        videoId: 'mock-us-2',
        title: 'Analysts discuss alliances and semiconductor supply chains',
        thumbnailUrl: mockThumbnail('jNQXAC9IVRw'),
        countryCode: 'US',
        language: 'en',
        nodeType: 'related',
        analysisStatus: 'MOCK_READY',
      },
      {
        id: 'mock-us-3',
        videoId: 'mock-us-3',
        title: 'Inside Washington response to chip export rules',
        thumbnailUrl: mockThumbnail('M7lc1UVf-VE'),
        countryCode: 'US',
        language: 'en',
        nodeType: 'related',
        analysisStatus: 'MOCK_READY',
      },
      {
        id: 'mock-us-4',
        videoId: 'mock-us-4',
        title: 'Markets react as trade talks intensify',
        thumbnailUrl: mockThumbnail('aqz-KE-bpKQ'),
        countryCode: 'US',
        language: 'en',
        nodeType: 'related',
        analysisStatus: 'MOCK_READY',
      },
      {
        id: 'mock-cn-2',
        videoId: 'mock-cn-2',
        title: '중국 관영 매체, 공급망 안정과 기술 독립 강조',
        thumbnailUrl: mockThumbnail('ysz5S6PUM-U'),
        countryCode: 'CN',
        language: 'zh',
        nodeType: 'related',
        analysisStatus: 'MOCK_READY',
      },
      {
        id: 'mock-cn-3',
        videoId: 'mock-cn-3',
        title: '중국 산업계, 반도체 제재 대응 전략 논의',
        thumbnailUrl: mockThumbnail('jNQXAC9IVRw'),
        countryCode: 'CN',
        language: 'zh',
        nodeType: 'related',
        analysisStatus: 'MOCK_READY',
      },
      {
        id: 'mock-cn-4',
        videoId: 'mock-cn-4',
        title: '기술 자립 정책과 글로벌 공급망 변화 분석',
        thumbnailUrl: mockThumbnail('M7lc1UVf-VE'),
        countryCode: 'CN',
        language: 'zh',
        nodeType: 'related',
        analysisStatus: 'MOCK_READY',
      },
    ],
    edges: [
      {
        id: 'mock-edge-1',
        source: selectedVideoId,
        target: 'mock-us-1',
        relationType: 'SAME_ISSUE',
        keywords: ['관세', '시장 영향', '무역 압박'],
        reasons: ['두 영상 모두 정책 변화가 시장에 미치는 영향을 중심으로 설명합니다.'],
        sharedEntities: ['미국 정부', '반도체 기업'],
        sameIssueCluster: '관세와 반도체 공급망 이슈',
        weight: 0.91,
      },
      {
        id: 'mock-edge-2',
        source: selectedVideoId,
        target: 'mock-cn-1',
        relationType: 'COUNTER_PERSPECTIVE',
        keywords: ['기술 자립', '대응 조치', '공급망'],
        reasons: ['한국 보도는 산업 영향, 중국 보도는 대응 전략과 기술 자립을 더 강조합니다.'],
        sharedEntities: ['중국 정부', '반도체 산업'],
        sameIssueCluster: '관세와 반도체 공급망 이슈',
        weight: 0.84,
      },
      {
        id: 'mock-edge-3',
        source: selectedVideoId,
        target: 'mock-kr-2',
        relationType: 'FOLLOW_UP',
        keywords: ['수출 기업', '소비자 영향'],
        reasons: ['같은 국내 관점에서 후속 경제 영향을 더 구체적으로 다룹니다.'],
        sharedEntities: ['수출 기업', '소비자'],
        sameIssueCluster: '관세와 반도체 공급망 이슈',
        weight: 0.78,
      },
      {
        id: 'mock-edge-4',
        source: selectedVideoId,
        target: 'mock-us-2',
        relationType: 'SHARED_ENTITY',
        keywords: ['동맹', '공급망', '반도체'],
        reasons: ['동맹 관계와 공급망 재편이라는 공통 엔티티를 중심으로 연결됩니다.'],
        sharedEntities: ['한국', '미국', '반도체 공급망'],
        sameIssueCluster: '관세와 반도체 공급망 이슈',
        weight: 0.73,
      },
    ],
    connectionReasons: [
      '테스트용 mock 데이터입니다. 백엔드 그래프 API가 준비되면 실제 응답이 우선 표시됩니다.',
      '선택 영상과 관련 국가 보도를 동일 이슈, 반대 관점, 후속 보도 관계로 연결했습니다.',
    ],
    countryPerspectives: [
      { countryCode: 'KR', summary: '한국 관점은 국내 산업과 수출 기업의 직접 영향을 중심으로 설명합니다.' },
      { countryCode: 'US', summary: '미국 관점은 정책 압박, 시장 반응, 동맹 공급망을 강조합니다.' },
      { countryCode: 'CN', summary: '중국 관점은 대응 조치와 기술 자립 프레임을 중심으로 전개됩니다.' },
    ],
    sharedKeywords: ['관세', '반도체', '공급망', '시장 영향'],
    sharedEntities: ['한국', '미국', '중국', '반도체 산업'],
    clusterInfo: {
      id: 'mock-cluster-tariff-chip',
      title: '관세와 반도체 공급망 이슈',
    },
    isMock: true,
  }
}

function getAnalysisRoute(videoId) {
  return `#summary/video/${encodeURIComponent(videoId)}`
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
        <div className="country-compare-page__video-meta">
          <span>{formatViewCount(video.viewCount)}</span>
          <span>{formatPublishedDate(video.publishedAt)}</span>
        </div>
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
        <CountryVideoCarousel section={section} videos={videos.slice(0, 5)} onOpenVideo={onOpenVideo} />
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

function hasSectionVideos(sections = []) {
  return sections.some((section) => Array.isArray(section?.videos) && section.videos.length)
}

function orderSectionsBySelectedCountry(sections = [], selectedCountryCode = 'KR') {
  const byCountry = new Map(sections.map((section) => [section.countryCode, section]))

  return getSelectedCenteredCountryCodes(selectedCountryCode)
    .map((countryCode) => byCountry.get(countryCode))
    .filter(Boolean)
}

function CountryCompare({ isLoggedIn, onAuthClick, accessToken }) {
  const [query, setQuery] = useState('')
  const [activeKeyword, setActiveKeyword] = useState('')
  const [issueKeywords, setIssueKeywords] = useState([])
  const [sections, setSections] = useState(() => normalizeSections([]))
  const [isHomeLoading, setIsHomeLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [resultTitle, setResultTitle] = useState('오늘의 국가별 추천 영상')

  useEffect(() => {
    let isCancelled = false

    const loadHome = async () => {
      setIsHomeLoading(true)
      setErrorMessage('')

      try {
        if (!isLoggedIn) {
          setIssueKeywords(fallbackKeywords)
          setSections(normalizeSections([]))
          setErrorMessage('로그인 후 영상 요약의 방송사 추천 영상을 불러올 수 있습니다.')
          return
        }

        let comparisonHome = null

        try {
          comparisonHome = await fetchComparisonHome({ limit: 5, accessToken })
        } catch {
          for (const keyword of fallbackKeywords) {
            try {
              const searchData = await searchComparisonVideos({ keyword, limit: 5, accessToken })
              const normalizedSearchSections = normalizeSections(searchData.sections)

              if (hasSectionVideos(normalizedSearchSections)) {
                comparisonHome = {
                  issueKeywords: fallbackKeywords,
                  sections: normalizedSearchSections,
                }
                break
              }
            } catch {
              // Try the next fallback keyword when the current pipeline request fails.
            }
          }
        }

        if (isCancelled) {
          return
        }

        if (!comparisonHome) {
          throw new Error('국가별 추천 영상을 불러오지 못했습니다.')
        }

        setIssueKeywords(comparisonHome.issueKeywords.length ? comparisonHome.issueKeywords : fallbackKeywords)
        setSections(normalizeSections(comparisonHome.sections))
      } catch {
        if (!isCancelled) {
          setIssueKeywords(fallbackKeywords)
          setSections(normalizeSections([]))
          setErrorMessage('국가별 추천 영상을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
        }
      } finally {
        if (!isCancelled) {
          setIsHomeLoading(false)
        }
      }
    }

    loadHome()

    return () => {
      isCancelled = true
    }
  }, [accessToken, isLoggedIn])

  const runSearch = async (keyword) => {
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
      const searchData = await searchComparisonVideos({ keyword: trimmedKeyword, limit: 5, accessToken })
      setSections(normalizeSections(searchData.sections))
    } catch {
      setSections(normalizeSections([]))
      setErrorMessage('검색 결과를 불러오지 못했습니다. 키워드를 바꾸거나 다시 시도해 주세요.')
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    runSearch(query)
  }

  const handleOpenVideo = (videoId, video = null) => {
    if (!videoId) {
      return
    }

    if (video) {
      cacheSelectedComparisonVideo(video)
    }

    goToHashRoute(`comparison/graph/${encodeURIComponent(videoId)}`)
  }

  const hasAnyVideos = sections.some((section) => section.videos.length)
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

            {!isLoading && !hasAnyVideos ? (
              <StatePanel title="표시할 영상이 없습니다" message="오늘의 추천 영상 또는 검색 결과가 아직 준비되지 않았습니다." />
            ) : null}

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
    const dotCount = 900
    const nextPositions = new Float32Array(dotCount * 3)

    for (let index = 0; index < dotCount; index += 1) {
      const t = index / dotCount
      const angle = t * Math.PI * 16
      const tunnel = 1.2 + t * 3.4
      const wave = Math.sin(t * Math.PI * 10) * 0.45
      const jitter = (Math.sin(index * 12.9898) * 43758.5453 % 1 - 0.5) * 0.34
      const radius = 0.42 + Math.sin(t * Math.PI * 6) * 0.18 + jitter

      nextPositions[index * 3] = Math.cos(angle) * (radius + wave) + Math.cos(t * Math.PI * 2) * 1.2
      nextPositions[index * 3 + 1] = Math.sin(angle) * radius + Math.sin(t * Math.PI * 3) * 0.7
      nextPositions[index * 3 + 2] = -tunnel + Math.sin(angle * 0.7) * 0.8
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
        color="#ffffff"
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.28}
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
          outlineColor="rgba(12, 45, 104, 0.62)"
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
    return `https://i.ytimg.com/vi/${node.videoId}/hqdefault.jpg`
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
            <img src={thumbnailSource} alt="" draggable="false" />
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

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    const pulse = Math.sin(elapsed * (selected ? 1.45 : 1.15)) * (selected ? 0.032 : 0.018)
    const shimmer = Math.sin(elapsed * 2.3 + size) * (selected ? 0.01 : 0.006)
    meshRef.current.scale.setScalar(size + pulse + shimmer)
    meshRef.current.rotation.y += delta * (selected ? 0.22 : 0.16)
    meshRef.current.rotation.x = Math.sin(elapsed * 0.46 + size) * 0.028
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
        className="comparison-graph-page__recommendation-card"
        type="button"
        onClick={() => onClick(node)}
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
          <em>{formatViewCount(node.viewCount)} · {formatPublishedDate(node.publishedAt, '게시일 정보 없음')}</em>
        </div>
      </button>
    </Html>
  )
}

function getCountryVideos(graphData, countryCode) {
  const selectedVideoId = graphData.selectedVideo.videoId
  const videos = graphData.nodes.filter(
    (node) => node.countryCode === countryCode && node.videoId !== selectedVideoId,
  )

  return videos.length ? videos : graphData.nodes.filter((node) => node.videoId !== selectedVideoId).slice(0, 3)
}

function ComparisonGraph({ graphData, onNodeOpen, onCompareVideo }) {
  const [activeCountryCode, setActiveCountryCode] = useState('')
  const [revealedCountryCode, setRevealedCountryCode] = useState('')
  const [visibleNodeCount, setVisibleNodeCount] = useState(0)
  const selectedVideo = graphData.selectedVideo
  const selectedCountryCode = selectedVideo?.countryCode || 'KR'
  const [leftCountryCode, , rightCountryCode] = getSelectedCenteredCountryCodes(selectedCountryCode)
  const sideCountryCodes = [leftCountryCode, rightCountryCode]
  const activeCountryVideos = revealedCountryCode ? getCountryVideos(graphData, revealedCountryCode).slice(0, 4) : []
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
  const videoAnchors = [
    [videoAnchorSide * 1.05, 0.92],
    [videoAnchorSide * 2.28, 0.92],
    [videoAnchorSide * 1.05, -0.92],
    [videoAnchorSide * 2.28, -0.92],
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
          const nextCount = Math.min(currentCount + 1, 4)

          if (nextCount >= 4 && revealInterval) {
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
        <SpatialPointCloud />
        <ClusterFocusRings
          activeCountryCode={activeCountryCode}
          position={activeCountryPosition}
        />
        <ActiveLightMarker
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
          <SpatialNode
            label="SELECTED VIDEO"
            subLabel={selectedVideo.title}
            size={0.52}
            selected
            onClick={() => onNodeOpen(selectedVideo.videoId)}
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
                subLabel={isActiveCountry ? 'RELATED FEED' : 'CLICK'}
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

function ComparisonVideoModalCard({ video, title }) {
  const country = getCountryMeta(video?.countryCode)
  const { focusKeywords, emotionKeywords } = getComparisonExpressionGroups(video)

  return (
    <article className={`comparison-graph-page__compare-card comparison-graph-page__compare-card--${country.tone}`}>
      <header className="comparison-graph-page__compare-card-head">
        <span className={`country-compare-page__country-badge country-compare-page__country-badge--${country.tone}`}>
          {country.localName}
        </span>
        <strong>{title}</strong>
      </header>

      <div className="comparison-graph-page__compare-thumb">
        <YoutubeThumbnail
          src={video?.thumbnailUrl}
          youtubeVideoId={video?.videoId}
          alt={video?.title || title}
          placeholder={<div className="comparison-graph-page__recommendation-placeholder" />}
        />
      </div>

      <div className="comparison-graph-page__compare-copy">
        <strong>{video?.title || '영상 제목 정보 없음'}</strong>
        <span>{video?.channelName || `${country.name} News`}</span>
        <em>{formatViewCount(video?.viewCount)} · {formatPublishedDate(video?.publishedAt, '게시일 정보 없음')}</em>
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

function ComparisonVideoModal({ graphData, comparedVideo, onClose }) {
  if (!graphData?.selectedVideo || !comparedVideo) {
    return null
  }

  const relationEdge = findComparisonEdge(graphData, comparedVideo)
  const differenceText =
    relationEdge?.reasons?.[0] ||
    relationEdge?.relationType ||
    '두 영상이 같은 이슈를 서로 다른 국가 관점에서 다루고 있습니다.'

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
            video={graphData.selectedVideo}
            title="원본 영상"
            relationEdge={relationEdge}
            graphData={graphData}
          />
          <ComparisonVideoModalCard
            video={comparedVideo}
            title="비교 영상"
            relationEdge={relationEdge}
            graphData={graphData}
          />
        </div>

        <section className="comparison-graph-page__compare-difference">
          <h3>핵심 차이</h3>
          <p>{differenceText}</p>
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

  const handleOpenNode = (nextVideoId) => {
    if (!nextVideoId) {
      return
    }

    goToHashRoute(getAnalysisRoute(nextVideoId))
  }

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

        {!isLoading && errorMessage ? (
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
                onNodeOpen={handleOpenNode}
                onCompareVideo={handleOpenComparisonModal}
              />
            </section>
          </>
        ) : null}

        <ComparisonVideoModal
          graphData={graphData}
          comparedVideo={comparisonModalVideo}
          onClose={() => setComparisonModalVideo(null)}
        />
      </section>
    </main>
  )
}

export default CountryCompare
