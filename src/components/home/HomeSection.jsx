import './HomeSection.css'

const CUBE_FACE_NAMES = ['front', 'back', 'right', 'left', 'top', 'bottom']
const DEFAULT_FACE_POSITIONS = ['50% 50%', '50% 45%', '82% 50%', '18% 50%', '50% 24%', '50% 76%']

function getCubeFaces(card) {
  return CUBE_FACE_NAMES.map((faceName, index) => {
    const configuredFace = Array.isArray(card.faceImages) ? card.faceImages[index] : null

    if (configuredFace && typeof configuredFace === 'object') {
      return {
        faceName,
        image: configuredFace.image || card.image,
        position: configuredFace.position || DEFAULT_FACE_POSITIONS[index],
      }
    }

    return {
      faceName,
      image: typeof configuredFace === 'string' ? configuredFace : card.image,
      position: DEFAULT_FACE_POSITIONS[index],
    }
  })
}

function HomeSection({ section, isActive, isSimple, nextHref, sectionRef }) {
  const previewFaces = !isSimple && section.card ? getCubeFaces(section.card) : []

  return (
    <section
      id={section.id}
      ref={sectionRef}
      className={`home-section ${isActive ? 'home-section--active' : ''} ${
        isSimple ? 'home-section--simple' : ''
      }`}
    >
      <div className="home-section__shell">
        <div className="home-section__content">
          <div className={`home-section__copy ${isSimple ? 'home-section__copy--simple' : ''}`}>
            {!isSimple && section.eyebrow ? (
              <p className="home-section__eyebrow">{section.eyebrow}</p>
            ) : null}
            <h1 className="home-section__title">
              {section.titleLines.map((line, lineIndex) => (
                <span
                  key={line}
                  className={
                    lineIndex === section.accentLine
                      ? 'home-section__title-line home-section__title-line--accent'
                      : 'home-section__title-line'
                  }
                >
                  {line}
                </span>
              ))}
            </h1>

            {!isSimple && (
              <>
                <p className="home-section__description">{section.description}</p>

                <div className="home-section__actions">
                  <a className="home-section__primary-button" href={section.primaryHref}>
                    {section.primaryLabel}
                  </a>
                  <a className="home-section__secondary-button" href={section.secondaryHref}>
                    {section.secondaryLabel}
                  </a>
                </div>
              </>
            )}
          </div>

          {!isSimple && section.card ? (
            <article className="home-section__preview-card">
              <div className="home-section__preview-media">
                <div className="home-section__preview-cube-stage" aria-hidden="true">
                  <div className="home-section__preview-cube">
                    {previewFaces.map((face) => (
                      <div
                        key={`${section.card.heading}-${face.faceName}`}
                        className={`home-section__preview-face home-section__preview-face--${face.faceName}`}
                      >
                        <div
                          className="home-section__preview-face-image"
                          style={{
                            '--face-image': `url(${face.image})`,
                            '--face-position': face.position,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="home-section__preview-cube-shadow" />
                </div>
                <div className="home-section__preview-glass" aria-hidden="true" />
                <div className="home-section__preview-badge">{section.card.badge}</div>
              </div>
              <div className="home-section__preview-body">
                <p className="home-section__preview-label">{section.card.label}</p>
                <h2>{section.card.heading}</h2>
                <p>{section.card.body}</p>
                <div className="home-section__preview-tags">
                  {section.card.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <a className="home-section__preview-link" href={section.card.linkHref}>
                  {section.card.linkLabel}
                </a>
              </div>
            </article>
          ) : null}
        </div>

        <div className="home-section__footer">
          <a className="home-section__scroll-indicator" href={nextHref}>
            <span className="home-section__scroll-chevron" aria-hidden="true" />
          </a>
          <a className="home-section__floating-top" href="#hero" aria-label="맨 위로 이동">
            ↑
          </a>
        </div>
      </div>
    </section>
  )
}

export default HomeSection
