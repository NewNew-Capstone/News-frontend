import RotatingArticleCarousel from '../RotatingArticleCarousel'
import './SummaryPublisherSection.css'

function SummaryPublisherSection({ publisher, onToggleScrap, onOpenVideo }) {
  const carouselKey = publisher.articles.map((article) => article.id).join('|') || publisher.id

  return (
    <section className="summary-publisher-section">
      <header className="summary-publisher-section__header">
        <h2 className="summary-publisher-section__title">{publisher.name}</h2>
        <span className="summary-publisher-section__count">
          {publisher.articles.length}개 영상
        </span>
      </header>

      <RotatingArticleCarousel
        key={carouselKey}
        articles={publisher.articles}
        sectionName={publisher.name}
        publisherId={publisher.id}
        onToggleScrap={onToggleScrap}
        onOpenArticle={onOpenVideo}
      />
    </section>
  )
}

export default SummaryPublisherSection
