"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Person } from "@/lib/types";
import { Avatar, useToast } from "./ui";
import { Icon } from "./icon";

function PasswordField({ id, label, autoComplete, help }: { id: string; label: string; autoComplete: "current-password" | "new-password"; help?: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="form-field">
    <label htmlFor={id}>{label}</label>
    <div className="password-field">
      <input id={id} name={id} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={autoComplete === "new-password" ? 15 : 1} maxLength={128} aria-describedby={help ? `${id}-help` : undefined}/>
      <button type="button" aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon name="eye" size={17}/></button>
    </div>
    {help && <small id={`${id}-help`}>{help}</small>}
  </div>;
}

export function AccountForm({ user, email, canChangePassword }: { user: Person; email: string; canChangePassword: boolean }) {
  const router = useRouter();
  const notify = useToast();
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio);
  const [github, setGithub] = useState(user.github || "");
  const [avatar, setAvatar] = useState(user.avatar);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function signInAgain() {
    router.push("/entrar?next=%2Fminha-conta");
    router.refresh();
  }

  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setProfileError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setProfileError("Escolha uma foto JPG, PNG ou WebP de até 2 MB.");
      return;
    }
    setUploading(true);
    try {
      const image = await createImageBitmap(file);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) throw new Error();
        const side = Math.min(image.width, image.height);
        context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 256, 256);
        setAvatar(canvas.toDataURL("image/webp", .85));
      } finally { image.close(); }
    } catch { setProfileError("Não foi possível preparar a foto. Tente outra imagem."); }
    finally { setUploading(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError("");
    setSavingProfile(true);
    try {
      const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, bio, avatar, github }) });
      if (response.status === 401) { signInAgain(); return; }
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar seu perfil.");
      setName(data.user.name); setBio(data.user.bio); setGithub(data.user.github || ""); setAvatar(data.user.avatar);
      notify("Perfil atualizado.");
      router.refresh();
    } catch (error) { setProfileError(error instanceof Error ? error.message : "Não foi possível salvar seu perfil. Tente novamente."); }
    finally { setSavingProfile(false); }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setPasswordError("");
    if (data.get("newPassword") !== data.get("confirmPassword")) { setPasswordError("A confirmação não corresponde à nova senha."); return; }
    setSavingPassword(true);
    try {
      const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) });
      if (response.status === 401) { signInAgain(); return; }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível alterar sua senha.");
      form.reset();
      notify("Senha alterada. As outras sessões foram encerradas.");
      router.refresh();
    } catch (error) { setPasswordError(error instanceof Error ? error.message : "Não foi possível alterar sua senha. Tente novamente."); }
    finally { setSavingPassword(false); }
  }

  return <main id="conteudo" className="container inner-page">
    <Link href={`/pessoas/${user.id}`} className="back-link"><Icon name="arrow-left" size={16}/>Meu perfil</Link>
    <div className="page-heading"><div className="page-intro"><h1>Editar perfil</h1><p>Atualize seu perfil e mantenha seu acesso seguro.</p></div></div>
    <div className="account-layout">
      <form onSubmit={saveProfile} aria-labelledby="account-profile-title">
        <h2 id="account-profile-title" className="account-section-title">Perfil</h2>
        <fieldset className="account-fieldset" disabled={savingProfile || uploading}>
          <div className="account-photo">
            <Avatar key={avatar || "initials"} person={{ name: name || user.name, avatar }} size={88}/>
            <div className="account-photo-actions">
              <input ref={fileRef} id="account-photo" type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadPhoto}/>
              <div className="account-photo-buttons">
                <button type="button" className="photo-change" onClick={() => fileRef.current?.click()}><Icon name={avatar ? "edit" : "plus"} size={15}/>{uploading ? "Preparando..." : avatar ? "Alterar foto" : "Adicionar foto"}</button>
                {avatar && <button type="button" className="photo-remove" aria-label="Remover foto" onClick={() => setAvatar(null)}><Icon name="trash" size={16}/>Remover</button>}
              </div>
              <small>JPG, PNG ou WebP, até 2 MB.</small>
            </div>
          </div>
          <div className="form-field"><label htmlFor="account-name">Nome</label><input id="account-name" name="name" value={name} onChange={event => setName(event.target.value)} autoComplete="name" required minLength={2} maxLength={70}/></div>
          <div className="form-field"><label htmlFor="account-bio">Apresentação (opcional)</label><textarea id="account-bio" name="bio" value={bio} onChange={event => setBio(event.target.value)} rows={4} maxLength={600} aria-describedby="account-bio-help"/><small id="account-bio-help">Conte um pouco sobre você. Até 600 caracteres.</small></div>
          <div className="form-field"><label htmlFor="account-github">GitHub (opcional)</label><input id="account-github" name="github" type="url" value={github} onChange={event => setGithub(event.target.value)} placeholder="https://github.com/seu-usuario" maxLength={2000}/></div>
          <dl className="account-details" aria-label="Dados de acesso"><div><dt>Email</dt><dd>{email}</dd></div><div><dt>Turma</dt><dd>{user.cohort}</dd></div></dl>
          {profileError && <p className="form-error" role="alert">{profileError}</p>}
          <div className="account-form-actions"><button type="submit" className="button button-dark">{savingProfile && <Icon name="loader" size={17} className="spinner"/>}{savingProfile ? "Salvando..." : "Salvar alterações"}</button></div>
        </fieldset>
      </form>
      <section className="account-security" aria-labelledby="account-password-title">
          <h2 id="account-password-title" className="account-section-title">Senha</h2>
          {canChangePassword ? <form onSubmit={savePassword} aria-labelledby="account-password-title">
            <p className="account-help">Confirme sua senha atual para definir uma nova.</p>
            <fieldset className="account-fieldset" disabled={savingPassword}>
              <PasswordField id="currentPassword" label="Senha atual" autoComplete="current-password"/>
              <PasswordField id="newPassword" label="Nova senha" autoComplete="new-password" help="Use de 15 a 128 caracteres."/>
              <PasswordField id="confirmPassword" label="Confirmar nova senha" autoComplete="new-password"/>
              {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
              <div className="account-form-actions"><button type="submit" className="button button-dark">{savingPassword && <Icon name="loader" size={17} className="spinner"/>}{savingPassword ? "Alterando..." : "Alterar senha"}</button></div>
            </fieldset>
          </form> : <p className="account-help">Sua conta usa o Google e ainda não tem uma senha. Peça à administração um link para definir uma senha e também entrar por email.</p>}
      </section>
    </div>
  </main>;
}
