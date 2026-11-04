import Markdown, { defaultUrlTransform } from "react-markdown";

const elements = ["p", "br", "strong", "em", "ul", "ol", "li", "blockquote", "pre", "code", "a", "h1", "h2", "h3", "h4", "h5", "h6"];

function descriptionUrl(value: string) {
  const safe = defaultUrlTransform(value);
  try {
    const url = new URL(safe);
    if (url.protocol === "https:" && !url.username && !url.password) return url.href;
  } catch { /* Relative and invalid links are displayed as text. */ }
  return undefined;
}

/** Restricted renderer shared by the public page, admin preview, and editor. */
export function ProjectDescription({ children, headingLevel = 3 }: { children: string; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const Subheading = headingLevel === 2 ? "h3" : "h4";
  return <div className="project-markdown">
    <Markdown skipHtml allowedElements={elements} unwrapDisallowed urlTransform={descriptionUrl}
      components={{
        // Match the surrounding page hierarchy in both editing and reading contexts.
        h1: ({ children }) => <Heading>{children}</Heading>,
        h2: ({ children }) => <Heading>{children}</Heading>,
        h3: ({ children }) => <Heading>{children}</Heading>,
        h4: ({ children }) => <Subheading>{children}</Subheading>,
        h5: ({ children }) => <Subheading>{children}</Subheading>,
        h6: ({ children }) => <Subheading>{children}</Subheading>,
        pre: ({ children }) => <pre tabIndex={0} role="region" aria-label="Bloco de código">{children}</pre>,
        a: ({ href, children }) => href
          ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
          : <span>{children}</span>,
      }}>
      {children}
    </Markdown>
  </div>;
}
