import publicInstitutionPaperworkJob from './publicInstitutionPaperworkJob';

export function PublicInstitutionPaperworkJobCard() {
  return (
    <article className="watany-job-card watany-job-card--public-paperwork" data-watany-job="taqib-muamalat-public-institutions">
      <div className="watany-job-card__eyebrow">{publicInstitutionPaperworkJob.categoryAr}</div>
      <h2>{publicInstitutionPaperworkJob.titleAr}</h2>
      <p>{publicInstitutionPaperworkJob.summaryAr}</p>
      <ul aria-label="مسؤوليات وظيفة تعقيب معاملات">
        {publicInstitutionPaperworkJob.responsibilitiesAr.slice(0, 4).map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <button type="button" className="watany-job-card__cta" data-open-card="public-institution-paperwork">
        {publicInstitutionPaperworkJob.ctaAr}
      </button>
    </article>
  );
}

export default PublicInstitutionPaperworkJobCard;