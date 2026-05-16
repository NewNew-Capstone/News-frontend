import { Environment, Html, Text } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import Navbar from '../components/Navbar'
import YoutubeThumbnail from '../components/YoutubeThumbnail'
import mockComparisonThumbnail from '../assets/summary.jpg'
import {
  COMPARISON_COUNTRIES,
  fetchComparisonGraph,
  normalizeComparisonVideo,
  searchComparisonVideos,
} from '../services/comparison'
import { fetchRecommendedChannelVideos } from '../services/youtube'
import './CountryCompare.css'

const countryDisplay = {
  KR: { name: 'Korea', localName: '대한민국', tone: 'kr' },
  US: { name: 'United States', localName: '미국', tone: 'us' },
  CN: { name: 'China', localName: '중국', tone: 'cn' },
}

const fallbackKeywords = ['AI 반도체', '미중 갈등', '기후 정상회의', '전기차 관세', '중동 정세']

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

function getCountryMeta(countryCode = '') {
  return countryDisplay[countryCode] || {
    name: countryCode || 'Unknown',
    localName: countryCode || '기타',
    tone: 'other',
  }
}

function createMockComparisonGraph(videoId) {
  const selectedVideoId = videoId || 'mock-selected-video'
  const mockThumbnail = () => mockComparisonThumbnail

  return {
    selectedVideo: {
      id: selectedVideoId,
      videoId: selectedVideoId,
      title: '선택한 영상: 같은 이슈를 다룬 국내 보도',
      thumbnailUrl: mockThumbnail('dQw4w9WgXcQ'),
      channelName: 'Mock Korea News',
      viewCount: 128400,
      publishedAt: '2026-05-12T09:00:00Z',
      countryCode: 'KR',
      countryName: 'Korea',
      countryLocalLabel: '대한민국',
      language: 'ko',
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
      {displayKeywords.slice(0, 5).map((keyword) => (
        <button
          key={keyword}
          className={activeKeyword === keyword ? 'country-compare-page__issue-chip country-compare-page__issue-chip--active' : 'country-compare-page__issue-chip'}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(keyword)}
        >
          #{keyword}
        </button>
      ))}
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

    onOpenVideo(video.videoId)
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

function createRecommendedSectionsFromSummaryVideos(videos = []) {
  const normalizedVideos = videos
    .map((video, index) => normalizeComparisonVideo(video, index))
    .filter((video) => video.videoId)
    .slice(0, 5)

  return COMPARISON_COUNTRIES.map((country) => ({
    ...country,
    countryCode: country.code,
    videos: normalizedVideos.map((video) => ({
      ...video,
      countryCode: country.code,
      countryName: country.label,
      countryLocalLabel: country.localLabel,
    })),
  }))
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

        const recommendedVideos = await fetchRecommendedChannelVideos(accessToken)

        if (isCancelled) {
          return
        }

        setIssueKeywords(fallbackKeywords)
        setSections(createRecommendedSectionsFromSummaryVideos(recommendedVideos))
      } catch {
        if (!isCancelled) {
          setIssueKeywords(fallbackKeywords)
          setSections(normalizeSections([]))
          setErrorMessage('영상 요약의 방송사 추천 영상을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
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
    const trimmedKeyword = keyword.trim()

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

  const handleOpenVideo = (videoId) => {
    if (!videoId) {
      return
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
              {sections.map((section) => (
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

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color={active ? '#ffffff' : '#6f7683'} transparent opacity={active ? 0.72 : 0.32} />
    </line>
  )
}

function SpatialReferenceGrid() {
  return (
    <group position={[0, -1.42, -1.1]}>
      <gridHelper args={[7.4, 18, '#9bc4ff', '#cfe1ff']} />
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([-3.6, 0.01, 0, 3.6, 0.01, 0]), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#3182f6" transparent opacity={0.42} />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([0, 0.01, -3.6, 0, 0.01, 3.6]), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#6da9ff" transparent opacity={0.32} />
      </line>
    </group>
  )
}

function ClusterFocusRings({ activeCountryCode, position }) {
  const groupRef = useRef(null)

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    groupRef.current.rotation.z = elapsed * 0.18
    groupRef.current.scale.setScalar(1 + Math.sin(elapsed * 1.4) * 0.025)
  })

  if (!activeCountryCode) {
    return null
  }

  const color = activeCountryCode === 'US' ? '#3182f6' : '#6da9ff'

  return (
    <group ref={groupRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <torusGeometry args={[1.15, 0.012, 10, 120]} />
        <meshBasicMaterial color={color} transparent opacity={0.36} />
      </mesh>
      <mesh scale={[1.42, 1.42, 1.42]}>
        <torusGeometry args={[1.15, 0.008, 10, 120]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
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
    markerRef.current.position.x = position[0] + Math.cos(elapsed * 1.1) * 0.28
    markerRef.current.position.y = position[1] + 0.72 + Math.sin(elapsed * 1.1) * 0.12
    markerRef.current.position.z = position[2] + Math.sin(elapsed * 0.9) * 0.28
  })

  if (!activeCountryCode) {
    return null
  }

  const color = activeCountryCode === 'US' ? '#3182f6' : '#6da9ff'

  return (
    <group ref={markerRef} position={[position[0], position[1] + 0.72, position[2]]}>
      <pointLight color={color} intensity={20} distance={5.2} />
      <mesh>
        <sphereGeometry args={[0.055, 18, 18]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

function CameraRig({ activeCountryCode }) {
  const { camera } = useThree()
  const eyeRef = useRef(new THREE.Vector3(0, 0.25, 6.4))
  const lookAtRef = useRef(new THREE.Vector3(0, -0.05, -0.65))
  const upRef = useRef(new THREE.Vector3(0, 1, 0))

  useFrame(() => {
    const focus =
      activeCountryCode === 'US'
        ? new THREE.Vector3(-1.24, -0.18, -1.02)
        : activeCountryCode === 'CN'
          ? new THREE.Vector3(1.24, -0.18, -1.02)
          : new THREE.Vector3(0, -0.05, -0.65)
    const yaw = activeCountryCode === 'US' ? -0.72 : activeCountryCode === 'CN' ? 0.72 : 0
    const pitch = activeCountryCode ? 0.24 : 0.04
    const distance = activeCountryCode ? 5.95 : 6.42
    const roll = activeCountryCode === 'US' ? 0.16 : activeCountryCode === 'CN' ? -0.16 : 0
    const targetEye = new THREE.Vector3(
      focus.x + Math.sin(yaw) * Math.cos(pitch) * distance,
      focus.y + Math.sin(pitch) * distance + 0.12,
      focus.z + Math.cos(yaw) * Math.cos(pitch) * distance,
    )
    const targetUp = new THREE.Vector3(Math.sin(roll), Math.cos(roll), 0).normalize()

    eyeRef.current.lerp(targetEye, 0.028)
    lookAtRef.current.lerp(focus, 0.036)
    upRef.current.lerp(targetUp, 0.04).normalize()
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

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    groupRef.current.position.lerp(
      {
        x: position[0],
        y: position[1] + Math.sin(elapsed * 0.68 + drift) * (isActive ? 0.045 : 0.015),
        z: position[2],
      },
      0.06,
    )
    groupRef.current.scale.x += (1 - groupRef.current.scale.x) * 0.075
    groupRef.current.scale.y += (1 - groupRef.current.scale.y) * 0.075
    groupRef.current.scale.z += (1 - groupRef.current.scale.z) * 0.075
    groupRef.current.rotation.set(0, 0, 0)
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

  useFrame(() => {
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
  })

  return (
    <line>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffffff" transparent opacity={active ? 0.58 : 0.22} />
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

  useFrame(({ clock }) => {
    if (!groupRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    camera.getWorldDirection(forwardRef.current).normalize()
    upRef.current.copy(camera.up).normalize()
    rightRef.current.crossVectors(forwardRef.current, upRef.current).normalize()
    targetRef.current
      .set(focus[0], focus[1], focus[2])
      .addScaledVector(rightRef.current, anchor[0])
      .addScaledVector(upRef.current, anchor[1] + Math.sin(elapsed * 0.68 + drift) * 0.035)
      .addScaledVector(forwardRef.current, -frontOffset)

    groupRef.current.position.lerp(targetRef.current, 0.075)
    groupRef.current.scale.x += (1 - groupRef.current.scale.x) * 0.075
    groupRef.current.scale.y += (1 - groupRef.current.scale.y) * 0.075
    groupRef.current.scale.z += (1 - groupRef.current.scale.z) * 0.075
    groupRef.current.rotation.set(0, 0, 0)

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

  if (countryCode === 'US') {
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
  const accentColor = countryCode === 'CN' ? '#de2910' : '#3182f6'
  const secondaryColor = countryCode === 'CN' ? '#ffde00' : '#77d9d5'
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
  context.fillText(countryCode === 'CN' ? 'CHINA NEWS' : 'US NEWS', 42, 82)

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
  const texture = useMemo(() => createGeneratedVideoThumbnailTexture(node), [node?.countryCode, node?.title, node?.videoId])
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
    () => (!videoNode && (flagCode === 'US' || flagCode === 'CN') ? createCountrySphereTexture(flagCode) : null),
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

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return
    }

    const elapsed = clock.getElapsedTime()
    meshRef.current.scale.setScalar(size + Math.sin(elapsed * 1.3) * (selected ? 0.018 : 0.01))
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
        onClick={() => onClick(node.videoId)}
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

function ComparisonGraph({ graphData, onNodeOpen }) {
  const [activeCountryCode, setActiveCountryCode] = useState('')
  const [revealedCountryCode, setRevealedCountryCode] = useState('')
  const [visibleNodeCount, setVisibleNodeCount] = useState(0)
  const selectedVideo = graphData.selectedVideo
  const activeCountryVideos = revealedCountryCode ? getCountryVideos(graphData, revealedCountryCode).slice(0, 4) : []
  const visibleCountryVideos = activeCountryVideos.slice(0, visibleNodeCount)
  const videoPositionRefs = useRef([])
  const selectedPosition = [0, 0.82, 0.36]
  const usPosition = activeCountryCode === 'US' ? [-1.2, -0.1, -0.72] : [-1.65, -0.72, 0.24]
  const cnPosition = activeCountryCode === 'CN' ? [1.2, -0.1, -0.72] : [1.65, -0.72, 0.24]
  const inactiveCountryPosition = activeCountryCode === 'US' ? [1.9, -0.95, -1.18] : [-1.9, -0.95, -1.18]
  const videoAnchorSide = revealedCountryCode === 'CN' ? 1 : -1
  const videoAnchors = [
    [videoAnchorSide * 0.85, 0.7],
    [videoAnchorSide * 1.85, 0.7],
    [videoAnchorSide * 0.85, -0.7],
    [videoAnchorSide * 1.85, -0.7],
  ]

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
        <CameraRig activeCountryCode={activeCountryCode} />
        <SpatialReferenceGrid />
        <SpatialPointCloud />
        <ClusterFocusRings
          activeCountryCode={activeCountryCode}
          position={activeCountryCode === 'CN' ? cnPosition : usPosition}
        />
        <ActiveLightMarker
          activeCountryCode={activeCountryCode}
          position={activeCountryCode === 'CN' ? cnPosition : usPosition}
        />
        <GraphConnector from={selectedPosition} to={usPosition} active={activeCountryCode === 'US'} />
        <GraphConnector from={selectedPosition} to={cnPosition} active={activeCountryCode === 'CN'} />
        {visibleCountryVideos.map((node, index) => {
          const countryPosition = revealedCountryCode === 'CN' ? cnPosition : usPosition
          if (!videoPositionRefs.current[index]) {
            videoPositionRefs.current[index] = new THREE.Vector3(...countryPosition)
          }

          return (
            <CameraFacingConnector
              key={`connector-${revealedCountryCode}-${node.videoId || node.id}`}
              from={countryPosition}
              toRef={videoPositionRefs.current[index]}
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

        <MovingGroup position={activeCountryCode && activeCountryCode !== 'US' ? inactiveCountryPosition : usPosition} drift={1.2} isActive={Boolean(activeCountryCode)}>
          <SpatialNode
            label="UNITED STATES"
            subLabel={activeCountryCode === 'US' ? 'RELATED FEED' : 'CLICK'}
            tone="us"
            flagCode="US"
            size={activeCountryCode === 'US' ? 0.48 : 0.42}
            selected={activeCountryCode === 'US'}
            onClick={() => handleCountryClick('US')}
          />
        </MovingGroup>

        <MovingGroup position={activeCountryCode && activeCountryCode !== 'CN' ? inactiveCountryPosition : cnPosition} drift={2.4} isActive={Boolean(activeCountryCode)}>
          <SpatialNode
            label="CHINA"
            subLabel={activeCountryCode === 'CN' ? 'RELATED FEED' : 'CLICK'}
            tone="cn"
            flagCode="CN"
            size={activeCountryCode === 'CN' ? 0.48 : 0.42}
            selected={activeCountryCode === 'CN'}
            onClick={() => handleCountryClick('CN')}
          />
        </MovingGroup>

        {visibleCountryVideos.map((node, index) => {
          const countryPosition = revealedCountryCode === 'CN' ? cnPosition : usPosition
          if (!videoPositionRefs.current[index]) {
            videoPositionRefs.current[index] = new THREE.Vector3(...countryPosition)
          }

          return (
            <CameraFacingVideoGroup
              key={`${revealedCountryCode}-${node.videoId || node.id}`}
              anchor={videoAnchors[index]}
              focus={countryPosition}
              initialPosition={countryPosition}
              initialScale={0.18}
              drift={index * 0.72 + 3}
              positionRef={videoPositionRefs.current[index]}
            >
              <RecommendationVideoCard
                node={{ ...node, countryCode: revealedCountryCode }}
                countryCode={revealedCountryCode}
                onClick={onNodeOpen}
              />
            </CameraFacingVideoGroup>
          )
        })}

        <Environment preset="city" />
      </Canvas>
    </div>
  )
}

export function ComparisonGraphPage({ isLoggedIn, onAuthClick, accessToken, videoId }) {
  const [graphData, setGraphData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isCancelled = false

    const loadGraph = async () => {
      setIsLoading(true)
      setErrorMessage('')

      try {
        const nextGraphData = await fetchComparisonGraph({ videoId, accessToken })

        if (!isCancelled) {
          setGraphData(nextGraphData)
        }
      } catch {
        if (!isCancelled) {
          setGraphData(createMockComparisonGraph(videoId))
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
              />
            </section>
          </>
        ) : null}
      </section>
    </main>
  )
}

export default CountryCompare
