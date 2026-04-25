import { useEffect, useRef, useState } from 'react'
import alexskyPresidentImg from '../assets/home-cube/alexsky-the-president-1812154.jpg'
import broadmarkDemonstrationImg from '../assets/home-cube/broadmark-demonstration-301529.jpg'
import dylanJournalistImg from '../assets/home-cube/dylan_agbagni-journalist-6847555.jpg'
import geraltGlobalImg from '../assets/home-cube/geralt-man-2692447.jpg'
import klimkinPutinImg from '../assets/home-cube/klimkin-putin-889784.jpg'
import loochaninHistoricImg from '../assets/home-cube/loochanin-lions-1329288.jpg'
import mbordakovMediaImg from '../assets/home-cube/mbordakov-media-4661401.jpg'
import mikecookConflictImg from '../assets/home-cube/mikecook1-people-3113276.jpg'
import compareNewsImg from '../assets/international.jpg'
import summaryNewsImg from '../assets/summary.jpg'
import Navbar from '../components/Navbar'
import HomeSection from '../components/home/HomeSection'
import './Home.css'

const sections = [
  {
    id: 'hero',
    theme: 'hero',
    eyebrow: '',
    titleLines: ['비슷한 영상, 다른 시각.', '뉴뉴가 요약해드립니다.'],
    accentLine: 1,
  },
  {
    id: 'summary-detail',
    theme: 'summary',
    eyebrow: '서비스 소개',
    titleLines: ['궁금한 주제를 검색하면', '영상 요약으로', '바로 확인할 수 있어요.'],
    accentLine: 1,
    description:
      '사건, 인물, 지역, 쟁점을 입력하면 관련 뉴스 영상을 모아 핵심만 정리해 보여줍니다. 긴 영상을 끝까지 보지 않아도 중요한 맥락을 빠르게 파악할 수 있어요.',
    primaryLabel: '영상 요약 페이지로',
    primaryHref: '#summary',
    secondaryLabel: '국가별 비교 소개 보기',
    secondaryHref: '#compare-detail',
    card: {
      label: '핵심 기능',
      heading: '영상 요약',
      body: '주요 발언, 배경 설명, 후속 맥락까지 이어서 정리해 짧은 시간 안에 핵심을 파악할 수 있습니다.',
      badge: '영상 요약',
      image: summaryNewsImg,
      faceImages: [
        { image: summaryNewsImg, position: '52% 48%' },
        { image: mbordakovMediaImg, position: '70% 46%' },
        { image: dylanJournalistImg, position: '48% 44%' },
        { image: geraltGlobalImg, position: '50% 50%' },
        { image: klimkinPutinImg, position: '60% 34%' },
        { image: summaryNewsImg, position: '44% 76%' },
      ],
      tags: ['핵심 정리', '맥락 요약', '빠른 탐색'],
      linkHref: '#summary',
      linkLabel: '자세히 보기',
    },
  },
  {
    id: 'compare-detail',
    theme: 'compare',
    eyebrow: '서비스 소개',
    titleLines: ['같은 이슈를', '나라별 관점으로 보는', '국가별 비교'],
    accentLine: 2,
    description:
      '같은 사건이라도 나라마다 다르게 해석하고 다르게 강조합니다. 뉴뉴는 그 차이를 한눈에 비교할 수 있게 정리해서 더 넓은 시야로 뉴스를 이해하도록 돕습니다.',
    primaryLabel: '국가별 비교 페이지로',
    primaryHref: '#compare',
    secondaryLabel: '처음 소개로 돌아가기',
    secondaryHref: '#hero',
    card: {
      label: '핵심 기능',
      heading: '국가별 비교',
      body: '같은 이슈를 한국, 미국, 일본 등 다양한 국가의 관점으로 살펴보며 차이를 이해할 수 있습니다.',
      badge: '국가별 비교',
      image: compareNewsImg,
      faceImages: [
        { image: compareNewsImg, position: '50% 50%' },
        { image: mikecookConflictImg, position: '52% 52%' },
        { image: loochaninHistoricImg, position: '48% 46%' },
        { image: broadmarkDemonstrationImg, position: '52% 46%' },
        { image: alexskyPresidentImg, position: '52% 32%' },
        { image: compareNewsImg, position: '50% 76%' },
      ],
      tags: ['쟁점 비교', '관점 정리', '빠른 탐색'],
      linkHref: '#compare',
      linkLabel: '자세히 보기',
    },
  },
]

function Home({ isLoggedIn, onAuthClick }) {
  const [activeSection, setActiveSection] = useState(sections[0].id)
  const homeRef = useRef(null)
  const sectionRefs = useRef([])
  const wheelDeltaRef = useRef(0)
  const scrollLockRef = useRef(false)
  const scrollUnlockTimerRef = useRef(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]

        if (visibleEntry?.target?.id) {
          setActiveSection(visibleEntry.target.id)
        }
      },
      {
        threshold: [0.45, 0.6, 0.8],
        rootMargin: '-10% 0px -10% 0px',
      },
    )

    const currentSections = sectionRefs.current.filter(Boolean)
    currentSections.forEach((section) => observer.observe(section))

    return () => {
      currentSections.forEach((section) => observer.unobserve(section))
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const homeElement = homeRef.current

    if (!homeElement) {
      return undefined
    }

    const clearScrollLock = () => {
      scrollLockRef.current = false
      wheelDeltaRef.current = 0

      if (scrollUnlockTimerRef.current) {
        window.clearTimeout(scrollUnlockTimerRef.current)
        scrollUnlockTimerRef.current = null
      }
    }

    const moveToSection = (direction) => {
      const currentIndex = sections.findIndex((section) => section.id === activeSection)
      let nextIndex = currentIndex + direction

      if (currentIndex === -1) {
        nextIndex = 0
      } else if (nextIndex >= sections.length) {
        nextIndex = 0
      } else if (nextIndex < 0) {
        nextIndex = 0
      }

      if (nextIndex === currentIndex) {
        wheelDeltaRef.current = 0
        return
      }

      scrollLockRef.current = true
      wheelDeltaRef.current = 0
      sectionRefs.current[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'start' })

      scrollUnlockTimerRef.current = window.setTimeout(() => {
        clearScrollLock()
      }, 700)
    }

    const handleWheel = (event) => {
      event.preventDefault()

      if (scrollLockRef.current) {
        return
      }

      wheelDeltaRef.current += event.deltaY

      if (Math.abs(wheelDeltaRef.current) < 36) {
        return
      }

      moveToSection(wheelDeltaRef.current > 0 ? 1 : -1)
    }

    homeElement.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      homeElement.removeEventListener('wheel', handleWheel)
      clearScrollLock()
    }
  }, [activeSection])

  const activeTheme =
    sections.find((section) => section.id === activeSection)?.theme ?? sections[0].theme

  return (
    <main ref={homeRef} className={`home-page home-page--${activeTheme}`}>
      <header className="home-page__navbar-shell">
        <Navbar
          activeKey="service"
          serviceHref="#hero"
          isLoggedIn={isLoggedIn}
          onAuthClick={onAuthClick}
        />
      </header>

      {sections.map((section, index) => (
        <HomeSection
          key={section.id}
          section={section}
          isActive={activeSection === section.id}
          isSimple={section.id === 'hero'}
          nextHref={index === sections.length - 1 ? '#hero' : `#${sections[index + 1].id}`}
          sectionRef={(element) => {
            sectionRefs.current[index] = element
          }}
        />
      ))}
    </main>
  )
}

export default Home
