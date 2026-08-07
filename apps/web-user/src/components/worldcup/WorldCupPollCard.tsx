type Props = {
  matchId: string;
};

export function WorldCupPollCard({ matchId }: Readonly<Props>) {
  return (
    <section className="watany-listing-surface" dir="rtl">
      <h3 className="watany-listing-surface__title">التصويت والتوقعات</h3>
      <p className="watany-listing-card__summary" style={{ marginTop: 12, marginBottom: 16 }}>
        توقعات ودية فقط للمشجعين. لا مراهنات، لا أموال، ولا احتمالات ربح.
      </p>

      <div className="watany-listing-grid">
        <button className="watany-listing-card__button watany-listing-card__button--secondary" type="button">فوز الفريق الأول</button>
        <button className="watany-listing-card__button watany-listing-card__button--secondary" type="button">تعادل</button>
        <button className="watany-listing-card__button watany-listing-card__button--secondary" type="button">فوز الفريق الثاني</button>
      </div>

      <p className="watany-listing-card__summary" style={{ marginTop: 12 }}>Match ID: {matchId}</p>
    </section>
  );
}