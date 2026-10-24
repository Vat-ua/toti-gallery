import Link from "next/link";
import { Icon } from "@/components/icon";

export default function NotFoundPage() {
  return <main id="conteudo" className="container error-page"><span className="error-number" aria-hidden="true">404<span style={{ color: "#c5d99e" }}>.</span></span><h1>Essa ideia tomou outro caminho.</h1><p>A página que você procura não existe ou foi removida. Mas tem muita coisa boa esperando na galeria.</p><Link href="/" className="button button-dark">Encontrar novas ideias<Icon name="arrow-right" size={17}/></Link></main>;
}
