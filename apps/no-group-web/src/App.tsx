import { useEffect, useState, type FormEvent, type ReactNode } from 'react';

type Route = '/' | '/ecosystem' | '/infrastructure' | '/intelligence' | '/ventures' | '/company' | '/contact';
type IconName = 'arrow' | 'arrow-up' | 'menu' | 'close' | 'sun' | 'moon' | 'spark' | 'layers' | 'code' | 'cloud' | 'brain' | 'book' | 'message' | 'browser' | 'tool' | 'shield' | 'globe' | 'github' | 'discord' | 'bluesky' | 'check' | 'plus' | 'mail' | 'phone' | 'location' | 'external' | 'quote' | 'network';

type Product = {
  name: string;
  category: string;
  description: string;
  icon: IconName;
  url?: string;
  status?: string;
};

const internalRoutes: Route[] = ['/', '/ecosystem', '/infrastructure', '/intelligence', '/ventures', '/company', '/contact'];
const navItems: Array<{ label: string; route: Route }> = [
  { label: 'Ecosystem', route: '/ecosystem' },
  { label: 'Capabilities', route: '/infrastructure' },
  { label: 'Company', route: '/company' },
];

const products: Product[] = [
  { name: 'Vortex', category: 'Cloud infrastructure', description: 'A developer cloud dashboard for building, hosting, managing, and scaling applications on a resilient serverless foundation.', icon: 'cloud', url: 'https://vortex.no-group.org' },
  { name: 'Tungsten', category: 'Developer environment', description: 'A visual IDE with a bidirectional builder, code editor, terminal, offline command reference, and code integrity checks.', icon: 'code', url: 'https://tungsten.no-group.org' },
  { name: 'Jeris', category: 'Artificial intelligence', description: 'A multimodal intelligence initiative designed to power useful, thoughtful experiences across the N.O Group ecosystem.', icon: 'brain', url: 'https://jeris.no-group.org' },
  { name: 'BookNest', category: 'Publishing and education', description: 'An edu-social reading and publishing space with creative tools and an AI reading companion named Jenny.', icon: 'book', status: 'In development' },
  { name: 'Link', category: 'Consumer communication', description: 'A real-time social messaging and feed experience shaped by focused, water-droplet glassmorphism.', icon: 'message', url: 'https://link.no-group.org' },
  { name: 'Interface', category: 'Mobile web', description: 'A lightweight browser concept with multi-search, data-saver controls, and offline moments built for constrained connections.', icon: 'browser', status: 'In development' },
  { name: 'KwikChat', category: 'Consumer communication', description: 'A minimalist, Nigeria-driven messaging interface concept for clear and immediate conversation.', icon: 'message', url: 'https://kwikchat.no-group.org' },
  { name: 'ToolsKit', category: 'Browser utilities', description: 'Private, client-side productivity tools for developers and everyday work: formatting, encoding, generation, conversion, and more.', icon: 'tool', url: 'https://toolskit.no-group.org' },
];

const footerGroups = [
  {
    title: 'Explore',
    items: [
      { label: 'Our ecosystem', route: '/ecosystem' as Route },
      { label: 'Infrastructure', route: '/infrastructure' as Route },
      { label: 'Intelligence', route: '/intelligence' as Route },
      { label: 'Ventures', route: '/ventures' as Route },
    ],
  },
  {
    title: 'Connect',
    items: [
      { label: 'Start a conversation', route: '/contact' as Route },
      { label: 'Mtek Fire Safety', url: 'https://mtekfiresafetyltd.com' },
      { label: 'GitHub', url: 'https://github.com/NO-Group' },
      { label: 'Press', url: 'mailto:press@no-group.org' },
    ],
  },
];

function getRoute(pathname: string): Route {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  return internalRoutes.includes(trimmed as Route) ? (trimmed as Route) : '/';
}

function Icon({ name, size = 20, stroke = 1.7 }: { name: IconName; size?: number; stroke?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  const paths: Record<IconName, ReactNode> = {
    arrow: <><path d="M5 12h13"/><path d="m13 6 6 6-6 6"/></>,
    'arrow-up': <><path d="M12 19V5"/><path d="m6 11 6-6 6 6"/></>,
    menu: <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>,
    close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
    sun: <><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
    moon: <path d="M20.2 15.5A8.7 8.7 0 0 1 8.5 3.8 8.7 8.7 0 1 0 20.2 15.5Z"/>,
    spark: <><path d="M12 2.5 13.8 10 21 12l-7.2 1.8L12 21.5l-1.8-7.7L3 12l7.2-2L12 2.5Z"/><path d="m19 3 .5 2.5L22 6l-2.5.5L19 9l-.5-2.5L16 6l2.5-.5L19 3Z"/></>,
    layers: <><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"/><path d="m4 12 8 4.5 8-4.5"/><path d="m4 16.5 8 4.5 8-4.5"/></>,
    code: <><path d="m8 8-4 4 4 4"/><path d="m16 8 4 4-4 4"/><path d="m14 4-4 16"/></>,
    cloud: <path d="M7 18.5h10.4a4.1 4.1 0 0 0 .7-8.1A6.2 6.2 0 0 0 6.2 8.8 4.8 4.8 0 0 0 7 18.5Z"/>,
    brain: <><path d="M9.5 4.1a3.6 3.6 0 0 0-5.9 2.8 3.6 3.6 0 0 0 .7 6.5 3.8 3.8 0 0 0 5.2 5.3M14.5 4.1a3.6 3.6 0 0 1 5.9 2.8 3.6 3.6 0 0 1-.7 6.5 3.8 3.8 0 0 1-5.2 5.3"/><path d="M12 3v18M7.3 7.7c1.1.1 2 .9 2.2 2M16.7 7.7c-1.1.1-2 .9-2.2 2M7.3 15.8c1.3-.1 2.4-1.1 2.5-2.4M16.7 15.8c-1.3-.1-2.4-1.1-2.5-2.4"/></>,
    book: <><path d="M4.5 5.5A2.5 2.5 0 0 1 7 3h11.5v16H7a2.5 2.5 0 0 0-2.5 2.5v-16Z"/><path d="M4.5 19A2.5 2.5 0 0 1 7 16.5h11.5"/></>,
    message: <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5 8 8 0 0 1-3.3-.7L4 20l1.7-4.6A7.5 7.5 0 1 1 20 11.5Z"/>,
    browser: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 8h18M7 6h.01M10 6h.01"/></>,
    tool: <><path d="m14.7 6.4 2.9-2.9 2.9 2.9-2.9 2.9"/><path d="m13 8-8.8 8.8a2.1 2.1 0 0 0 3 3L16 11"/><path d="m12 4 8 8"/></>,
    shield: <path d="M12 3.2 19 6v5.2c0 4.3-2.8 7.7-7 9.6-4.2-1.9-7-5.3-7-9.6V6l7-2.8Z"/>,
    globe: <><circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3c2.2 2.5 3.3 5.5 3.3 9S14.2 18.5 12 21M12 3C9.8 5.5 8.7 8.5 8.7 12S9.8 18.5 12 21"/></>,
    github: <><path d="M9 19c-5 .9-5-2.5-7-3m14 5v-3.9a3.4 3.4 0 0 0-.9-2.6c3-.3 6.1-1.5 6.1-6.8a5.3 5.3 0 0 0-1.4-3.7 4.9 4.9 0 0 0-.1-3.7s-1.1-.4-3.7 1.4a12.8 12.8 0 0 0-6.8 0C6.6.7 5.5 1.1 5.5 1.1a4.9 4.9 0 0 0-.1 3.7A5.3 5.3 0 0 0 4 8.5c0 5.3 3.1 6.5 6.1 6.8a3.1 3.1 0 0 0-.9 2.4V21"/></>,
    discord: <><path d="M18.6 5.1A16.4 16.4 0 0 0 14.5 4l-.5 1.1a14.9 14.9 0 0 0-4 0L9.5 4a16.4 16.4 0 0 0-4.1 1.1C2.8 9 2.1 12.8 2.4 16.6a16.6 16.6 0 0 0 5.1 2.6l1.2-1.6a9.5 9.5 0 0 1-1.9-.9l.5-.4a11.8 11.8 0 0 0 9.4 0l.5.4c-.6.4-1.2.7-1.9.9l1.2 1.6a16.5 16.5 0 0 0 5.1-2.6c.4-4.4-.7-8.2-3-11.5Z"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/></>,
    bluesky: <path d="M12 11.5c-1.1-2.2-4.2-6.3-7-8.3C2.3 1.3 1.2 2 1.6 4.9c.3 2.1 2.1 8.6 3.4 10.4.5.7 1.1 1.2 1.8 1.2.9 0 1.9-1 2.8-2.7.9 1.7 1.9 2.7 2.8 2.7.7 0 1.3-.5 1.8-1.2 1.3-1.8 3.1-8.3 3.4-10.4.4-2.9-.7-3.6-3.4-1.7-2.8 2-5.9 6.1-7 8.3Z"/>,
    check: <path d="m5 12 4.2 4.2L19 6.5"/>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    phone: <path d="M6.7 3.8 9.2 3l1.6 4.2-2.1 1.4a14.6 14.6 0 0 0 6.7 6.7l1.4-2.1L21 14.8l-.8 2.5a2.7 2.7 0 0 1-2.9 1.8C9.9 18.3 5.7 14.1 4.9 6.7a2.7 2.7 0 0 1 1.8-2.9Z"/>,
    location: <><path d="M19 10.5c0 5-7 10.3-7 10.3S5 15.5 5 10.5a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10.5" r="2.3"/></>,
    external: <><path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></>,
    quote: <path d="M7.8 7C5.1 8.2 3.5 10.5 3.5 14c0 2.4 1.4 4 3.7 4 2.1 0 3.5-1.5 3.5-3.6 0-2-1.4-3.3-3.2-3.3-.4 0-.8.1-1.1.2.5-1.4 1.5-2.5 3.2-3.2L7.8 7Zm8 0c-2.7 1.2-4.3 3.5-4.3 7 0 2.4 1.4 4 3.7 4 2.1 0 3.5-1.5 3.5-3.6 0-2-1.4-3.3-3.2-3.3-.4 0-.8.1-1.1.2.5-1.4 1.5-2.5 3.2-3.2L15.8 7Z"/>,
    network: <><circle cx="5" cy="12" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="19" cy="19" r="2"/><path d="m6.8 11 10.4-5M6.8 13l10.4 5"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function Mark() {
  return <span className="mark" aria-hidden="true"><span/><i/></span>;
}

function Button({ children, href, onClick, variant = 'primary', className = '', external = false }: { children: ReactNode; href?: string; onClick?: () => void; variant?: 'primary' | 'secondary' | 'text'; className?: string; external?: boolean }) {
  const classes = `button button-${variant} ${className}`.trim();
  if (href) return <a className={classes} href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{children}</a>;
  return <button className={classes} type="button" onClick={onClick}>{children}</button>;
}

function PageLabel({ children }: { children: ReactNode }) {
  return <p className="section-label"><span/><span>{children}</span></p>;
}

function ExternalLink({ href, children, label }: { href: string; children: ReactNode; label?: string }) {
  return <a className="inline-link" href={href} target="_blank" rel="noreferrer" aria-label={label}>{children}<Icon name="external" size={14}/></a>;
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const content = <>
    <div className="product-card-top"><span className="product-icon"><Icon name={product.icon} size={22}/></span><span className="product-number">0{index + 1}</span></div>
    <div className="product-card-copy"><p>{product.category}</p><h3>{product.name}</h3><span>{product.description}</span></div>
    <div className="product-card-bottom">{product.url ? <><span>Visit platform</span><Icon name="arrow" size={18}/></> : <><span>{product.status ?? 'Learn more'}</span><Icon name="arrow" size={18}/></>}</div>
  </>;
  return product.url ? <a href={product.url} target="_blank" rel="noreferrer" className="product-card">{content}</a> : <article className="product-card">{content}</article>;
}

function SiteHeader({ route, navigate, theme, toggleTheme }: { route: Route; navigate: (route: Route) => void; theme: 'dark' | 'light'; toggleTheme: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const go = (to: Route) => { setMenuOpen(false); navigate(to); };
  return <header className="site-header">
    <a className="brand" href="/" onClick={(event) => { event.preventDefault(); go('/'); }} aria-label="N.O Group home"><Mark/><span>N.O <b>GROUP</b></span></a>
    <nav className="desktop-nav" aria-label="Primary navigation">{navItems.map((item) => <a key={item.route} className={route === item.route ? 'active' : ''} href={item.route} onClick={(event) => { event.preventDefault(); go(item.route); }}>{item.label}</a>)}</nav>
    <div className="header-actions"><button className="theme-switch" onClick={toggleTheme} type="button" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18}/></button><a href="/contact" onClick={(event) => { event.preventDefault(); go('/contact'); }} className="header-contact">Start a conversation <Icon name="arrow" size={16}/></a><button className="menu-button" type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}><Icon name={menuOpen ? 'close' : 'menu'} size={21}/></button></div>
    {menuOpen && <div className="mobile-menu"><nav aria-label="Mobile navigation">{[...navItems, { label: 'Intelligence', route: '/intelligence' as Route }, { label: 'Ventures', route: '/ventures' as Route }, { label: 'Contact', route: '/contact' as Route }].map((item) => <a key={item.route} href={item.route} onClick={(event) => { event.preventDefault(); go(item.route); }}>{item.label}<Icon name="arrow" size={18}/></a>)}</nav><p>Independent thinking.<br/>Infinite possibilities.</p></div>}
  </header>;
}

function HomePage({ navigate }: { navigate: (route: Route) => void }) {
  return <>
    <section className="home-hero">
      <div className="hero-noise" aria-hidden="true"/>
      <div className="hero-copy enter-up">
        <PageLabel>Independent technology group · Nigeria</PageLabel>
        <h1>A new perspective<br/><em>starts here.</em></h1>
        <p className="hero-lede">We build an interconnected ecosystem of developer infrastructure, artificial intelligence, publishing, and consumer software for the next generation of builders.</p>
        <div className="hero-actions"><Button onClick={() => navigate('/ecosystem')}>Explore the ecosystem <Icon name="arrow" size={18}/></Button><Button onClick={() => navigate('/contact')} variant="secondary">Partner with us <Icon name="arrow" size={18}/></Button></div>
      </div>
      <div className="hero-art" aria-label="N.O Group official logo">
        <div className="orb orb-one"/><div className="orb orb-two"/><div className="orb orb-three"/>
        <div className="logo-frame"><img src="/nogroup-logo.png" alt="N.O Group official logo"/></div>
        <div className="orbit-line orbit-line-a"/><div className="orbit-line orbit-line-b"/>
        <p className="hero-art-label">N.O Group<br/><span>Build better systems</span></p>
      </div>
      <div className="hero-bottom"><span>Scroll to discover</span><i/><span>Founded 19 · 07 · 2025</span></div>
    </section>

    <section className="signal-section section-pad">
      <div className="section-grid-title reveal"><PageLabel>Built for the long view</PageLabel><h2>Ideas deserve<br/><em>better systems.</em></h2></div>
      <div className="signal-copy reveal"><p>From first draft to durable platform, N.O Group is designed as an ecosystem: independent products that share a belief in clarity, capability, and access.</p><a href="/company" onClick={(event) => { event.preventDefault(); navigate('/company'); }} className="text-link">Meet N.O Group <Icon name="arrow" size={17}/></a></div>
      <div className="signal-stats reveal"><div><strong>01</strong><span>Independent, founder-led group</span></div><div><strong>08</strong><span>Core products and ventures</span></div><div><strong>01</strong><span>Connected operating philosophy</span></div></div>
    </section>

    <section className="feature-slab">
      <div className="feature-art" aria-hidden="true"><div className="feature-grid"/><div className="feature-ring"/><span>INFRASTRUCTURE<br/>FOR IMAGINATION</span></div>
      <div className="feature-copy"><PageLabel>Core capability</PageLabel><h2>Less infrastructure.<br/><em>More imagination.</em></h2><p>Vortex, Tungsten, and our cross-cloud foundations give builders a more focused place to create, deploy, and grow—without losing sight of the work that matters.</p><Button onClick={() => navigate('/infrastructure')} variant="secondary">Explore infrastructure <Icon name="arrow" size={18}/></Button></div>
    </section>

    <section className="section-pad ecosystem-preview">
      <div className="section-heading reveal"><div><PageLabel>The N.O Group ecosystem</PageLabel><h2>Many disciplines.<br/><em>One point of view.</em></h2></div><Button onClick={() => navigate('/ecosystem')} variant="text">View every venture <Icon name="arrow" size={18}/></Button></div>
      <div className="product-grid">{products.slice(0, 6).map((product, index) => <ProductCard product={product} index={index} key={product.name}/>)}</div>
    </section>

    <section className="principles-section section-pad">
      <div className="principles-intro"><PageLabel>How we build</PageLabel><h2>Focused by design.<br/><em>Open by nature.</em></h2></div>
      <div className="principles-list">
        <article><span>01</span><div><h3>Clarity before complexity</h3><p>We favour interfaces that make the next decision feel obvious—without reducing what a product can do.</p></div><Icon name="arrow-up" size={20}/></article>
        <article><span>02</span><div><h3>Access is an engineering principle</h3><p>Lean architectures, local-first thinking, and considerate performance make meaningful tools more reachable.</p></div><Icon name="arrow-up" size={20}/></article>
        <article><span>03</span><div><h3>Independent by design</h3><p>We build patiently, learn in public where we can, and let product usefulness lead the way.</p></div><Icon name="arrow-up" size={20}/></article>
      </div>
    </section>

    <section className="home-contact section-pad"><div className="contact-gradient" aria-hidden="true"/><div><PageLabel>Build with us</PageLabel><h2>Good work starts<br/>with a conversation.</h2></div><div className="home-contact-action"><p>For a platform, a partnership, a client need, or an idea worth exploring—our door is open.</p><Button onClick={() => navigate('/contact')}>Start a conversation <Icon name="arrow" size={18}/></Button></div></section>
  </>;
}

function EcosystemPage({ navigate }: { navigate: (route: Route) => void }) {
  return <>
    <PageHero eyebrow="The N.O Group ecosystem" title={<>A connected portfolio<br/>for <em>curious people.</em></>} copy="N.O Group brings infrastructure, intelligence, education, publishing, and consumer experiences together under a shared commitment to thoughtful software." art="constellation"/>
    <section className="section-pad directory-section"><div className="directory-heading"><PageLabel>Directory</PageLabel><p>Our ventures are built independently, but never in isolation. Each one carries a distinct purpose—and benefits from the perspective of the whole.</p></div><div className="directory-grid">{products.map((product, index) => <ProductCard key={product.name} product={product} index={index}/>)}</div></section>
    <section className="section-pad system-bridge"><div><PageLabel>More than a collection</PageLabel><h2>Shared context<br/>makes each venture<br/><em>stronger.</em></h2></div><div className="bridge-diagram"><div className="bridge-node center"><Mark/><span>N.O Group</span></div>{['Infrastructure', 'Intelligence', 'Publishing', 'Consumer'].map((item, index) => <div className={`bridge-node node-${index + 1}`} key={item}><span>{item}</span></div>)}</div></section>
    <section className="slim-cta"><div><p>Have a product, platform, or partnership in mind?</p><h2>Let’s make the next<br/><em>useful thing.</em></h2></div><Button onClick={() => navigate('/contact')}>Partner with us <Icon name="arrow" size={18}/></Button></section>
  </>;
}

function InfrastructurePage({ navigate }: { navigate: (route: Route) => void }) {
  const pillars: Array<[string, string, IconName, string]> = [
    ['Vortex cloud', 'A Cloudflare-native infrastructure and management dashboard for the practical work of building and operating applications.', 'cloud' as IconName, 'https://vortex.no-group.org'],
    ['Multi-cloud engine', 'A developing infrastructure layer designed to bring diverse cloud deployments into a coherent, low-friction operating surface.', 'network' as IconName, 'https://graphene.no-group.org'],
    ['Real-time sync', 'Low-latency data movement and live application states designed around the moments that need to stay connected.', 'layers' as IconName, 'https://tether.no-group.org'],
    ['Tungsten IDE', 'A visual and code-first environment where rapid prototyping, local capability, and code integrity can live side by side.', 'code' as IconName, 'https://tungsten.no-group.org'],
  ];
  return <>
    <PageHero eyebrow="Infrastructure and developer tools" title={<>Build without<br/><em>unnecessary weight.</em></>} copy="N.O Group creates systems for builders who want to spend more time making meaningful software and less time negotiating avoidable complexity." art="grid"/>
    <section className="section-pad narrative-layout"><aside><PageLabel>A foundation that holds</PageLabel></aside><div><h2>Infrastructure should feel<br/>like momentum—not <em>friction.</em></h2><p className="large-copy">We are developing an adaptable technical foundation for independent developers, emerging teams, and organisations with ambitious ideas and practical constraints.</p><p>It begins with the basics done carefully: usable tools, sane defaults, low-latency experiences, clear controls, and a respect for the bandwidth, budgets, and attention of the people using them.</p></div></section>
    <section className="pillar-list">{pillars.map(([title, text, icon, url], index) => <article key={title}><div className="pillar-number">0{index + 1}</div><span className="pillar-icon"><Icon name={icon} size={30}/></span><div><h3>{title}</h3><p>{text}</p></div><ExternalLink href={url as string} label={`Visit ${title}`}>Visit platform</ExternalLink></article>)}</section>
    <section className="section-pad capability-band"><div className="capability-word">BUILD</div><div><PageLabel>For builders at every stage</PageLabel><h2>Use less time managing<br/>the machinery.</h2><p>Whether you are shaping a first release or a more durable operating layer, N.O Group is working toward an ecosystem that helps useful products move forward.</p><Button onClick={() => navigate('/ecosystem')} variant="secondary">See the ecosystem <Icon name="arrow" size={18}/></Button></div></section>
  </>;
}

function IntelligencePage({ navigate }: { navigate: (route: Route) => void }) {
  return <>
    <PageHero eyebrow="Jeris artificial intelligence" title={<>Intelligence with<br/><em>room to think.</em></>} copy="Jeris is N.O Group’s multimodal AI initiative—an evolving foundation for useful, context-aware experiences across the ecosystem." art="pulse"/>
    <section className="section-pad intelligence-intro"><div><PageLabel>The initiative</PageLabel><h2>Not just a response.<br/>A better <em>relationship</em><br/>with possibility.</h2></div><div><p className="large-copy">Jeris is being shaped as a general-purpose intelligence layer: practical enough to support real products, thoughtful enough to respect the people using them.</p><ExternalLink href="https://jeris.no-group.org">Visit Jeris</ExternalLink></div></section>
    <section className="model-grid"><article className="model-card model-main"><span className="model-index">01</span><span className="model-orb"/><PageLabel>Jeris · Model Omini</PageLabel><h3>A capable assistant<br/>for the ecosystem.</h3><p>A general-purpose model initiative intended to support applications, exploration, and useful everyday workflows.</p><ExternalLink href="https://jeris.no-group.org">Explore Jeris</ExternalLink></article><article className="model-card"><span className="model-index">02</span><PageLabel>Jeris · Model Duo</PageLabel><h3>A personal<br/>digital twin study.</h3><p>An experimental architecture investigating more personal, context-sensitive digital experiences.</p><span className="status-chip">Experimental</span></article></section>
    <section className="ethics-section section-pad"><div className="ethics-icon"><Icon name="shield" size={34}/></div><div><PageLabel>How we approach AI</PageLabel><h2>Useful first.<br/><em>Human always.</em></h2></div><div className="ethics-list"><p><Icon name="check" size={17}/> Built around meaningful product use—not spectacle.</p><p><Icon name="check" size={17}/> Developed with clear interfaces and understandable controls.</p><p><Icon name="check" size={17}/> Grounded in the same accessibility and efficiency principles as the wider ecosystem.</p></div></section>
    <section className="slim-cta"><div><p>Interested in the Jeris initiative?</p><h2>Help shape a more<br/><em>useful intelligence.</em></h2></div><Button onClick={() => navigate('/contact')}>Start a conversation <Icon name="arrow" size={18}/></Button></section>
  </>;
}

function VenturesPage({ navigate }: { navigate: (route: Route) => void }) {
  const ventures = products.filter((product) => !['Vortex', 'Tungsten', 'Jeris'].includes(product.name));
  return <>
    <PageHero eyebrow="Consumer and creative ventures" title={<>Technology for the<br/><em>rest of life.</em></>} copy="Not every important experience begins in a dashboard. N.O Group is building lighter, clearer digital products for readers, creators, and everyday mobile life." art="ripple"/>
    <section className="section-pad venture-intro"><div><PageLabel>Beyond the platform</PageLabel><h2>Tools with a human<br/><em>point of view.</em></h2></div><p>Our consumer ventures explore what happens when capability meets care: when a reading experience supports curiosity, communication leaves room to breathe, and the web works even when conditions are less than ideal.</p></section>
    <section className="ventures-stack">{ventures.map((product, index) => <article className="venture-row" key={product.name}><span className="venture-count">0{index + 1}</span><span className="venture-icon"><Icon name={product.icon} size={27}/></span><div><p>{product.category}</p><h3>{product.name}</h3></div><p className="venture-description">{product.description}</p>{product.url ? <ExternalLink href={product.url}>Visit platform</ExternalLink> : <span className="status-chip">{product.status}</span>}</article>)}</section>
    <section className="section-pad tools-highlight"><div className="tools-art"><span>UTILITY<br/>WITHOUT<br/>UPLOADS</span><div/><div/><div/></div><div><PageLabel>Made for the open web</PageLabel><h2>Small utilities.<br/><em>Serious care.</em></h2><p>ToolsKit is a collection of browser-based utilities that keep work local wherever possible. From JSON to QR, simple jobs should not require a complicated handover.</p><ExternalLink href="https://toolskit.no-group.org">Open ToolsKit</ExternalLink></div></section>
    <section className="slim-cta"><div><p>Are you building something that should feel simpler?</p><h2>Let’s make digital<br/><em>life lighter.</em></h2></div><Button onClick={() => navigate('/contact')}>Work with N.O Group <Icon name="arrow" size={18}/></Button></section>
  </>;
}

function CompanyPage({ navigate }: { navigate: (route: Route) => void }) {
  return <>
    <PageHero eyebrow="The company" title={<>Independent thinking.<br/><em>Infinite possibilities.</em></>} copy="N.O Group is a Nigerian technology holding company and innovation ecosystem building connected products for the people making what comes next." art="monogram"/>
    <section className="section-pad story-section"><div className="story-stamp"><span>19</span><i>JULY</i><strong>2025</strong></div><div><PageLabel>Where it began</PageLabel><h2>Built from conviction,<br/>not a template.</h2><p className="large-copy">N.O Group was founded by Jason N.O Jeremiah as an independent home for products that make powerful technology feel more approachable, capable, and alive.</p><p>Its name is rooted in the Nwezeh-Onuh family name. Its ambition is rooted in practical work: build what is useful, keep learning, and let each product create a stronger foundation for the next.</p></div></section>
    <section className="founder-section"><div className="founder-portrait"><div className="founder-photo-rings" aria-hidden="true"/><div className="founder-photo-frame"><img src="/jason-n-o-jeremiah.jpg" alt="Jason N.O Jeremiah, Founder and CEO of N.O Group"/></div><div className="founder-logo-badge"><img src="/nogroup-logo.png" alt="N.O Group logo"/></div><small>FOUNDER<br/>AND CEO</small></div><div className="founder-copy"><Icon name="quote" size={37}/><blockquote>“I wanted to prove that ambitious, useful technology can begin with clarity, persistence, and a willingness to build.”</blockquote><p>Jason N.O Jeremiah<br/><span>Founder and CEO, N.O Group</span></p></div></section>
    <section className="section-pad operating-section"><div><PageLabel>Operating philosophy</PageLabel><h2>Lean by default.<br/><em>Ambitious by nature.</em></h2></div><div className="operating-cards"><article><Icon name="layers" size={26}/><h3>Minimal interfaces</h3><p>Clutter-free products place attention where it can make the most difference.</p></article><article><Icon name="shield" size={26}/><h3>Thoughtful foundations</h3><p>Open-source technologies, local assets, and pragmatic architecture keep momentum within reach.</p></article><article><Icon name="globe" size={26}/><h3>Accessible ambition</h3><p>We make for builders and consumers navigating a range of devices, budgets, and connections.</p></article></div></section>
    <section className="section-pad company-note"><PageLabel>From Nigeria, for everywhere</PageLabel><h2>A local point of view<br/>with a <em>global horizon.</em></h2><p>N.O Group is growing from Nigeria into a wider conversation about what independent technology can become.</p><Button onClick={() => navigate('/contact')}>Meet the group <Icon name="arrow" size={18}/></Button></section>
  </>;
}

function ContactPage() {
  const [sent, setSent] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSent(true); };
  return <>
    <PageHero eyebrow="Contact N.O Group" title={<>Let’s build something<br/><em>that matters.</em></>} copy="Whether you are a partner, client, developer, member of the press, or simply have an idea worth sharing, we would like to hear from you." art="contact"/>
    <section className="contact-layout section-pad"><div className="contact-details"><PageLabel>Direct channels</PageLabel><h2>Start with a<br/><em>simple hello.</em></h2><div className="contact-options"><a href="mailto:contact@no-group.org"><span><Icon name="mail" size={19}/></span><div><small>General and partnerships</small><strong>contact@no-group.org</strong></div><Icon name="arrow" size={18}/></a><a href="mailto:support@no-group.org"><span><Icon name="tool" size={19}/></span><div><small>Product support</small><strong>support@no-group.org</strong></div><Icon name="arrow" size={18}/></a><a href="mailto:press@no-group.org"><span><Icon name="quote" size={19}/></span><div><small>Media and press</small><strong>press@no-group.org</strong></div><Icon name="arrow" size={18}/></a><a href="tel:+2347075536341"><span><Icon name="phone" size={19}/></span><div><small>Phone</small><strong>+234 (0) 707 5536 341</strong></div><Icon name="arrow" size={18}/></a><a href="https://wa.me/2347075536341" target="_blank" rel="noreferrer"><span><Icon name="message" size={19}/></span><div><small>WhatsApp</small><strong>+234 (0) 707 5536 341</strong></div><Icon name="external" size={18}/></a></div><div className="location-line"><Icon name="location" size={18}/><span>Nigeria · collaborating globally</span></div></div>
      <form className="inquiry-form" onSubmit={submit}><PageLabel>Send an inquiry</PageLabel><div className="form-grid"><label>Your name<input required name="name" autoComplete="name" placeholder="Name"/></label><label>Your email<input required name="email" type="email" autoComplete="email" placeholder="you@company.com"/></label><label className="full">I am reaching out as<select name="role" defaultValue=""><option value="" disabled>Select one</option><option>Partner or collaborator</option><option>Client</option><option>Developer or builder</option><option>Press</option><option>Something else</option></select></label><label className="full">Tell us a little about it<textarea required name="message" placeholder="What would you like to build, explore, or discuss?" rows={5}/></label></div>{sent ? <p className="form-success"><Icon name="check" size={18}/> Thank you. Your message is ready to send—please email us directly at contact@no-group.org.</p> : <button className="button button-primary" type="submit">Prepare my inquiry <Icon name="arrow" size={18}/></button>}<p className="form-note">This form does not upload your message. It helps us keep the conversation focused; use our direct email to send it.</p></form></section>
    <section className="section-pad social-section"><div><PageLabel>Follow the work</PageLabel><h2>Stay close to<br/>what we’re <em>making.</em></h2></div><div className="social-links"><ExternalLink href="https://github.com/NO-Group"><Icon name="github" size={22}/> GitHub</ExternalLink><ExternalLink href="https://discord.gg/3q2VQq9DAh"><Icon name="discord" size={22}/> Discord</ExternalLink><ExternalLink href="https://bsky.app/profile/no-group.bsky.social"><Icon name="bluesky" size={22}/> Bluesky</ExternalLink></div></section>
  </>;
}

function PageHero({ eyebrow, title, copy, art }: { eyebrow: string; title: ReactNode; copy: string; art: 'constellation' | 'grid' | 'pulse' | 'ripple' | 'monogram' | 'contact' }) {
  return <section className={`page-hero page-hero-${art}`}><div className="page-hero-copy"><PageLabel>{eyebrow}</PageLabel><h1>{title}</h1><p>{copy}</p></div><div className="page-hero-art" aria-hidden="true"><div className="art-shape art-shape-one"/><div className="art-shape art-shape-two"/><div className="art-shape art-shape-three"/>{art === 'monogram' && <span className="art-monogram">N.O</span>}{art === 'contact' && <Icon name="mail" size={54}/>}</div></section>;
}

function SiteFooter({ navigate }: { navigate: (route: Route) => void }) {
  return <footer className="site-footer"><div className="footer-top"><div className="footer-brand"><a href="/" onClick={(event) => { event.preventDefault(); navigate('/'); }} className="brand"><Mark/><span>N.O <b>GROUP</b></span></a><p>Independent thinking.<br/>Infinite possibilities.</p></div>{footerGroups.map((group) => <div className="footer-links" key={group.title}><h3>{group.title}</h3>{group.items.map((item) => item.route ? <a key={item.label} href={item.route} onClick={(event) => { event.preventDefault(); navigate(item.route!); }}>{item.label}</a> : <a key={item.label} href={item.url} target={item.url?.startsWith('http') ? '_blank' : undefined} rel={item.url?.startsWith('http') ? 'noreferrer' : undefined}>{item.label}{item.url?.startsWith('http') && <Icon name="external" size={12}/>}</a>)}</div>)}</div><div className="footer-bottom"><span>© {new Date().getFullYear()} N.O Group. Built in Nigeria.</span><div><a href="/sitemap.xml">Sitemap</a><a href="mailto:contact@no-group.org">contact@no-group.org</a></div></div></footer>;
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => getRoute(window.location.pathname));
  const [theme, setTheme] = useState<'dark' | 'light'>(() => window.localStorage.getItem('no-group-theme') === 'light' ? 'light' : 'dark');
  const navigate = (to: Route) => { window.history.pushState({}, '', to); setRoute(to); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const toggleTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');

  useEffect(() => { const syncRoute = () => setRoute(getRoute(window.location.pathname)); window.addEventListener('popstate', syncRoute); return () => window.removeEventListener('popstate', syncRoute); }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.style.colorScheme = theme; window.localStorage.setItem('no-group-theme', theme); }, [theme]);
  useEffect(() => { const titles: Record<Route, string> = { '/': 'N.O Group — A new perspective starts here', '/ecosystem': 'Ecosystem — N.O Group', '/infrastructure': 'Infrastructure — N.O Group', '/intelligence': 'Jeris AI — N.O Group', '/ventures': 'Ventures — N.O Group', '/company': 'Company — N.O Group', '/contact': 'Contact — N.O Group' }; document.title = titles[route]; }, [route]);

  let page: ReactNode;
  if (route === '/ecosystem') page = <EcosystemPage navigate={navigate}/>;
  else if (route === '/infrastructure') page = <InfrastructurePage navigate={navigate}/>;
  else if (route === '/intelligence') page = <IntelligencePage navigate={navigate}/>;
  else if (route === '/ventures') page = <VenturesPage navigate={navigate}/>;
  else if (route === '/company') page = <CompanyPage navigate={navigate}/>;
  else if (route === '/contact') page = <ContactPage/>;
  else page = <HomePage navigate={navigate}/>;

  return <div className="site-shell"><a className="skip-link" href="#main-content">Skip to content</a><SiteHeader route={route} navigate={navigate} theme={theme} toggleTheme={toggleTheme}/><main id="main-content">{page}</main><SiteFooter navigate={navigate}/></div>;
}
