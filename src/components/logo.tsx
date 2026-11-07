import Link from "next/link";
import { BrandSymbol } from "./brand-symbol";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="brand"
      aria-label="Toti Gallery, página inicial"
    >
      <span className="brand-mark" aria-hidden="true">
        <BrandSymbol />
      </span>
      <span className="brand-word">toti</span>{" "}
      <span className="brand-gallery">gallery</span>
    </Link>
  );
}
