import type { Metadata } from "next";
import { unified } from "unified";
import remarkParse from "remark-parse";

export const siteTitle = "Toti Gallery — projetos da comunidade Toti";
export const siteDescription = "Exercícios, experimentos e aplicações completas publicados por estudantes e pessoas formadas nas turmas da Toti.";

const parser = unified().use(remarkParse);
type MarkdownNode = { type: string; value?: string; children?: MarkdownNode[] };

function textContent(node: MarkdownNode): string {
  switch (node.type) {
    case "text":
    case "inlineCode": return node.value || "";
    case "break": return " ";
    // Match the description renderer's omission of HTML/images; code blocks and
    // reference definitions are not useful in a short sharing description.
    case "html":
    case "image":
    case "imageReference":
    case "code":
    case "definition": return "";
    default: {
      const inline = ["paragraph", "heading", "emphasis", "strong", "link", "linkReference"].includes(node.type);
      return (node.children || []).map(textContent).join(inline ? "" : " ");
    }
  }
}

/** Parse CommonMark rather than stripping punctuation from user-authored text. */
export function metadataDescription(markdown: string): string {
  const text = textContent(parser.parse(markdown)).replace(/\s+/g, " ").trim();
  const characters = Array.from(text);
  if (characters.length <= 160) return text;
  const excerpt = characters.slice(0, 159).join("");
  const lastSpace = excerpt.lastIndexOf(" ");
  return `${(lastSpace > excerpt.length * 0.6 ? excerpt.slice(0, lastSpace) : excerpt).trimEnd()}…`;
}

/** Complete nested social metadata: Next.js replaces, rather than deep-merges it. */
export function sharingMetadata({ title = siteTitle, description = siteDescription, path = "/", canonical = true }: {
  title?: string; description?: string; path?: string; canonical?: boolean;
} = {}): Metadata {
  const summary = metadataDescription(description) || siteDescription;
  const socialTitle = title === siteTitle ? title : `${title} · Toti Gallery`;
  const image = { url: "/social-card.png", width: 1200, height: 630, alt: "Toti Gallery — Projetos de quem aprende fazendo." };
  return {
    title,
    description: summary,
    alternates: { canonical: canonical ? path : null },
    openGraph: {
      type: "website", locale: "pt_BR", siteName: "Toti Gallery",
      title: socialTitle, description: summary, url: path, images: [image],
    },
    twitter: {
      card: "summary_large_image", title: socialTitle, description: summary,
      images: [{ url: image.url, alt: image.alt }],
    },
  };
}
