const FEATURES = [
  { id: 'avatar', title: 'Decorações de avatar', description: 'Detalhes para dar outra presença à sua foto.', alt: 'Dois avatares com decorações luminosa e ametista.' },
  { id: 'effect', title: 'Efeitos de perfil', description: 'Uma nova atmosfera para o seu cartão.', alt: 'Luzes e estrelas atravessam o fundo do perfil.' },
  { id: 'banners', title: 'Banners e bandeiras', description: 'Seu banner com GIFs ou bandeiras em movimento.', alt: 'Bandeira do Brasil em destaque, com luz e dobras no tecido.' },
  { id: 'plate', title: 'Placas de identificação', description: 'Fundos que acompanham seu nome nas listas.', alt: 'Duas placas de identificação com fundos cósmicos.' },
  { id: 'name', title: 'Estilos de nome', description: 'Fontes, cores, degradês e brilho para combinar.', alt: 'Nome Lume Studio em dois estilos de fonte e cor.' },
] as const;

/** Fixed release artwork: no live catalog, animations, selectors or profile writes. */
export function ReleaseHighlights() {
  return <div className="lume-release-showcase">
    <figure className="lume-release-complete-preview">
      <div className="lume-release-preview-heading"><span>SEU PERFIL, COMPLETO</span></div>
      <img className="lume-release-complete-image" src="/releases/beta21/complete.webp" alt="Perfil do Lume com banner, avatar decorado, cristais na moldura e nome personalizado." width="620" height="748"/>
      <figcaption className="lume-release-preview-caption">Do avatar ao cartão completo. Combine os detalhes e faça do seu jeito.</figcaption>
    </figure>
    <div className="lume-release-feature-grid">{FEATURES.map(feature => <article className={`lume-release-feature lume-release-feature-${feature.id}`} key={feature.id}>
      <div className="lume-release-feature-art"><img src={`/releases/beta21/${feature.id}.webp`} alt={feature.alt} loading="lazy" decoding="async"/></div>
      <h2>{feature.title}</h2><p>{feature.description}</p>
    </article>)}</div>
  </div>;
}
