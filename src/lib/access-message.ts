export function formatAccessExpiry(expiresAt: string | Date) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(expiresAt));
}
export function accessMessage(name: string, url: string, expiresAt: string, activation: boolean) {
  return `Olá, ${name.split(" ")[0]}! Use este link para ${activation ? "ativar sua conta" : "definir sua senha"} na Toti Gallery: ${url}\nVálido até ${formatAccessExpiry(expiresAt)} (horário de Brasília). O link é pessoal e só pode ser usado uma vez.`;
}
