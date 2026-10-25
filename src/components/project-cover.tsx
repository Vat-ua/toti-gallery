"use client";

import { useState } from "react";
import { Icon } from "./icon";

const PALETTES: Record<string, string> = { abstract: "poster-tipo", eco: "poster-bloco", books: "poster-grade", finance: "poster-arco", connect: "poster-faisca", weather: "poster-duo", quiz: "poster-codigo" };
const TAGS: Record<string, string> = { eco: "Produto digital", books: "Interface", finance: "Produto digital", connect: "Comunidade", weather: "API", quiz: "Desafio", abstract: "Projeto" };

function tagFor(style: string) { return TAGS[style] || "Projeto"; }
function titleSize(title: string) {
  const longest = title.split(/\s+/).reduce((size, word) => Math.max(size, word.length), 0);
  if (longest > 12) return 8;
  if (longest > 9) return 9.6;
  if (title.length > 22) return 10.5;
  if (title.length > 14) return 12;
  return 14;
}
function Poster({ title, style }: { title: string; style: string }) {
  const number = String(title.split("").reduce((total, char) => total + char.charCodeAt(0), 0) % 97 + 1).padStart(2, "0");
  const tag = tagFor(style);
  const heading = <span className="poster-title" style={{ fontSize: `${titleSize(title)}cqw` }}>{title}</span>;
  return <div className={`poster ${PALETTES[style] || "poster-tipo"}`}>
    <div className="poster-top"><span className="poster-brand">toti<span>/</span>gallery</span><span className="poster-number">nº {number}</span></div>
    {style === "eco" && <><span className="poster-bloko-strip" aria-hidden="true"/>{heading}</>}
    {style === "books" && <><div className="poster-grade-grid" aria-hidden="true"/>{heading}</>}
    {style === "finance" && <><span className="poster-arco-arc a" aria-hidden="true"/><span className="poster-arco-arc b" aria-hidden="true"/><span className="poster-arco-arc c" aria-hidden="true"/><span className="poster-arco-plus" aria-hidden="true">+</span>{heading}</>}
    {style === "connect" && <><span className="poster-faisca-rays" aria-hidden="true"/><span className="poster-faisca-star" aria-hidden="true">✳</span>{heading}</>}
    {style === "weather" && <><span className="poster-duo-sun" aria-hidden="true"/><span className="poster-duo-line" aria-hidden="true"/>{heading}</>}
    {style === "quiz" && <><div className="poster-codigo-grid" aria-hidden="true"/><span className="poster-codigo-code" aria-hidden="true">&lt;/&gt;</span>{heading}</>}
    {style === "abstract" && <><span className="poster-tipo-star" aria-hidden="true">✳</span>{heading}<span className="poster-tipo-rule" aria-hidden="true"/></>}
    <div className="poster-bottom"><span className="poster-bottom-label">{tag}</span><span className="poster-bottom-mark" aria-hidden="true">→</span></div>
  </div>;
}

type ProjectCoverProps = { title: string; style?: string; imageUrl?: string | null; className?: string };

export function ProjectCover(props: ProjectCoverProps) {
  return <ProjectCoverContent key={props.imageUrl || "poster"} {...props}/>;
}
function ProjectCoverContent({ title, style = "abstract", imageUrl, className = "" }: ProjectCoverProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = Boolean(imageUrl) && !imageFailed;
  return <div className={`project-cover cover-${style} ${hasImage ? "has-image" : "has-poster"} ${className}`} role="img" aria-label={`Capa do projeto ${title}`}>
    <div className="cover-art" aria-hidden="true">
      {hasImage ? <img className="custom-cover-image" src={imageUrl as string} alt="" loading="lazy" onError={() => setImageFailed(true)}/> : <Poster title={title} style={style}/>}
    </div>
    <span className="cover-hover" aria-hidden="true"><Icon name="arrow-up-right" size={20}/></span>
  </div>;
}
