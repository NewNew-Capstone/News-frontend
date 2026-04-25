import './SummaryArticleCard.css'

function SummaryArticleCard({ article, publisherId, onToggleScrap, onOpenVideo }) {
  return (
    <article className="summary-article-card">
      <button
        type="button"
        className={`summary-article-card__bookmark ${
          article.scrapped ? 'summary-article-card__bookmark--active' : ''
        }`}
        aria-label={article.scrapped ? '나의 스크랩에서 제거' : '나의 스크랩에 저장'}
        aria-pressed={article.scrapped}
        onClick={(event) => {
          event.stopPropagation()
          onToggleScrap(publisherId, article.id)
        }}
        title={article.scrapped ? '스크랩 해제' : '스크랩'}
      >
        <span className="summary-article-card__bookmark-label">스크랩</span>
      </button>

      <button
        className="summary-article-card__main"
        type="button"
        onClick={() => onOpenVideo?.(article.youtubeVideoId)}
      >
        <div className="summary-article-card__image">
          {article.image ? (
            <img src={article.image} alt={article.title} />
          ) : (
            <div className="summary-article-card__image-placeholder">
              <span>영상 썸네일</span>
            </div>
          )}
        </div>

        <div className="summary-article-card__body">
          <div className="summary-article-card__title-row">
            <h3>{article.title}</h3>
            <span>{article.date}</span>
          </div>
          <p>{article.reporter}</p>
        </div>
      </button>
    </article>
  )
}

export default SummaryArticleCard
