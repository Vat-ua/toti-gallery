"use client";

import { useEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { Icon } from "./icon";
import { coverThumbnail } from "@/lib/image-policy";
import { DEFAULT_COVER_FRAMING, moveCoverFraming, type CoverFraming } from "@/lib/cover-framing";

const PALETTES: Record<string, string> = { abstract: "poster-tipo", eco: "poster-bloco", books: "poster-grade", finance: "poster-arco", connect: "poster-faisca", weather: "poster-duo", quiz: "poster-codigo" };
function titleSize(title: string) {
  const longest = title.split(/\s+/).reduce((size, word) => Math.max(size, word.length), 0);
  if (longest > 12) return 8;
  if (longest > 9) return 9.6;
  if (title.length > 22) return 10.5;
  if (title.length > 14) return 12;
  return 14;
}
function Poster({ title, style }: { title: string; style: string }) {
  const heading = <span className="poster-title" style={{ fontSize: `${titleSize(title)}cqw` }}>{title}</span>;
  return <div className={`poster ${PALETTES[style] || "poster-tipo"}`}>
    {style === "eco" && <><span className="poster-bloko-strip" aria-hidden="true"/>{heading}</>}
    {style === "books" && <><div className="poster-grade-grid" aria-hidden="true"/>{heading}</>}
    {style === "finance" && <><span className="poster-arco-arc a" aria-hidden="true"/><span className="poster-arco-arc b" aria-hidden="true"/><span className="poster-arco-arc c" aria-hidden="true"/><span className="poster-arco-plus" aria-hidden="true">+</span>{heading}</>}
    {style === "connect" && <><span className="poster-faisca-rays" aria-hidden="true"/><span className="poster-faisca-star" aria-hidden="true">✳</span>{heading}</>}
    {style === "weather" && <><span className="poster-duo-sun" aria-hidden="true"/><span className="poster-duo-line" aria-hidden="true"/>{heading}</>}
    {style === "quiz" && <><div className="poster-codigo-grid" aria-hidden="true"/><span className="poster-codigo-code" aria-hidden="true">&lt;/&gt;</span>{heading}</>}
    {style === "abstract" && <><span className="poster-tipo-star" aria-hidden="true">✳</span>{heading}<span className="poster-tipo-rule" aria-hidden="true"/></>}
  </div>;
}

type ProjectCoverProps = { title: string; style?: string; imageUrl?: string | null; isFinal?: boolean; className?: string; fullSize?: boolean;
  framing?: CoverFraming | null; onFramingChange?: (value: CoverFraming) => void; cropHelpId?: string;
  onImageStatusChange?: (status: "ready" | "error") => void };

export function ProjectCover(props: ProjectCoverProps) {
  return <ProjectCoverContent key={props.imageUrl || "poster"} {...props}/>;
}
function ProjectCoverContent({ title, style = "abstract", imageUrl, isFinal = false, className = "", fullSize = false, framing, onFramingChange, cropHelpId, onImageStatusChange }: ProjectCoverProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // A cached image can finish loading before hydration attaches onLoad.
    if (imageRef.current?.complete && imageRef.current.naturalWidth) onImageStatusChange?.("ready");
  }, [onImageStatusChange]);
  const drag = useRef<{ pointerId: number; x: number; y: number; frame: CoverFraming } | null>(null);
  const hasImage = Boolean(imageUrl) && !imageFailed;
  const frame = framing || DEFAULT_COVER_FRAMING;
  function move(dx: number, dy: number, surface: HTMLElement, start = frame) {
    const image = imageRef.current;
    if (image && onFramingChange) onFramingChange(moveCoverFraming(start, dx, dy, image.naturalWidth, image.naturalHeight, surface.clientWidth, surface.clientHeight));
  }
  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || !imageRef.current?.naturalWidth) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, frame };
  }
  function dragImage(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    if (start?.pointerId === event.pointerId) move(event.clientX - start.x, event.clientY - start.y, event.currentTarget, start.frame);
  }
  function moveWithKeyboard(event: KeyboardEvent<HTMLButtonElement>) {
    const directions: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 10;
    move(direction[0] * step, direction[1] * step, event.currentTarget);
  }
  return <div className={`project-cover cover-${style} ${hasImage ? "has-image" : "has-poster"} ${onFramingChange && hasImage ? "is-cropping" : ""} ${className}`} role={onFramingChange && hasImage ? "group" : "img"} aria-label={`Capa do projeto ${title}${isFinal ? ", projeto final" : ""}`}>
    <div className="cover-art" aria-hidden="true">
      {hasImage ? <img ref={imageRef} className="custom-cover-image" src={fullSize || frame.zoom > 1 ? imageUrl! : coverThumbnail(imageUrl!)} alt="" loading="lazy"
        onLoad={() => onImageStatusChange?.("ready")} onError={() => { setImageFailed(true); onImageStatusChange?.("error"); }}
        style={framing ? { objectPosition: `${frame.x}% ${frame.y}%`, transform: `scale(${frame.zoom})`, transformOrigin: `${frame.x}% ${frame.y}%` } : undefined}/> : <Poster title={title} style={style}/>}
    </div>
    {onFramingChange && hasImage && <button type="button" className="cover-crop-surface" aria-label="Mover imagem da capa" aria-describedby={cropHelpId}
      onPointerDown={beginDrag} onPointerMove={dragImage} onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={moveWithKeyboard}/>}
    {isFinal && <span className="project-final-badge cover-final-badge" aria-hidden="true">Projeto final</span>}
    <span className="cover-hover" aria-hidden="true"><Icon name="arrow-up-right" size={20}/></span>
  </div>;
}
