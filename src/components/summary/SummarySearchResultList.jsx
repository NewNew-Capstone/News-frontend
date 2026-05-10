import YoutubeThumbnail from '../YoutubeThumbnail'
import './SummarySearchResultList.css'

function SummarySearchResultList({ title, articles, onToggleScrap, onOpenVideo }) {
  return (
    <section className="summary-search-results">
      <h2 className="summary-search-results__title">{title}</h2>

      <div className="summary-search-results__list">
        {articles.map((article) => (
          <article key={article.id} className="summary-search-results__item">
            <button
              className="summary-search-results__main"
              type="button"
              onClick={() => onOpenVideo?.(article.youtubeVideoId)}
            >
              <div className="summary-search-results__thumb">
                <YoutubeThumbnail
                  src={article.image}
                  youtubeVideoId={article.youtubeVideoId}
                  alt={article.title}
                  placeholder={
                    <div className="summary-search-results__thumb-placeholder">
                      <span>영상 화면</span>
                    </div>
                  }
                />
              </div>

              <div className="summary-search-results__body">
                <h3>{article.title}</h3>
                <p>{article.reporter}</p>
                <span>{article.date}</span>
              </div>
            </button>

            <button
              type="button"
              className={`summary-search-results__bookmark ${
                article.scrapped ? 'summary-search-results__bookmark--active' : ''
              }`}
              aria-label={article.scrapped ? '나의 스크랩에서 제거' : '나의 스크랩에 저장'}
              aria-pressed={article.scrapped}
              onClick={() => onToggleScrap('search-results', article.id)}
              title={article.scrapped ? '스크랩 해제' : '스크랩'}
            >
              <span className="summary-search-results__bookmark-label">스크랩</span>
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

export default SummarySearchResultList
