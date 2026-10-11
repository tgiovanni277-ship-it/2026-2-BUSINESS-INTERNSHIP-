"use client";

import Image from "next/image";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import en from "@/dictionaries/en.json";
import es from "@/dictionaries/es.json";
import { tr } from "@/lib/i18n";
import { buildFormSchema } from "./build-schema";
import { useAttribution } from "./use-attribution";

const dictionaries = { en, es };
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
const inputClass = "rely-input w-full rounded-xl border border-slate-200 bg-[#f8fafb] px-4 py-3 text-base text-[#143340] outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-[#087fad] focus:bg-white focus:ring-4 focus:ring-[#087fad]/10 aria-invalid:border-red-400";

function Icon({ kind, className = "h-5 w-5" }) {
  const paths = {
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    external: <><path d="M14 3h7v7M21 3l-9 9" /><path d="M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></>,
    briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12a22 22 0 0 0 18 0M12 11v3" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><ellipse cx="12" cy="12" rx="4" ry="9" /><path d="M3 12h18" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[kind]}</svg>;
}

function Field({ label, error, children }) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-[#143340]">{label}</label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": error ? `${id}-error` : undefined })}
      {error && <p id={`${id}-error`} className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function BrandHeader({ lang, onLanguageChange }) {
  return (
    <header className="mb-7 flex items-center justify-between gap-4 sm:mb-10">
      <Image src="/relay-logo.png" alt="Rely Workforce Group" width={706} height={225} preload className="h-auto w-36 sm:w-44" />
      <button type="button" onClick={onLanguageChange} className="inline-flex items-center gap-2 rounded-full border border-[#087fad]/15 bg-white px-4 py-2.5 text-sm font-semibold text-[#087fad] shadow-sm transition hover:bg-[#eaf7fb] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#087fad]/15">
        <Icon kind="globe" className="h-4 w-4" />
        {lang === "en" ? "Español" : "English"}
      </button>
    </header>
  );
}

function BrandFooter({ t }) {
  return (
    <footer className="mt-8 flex flex-col items-center gap-3 border-t border-[#143340]/10 pt-6 text-center sm:mt-10 sm:flex-row sm:justify-between sm:text-left">
      <p className="text-sm text-slate-500">{t.footerIntro}</p>
      <a href="https://relyworkforce.com/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-3 rounded-xl border border-[#087fad]/20 bg-white px-4 py-3 text-xs font-semibold text-[#087fad] shadow-sm transition hover:border-[#087fad] hover:bg-[#f4fbfd] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#087fad]/20">
        <Image src="/relay-logo.png" alt="Rely Workforce Group" width={706} height={225} className="h-auto w-20 sm:w-24" />
        <span>{t.officialSite}</span>
        <Icon kind="external" className="h-4 w-4 shrink-0" />
        <span className="sr-only">{t.opensInNewTab}</span>
      </a>
    </footer>
  );
}

function SectionHeading({ number, title, description }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eaf7fb] text-xs font-bold text-[#087fad]">{number}</span>
      <div><h3 className="text-base font-bold text-[#143340]">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
    </div>
  );
}

export default function ApplyForm({ vacante }) {
  const params = useSearchParams();
  const [lang, setLang] = useState(params.get("lang") === "es" ? "es" : "en");
  const [status, setStatus] = useState("idle");
  const [serverError, setServerError] = useState("generic");
  const [eventId, setEventId] = useState(() => crypto.randomUUID());
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileElement = useRef(null);
  const attribution = useAttribution();
  const t = dictionaries[lang];
  const schema = useMemo(() => buildFormSchema(vacante), [vacante]);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(schema), defaultValues: { consentimiento: false, website: "" } });
  const msg = (e) => e?.message ? (t.errors[e.message] ?? t.errors.required) : null;

  useEffect(() => {
    if (!turnstileSiteKey) return;
    const render = () => {
      if (!turnstileElement.current || turnstileElement.current.dataset.rendered) return;
      turnstileElement.current.dataset.rendered = "true";
      window.turnstile.render(turnstileElement.current, {
        sitekey: turnstileSiteKey,
        callback: setTurnstileToken,
        "expired-callback": () => setTurnstileToken(""),
        "error-callback": () => setTurnstileToken(""),
      });
    };
    if (window.turnstile) render();
    else {
      window.relayTurnstileLoaded = render;
      if (!document.querySelector('script[data-relay-turnstile]')) {
        const script = document.createElement("script");
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=relayTurnstileLoaded&render=explicit";
        script.async = true; script.defer = true; script.dataset.relayTurnstile = "true";
        document.head.appendChild(script);
      }
    }
    return () => { if (window.relayTurnstileLoaded === render) delete window.relayTurnstileLoaded; };
  }, []);

  async function onSubmit(values) {
    setStatus("sending");
    try {
      const res = await fetch("/api/apply", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, slug: vacante.slug, idioma: lang, eventId, turnstileToken, utm: attribution.utm, fbclid: attribution.fbclid }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "conflict") setEventId(crypto.randomUUID());
        window.turnstile?.reset();
        setTurnstileToken(""); setServerError(data.code ?? "generic"); setStatus("error"); return;
      }
      window.fbq?.("track", "Lead", { content_name: vacante.vacanteId }, { eventID: eventId });
      setStatus("done");
    } catch { setServerError("generic"); setStatus("error"); }
  }

  return (
    <div>
      <BrandHeader lang={lang} onLanguageChange={() => setLang(lang === "en" ? "es" : "en")} />
      {status === "done" ? (
        <section role="status" className="mx-auto max-w-xl rounded-[28px] border border-white bg-white px-6 py-12 text-center shadow-xl shadow-[#143340]/5 sm:p-14">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50"><Icon kind="check" className="h-8 w-8" /></div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#087fad]">Rely Workforce Group</p>
          <h1 className="text-3xl font-bold tracking-tight text-[#143340]">{t.successTitle}</h1>
          <p className="mt-4 leading-7 text-slate-600">{t.successBody}</p>
        </section>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[0.82fr_1.18fr] lg:gap-10">
          <aside className="rely-intro relative overflow-hidden rounded-[28px] bg-[#073d51] p-7 text-white sm:p-9 lg:sticky lg:top-8 lg:p-10">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full border-[35px] border-white/5" />
            <div className="relative">
              <p className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#a9dce9]"><span className="h-1.5 w-1.5 rounded-full bg-[#ef772d]" />{t.campaignEyebrow}</p>
              <h1 className="max-w-sm text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">{t.leadTitle}</h1>
              <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-[#d7edf4]"><Icon kind="briefcase" className="h-4 w-4" />{tr(vacante.titulo, lang)}</div>
              <p className="mt-5 max-w-sm text-sm leading-7 text-[#c1dce5]">{tr(vacante.descripcion, lang)}</p>
              <div className="mt-8 hidden space-y-5 border-t border-white/15 pt-7 lg:block">
                {[t.howStepOne, t.howStepTwo, t.howStepThree].map((step, i) => <div key={step} className="flex items-center gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 text-xs text-[#9bd2e2]">{i + 1}</span><p className="text-sm text-[#d7edf4]">{step}</p></div>)}
              </div>
              <p className="mt-8 hidden text-xs font-semibold tracking-wide text-[#9bd2e2] lg:block">{t.heroClosing}</p>
            </div>
          </aside>

          <section className="rounded-[28px] border border-[#e4edf1] bg-white p-6 shadow-[0_16px_60px_-25px_rgba(7,61,81,0.22)] sm:p-8">
            <div className="mb-7 border-b border-slate-100 pb-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#087fad]">{t.formEyebrow}</p>
              <h2 className="text-2xl font-bold tracking-tight text-[#143340]">{t.formTitle}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">{t.formIntro}</p>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-7" noValidate aria-busy={status === "sending"}>
              <section aria-label={t.contactSection}>
                <SectionHeading number="01" title={t.contactSection} description={t.contactHint} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t.name} error={msg(errors.nombre)}>{(a11y) => <input {...a11y} className={inputClass} autoComplete="name" placeholder={t.namePlaceholder} {...register("nombre")} />}</Field>
                  <Field label={t.phone} error={msg(errors.telefono)}>{(a11y) => <input {...a11y} className={inputClass} type="tel" inputMode="tel" autoComplete="tel" placeholder="(919) 555-0123" {...register("telefono")} />}</Field>
                  <Field label={t.email} error={msg(errors.email)}>{(a11y) => <input {...a11y} className={inputClass} type="email" autoComplete="email" placeholder={t.emailPlaceholder} {...register("email")} />}</Field>
                  <Field label={t.zip} error={msg(errors.zip)}>{(a11y) => <input {...a11y} className={inputClass} inputMode="numeric" maxLength={5} autoComplete="postal-code" placeholder="27601" {...register("zip")} />}</Field>
                </div>
              </section>

              <section aria-label={t.profileSection} className="border-t border-slate-100 pt-6">
                <SectionHeading number="02" title={t.profileSection} description={t.profileHint} />
                <div className="grid gap-5 sm:grid-cols-2">
                  {vacante.campos.map((c) => c.tipo === "yesno" ? (
                    <fieldset key={c.id} className="min-w-0 space-y-2" aria-describedby={errors.respuestas?.[c.id] ? `${c.id}-error` : undefined}>
                      <legend className="mb-2 text-sm font-semibold leading-5 text-[#143340] sm:min-h-10">{tr(c.label, lang)}</legend>
                      <div className="grid grid-cols-2 gap-2">{["yes", "no"].map((v) => <label key={v} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-[#f8fafb] px-3 py-3 text-sm font-semibold text-slate-500 transition hover:border-[#087fad]/50 has-[:checked]:border-[#087fad] has-[:checked]:bg-[#eaf7fb] has-[:checked]:text-[#087fad] has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#087fad]/10"><input className="h-4 w-4 accent-[#087fad]" type="radio" value={v} {...register(`respuestas.${c.id}`)} />{t[v]}</label>)}</div>
                      {errors.respuestas?.[c.id] && <p id={`${c.id}-error`} className="text-sm text-red-600">{msg(errors.respuestas[c.id])}</p>}
                    </fieldset>
                  ) : (
                    <Field key={c.id} label={tr(c.label, lang)} error={msg(errors.respuestas?.[c.id])}>{(a11y) => c.tipo === "select" ? <select {...a11y} className={inputClass} defaultValue="" {...register(`respuestas.${c.id}`)}><option value="">{t.select}</option>{c.opciones.map((o) => <option key={o.valor} value={o.valor}>{tr(o.label, lang)}</option>)}</select> : <input {...a11y} className={inputClass} {...register(`respuestas.${c.id}`)} />}</Field>
                  ))}
                  <div className="sm:col-span-2"><Field label={t.callTime} error={msg(errors.horario)}>{(a11y) => <select {...a11y} className={inputClass} defaultValue="" {...register("horario")}><option value="">{t.select}</option>{["morning", "afternoon", "evening"].map((h) => <option key={h} value={h}>{t.callTimes[h]}</option>)}</select>}</Field></div>
                </div>
              </section>

              {/* Rely debe aprobar el consentimiento antes de activar campañas reales. */}
              <div className="border-t border-slate-100 pt-5">
                <label className="flex cursor-pointer items-start gap-3 text-xs leading-6 text-slate-500"><input type="checkbox" className="mt-1.5 h-4 w-4 shrink-0 accent-[#087fad]" aria-invalid={!!errors.consentimiento} aria-describedby={errors.consentimiento ? "consent-error" : undefined} {...register("consentimiento")} /><span>{t.consent}</span></label>
                {errors.consentimiento && <p id="consent-error" className="mt-2 text-sm text-red-600">{msg(errors.consentimiento)}</p>}
              </div>
              <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" {...register("website")} />
              {turnstileSiteKey && <div ref={turnstileElement} className="flex min-h-[65px] justify-center" />}
              {status === "error" && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{t.errors[serverError] ?? t.errors.generic}</p>}
              <button type="submit" disabled={status === "sending" || (Boolean(turnstileSiteKey) && !turnstileToken)} className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#087fad] px-4 py-4 font-bold text-white shadow-lg shadow-[#087fad]/20 transition hover:bg-[#056d96] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#087fad]/25 disabled:cursor-not-allowed disabled:opacity-60">
                {status === "sending" ? <><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />{t.sending}</> : <>{t.submit}<Icon kind="arrow" /></>}
              </button>
            </form>
          </section>
        </div>
      )}
      <BrandFooter t={t} />
    </div>
  );
}
