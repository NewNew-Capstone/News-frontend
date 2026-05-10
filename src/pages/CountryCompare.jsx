import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Navbar from '../components/Navbar'
import RotatingArticleCarousel from '../components/RotatingArticleCarousel'
import YoutubeThumbnail from '../components/YoutubeThumbnail'
import { fetchIssueComparison, fetchIssueSearchResults } from '../services/issues'
import { fetchRecommendedChannelVideos } from '../services/youtube'
import './CountryCompare.css'

const countryOptions = [
  { code: 'KR', label: '한국', languageLabel: '한국어' },
  { code: 'JP', label: '일본', languageLabel: '일본어' },
  { code: 'US', label: '미국', languageLabel: '영어' },
  { code: 'CN', label: '중국', languageLabel: '중국어' },
]

const countryMap = Object.fromEntries(countryOptions.map((country) => [country.code, country]))

const periodOptions = [
  { id: '7d', label: '최근 7일' },
  { id: '30d', label: '최근 30일' },
  { id: '90d', label: '최근 90일' },
]

function pickFirst(source, keys, fallback = '') {
  for (const key of keys) {
    const value = source?.[key]

    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return fallback
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣]/g, '')
}

function formatPublishedDate(value) {
  if (!value) {
    return '날짜 정보 없음'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}.${month}.${day}`
}

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) {
    return ''
  }

  if (startDate && endDate) {
    return `${formatPublishedDate(startDate)} - ${formatPublishedDate(endDate)}`
  }

  return formatPublishedDate(startDate || endDate)
}

function formatViewCount(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return ''
  }

  return `조회수 ${value.toLocaleString()}`
}

function formatScore(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '분석 전'
  }

  return value.toFixed(2)
}

function buildMetaText(video) {
  const channelName = pickFirst(video, ['channelName', 'channelTitle', 'channel', 'publisher'])
  const rawViewCount = pickFirst(video, ['viewCount', 'views', 'view_count'], null)
  const numericViewCount =
    typeof rawViewCount === 'number'
      ? rawViewCount
      : typeof rawViewCount === 'string'
        ? Number(rawViewCount)
        : null

  return [channelName, formatViewCount(numericViewCount)].filter(Boolean).join(' · ') || '채널 정보 없음'
}

function createVideoCard(video, index) {
  const youtubeVideoId = pickFirst(video, ['youtubeVideoId', 'videoId', 'id'], '')
  const id = pickFirst(
    video,
    ['youtubeVideoId', 'videoId', 'id', 'originalUrl', 'url'],
    `compare-video-${index + 1}`,
  )

  return {
    id,
    youtubeVideoId: youtubeVideoId || id,
    title: pickFirst(video, ['title', 'videoTitle', 'name'], '영상 제목 정보가 없습니다.'),
    description: pickFirst(video, ['description', 'summaryDescription', 'content']),
    date: formatPublishedDate(
      pickFirst(video, ['publishedAt', 'publishedDate', 'published_at', 'uploadDate']),
    ),
    image: pickFirst(video, ['thumbnailUrl', 'thumbnail', 'thumbnailURL', 'thumbUrl', 'imageUrl']),
    reporter: buildMetaText(video),
  }
}

function createRecommendedSections(videos) {
  const grouped = videos.reduce((map, video, index) => {
    const channelName = pickFirst(
      video,
      ['channelName', 'channelTitle', 'channel', 'publisher'],
      '추천',
    )
    const sectionId = `compare-${slugify(channelName) || index + 1}`

    if (!map.has(sectionId)) {
      map.set(sectionId, { id: sectionId, name: `${channelName} 추천 영상`, articles: [] })
    }

    map.get(sectionId).articles.push(createVideoCard(video, index))
    return map
  }, new Map())

  return Array.from(grouped.values()).slice(0, 4)
}

function createFallbackSections() {
  return ['연합뉴스', 'SBS', 'MBC', 'KBS'].map((channelName, sectionIndex) => ({
    id: `fallback-${sectionIndex + 1}`,
    name: `${channelName} 추천 영상`,
    articles: Array.from({ length: 4 }, (_, articleIndex) => ({
      id: `${channelName}-${articleIndex + 1}`,
      youtubeVideoId: '',
      title: `${channelName} 국제 이슈 추천 영상`,
      description: '비교할 국제 이슈와 관련된 추천 영상을 이곳에 표시합니다.',
      date: '2026.04.01',
      image: '',
      reporter: `${channelName} 뉴스`,
    })),
  }))
}

function normalizeSearchResultItem(result, index) {
  const countryCode = pickFirst(result, ['countryCode'], 'KR')
  const country = countryMap[countryCode]
  const youtubeVideoId = pickFirst(result, ['youtubeVideoId', 'videoId'], '')

  return {
    id: `${countryCode}-${youtubeVideoId || index + 1}`,
    countryCode,
    countryName: country?.label || countryCode,
    youtubeVideoId,
    title: pickFirst(result, ['title'], '영상 제목 정보가 없습니다.'),
    channelName: pickFirst(result, ['channelName'], '채널 정보 없음'),
    image: pickFirst(result, ['thumbnailUrl'], ''),
    publishedAt: formatPublishedDate(pickFirst(result, ['publishedAt'])),
    similarityScore: pickFirst(result, ['similarityScore'], null),
    isRepresentative: Boolean(result?.isRepresentative),
  }
}

function groupSearchResultsByCountry(results, selectedCountryCodes) {
  const grouped = new Map(selectedCountryCodes.map((countryCode) => [countryCode, []]))

  results.forEach((result, index) => {
    const normalizedResult = normalizeSearchResultItem(result, index)

    if (!grouped.has(normalizedResult.countryCode)) {
      grouped.set(normalizedResult.countryCode, [])
    }

    grouped.get(normalizedResult.countryCode).push(normalizedResult)
  })

  return Array.from(grouped.entries())
    .map(([countryCode, articles]) => ({
      id: `issue-result-${countryCode}`,
      countryCode,
      countryName: countryMap[countryCode]?.label || countryCode,
      articles: articles.sort((left, right) => Number(right.isRepresentative) - Number(left.isRepresentative)),
    }))
    .filter((section) => section.articles.length)
}

function buildComparisonQuery(results, selectedCountryCodes) {
  const entries = selectedCountryCodes
    .map((countryCode) => {
      const representativeResult =
        results.find(
          (result) => result.countryCode === countryCode && result.youtubeVideoId && result.isRepresentative,
        ) || results.find((result) => result.countryCode === countryCode && result.youtubeVideoId)

      return representativeResult ? [countryCode, representativeResult.youtubeVideoId] : null
    })
    .filter(Boolean)

  return Object.fromEntries(entries)
}

function getComparisonKeywords(countries) {
  const keywords = countries.flatMap((country) =>
    Array.isArray(country?.comparison?.coreKeywords) ? country.comparison.coreKeywords : [],
  )

  return [...new Set(keywords.filter(Boolean))]
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6 18 18M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function ChevronIcon({ direction = 'right' }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: direction === 'left' ? 'rotate(180deg)' : 'none' }}>
      <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  )
}

function CaretIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 10 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

function CountryCompare({ isLoggedIn, onAuthClick }) {
  const railRefs = useRef({})
  const [activeModal, setActiveModal] = useState(null)
  const [selectedCountryCodes, setSelectedCountryCodes] = useState(['KR', 'US'])
  const [draftCountryCodes, setDraftCountryCodes] = useState(['KR', 'US'])
  const [selectedPeriodId, setSelectedPeriodId] = useState('30d')
  const [draftPeriodId, setDraftPeriodId] = useState('30d')
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [recommendationSections, setRecommendationSections] = useState(createFallbackSections())
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [recommendationMessage, setRecommendationMessage] = useState('')
  const [issueSearchResult, setIssueSearchResult] = useState(null)
  const [comparisonResult, setComparisonResult] = useState(null)
  const [isSearchingIssues, setIsSearchingIssues] = useState(false)
  const [isLoadingComparison, setIsLoadingComparison] = useState(false)
  const [issueMessage, setIssueMessage] = useState('')
  const [comparisonMessage, setComparisonMessage] = useState('')

  useEffect(() => {
    if (!activeModal) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setActiveModal(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeModal])

  useEffect(() => {
    if (!activeModal) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [activeModal])

  useEffect(() => {
    let isCancelled = false

    const loadRecommendations = async () => {
      if (!isLoggedIn) {
        setRecommendationSections(createFallbackSections())
        setRecommendationMessage('로그인하면 방송사별 추천 영상을 불러올 수 있습니다.')
        return
      }

      setIsLoadingRecommendations(true)
      setRecommendationMessage('')

      try {
        const videos = await fetchRecommendedChannelVideos()

        if (isCancelled) {
          return
        }

        const nextSections = createRecommendedSections(videos)
        setRecommendationSections(nextSections.length ? nextSections : createFallbackSections())
        setRecommendationMessage(nextSections.length ? '' : '표시할 추천 영상이 아직 없습니다.')
      } catch (error) {
        if (isCancelled) {
          return
        }

        setRecommendationSections(createFallbackSections())
        setRecommendationMessage(
          error instanceof Error ? error.message : '추천 영상을 불러오지 못했습니다.',
        )
      } finally {
        if (!isCancelled) {
          setIsLoadingRecommendations(false)
        }
      }
    }

    loadRecommendations()

    return () => {
      isCancelled = true
    }
  }, [isLoggedIn])

  const selectedCountries = selectedCountryCodes.map((countryCode) => countryMap[countryCode]?.label || countryCode)
  const selectedPeriod =
    periodOptions.find((period) => period.id === selectedPeriodId) || periodOptions[1]

  const groupedSearchSections = useMemo(
    () => groupSearchResultsByCountry(issueSearchResult?.results || [], selectedCountryCodes),
    [issueSearchResult, selectedCountryCodes],
  )

  const comparisonCountries = comparisonResult?.countries || []
  const comparisonKeywords = useMemo(
    () => getComparisonKeywords(comparisonCountries),
    [comparisonCountries],
  )

  const resetSearchState = () => {
    setSubmittedQuery('')
    setIssueSearchResult(null)
    setComparisonResult(null)
    setIssueMessage('')
    setComparisonMessage('')
    setIsSearchingIssues(false)
    setIsLoadingComparison(false)
  }

  const openCountryModal = () => {
    setDraftCountryCodes(selectedCountryCodes)
    setActiveModal('countries')
  }

  const openPeriodModal = () => {
    setDraftPeriodId(selectedPeriodId)
    setActiveModal('period')
  }

  const closeModal = () => {
    setActiveModal(null)
  }

  const handleToggleCountry = (countryCode) => {
    setDraftCountryCodes((currentCountryCodes) => {
      if (currentCountryCodes.includes(countryCode)) {
        return currentCountryCodes.filter((item) => item !== countryCode)
      }

      if (currentCountryCodes.length >= 2) {
        return currentCountryCodes
      }

      return [...currentCountryCodes, countryCode]
    })
  }

  const handleApplyCountries = () => {
    if (!draftCountryCodes.length) {
      return
    }

    setSelectedCountryCodes(draftCountryCodes)
    resetSearchState()
    closeModal()
  }

  const handleApplyPeriod = () => {
    setSelectedPeriodId(draftPeriodId)
    resetSearchState()
    closeModal()
  }

  const handleOpenVideo = (youtubeVideoId) => {
    if (!youtubeVideoId) {
      return
    }

    window.location.hash = `#summary/video/${encodeURIComponent(youtubeVideoId)}`
  }

  const handleScrollRail = (sectionId, direction) => {
    const rail = railRefs.current[sectionId]

    if (!rail) {
      return
    }

    rail.scrollBy({
      left: (direction === 'left' ? -1 : 1) * rail.clientWidth * 0.86,
      behavior: 'smooth',
    })
  }

  const handleSearchSubmit = async (event) => {
    event.preventDefault()

    const trimmedQuery = query.trim()

    if (!trimmedQuery) {
      resetSearchState()
      return
    }

    setSubmittedQuery(trimmedQuery)
    setIssueMessage('')
    setComparisonMessage('')
    setIssueSearchResult(null)
    setComparisonResult(null)
    setIsSearchingIssues(true)

    try {
      const searchPayload = await fetchIssueSearchResults({
        searchKeyword: trimmedQuery,
        countries: selectedCountryCodes.join(','),
        period: selectedPeriodId,
      })

      setIssueSearchResult(searchPayload)

      const normalizedSections = groupSearchResultsByCountry(searchPayload.results, selectedCountryCodes)

      if (!normalizedSections.length) {
        setIssueMessage('검색 조건에 맞는 국가별 이슈 영상을 찾지 못했습니다.')
        return
      }

      const comparisonQuery = buildComparisonQuery(searchPayload.results, selectedCountryCodes)

      if (Object.keys(comparisonQuery).length < 2) {
        setComparisonMessage('비교할 대표 영상이 충분하지 않아 비교 결과를 만들지 못했습니다.')
        return
      }

      setIsLoadingComparison(true)

      try {
        const comparisonPayload = await fetchIssueComparison(comparisonQuery)
        setComparisonResult(comparisonPayload)

        if (!comparisonPayload.countries.length) {
          setComparisonMessage('대표 영상 비교 결과가 아직 준비되지 않았습니다.')
        }
      } catch (error) {
        setComparisonMessage(
          error instanceof Error ? error.message : '국가별 대표 영상 비교 결과를 불러오지 못했습니다.',
        )
      } finally {
        setIsLoadingComparison(false)
      }
    } catch (error) {
      setIssueMessage(
        error instanceof Error ? error.message : '국가별 이슈 영상을 불러오지 못했습니다.',
      )
    } finally {
      setIsSearchingIssues(false)
    }
  }

  const modalRoot = typeof document !== 'undefined' ? document.body : null

  const modalContent =
    activeModal === 'countries' ? (
      <div className="country-compare-page__modal" role="presentation" onClick={closeModal}>
        <div
          className="country-compare-page__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="country-compare-country-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="country-compare-page__modal-close"
            type="button"
            onClick={closeModal}
            aria-label="국가 선택 모달 닫기"
          >
            <CloseIcon />
          </button>
          <h2 id="country-compare-country-modal-title">비교할 국가 선택</h2>
          <p className="country-compare-page__modal-description">
            비교할 국가는 최대 2개까지 선택할 수 있습니다.
          </p>
          <div className="country-compare-page__option-grid">
            {countryOptions.map((country) => {
              const isSelected = draftCountryCodes.includes(country.code)
              const isDisabled = !isSelected && draftCountryCodes.length >= 2

              return (
                <button
                  key={country.code}
                  className={`country-compare-page__option-chip ${
                    isSelected ? 'country-compare-page__option-chip--selected' : ''
                  }`}
                  type="button"
                  onClick={() => handleToggleCountry(country.code)}
                  disabled={isDisabled}
                >
                  {country.label}
                </button>
              )
            })}
          </div>
          <div className="country-compare-page__modal-actions">
            <button
              className="country-compare-page__modal-button country-compare-page__modal-button--secondary"
              type="button"
              onClick={closeModal}
            >
              취소
            </button>
            <button
              className="country-compare-page__modal-button country-compare-page__modal-button--primary"
              type="button"
              onClick={handleApplyCountries}
              disabled={!draftCountryCodes.length}
            >
              선택 완료
            </button>
          </div>
        </div>
      </div>
    ) : activeModal === 'period' ? (
      <div className="country-compare-page__modal" role="presentation" onClick={closeModal}>
        <div
          className="country-compare-page__dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="country-compare-period-modal-title"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="country-compare-page__modal-close"
            type="button"
            onClick={closeModal}
            aria-label="기간 선택 모달 닫기"
          >
            <CloseIcon />
          </button>
          <h2 id="country-compare-period-modal-title">기간 선택</h2>
          <p className="country-compare-page__modal-description">
            비교할 이슈를 찾을 기간을 선택해 주세요.
          </p>
          <div className="country-compare-page__period-list">
            {periodOptions.map((period) => (
              <button
                key={period.id}
                className={`country-compare-page__period-option ${
                  draftPeriodId === period.id ? 'country-compare-page__period-option--selected' : ''
                }`}
                type="button"
                onClick={() => setDraftPeriodId(period.id)}
              >
                {period.label}
              </button>
            ))}
          </div>
          <div className="country-compare-page__modal-actions">
            <button
              className="country-compare-page__modal-button country-compare-page__modal-button--secondary"
              type="button"
              onClick={closeModal}
            >
              취소
            </button>
            <button
              className="country-compare-page__modal-button country-compare-page__modal-button--primary"
              type="button"
              onClick={handleApplyPeriod}
            >
              선택 완료
            </button>
          </div>
        </div>
      </div>
    ) : null

  return (
    <main id="country-compare-top" className="country-compare-page">
      <section className="country-compare-page__shell">
        <Navbar
          activeKey="compare"
          serviceHref="#home"
          isLoggedIn={isLoggedIn}
          onAuthClick={onAuthClick}
          maxWidth="1320px"
        />

        <div className="country-compare-page__panel">
          <header className="country-compare-page__intro">
            <h1>비교할 국제 이슈를 검색해보세요</h1>

            <div className="country-compare-page__filters">
              <button className="country-compare-page__filter-button" type="button" onClick={openCountryModal}>
                비교할 국가 선택
                <CaretIcon />
              </button>
              <button className="country-compare-page__filter-button" type="button" onClick={openPeriodModal}>
                기간 선택
                <CaretIcon />
              </button>
            </div>

            <form className="country-compare-page__searchbar" onSubmit={handleSearchSubmit}>
              <button className="country-compare-page__search-button" type="submit" aria-label="검색" disabled={isSearchingIssues}>
                <SearchIcon />
              </button>
              <input type="text" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="검색하실 키워드를 입력해주세요" />
            </form>

            <p className="country-compare-page__selection">{selectedCountries.join(' · ')} / {selectedPeriod.label}</p>
          </header>

          {isSearchingIssues ? <p className="country-compare-page__status">국가별 이슈 영상을 찾는 중입니다.</p> : null}
          {!isSearchingIssues && issueMessage ? <p className="country-compare-page__status country-compare-page__status--error">{issueMessage}</p> : null}

          {issueSearchResult ? (
            <div className="country-compare-page__results">
              <section className="country-compare-page__summary-card">
                <div>
                  <p className="country-compare-page__summary-eyebrow">국가별 이슈 영상 검색</p>
                  <h2>{issueSearchResult.clusterTitle || `"${issueSearchResult.searchKeyword || submittedQuery}" 관련 이슈 영상`}</h2>
                  <p className="country-compare-page__summary-description">
                    {issueSearchResult.clusterSummary || '선택한 국가와 기간 기준으로 수집한 관련 영상을 비교용으로 정리했습니다.'}
                  </p>
                </div>
                <dl className="country-compare-page__summary-meta">
                  <div><dt>검색어</dt><dd>{issueSearchResult.searchKeyword || submittedQuery}</dd></div>
                  <div><dt>국가</dt><dd>{selectedCountries.join(' · ')}</dd></div>
                  <div><dt>기간</dt><dd>{formatDateRange(issueSearchResult.periodStartDate, issueSearchResult.periodEndDate) || selectedPeriod.label}</dd></div>
                </dl>
              </section>

              <div className="country-compare-page__section-list country-compare-page__section-list--results">
                {groupedSearchSections.map((section) => (
                  <section key={section.id} className="country-compare-page__section">
                    <div className="country-compare-page__section-head">
                      <h2>{section.countryName} 검색 결과</h2>
                      <span>{section.articles.length}개 영상</span>
                    </div>
                    <div className="country-compare-page__rail-shell">
                      <button className="country-compare-page__rail-arrow" type="button" aria-label={`${section.countryName} 검색 결과를 왼쪽으로 이동`} onClick={() => handleScrollRail(section.id, 'left')}>
                        <ChevronIcon direction="left" />
                      </button>
                      <div className="country-compare-page__rail" ref={(element) => { railRefs.current[section.id] = element }}>
                        {section.articles.map((article) => (
                          <button key={article.id} className="country-compare-page__video-card" type="button" onClick={() => handleOpenVideo(article.youtubeVideoId)}>
                            <div className="country-compare-page__video-thumb">
                              <YoutubeThumbnail
                                src={article.image}
                                youtubeVideoId={article.youtubeVideoId}
                                alt={article.title}
                                placeholder={<div className="country-compare-page__video-placeholder" />}
                              />
                              {article.isRepresentative ? <span className="country-compare-page__badge">대표 영상</span> : null}
                            </div>
                            <div className="country-compare-page__video-body">
                              <strong>{article.title}</strong>
                              <p>{article.channelName}</p>
                              <div className="country-compare-page__video-meta">
                                <span>{article.publishedAt}</span>
                                <span>{article.similarityScore === null || article.similarityScore === '' ? '유사도 없음' : `유사도 ${article.similarityScore}`}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                      <button className="country-compare-page__rail-arrow" type="button" aria-label={`${section.countryName} 검색 결과를 오른쪽으로 이동`} onClick={() => handleScrollRail(section.id, 'right')}>
                        <ChevronIcon direction="right" />
                      </button>
                    </div>
                  </section>
                ))}
              </div>

              <section className="country-compare-page__comparison-section">
                <div className="country-compare-page__section-head country-compare-page__section-head--comparison">
                  <div>
                    <h2>국가별 대표 영상 비교 결과</h2>
                    <p>대표 영상이 선정되면 비교 결과 API를 호출하고, 분석 전 단계에서는 지표가 비어 있는 상태로 보여집니다.</p>
                  </div>
                </div>

                {isLoadingComparison ? <p className="country-compare-page__status">대표 영상 비교 결과를 불러오는 중입니다.</p> : null}
                {!isLoadingComparison && comparisonMessage ? <p className="country-compare-page__status country-compare-page__status--error">{comparisonMessage}</p> : null}

                {!isLoadingComparison && comparisonCountries.length ? (
                  <>
                    <div className="country-compare-page__comparison-summary">
                      <div><span>핵심 키워드</span><strong>{comparisonKeywords.length ? comparisonKeywords.join(', ') : '분석 전이라 핵심 키워드가 아직 없습니다.'}</strong></div>
                    </div>
                    <div className="country-compare-page__comparison-grid">
                      {comparisonCountries.map((country) => {
                        const countryInfo = countryMap[country.countryCode] || {}
                        const comparison = country.comparison || {}
                        const keywords = Array.isArray(comparison.coreKeywords) ? comparison.coreKeywords.filter(Boolean) : []

                        return (
                          <article key={country.countryCode} className="country-compare-page__comparison-card">
                            <button className="country-compare-page__comparison-thumb" type="button" onClick={() => handleOpenVideo(country.youtubeVideoId)}>
                              <YoutubeThumbnail
                                src={country.thumbnailUrl}
                                youtubeVideoId={country.youtubeVideoId}
                                alt={country.title}
                                placeholder={<div className="country-compare-page__video-placeholder" />}
                              />
                            </button>
                            <div className="country-compare-page__comparison-head">
                              <div>
                                <span className="country-compare-page__comparison-country">{country.countryName || countryInfo.label || country.countryCode}</span>
                                <span className="country-compare-page__comparison-language">{country.languageLabel || countryInfo.languageLabel || ''}</span>
                              </div>
                              <span className="country-compare-page__comparison-date">{formatPublishedDate(country.publishedAt)}</span>
                            </div>
                            <strong className="country-compare-page__comparison-title">{country.title}</strong>
                            <p className="country-compare-page__comparison-channel">{country.channelName || '채널 정보 없음'}</p>
                            <div className="country-compare-page__metric-grid">
                              <div><span className="country-compare-page__metric-label">전체 편향</span><strong className="country-compare-page__metric-value">{formatScore(country.overallBiasScore)}</strong></div>
                              <div><span className="country-compare-page__metric-label">의견성</span><strong className="country-compare-page__metric-value">{formatScore(country.opinionScore)}</strong></div>
                              <div><span className="country-compare-page__metric-label">감정성</span><strong className="country-compare-page__metric-value">{formatScore(country.emotionScore)}</strong></div>
                              <div><span className="country-compare-page__metric-label">톤</span><strong className="country-compare-page__metric-value">{country.toneLabel || comparison.toneLabel || '분석 전'}</strong></div>
                            </div>
                            <div className="country-compare-page__comparison-copy">
                              <div><h3>관점 요약</h3><p>{country.perspectiveSummary || comparison.perspectiveSummary || '분석 전이라 관점 요약이 아직 없습니다.'}</p></div>
                              <div><h3>근거 요약</h3><p>{country.evidenceSummary || '분석 전이라 근거 요약이 아직 없습니다.'}</p></div>
                            </div>
                            <div className="country-compare-page__comparison-footer">
                              <span>대표 채널 {comparison.representativeChannelName || country.channelName || '정보 없음'}</span>
                              <div className="country-compare-page__keyword-list">
                                {keywords.length ? keywords.map((keyword) => <span key={`${country.countryCode}-${keyword}`}>{keyword}</span>) : <span>핵심 키워드 분석 전</span>}
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </>
                ) : null}
              </section>
            </div>
          ) : (
            <>
              {isLoadingRecommendations ? <p className="country-compare-page__status">추천 영상을 불러오는 중입니다.</p> : null}
              {!isLoadingRecommendations && recommendationMessage ? <p className="country-compare-page__status">{recommendationMessage}</p> : null}
              <div className="country-compare-page__section-list">
                {recommendationSections.map((section) => (
                  <section
                    key={section.id}
                    className="country-compare-page__section country-compare-page__section--recommendation"
                  >
                    <h2>{section.name}</h2>
                    <RotatingArticleCarousel
                      articles={section.articles}
                      sectionName={section.name}
                      onOpenArticle={handleOpenVideo}
                    />
                  </section>
                ))}
              </div>
            </>
          )}
        </div>

        <a className="country-compare-page__floating-top" href="#country-compare-top" aria-label="맨 위로 이동">↑</a>

      </section>
      {modalRoot && modalContent ? createPortal(modalContent, modalRoot) : null}
    </main>
  )
}

export default CountryCompare
