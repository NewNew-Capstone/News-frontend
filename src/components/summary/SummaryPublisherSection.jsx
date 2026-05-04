import RotatingArticleCarousel from '../RotatingArticleCarousel'
import './SummaryPublisherSection.css'

function SummaryPublisherSection({ publisher, onToggleScrap, onOpenVideo }) {
  return (
    <section className="summary-publisher-section">
      <h2 className="summary-publisher-section__title">{publisher.name}</h2>

      <RotatingArticleCarousel
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
