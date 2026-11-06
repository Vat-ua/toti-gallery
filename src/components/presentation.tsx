"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { Icon } from "./icon";
import { adminScreens, entities, presentationImages, presentationTabs, relations, studentSteps, type EntityId, type PresentationImage, type PresentationTab } from "@/lib/presentation-data";

function subscribeTab(listener: () => void) {
  window.addEventListener("hashchange", listener);
  window.addEventListener("popstate", listener);
  return () => { window.removeEventListener("hashchange", listener); window.removeEventListener("popstate", listener); };
}
function readTab(): PresentationTab {
  return presentationTabs.find(tab => `#${tab.id}` === location.hash)?.id ?? "projeto";
}

export function Presentation({ authenticated }: { authenticated: boolean }) {
  const active = useSyncExternalStore(subscribeTab, readTab, () => "projeto" as PresentationTab);
  const tabs = useRef<HTMLDivElement>(null);
  const [studentStep, setStudentStep] = useState(0);
  const [adminScreen, setAdminScreen] = useState(0);
  const [expanded, setExpanded] = useState<{ image: PresentationImage; alt: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (expanded) dialog.current?.showModal(); else dialog.current?.close(); }, [expanded]);
  function select(id: PresentationTab, focus = false) {
    window.history.replaceState(window.history.state, "", `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    const button = tabs.current?.querySelector<HTMLButtonElement>(`#presentation-tab-${id}`);
    if (focus) button?.focus();
    button?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function tabKeys(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next = event.key === "ArrowRight" ? (index + 1) % presentationTabs.length : event.key === "ArrowLeft" ? (index + presentationTabs.length - 1) % presentationTabs.length : event.key === "Home" ? 0 : event.key === "End" ? presentationTabs.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); select(presentationTabs[next].id, true); }
  }
  function screen(image: PresentationImage, alt: string, priority = false) {
    return <figure className="presentation-screen">
      <button type="button" onClick={() => setExpanded({ image, alt })} aria-label={`Ampliar imagem: ${alt}`}>
        <Image src={`/presentation/${image}.webp`} alt={alt} {...presentationImages[image]} sizes="(max-width: 1000px) 100vw, 900px" preload={priority}/>
        <span className="presentation-zoom"><Icon name="external" size={15}/>Ampliar</span>
      </button>
      <figcaption>Interface da plataforma com dados fictícios.</figcaption>
    </figure>;
  }
  const step = studentSteps[studentStep];
  const admin = adminScreens[adminScreen];
  return <main id="conteudo" className="container presentation-page">
    <header className="presentation-heading">
      <div><p className="presentation-kicker">Apresentação do projeto</p><h1>Do exercício ao <span><em>projeto final</em>.</span></h1></div>
      <div className="presentation-heading-copy"><p>Uma plataforma criada por estudantes para reunir projetos, reconhecer cada autoria e aproximar quem está aprendendo.</p><a href="https://github.com/Vat-ua/toti-gallery" target="_blank" rel="noopener noreferrer" className="presentation-source"><Icon name="github" size={18}/>Código no GitHub<Icon name="arrow-up-right" size={16}/></a></div>
    </header>

    <div ref={tabs} className="presentation-tabs" role="tablist" aria-label="Seções da apresentação">{presentationTabs.map((tab, index) => <button key={tab.id} id={`presentation-tab-${tab.id}`} role="tab" type="button" aria-selected={active === tab.id} aria-controls={`presentation-panel-${tab.id}`} tabIndex={active === tab.id ? 0 : -1} onClick={() => select(tab.id)} onKeyDown={event => tabKeys(event, index)}><span aria-hidden="true">0{index + 1}</span>{tab.label}</button>)}</div>

    <section className="presentation-panel" id="presentation-panel-projeto" role="tabpanel" aria-labelledby="presentation-tab-projeto" hidden={active !== "projeto"} tabIndex={0}>
      <div className="presentation-split">
        <div className="presentation-copy"><h2>O trabalho de cada turma, em um só lugar.</h2><p>Durante o curso, os projetos acabam espalhados entre repositórios e links. Fica difícil conhecer o que outras pessoas estão criando.</p><p>A Toti Gallery reúne esses trabalhos em uma galeria pesquisável, com perfis, tecnologias, turmas e projetos finais.</p><Link className="button button-dark" href="/">Explorar galeria<Icon name="arrow-right" size={17}/></Link></div>
        {screen("galeria", "Galeria de projetos com busca, filtros e capas", true)}
      </div>
      <div className="presentation-principles">
        <article><span>01</span><h3>Publicar sem complicar</h3><p>Uma descrição, o repositório e uma capa. Prévia e enquadramento ajudam a preparar a publicação.</p></article>
        <article><span>02</span><h3>Valorizar a equipe</h3><p>Um trabalho em grupo tem uma publicação e aparece nos perfis de todos os autores.</p></article>
        <article><span>03</span><h3>Manter a comunidade organizada</h3><p>Turmas, acesso e moderação têm uma área própria, separada da experiência pública.</p></article>
      </div>
      <p className="presentation-note">Uma iniciativa de estudantes, veja <Link href="/sobre">Sobre a plataforma<Icon name="arrow-right" size={14}/></Link></p>
    </section>

    <section className="presentation-panel" id="presentation-panel-pratica" role="tabpanel" aria-labelledby="presentation-tab-pratica" hidden={active !== "pratica"} tabIndex={0}>
      <div className="presentation-section-heading"><h2>Da ideia à publicação.</h2><p>A mesma experiência para exercícios, experimentos e projetos finais — individuais ou em equipe.</p></div>
      <div className="presentation-split">
        <div className="presentation-copy"><div className="presentation-steps" aria-label="Etapas de publicação">{studentSteps.map((item, index) => <button type="button" key={item.title} aria-pressed={studentStep === index} onClick={() => setStudentStep(index)}><span>0{index + 1}</span><strong>{item.title}</strong></button>)}</div><p>{step.text}</p><Link href={authenticated ? "/meus-projetos" : "/demo"} className="button button-dark">{authenticated ? "Meus projetos" : "Experimentar demonstração"}<Icon name="arrow-right" size={17}/></Link></div>
        {screen(step.image, step.alt)}
      </div>
      <div className="presentation-authorship" aria-label="Exemplo de projeto colaborativo"><div><strong>1</strong><span>publicação na galeria</span></div><Icon name="arrow-right" size={24}/><div><strong>6</strong><span>autores reconhecidos</span></div><Icon name="arrow-right" size={24}/><div><strong>6</strong><span>perfis com o mesmo projeto</span></div><p>Exemplo de uma equipe. A autoria permanece mesmo quando alguém muda de turma.</p></div>
    </section>

    <section className="presentation-panel" id="presentation-panel-administracao" role="tabpanel" aria-labelledby="presentation-tab-administracao" hidden={active !== "administracao"} tabIndex={0}>
      <div className="presentation-section-heading"><h2>Da turma à moderação.</h2><p>Quatro áreas para organizar a plataforma. As imagens mostram a interface real com registros fictícios.</p></div>
      <div className="presentation-split">
        <div className="presentation-copy"><div className="presentation-admin-options" aria-label="Áreas da administração">{adminScreens.map((item, index) => <button key={item.id} type="button" aria-pressed={adminScreen === index} onClick={() => setAdminScreen(index)}><Icon name={item.icon} size={18}/>{item.title}<Icon name="arrow-right" size={16}/></button>)}</div><h3>{admin.title}</h3><p>{admin.text}</p><ul>{admin.capabilities.map(item => <li key={item}>{item}</li>)}</ul></div>
        {screen(admin.id, admin.alt)}
      </div>
    </section>

    <section className="presentation-panel" id="presentation-panel-tecnologia" role="tabpanel" aria-labelledby="presentation-tab-tecnologia" hidden={active !== "tecnologia"} tabIndex={0}>
      <div className="presentation-section-heading"><h2>Como a plataforma funciona.</h2><p>Interface, regras de negócio e persistência têm responsabilidades distintas.</p></div>
      <div className="presentation-architecture">
        <article><Icon name="grid" size={23}/><h3>Interface</h3><strong>Next.js · React · TypeScript</strong><p>Páginas públicas, publicação e administração. Estilos compartilhados, Radix e Lucide mantêm os controles consistentes.</p></article>
        <article><Icon name="code" size={23}/><h3>Servidor</h3><strong>Route Handlers · Better Auth</strong><p>Validação, permissões e operações transacionais. Google e email/senha dão acesso ao mesmo cadastro provisionado.</p></article>
        <article><Icon name="database" size={23}/><h3>Dados e imagens</h3><strong>PostgreSQL · Drizzle · Neon</strong><p>Dados relacionais no PostgreSQL e arquivos no Object Storage. Imagens são otimizadas em WebP, com versões para exibição.</p></article>
      </div>
      <DataModel/>
      <div className="presentation-engineering"><article><h3>Proteção contra erros reais</h3><p>Versões detectam edições concorrentes. Recibos evitam publicações duplicadas em tentativas repetidas. Curtidas usam o estado desejado, em vez de alternar cegamente.</p></article><article><h3>Verificações durante o desenvolvimento</h3><p>Testes unitários e de integração cobrem operações críticas. Playwright verifica fluxos no navegador; o CI executa um conjunto isolado de regressão em desktop e mobile.</p></article><article><h3>Demonstração sem dados reais</h3><p>O estudante fictício usa IndexedDB no navegador. Seus projetos, imagens e curtidas ficam locais; o modo demo não concede uma sessão autenticada.</p></article></div>
      <details className="presentation-follow-up"><summary>O que ainda está em evolução</summary><p>O protótipo já gera links de ativação e recuperação, compartilhados manualmente. O envio automático de emails é uma próxima etapa. A evolução da interface continua a partir de testes e feedback de uso.</p></details>
    </section>

    <dialog ref={dialog} className="presentation-lightbox" aria-labelledby="presentation-image-title" onCancel={() => setExpanded(null)} onClick={event => { if (event.target === event.currentTarget) setExpanded(null); }}>
      <div className="presentation-lightbox-heading"><h2 id="presentation-image-title">{expanded?.alt}</h2><button type="button" className="button button-outline" onClick={() => setExpanded(null)} aria-label="Fechar imagem"><Icon name="x" size={20}/></button></div>
      {expanded && <div className="presentation-lightbox-image" tabIndex={0} role="region" aria-label="Imagem ampliada; use a rolagem para ver os detalhes"><Image src={`/presentation/${expanded.image}.webp`} alt={expanded.alt} {...presentationImages[expanded.image]} sizes="(max-width: 1280px) 1280px, 95vw"/></div>}
    </dialog>
  </main>;
}

function DataModel() {
  const [selected, setSelected] = useState<EntityId>("projects");
  const graph = useRef<HTMLDivElement>(null);
  const [wires, setWires] = useState<{ width: number; height: number; paths: { key: string; path: string; from: EntityId; to: EntityId }[] }>({ width: 1, height: 1, paths: [] });
  useEffect(() => {
    const element = graph.current;
    if (!element) return;
    function measure() {
      if (!element?.clientWidth) return;
      const canvas = element.getBoundingClientRect();
      const rects = new Map(entities.map(entity => [entity.id, element.querySelector<HTMLElement>(`[data-entity="${entity.id}"]`)!.getBoundingClientRect()]));
      const paths = relations.map(relation => {
        const a = rects.get(relation.from)!, b = rects.get(relation.to)!;
        const ax = a.left - canvas.left + a.width / 2, bx = b.left - canvas.left + b.width / 2;
        const ay = a.top - canvas.top + a.height / 2, by = b.top - canvas.top + b.height / 2;
        const horizontal = Math.abs(ay - by) < 20;
        const x1 = horizontal ? ax + (ax < bx ? a.width / 2 : -a.width / 2) : ax;
        const x2 = horizontal ? bx + (ax < bx ? -b.width / 2 : b.width / 2) : bx;
        const y1 = horizontal ? ay : ay + (ay < by ? a.height / 2 : -a.height / 2);
        const y2 = horizontal ? by : by + (ay < by ? -b.height / 2 : b.height / 2);
        const acrossNode = horizontal && Math.abs(ax - bx) > a.width * 1.8;
        const bottom = Math.max(a.bottom, b.bottom) - canvas.top;
        const path = acrossNode ? `M${ax},${bottom} C${ax},${canvas.height-4} ${bx},${canvas.height-4} ${bx},${bottom}` : horizontal ? `M${x1},${y1} C${(x1+x2)/2},${y1} ${(x1+x2)/2},${y2} ${x2},${y2}` : `M${x1},${y1} C${x1},${(y1+y2)/2} ${x2},${(y1+y2)/2} ${x2},${y2}`;
        return { key: `${relation.from}-${relation.to}`, path, from: relation.from, to: relation.to };
      });
      setWires({ width: canvas.width, height: canvas.height, paths });
    }
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const entity = entities.find(item => item.id === selected)!;
  const connected = relations.filter(relation => relation.from === selected || relation.to === selected);
  return <section className="presentation-model" aria-labelledby="presentation-model-title">
    <div className="presentation-section-heading"><h3 id="presentation-model-title">Um projeto, várias relações.</h3><p>Selecione uma tabela para conhecer seu papel e destacar as conexões.</p></div>
    <div className="presentation-model-layout">
      <div className="presentation-model-scroll" tabIndex={0} role="region" aria-label="Diagrama das tabelas principais, com rolagem horizontal em telas pequenas">
        <div className="presentation-graph" ref={graph}>
          <svg viewBox={`0 0 ${wires.width} ${wires.height}`} aria-hidden="true">{wires.paths.map(wire => <path key={wire.key} d={wire.path} className={wire.from === selected || wire.to === selected ? "is-connected" : ""}/>)}</svg>
          {entities.map(item => <button type="button" className="presentation-entity" key={item.id} data-entity={item.id} aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}><strong>{item.label}</strong><code>{item.table}</code><span>{item.fields.map(field => <span key={field}>{field}</span>)}</span></button>)}
        </div>
      </div>
      <aside className="presentation-inspector" aria-live="polite" aria-atomic="true"><h4>{entity.label}</h4><p>{entity.text}</p><ul>{connected.map(relation => <li key={`${relation.from}-${relation.to}`}>{relation.text}</li>)}</ul></aside>
    </div>
    <p className="presentation-model-note">Recorte das seis tabelas principais. Autenticação e controle de operações usam tabelas de apoio. PK: chave primária. FK: chave estrangeira.</p>
  </section>;
}
