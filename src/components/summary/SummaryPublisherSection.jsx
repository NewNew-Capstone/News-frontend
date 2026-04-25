import SummaryArticleCard from './SummaryArticleCard'
import './SummaryPublisherSection.css'

function SummaryPublisherSection({ publisher, onToggleScrap, onOpenVideo }) {
  return (
    <section className="summary-publisher-section">
      <h2 className="summary-publisher-section__title">{publisher.name}</h2>

      <div className="summary-publisher-section__grid">
        {publisher.articles.map((article) => (
          <SummaryArticleCard
            key={`${publisher.id}-${article.id}`}
            publisherId={publisher.id}
            article={article}
            onToggleScrap={onToggleScrap}
            onOpenVideo={onOpenVideo}
          />
        ))}
      </div>
    </section>
  )
}

export default SummaryPublisherSection
