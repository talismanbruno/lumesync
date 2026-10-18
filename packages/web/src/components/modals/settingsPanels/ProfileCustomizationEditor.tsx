import { useEffect, useMemo, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { PROFILE_NAME_EFFECTS, PROFILE_NAME_FONTS, type CosmeticItem, type ProfileCustomization, type User } from '@backspace/shared';
import { Avatar } from '../../ui/Avatar';
import { ProfileBanner } from '../../ui/FlagCanvas';
import { loadFlagRenderer } from '../../../utils/flagRenderer';
import { isProfileFlagCountry, type ProfileFlagCountry } from '@backspace/shared';
import { Nameplate, ProfileCosmetics, ProfileFrameSpace } from '../../ui/ProfileCosmetics';
import { useCustomizationStore } from '../../../stores/customizationStore';
import { getNameStyle, NAME_COLOR_PRESETS } from '../../../utils/nameAppearance';
import { AVATAR_GRADIENT_MAP } from '../../../utils/gradients';
import { getProfileThemeColors, getProfileThemeStyle } from '../../../utils/profileTheme';

const PICKERS = {
  avatarDecorationId: { type: 0, title: 'Mudar decoração de avatar', label: 'Decoração de avatar' },
  profileEffectId: { type: 1, title: 'Mudar efeito de perfil', label: 'Efeito de perfil' },
  nameplateId: { type: 2, title: 'Mudar placa de identificação', label: 'Placa de identificação' },
  profileFrameId: { type: 3, title: 'Mudar moldura de perfil', label: 'Moldura de perfil' },
} as const;
type PickerKey = keyof typeof PICKERS;
const EFFECT_LABELS: Record<string, string> = { solid: 'Sólido', gradient: 'Degradê', neon: 'Neon', toon: 'Contorno', pop: 'Pop', glow: 'Brilho', prism: 'Prisma', gummy: 'Gummy' };

export function CustomizationProfilePreview({ user, avatarSrc, bannerSrc, bannerFallback, editable, effectReplayKey = 0 }: {
  user: User; avatarSrc?: string | null; bannerSrc?: string | null; bannerFallback: string;
  editable?: { displayName: (value: string) => void; bio: (value: string) => void; customStatus: (value: string) => void };
  effectReplayKey?: number;
}) {
  const name = user.displayName?.trim() || user.username;
  return <ProfileFrameSpace customization={user.customization}><article className="lume-customization-preview" aria-label="Prévia do perfil" style={getProfileThemeStyle(user)}>
    <ProfileBanner className="lume-customization-banner" customization={user.customization} src={bannerSrc} fallback={bannerFallback} />
    <div className="lume-customization-preview-body">
      <Avatar src={avatarSrc ?? user.avatar} name={name} size={84} userId={user.id} avatarColor={user.avatarColor} customization={user.customization ?? null} status={user.status} className="lume-customization-preview-avatar" />
      <div className="lume-customization-preview-name lume-nameplate-host"><Nameplate flag={user.customization?.nameplateFlag} id={user.customization?.nameplateId} /><span style={getNameStyle(user)}>{name}</span></div>
      <div className="lume-customization-preview-handle">@{user.username}</div>
      {editable ? <>
        <label className="lume-customization-field">Nome exibido<input value={user.displayName ?? ''} maxLength={32} onChange={event => editable.displayName(event.target.value)} placeholder={user.username} /></label>
        <label className="lume-customization-field">Status personalizado<input value={user.customStatus ?? ''} maxLength={128} onChange={event => editable.customStatus(event.target.value)} placeholder="O que está acontecendo?" /></label>
        <label className="lume-customization-field">Sobre mim<textarea value={user.bio ?? ''} maxLength={190} rows={3} onChange={event => editable.bio(event.target.value)} placeholder="Um pouco sobre você…" /><span className="lume-customization-counter">{user.bio?.length ?? 0}/190</span></label>
      </> : <><p className="lume-customization-preview-status">{user.customStatus}</p><div className="lume-customization-preview-bio">{user.bio || 'Seu perfil, do seu jeito.'}</div></>}
      <div className="lume-customization-member-since"><span>MEMBRO DESDE</span><strong>{new Date(user.createdAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</strong></div>
    </div>
    <ProfileCosmetics customization={user.customization} replayKey={effectReplayKey} />
  </article></ProfileFrameSpace>;
}

function EditorDialog({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    root?.querySelector<HTMLElement>('button, input, select, textarea')?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key !== 'Tab' || !root) return;
      const focusable = Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'));
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap, true);
    return () => { document.removeEventListener('keydown', trap, true); previous?.focus(); };
  }, [onClose]);
  return createPortal(<div className="lume-cosmetic-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={ref} className="lume-cosmetic-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <header><h2>{title}</h2><button type="button" className="lume-customization-close" onClick={onClose} aria-label="Fechar seletor">×</button></header>{children}
    </div>
  </div>, document.body);
}

function CosmeticPicker({ field, user, avatarSrc, bannerSrc, bannerFallback, onApply, onClose }: {
  field: PickerKey; user: User; avatarSrc?: string | null; bannerSrc?: string | null; bannerFallback: string;
  onApply: (id: string | null) => void; onClose: () => void;
}) {
  const items = useCustomizationStore(state => state.items);
  const loading = useCustomizationStore(state => state.loading);
  const error = useCustomizationStore(state => state.error);
  const load = useCustomizationStore(state => state.load);
  const [selected, setSelected] = useState(user.customization?.[field] ?? null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState(36);
  const config = PICKERS[field];
  const candidates = useMemo(() => items.filter(item => item.type === config.type), [items, config.type]);
  const categories = useMemo(() => [...new Set(candidates.map(item => item.category))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [candidates]);
  const filtered = useMemo(() => candidates.filter(item => (!category || item.category === category) && `${item.name} ${item.description}`.toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR'))), [candidates, category, query]);
  const choice = candidates.find(item => item.id === selected);
  const previewUser = { ...user, customization: { ...user.customization, [field]: selected, ...(field === 'nameplateId' ? { nameplateFlag: null } : {}) } };
  return <EditorDialog title={config.title} onClose={onClose}>
    <div className="lume-cosmetic-picker-layout">
      <section className="lume-cosmetic-options" aria-label="Biblioteca de personalização">
        <div className="lume-cosmetic-filters"><input aria-label="Buscar personalizações" placeholder="Buscar na biblioteca" value={query} onChange={event => { setQuery(event.target.value); setLimit(36); }} /><select aria-label="Filtrar coleção" value={category} onChange={event => { setCategory(event.target.value); setLimit(36); }}><option value="">Todas as coleções</option>{categories.map(name => <option key={name}>{name}</option>)}</select></div>
        <p className="lume-cosmetic-result-count" aria-live="polite">{loading ? 'Carregando biblioteca…' : `${filtered.length} opções`}</p>
        {error && <div role="alert" className="lume-customization-error">{error}<button type="button" onClick={() => void load()}>Tentar novamente</button></div>}
        <div className="lume-cosmetic-grid">
          <button className="lume-cosmetic-tile lume-cosmetic-none" type="button" aria-label="Nenhum" aria-pressed={selected === null} onClick={() => setSelected(null)}><span>∅</span><small>Nenhum</small></button>
          {filtered.slice(0, limit).map(item => <CosmeticTile key={item.id} item={item} user={user} selected={selected === item.id} onSelect={() => setSelected(item.id)} />)}
        </div>
        {!loading && !error && filtered.length === 0 && <p className="lume-cosmetic-empty">Nenhuma opção encontrada.</p>}
        {filtered.length > limit && <button type="button" className="lume-customization-secondary lume-cosmetic-load-more" onClick={() => setLimit(value => value + 36)}>Carregar mais</button>}
      </section>
      <aside className="lume-cosmetic-selected-preview"><CustomizationProfilePreview user={previewUser} avatarSrc={avatarSrc} bannerSrc={bannerSrc} bannerFallback={bannerFallback} /><div className="lume-cosmetic-selection-info"><strong>{choice?.name ?? 'Nenhum'}</strong><span>{choice?.category ?? 'Sem personalização'}</span><p>{choice?.description}</p></div></aside>
    </div>
    <footer><button type="button" className="lume-customization-secondary" onClick={onClose}>Cancelar</button><button type="button" className="lume-customization-primary" onClick={() => onApply(selected)}>Aplicar</button></footer>
  </EditorDialog>;
}

function CosmeticTile({ item, user, selected, onSelect }: { item: CosmeticItem; user: User; selected: boolean; onSelect: () => void }) {
  const [hovered, setHovered] = useState(false);
  return <button type="button" className={`lume-cosmetic-tile lume-cosmetic-type-${item.type}`} aria-label={item.name} aria-pressed={selected} onClick={onSelect} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)}>
    <div className="lume-cosmetic-tile-art">{item.type === 0 ? <Avatar src={user.avatar} name={user.displayName || user.username} size={62} userId={user.id} avatarColor={user.avatarColor} customization={{ avatarDecorationId: item.id }} freezeAnimation={!hovered} /> : <img src={(hovered && item.animatedSrc) || item.staticSrc} alt="" loading="lazy" />}{item.type === 2 && <span style={getNameStyle(user)}>{user.displayName || user.username}</span>}</div><small>{item.name}</small>{selected && <span className="lume-cosmetic-check" aria-hidden="true">✓</span>}
  </button>;
}

interface FlagCountry { code: ProfileFlagCountry; name: string; }
function FlagThumbnail({ code }: { code: ProfileFlagCountry }) {
  const [src, setSrc] = useState(`/previews/flags/${code}.svg`);
  useEffect(() => {
    let active = true;
    void loadFlagRenderer().then(module => module.renderFlagThumbnail(code)).then(value => { if (active) setSrc(value); }).catch(() => {});
    return () => { active = false; };
  }, [code]);
  return <img src={src} alt="" loading="lazy" />;
}

function FlagPicker({ field, user, avatarSrc, bannerSrc, bannerFallback, onApply, onClose }: {
  field: 'bannerFlag' | 'nameplateFlag'; user: User; avatarSrc?: string | null; bannerSrc?: string | null; bannerFallback: string;
  onApply: (code: ProfileFlagCountry | null) => void; onClose: () => void;
}) {
  const [countries, setCountries] = useState<FlagCountry[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState(user.customization?.[field] ?? null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    void fetch('/previews/flags/countries.json', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('flags');
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('flags');
      const valid = data.filter((item): item is FlagCountry => typeof item === 'object' && item !== null && isProfileFlagCountry(item.code) && typeof item.name === 'string');
      const featured = ['br', 'pt', 'us', 'jp', 'gb', 'gi'];
      valid.sort((a, b) => (featured.includes(a.code) ? featured.indexOf(a.code) : 100) - (featured.includes(b.code) ? featured.indexOf(b.code) : 100) || a.name.localeCompare(b.name, 'pt-BR'));
      setCountries(valid);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const filtered = countries.filter(country => normalize(`${country.name} ${country.code}`).includes(normalize(query)));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const choice = countries.find(country => country.code === selected);
  const previewUser = { ...user, customization: { ...user.customization, [field]: selected, ...(field === 'nameplateFlag' && selected ? { nameplateId: null } : {}) } };
  return <EditorDialog title={field === 'bannerFlag' ? 'Bandeiras para banner' : 'Bandeiras para placa'} onClose={onClose}>
    <div className="lume-cosmetic-picker-layout lume-flag-picker-layout">
      <section className="lume-cosmetic-options" aria-label="Bandeiras de países">
        <div className="lume-cosmetic-filters"><input aria-label="Buscar país" placeholder="Buscar país" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /><button type="button" className="lume-customization-secondary" aria-pressed={selected === null} onClick={() => setSelected(null)}>Sem bandeira</button></div>
        <p className="lume-cosmetic-result-count" aria-live="polite">{!countries.length && !error ? 'Carregando bandeiras…' : `${filtered.length} bandeiras`}</p>
        {error && <div role="alert" className="lume-customization-error">Não foi possível carregar as bandeiras.<button type="button" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div>}
        <div className="lume-cosmetic-grid lume-flag-grid">{filtered.slice(page * 12, (page + 1) * 12).map(country => <button key={country.code} type="button" className="lume-cosmetic-tile lume-flag-tile" aria-label={country.name} aria-pressed={selected === country.code} onClick={() => setSelected(country.code)}><div className="lume-cosmetic-tile-art"><FlagThumbnail code={country.code} /></div><small>{country.name}</small>{selected === country.code && <span className="lume-cosmetic-check" aria-hidden="true">✓</span>}</button>)}</div>
        {!error && countries.length > 0 && filtered.length === 0 && <p className="lume-cosmetic-empty">Nenhum país encontrado.</p>}
        <nav className="lume-flag-pagination" aria-label="Páginas de bandeiras"><button type="button" className="lume-customization-secondary" aria-label="Página anterior" disabled={page === 0} onClick={() => setPage(value => value - 1)}>←</button><span>{page + 1} / {pages}</span><button type="button" className="lume-customization-secondary" aria-label="Próxima página" disabled={page + 1 >= pages} onClick={() => setPage(value => value + 1)}>→</button></nav>
      </section>
      <aside className="lume-cosmetic-selected-preview"><CustomizationProfilePreview user={previewUser} avatarSrc={avatarSrc} bannerSrc={bannerSrc} bannerFallback={bannerFallback} /><div className="lume-cosmetic-selection-info"><strong>{choice?.name ?? 'Sem bandeira'}</strong><span>{field === 'bannerFlag' ? 'Banner animado' : 'Placa de identificação animada'}</span><p>Tecido em movimento, com luz e ondulação.</p></div></aside>
    </div>
    <footer><button type="button" className="lume-customization-secondary" onClick={onClose}>Cancelar</button><button type="button" className="lume-customization-primary" onClick={() => onApply(selected)}>Aplicar</button></footer>
  </EditorDialog>;
}

function NameStylePicker({ user, onApply, onClose }: { user: User; onApply: (value: ProfileCustomization) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<ProfileCustomization>(user.customization ?? {});
  const colors = draft.nameColors?.length ? draft.nameColors : [user.nameColor?.startsWith('#') ? user.nameColor : '#b4a8ff', '#8ee7d1'];
  const update = (value: Partial<ProfileCustomization>) => setDraft(current => ({ ...current, ...value }));
  return <EditorDialog title="Estilo do nome exibido" onClose={onClose}>
    <div className="lume-name-style-editor"><div className="lume-name-style-preview" style={getNameStyle({ ...user, nameColor: user.nameColor === 'gold' ? null : user.nameColor, customization: { ...draft, nameColors: colors } })}>{user.displayName || user.username}</div>
      <fieldset><legend>Fonte</legend><div className="lume-font-options">{PROFILE_NAME_FONTS.map(font => <button type="button" key={font} aria-pressed={(draft.nameFont || 'gg sans') === font} style={{ fontFamily: `"${font}", sans-serif` }} onClick={() => update({ nameFont: font })}>{font === 'gg sans' ? 'Padrão' : font}</button>)}</div></fieldset>
      <fieldset><legend>Efeito</legend><div className="lume-effect-options">{PROFILE_NAME_EFFECTS.map(effect => <button type="button" key={effect} aria-pressed={(draft.nameEffect || 'solid') === effect} onClick={() => update({ nameEffect: effect })}>{EFFECT_LABELS[effect]}</button>)}</div></fieldset>
      <fieldset><legend>Cores</legend><div className="lume-name-color-inputs">{Array.from({ length: draft.nameEffect === 'prism' || draft.nameEffect === 'gummy' ? 5 : draft.nameEffect === 'gradient' || draft.nameEffect === 'glow' ? 2 : 1 }, (_, index) => <label key={index}>Cor {index + 1}<input type="color" aria-label={`Cor ${index + 1} do nome`} value={colors[index] || colors[0] || '#ffffff'} onChange={event => { const next = [...colors]; while (next.length <= index) next.push('#ffffff'); next[index] = event.target.value; update({ nameColors: next }); }} /></label>)}</div><div className="lume-name-swatches">{NAME_COLOR_PRESETS.map(preset => <button key={preset.label} type="button" aria-label={preset.label} style={{ backgroundColor: preset.value || '#ffffff' }} onClick={() => update({ nameColors: [preset.value || '#ffffff', colors[1] || '#8ee7d1'] })} />)}</div></fieldset>
    </div><footer><div><button type="button" className="lume-style-remove" onClick={() => onApply({ ...draft, nameFont: null, nameEffect: null, nameColors: [] })}>Restaurar estilo</button></div><button type="button" className="lume-customization-secondary" onClick={onClose}>Cancelar</button><button type="button" className="lume-customization-primary" onClick={() => onApply({ ...draft, nameColors: colors })}>Aplicar</button></footer>
  </EditorDialog>;
}

interface EditorProps {
  user: User;
  avatarSrc: string | null;
  bannerSrc: string | null;
  bannerFallback: string;
  onCustomization: (value: ProfileCustomization) => void;
  onNameColor: (value: string | null) => void;
  onAccentColor: (value: string | null) => void;
  onAvatarColor: (value: User['avatarColor']) => void;
  onDisplayName: (value: string) => void;
  onBio: (value: string) => void;
  onCustomStatus: (value: string) => void;
  avatarInputRef: RefObject<HTMLInputElement>;
  bannerInputRef: RefObject<HTMLInputElement>;
  onAvatarSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onBannerSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveAvatar: () => void;
  onRemoveBanner: () => void;
  uploading: boolean;
}
export function ProfileCustomizationEditor(props: EditorProps) {
  const { user, onCustomization } = props;
  const [picker, setPicker] = useState<PickerKey | 'name' | 'flag-banner' | 'flag-plate' | null>(null);
  const closePicker = useMemo(() => () => setPicker(null), []);
  const load = useCustomizationStore(state => state.load);
  const byId = useCustomizationStore(state => state.byId);
  useEffect(() => { void load(); }, [load]);
  const appearance = user.customization ?? {};
  const themeColors = getProfileThemeColors(user);
  const update = (value: Partial<ProfileCustomization>) => onCustomization({ ...appearance, ...value });
  const tile = (field: PickerKey) => <button type="button" className="lume-style-tile" aria-label={PICKERS[field].label} onClick={() => setPicker(field)}>{appearance[field] ? <><img src={byId.get(appearance[field]!)?.staticSrc} alt="" /><span>{byId.get(appearance[field]!)?.name || 'Selecionado'}</span></> : <><span className="lume-style-add">+</span><span>{PICKERS[field].label}</span></>}</button>;
  return <div className="lume-customization-editor">
    <header className="lume-customization-heading"><div><span>IDENTIDADE LUME</span><h2>Seu perfil</h2><p>Um espaço com a sua cara.</p></div></header>
    <div className="lume-customization-layout"><aside className="lume-customization-styles" aria-label="Estilos de perfil">
      <div className="lume-customization-profile-label"><span className="lume-customization-orbit-dot" />Perfil principal</div>
      <section><h3>Placa de identificação</h3><div className="lume-style-nameplate"><button type="button" aria-label="Placa de identificação" onClick={() => setPicker('nameplateId')}><Nameplate flag={appearance.nameplateFlag} id={appearance.nameplateId} /><span style={getNameStyle(user)}>{user.displayName || user.username}</span><span className="lume-style-inline-add">+</span></button></div><button type="button" className="lume-style-remove" onClick={() => setPicker('flag-plate')}>Bandeiras para placa</button></section>
      <section><h3>Avatar e decorações</h3><div className="lume-style-two-columns"><button type="button" className="lume-style-tile" aria-label="Mudar avatar" disabled={props.uploading} onClick={() => props.avatarInputRef.current?.click()}><Avatar src={props.avatarSrc} name={user.displayName || user.username} size={55} userId={user.id} avatarColor={user.avatarColor} customization={null} /><span>Avatar</span></button>{tile('avatarDecorationId')}</div>{props.avatarSrc && <button type="button" className="lume-style-remove" onClick={props.onRemoveAvatar}>Remover avatar</button>}</section>
      <section><h3>Estilo do nome exibido</h3><button type="button" className="lume-style-name-button" aria-label="Estilo do nome exibido" onClick={() => setPicker('name')}><span style={getNameStyle(user)}>{user.displayName || user.username}</span><span>Editar estilo</span></button>{user.isAdmin && <button type="button" className="lume-style-remove" aria-pressed={user.nameColor === 'gold'} onClick={() => props.onNameColor(user.nameColor === 'gold' ? null : 'gold')}>Dourado luminoso</button>}</section>
      <section><h3>Banner</h3><div className="lume-style-two-columns">
        <button type="button" className="lume-style-tile lume-style-banner-upload" aria-label="Enviar banner" disabled={props.uploading} onClick={() => props.bannerInputRef.current?.click()}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></svg><span>Enviar banner</span>
        </button>
        <button type="button" className="lume-style-tile" aria-label="Bandeiras para banner" onClick={() => setPicker('flag-banner')}>
          <div className="lume-style-flag-art" aria-hidden="true"><img src="/previews/flags/us.svg" alt=""/><img src="/previews/flags/jp.svg" alt=""/><img src={`/previews/flags/${appearance.bannerFlag || 'br'}.svg`} alt=""/></div><span>Bandeiras</span>
        </button>
      </div><div className="lume-banner-actions">{props.bannerSrc && <button type="button" className="lume-style-remove" onClick={props.onRemoveBanner}>Remover banner</button>}{appearance.bannerFlag && <button type="button" className="lume-style-remove" onClick={() => update({ bannerFlag: null })}>Remover bandeira</button>}</div></section>
      <section><h3>Efeitos e molduras de perfil</h3><div className="lume-style-two-columns">{tile('profileEffectId')}{tile('profileFrameId')}</div></section>
      <section><h3>Cor do avatar</h3><div className="lume-avatar-color-options">{Object.entries(AVATAR_GRADIENT_MAP).map(([key, value]) => <button key={key} type="button" aria-label={`Cor de avatar ${key}`} aria-pressed={user.avatarColor === key} style={{ background: value.gradient }} onClick={() => props.onAvatarColor(key as User['avatarColor'])} />)}</div>
        <label className="lume-avatar-custom-color"><span className="lume-avatar-color-wheel" style={user.avatarColor?.startsWith('#') ? { background: user.avatarColor } : undefined}><input type="color" aria-label="Cor personalizada do avatar" value={user.avatarColor?.startsWith('#') ? user.avatarColor : '#67d9f2'} onChange={event => props.onAvatarColor(event.target.value as `#${string}`)}/></span><span>Personalizada{user.avatarColor?.startsWith('#') && <small>{user.avatarColor.toUpperCase()}</small>}</span></label>
      </section>
      <section><h3>Cores do perfil</h3><div className="lume-profile-gradient-swatch" aria-label="Degradê das cores do perfil" style={getProfileThemeStyle(user)} /><div className="lume-theme-controls"><label>Cor principal<input type="color" aria-label="Cor principal do perfil" value={themeColors.primary} onChange={event => update({ themeColor: event.target.value })} /></label><label>Cor secundária<input type="color" aria-label="Cor secundária do perfil" value={themeColors.secondary} onChange={event => update({ themeSecondaryColor: event.target.value })} /></label></div><p className="lume-theme-hint">Duas cores, um degradê no seu cartão.</p><button type="button" className="lume-style-remove" onClick={() => { update({ themeColor: null, themeSecondaryColor: null }); props.onAccentColor(null); }}>Restaurar cores</button></section>
    </aside><main className="lume-customization-live-preview"><span className="lume-customization-preview-label">PRÉVIA AO VIVO</span><CustomizationProfilePreview user={user} avatarSrc={props.avatarSrc} bannerSrc={props.bannerSrc} bannerFallback={props.bannerFallback} editable={{ displayName: props.onDisplayName, bio: props.onBio, customStatus: props.onCustomStatus }} /></main></div>
    <input ref={props.avatarInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={props.onAvatarSelect} hidden aria-label="Arquivo do avatar" />
    <input ref={props.bannerInputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={event => { if (event.target.files?.length) update({ bannerFlag: null }); props.onBannerSelect(event); }} hidden aria-label="Arquivo do banner" />
    {picker && picker !== 'name' && picker !== 'flag-banner' && picker !== 'flag-plate' && <CosmeticPicker field={picker} user={user} avatarSrc={props.avatarSrc} bannerSrc={props.bannerSrc} bannerFallback={props.bannerFallback} onClose={closePicker} onApply={id => { update({ [picker]: id, ...(picker === 'nameplateId' ? { nameplateFlag: null } : {}) }); closePicker(); }} />}
    {(picker === 'flag-banner' || picker === 'flag-plate') && <FlagPicker field={picker === 'flag-banner' ? 'bannerFlag' : 'nameplateFlag'} user={user} avatarSrc={props.avatarSrc} bannerSrc={props.bannerSrc} bannerFallback={props.bannerFallback} onClose={closePicker} onApply={value => { update({ [picker === 'flag-banner' ? 'bannerFlag' : 'nameplateFlag']: value, ...(picker === 'flag-plate' && value ? { nameplateId: null } : {}) }); closePicker(); }} />}
    {picker === 'name' && <NameStylePicker user={user} onClose={closePicker} onApply={value => { onCustomization(value); props.onNameColor(null); closePicker(); }} />}
  </div>;
}
