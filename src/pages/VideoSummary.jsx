import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import LoginModal from '../components/auth/LoginModal'
import SummaryPublisherSection from '../components/summary/SummaryPublisherSection'
import SummarySearchResultList from '../components/summary/SummarySearchResultList'
import {
  createScrapLookup,
  deleteScrapVideo,
  fetchScrapVideos,
  saveScrapVideo,
} from '../services/scraps'
import {
  fetchNewsPoliticsTrendingKeywords,
  fetchRecommendedChannelVideos,
  fetchYoutubeSearchResults,
} from '../services/youtube'
import { normalizeYoutubeVideoId } from '../utils/youtubeVideo'
import './VideoSummary.css'

const NEWS_POLITICS_KEYWORD_FALLBACK = ['정치 이슈', '국회', '북한']
const TRENDING_KEYWORD_LIMIT = 3

function pickFirst(video, keys, fallback = '') {
  for (const key of keys) {
    const value = video?.[key]

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
    .replace(/[^a-z0-9가-힣-]/g, '')
}

function formatPublishedDate(value) {
  if (!value) {
    return '날짜 정보 없음'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  const year = String(date.getFullYear()).slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}. ${month}. ${day}.`
}

function formatViewCount(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return ''
  }

  return `조회수 ${value.toLocaleString()}`
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
  const parts = [channelName, formatViewCount(numericViewCount)].filter(Boolean)

  return parts.join(' · ') || '채널 정보 없음'
}

function createVideoCard(video, scrapLookup, index) {
  const rawYoutubeVideoId = pickFirst(video, ['youtubeVideoId', 'videoId', 'id'], '')
  const fallbackYoutubeSource = pickFirst(
    video,
    ['originalUrl', 'url', 'videoUrl', 'youtubeUrl', 'thumbnailUrl', 'thumbnail', 'thumbnailURL', 'thumbUrl'],
    '',
  )
  const youtubeVideoId =
    normalizeYoutubeVideoId(rawYoutubeVideoId) || normalizeYoutubeVideoId(fallbackYoutubeSource)
  const id = pickFirst(
    video,
    ['youtubeVideoId', 'videoId', 'id', 'originalUrl', 'url'],
    `video-${index + 1}`,
  )
  const normalizedYoutubeVideoId = youtubeVideoId || normalizeYoutubeVideoId(id) || id
  const scrapItem = scrapLookup[normalizedYoutubeVideoId] || null
  const title = pickFirst(video, ['title', 'videoTitle', 'name'], '영상 제목 정보가 없습니다.')
  const publishedAt = pickFirst(video, ['publishedAt', 'publishedDate', 'published_at', 'uploadDate'])
  const image = pickFirst(video, ['thumbnailUrl', 'thumbnail', 'thumbnailURL', 'thumbUrl', 'imageUrl'])
  const originalUrl = pickFirst(
    video,
    ['originalUrl', 'url', 'videoUrl', 'youtubeUrl'],
    normalizedYoutubeVideoId ? `https://www.youtube.com/watch?v=${normalizedYoutubeVideoId}` : '',
  )

  return {
    id,
    youtubeVideoId: normalizedYoutubeVideoId,
    title,
    reporter: buildMetaText(video),
    date: formatPublishedDate(publishedAt),
    image,
    originalUrl,
    scrapId: scrapItem?.scrapId ?? null,
    scrapped: Boolean(scrapItem),
  }
}

function createSearchSection(keyword, videos, scrapLookup) {
  return {
    id: 'search-results',
    name: `"${keyword}" 검색 결과`,
    articles: videos.map((video, index) => createVideoCard(video, scrapLookup, index)),
  }
}

function createRecommendedSections(videos, scrapLookup) {
  const grouped = videos.reduce((map, video, index) => {
    const channelName = pickFirst(
      video,
      ['channelName', 'channelTitle', 'channel', 'publisher'],
      '추천 영상',
    )
    const sectionId = `publisher-${slugify(channelName) || index + 1}`

    if (!map.has(sectionId)) {
      map.set(sectionId, {
        id: sectionId,
        name: channelName,
        articles: [],
      })
    }

    map.get(sectionId).articles.push(createVideoCard(video, scrapLookup, index))

    return map
  }, new Map())

  return Array.from(grouped.values())
}

function syncSectionScraps(section, scrapLookup) {
  if (!section) {
    return section
  }

  return {
    ...section,
    articles: section.articles.map((article) => {
      const scrapItem = scrapLookup[article.youtubeVideoId] || null

      return {
        ...article,
        scrapId: scrapItem?.scrapId ?? null,
        scrapped: Boolean(scrapItem),
      }
    }),
  }
}

function findArticleBySection(searchSection, publishers, sectionId, articleId) {
  if (searchSection?.id === sectionId) {
    return searchSection.articles.find((article) => article.id === articleId) || null
  }

  const publisherSection = publishers.find((publisher) => publisher.id === sectionId)

  return publisherSection?.articles.find((article) => article.id === articleId) || null
}

function VideoSummary({ isLoggedIn, onAuthClick, onLoginSuccess, onMoveToSignup }) {
  const [query, setQuery] = useState('')
  const [publishers, setPublishers] = useState([])
  const [searchSection, setSearchSection] = useState(null)
  const [scrapLookup, setScrapLookup] = useState({})
  const [pendingScrapKeys, setPendingScrapKeys] = useState([])
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false)
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false)
  const [popularKeywords, setPopularKeywords] = useState(NEWS_POLITICS_KEYWORD_FALLBACK)
  const [searchMessage, setSearchMessage] = useState('')
  const [recommendationMessage, setRecommendationMessage] = useState('')

  const openLoginModal = () => setIsLoginModalOpen(true)
  const closeLoginModal = () => setIsLoginModalOpen(false)
  const hasSearchResults = Boolean(searchSection?.articles?.length)

  const applyScrapLookup = (nextScrapLookup) => {
    setScrapLookup(nextScrapLookup)
    setSearchSection((currentSearchSection) => syncSectionScraps(currentSearchSection, nextScrapLookup))
    setPublishers((currentPublishers) =>
      currentPublishers.map((publisher) => syncSectionScraps(publisher, nextScrapLookup)),
    )
  }

  const handleOpenVideo = (youtubeVideoId) => {
    if (!youtubeVideoId) {
      return
    }

    window.location.hash = `#summary/video/${encodeURIComponent(youtubeVideoId)}`
  }

  useEffect(() => {
    let isCancelled = false

    const loadTrendingKeywords = async () => {
      setIsLoadingKeywords(true)

      try {
        const keywords = await fetchNewsPoliticsTrendingKeywords({
          limit: TRENDING_KEYWORD_LIMIT,
        })

        if (!isCancelled) {
          setPopularKeywords(keywords.length ? keywords : NEWS_POLITICS_KEYWORD_FALLBACK)
        }
      } catch {
        if (!isCancelled) {
          setPopularKeywords(NEWS_POLITICS_KEYWORD_FALLBACK)
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingKeywords(false)
        }
      }
    }

    loadTrendingKeywords()

    return () => {
      isCancelled = true
    }
  }, [isLoggedIn])

  useEffect(() => {
    if (!isLoggedIn) {
      setPublishers([])
      setSearchSection(null)
      setScrapLookup({})
      setRecommendationMessage('로그인 후 추천 영상과 스크랩 상태를 확인할 수 있습니다.')
      return undefined
    }

    let isCancelled = false

    const loadRecommendedVideos = async () => {
      setIsLoadingRecommendations(true)
      setRecommendationMessage('')

      try {
        const [videosResult, scrapsResult] = await Promise.allSettled([
          fetchRecommendedChannelVideos(),
          fetchScrapVideos(),
        ])

        if (isCancelled) {
          return
        }

        if (videosResult.status !== 'fulfilled') {
          throw videosResult.reason
        }

        const nextScrapLookup =
          scrapsResult.status === 'fulfilled' ? createScrapLookup(scrapsResult.value) : {}

        applyScrapLookup(nextScrapLookup)

        const nextPublishers = createRecommendedSections(videosResult.value, nextScrapLookup)

        setPublishers(nextPublishers)
        setRecommendationMessage(nextPublishers.length ? '' : '표시할 추천 영상이 아직 없습니다.')
      } catch (error) {
        if (!isCancelled) {
          setPublishers([])
          setRecommendationMessage(
            error instanceof Error
              ? error.message
              : '추천 영상을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
          )
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingRecommendations(false)
        }
      }
    }

    loadRecommendedVideos()

    return () => {
      isCancelled = true
    }
  }, [isLoggedIn])

  const runSearch = async (keyword) => {
    const trimmedKeyword = keyword.trim()

    if (!trimmedKeyword) {
      setSearchMessage('검색어를 입력해 주세요.')
      setSearchSection(null)
      return
    }

    setIsSearching(true)
    setSearchMessage('')

    try {
      const videos = await fetchYoutubeSearchResults(trimmedKeyword)
      const nextSearchSection = createSearchSection(trimmedKeyword, videos, scrapLookup)

      setSearchSection(nextSearchSection)
      setSearchMessage(videos.length ? '' : '검색 결과가 없습니다.')
    } catch (error) {
      setSearchSection(null)
      setSearchMessage(
        error instanceof Error
          ? error.message
          : '검색 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      )
    } finally {
      setIsSearching(false)
    }
  }

  const handleSearchSubmit = async (event) => {
    event.preventDefault()

    if (!isLoggedIn) {
      openLoginModal()
      return
    }

    await runSearch(query)
  }

  const handleKeywordSearch = async (keyword) => {
    setQuery(keyword)

    if (!isLoggedIn) {
      openLoginModal()
      return
    }

    await runSearch(keyword)
  }

  const handleToggleScrap = async (publisherId, articleId) => {
    if (!isLoggedIn) {
      openLoginModal()
      return
    }

    const pendingKey = `${publisherId}:${articleId}`

    if (pendingScrapKeys.includes(pendingKey)) {
      return
    }

    const targetArticle = findArticleBySection(searchSection, publishers, publisherId, articleId)

    if (!targetArticle?.youtubeVideoId) {
      return
    }

    setPendingScrapKeys((currentKeys) => [...currentKeys, pendingKey])

    try {
      const currentScrapId =
        targetArticle.scrapId || scrapLookup[targetArticle.youtubeVideoId]?.scrapId || null

      if (targetArticle.scrapped && currentScrapId) {
        await deleteScrapVideo(currentScrapId)
      } else {
        await saveScrapVideo(targetArticle.youtubeVideoId)
      }

      const latestScrapItems = await fetchScrapVideos()
      applyScrapLookup(createScrapLookup(latestScrapItems))

      if (publisherId === 'search-results') {
        setSearchMessage('')
      } else {
        setRecommendationMessage('')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : '스크랩 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.'

      if (publisherId === 'search-results') {
        setSearchMessage(errorMessage)
      } else {
        setRecommendationMessage(errorMessage)
      }
    } finally {
      setPendingScrapKeys((currentKeys) => currentKeys.filter((key) => key !== pendingKey))
    }
  }

  return (
    <main id="summary-top" className="video-summary-page">
      <section className="video-summary-page__shell">
        <Navbar
          activeKey="summary"
          serviceHref="#home"
          isLoggedIn={isLoggedIn}
          onAuthClick={onAuthClick}
          maxWidth="1320px"
        />

        <div className="video-summary-page__panel">
          <section className="video-summary-page__search-section">
            <h1>원하시는 영상을 검색해 주세요</h1>

            <div className="video-summary-page__keywords" aria-busy={isLoadingKeywords}>
              {popularKeywords.map((keyword, index) => (
                <button
                  key={`${keyword}-${index}`}
                  type="button"
                  className={`video-summary-page__keyword-chip ${
                    index === 2 ? '' : 'video-summary-page__keyword-chip--emphasis'
                  }`}
                  aria-label={`${keyword} 검색`}
                  onClick={() => handleKeywordSearch(keyword)}
                >
                  {keyword}
                </button>
              ))}
            </div>

            <form className="video-summary-page__searchbar" onSubmit={handleSearchSubmit}>
              <button
                className="video-summary-page__search-button"
                type="submit"
                aria-label="검색"
              >
                검색
              </button>
              <input
                id="summary-search-input"
                type="text"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setSearchMessage('')
                }}
                placeholder="검색하실 키워드를 입력해 주세요"
              />
            </form>

            {searchMessage ? (
              <p className="video-summary-page__status video-summary-page__status--inline">
                {searchMessage}
              </p>
            ) : null}
          </section>

          {isSearching ? (
            <p className="video-summary-page__status">검색 결과를 불러오는 중입니다.</p>
          ) : null}

          {searchSection?.articles.length ? (
            <div className="video-summary-page__result-group">
              <SummarySearchResultList
                title={searchSection.name}
                articles={searchSection.articles}
                onToggleScrap={handleToggleScrap}
                onOpenVideo={handleOpenVideo}
              />
            </div>
          ) : null}

          {!hasSearchResults && isLoadingRecommendations ? (
            <p className="video-summary-page__status">추천 영상을 불러오는 중입니다.</p>
          ) : null}

          {!hasSearchResults && recommendationMessage ? (
            <p className="video-summary-page__status">{recommendationMessage}</p>
          ) : null}

          {!hasSearchResults ? (
            <div className="video-summary-page__publisher-list">
              {publishers.map((publisher) => (
                <SummaryPublisherSection
                  key={publisher.id}
                  publisher={publisher}
                  onToggleScrap={handleToggleScrap}
                  onOpenVideo={handleOpenVideo}
                />
              ))}
            </div>
          ) : null}
        </div>

        <a
          className="video-summary-page__floating-top"
          href="#summary-top"
          aria-label="맨 위로 이동"
        >
          ↑
        </a>

        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={closeLoginModal}
          onLoginSuccess={onLoginSuccess}
          onMoveToSignup={onMoveToSignup}
        />
      </section>
    </main>
  )
}

export default VideoSummary
