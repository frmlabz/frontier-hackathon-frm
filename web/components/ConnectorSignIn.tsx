// The fake sign-in (04 A2). One dialog for the whole app: the Connectors page and the chat
// connector_card both call openConnector(id). Nothing leaves the app: Allow only posts {account} to our own
// server. There is never a password field, and Escape / Cancel close without writing anything.
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeftRight, Check, CircleUserRound } from "lucide-react";
import { closeConnector, connect, useStore } from "../store";
import { getConnector, type Connector } from "../../server/connectors";
import { BosMark, GoogleG, ProviderLogo, brandColor } from "../logos";
import { Spinner, cx } from "./common";

export const DEFAULT_ACCOUNT = "marko@markosbistro.com";
const MIN_ALLOW_MS = 900;
const G_BLUE = "#1a73e8";
const G_FONT = { fontFamily: "Roboto, Arial, ui-sans-serif, system-ui, sans-serif" };

/** Allow → connect, with the spinner up for at least MIN_ALLOW_MS. Resolves to an error message or null. */
type OnAllow = (account: string) => Promise<string | null>;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const withMinimum = async (p: Promise<string | null>) => (await Promise.all([p, sleep(MIN_ALLOW_MS)]))[0];

/** True while an Allow is in flight: nothing may close the dialog then (the write has been sent). */
let allowing = false;

/** Mounted once in Root; shows the dialog for the connector in store.connectDialog. */
export function ConnectorSignIn() {
  const id = useStore((s) => s.connectDialog);
  const c = id ? getConnector(id) : undefined;
  if (!c) return null;
  const onAllow: OnAllow = async (account) => {
    allowing = true;
    try {
      const err = await withMinimum(connect(c.id, account));
      if (!err) closeConnector();
      return err;
    } finally {
      allowing = false;
    }
  };
  return (
    <Backdrop>
      {c.signIn === "google" ? <GoogleSignIn key={c.id} connector={c} onAllow={onAllow} onCancel={closeConnector} /> : <GenericConsent key={c.id} connector={c} onAllow={onAllow} onCancel={closeConnector} />}
    </Backdrop>
  );
}

function Backdrop({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 anim-fade-in" onMouseDown={(e) => e.target === e.currentTarget && !allowing && closeConnector()}>
      {children}
    </div>
  );
}

/** Escape closes, except while Allow is in flight (the write has already been sent). */
function useEscape(onCancel: () => void, busy: boolean) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && !busy && onCancel();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel, busy]);
}

function useAllow(onAllow: OnAllow) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allow = async (account: string) => {
    setBusy(true);
    setError(null);
    const err = await onAllow(account).catch(() => "Couldn't connect. Try again.");
    setBusy(false); // harmless if the dialog already closed
    if (err) setError(err);
  };
  return { busy, error, setError, allow };
}

const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

function Initial({ email, size }: { email: string; size: number }) {
  return (
    <span className="rounded-full bg-[#00897b] text-white flex items-center justify-center shrink-0 font-medium select-none" style={{ width: size, height: size, fontSize: size * 0.48 }}>
      {(email.trim()[0] ?? "M").toUpperCase()}
    </span>
  );
}

// ---------- Google ----------
export function GoogleSignIn({ connector, onAllow, onCancel, initialStep = "choose", initialEmail = DEFAULT_ACCOUNT, initialOther = false }: {
  connector: Connector; onAllow: OnAllow; onCancel: () => void; initialStep?: "choose" | "consent"; initialEmail?: string; initialOther?: boolean;
}) {
  const [step, setStep] = useState(initialStep);
  const [email, setEmail] = useState(initialEmail);
  const [other, setOther] = useState(initialOther);
  const [draft, setDraft] = useState("");
  const { busy, error, setError, allow } = useAllow(onAllow);
  useEscape(onCancel, busy);
  const pick = (e: string) => { setEmail(e.trim()); setError(null); setStep("consent"); };

  return (
    <div role="dialog" aria-label="Sign in with Google" className="w-[448px] max-w-full max-h-full overflow-y-auto bg-white text-[#202124] border border-[#dadce0] rounded-lg shadow-2xl anim-fade-up" style={G_FONT}>
      <div className="flex items-center gap-2 h-11 px-5 border-b border-[#dadce0] text-[14px] text-[#3c4043]">
        <GoogleG size={18} /> Sign in with Google
      </div>
      {step === "choose" ? (
        <div>
          <div className="px-6 sm:px-9 pt-7 pb-5">
            <h1 className="text-[24px] leading-[1.3] font-normal">Choose an account</h1>
            <p className="mt-2 text-[16px]">to continue to <span className="font-medium text-[#1a73e8]">Business OS</span></p>
          </div>
          <div className="border-t border-[#dadce0]">
            <button type="button" data-account={DEFAULT_ACCOUNT} onClick={() => pick(DEFAULT_ACCOUNT)} className="w-full flex items-center gap-3 px-6 sm:px-9 py-3 text-left hover:bg-[#f7f8f8] cursor-pointer border-b border-[#dadce0]">
              <Initial email="M" size={28} />
              <span className="min-w-0">
                <span className="block text-[14px] font-medium leading-5">Marko</span>
                <span className="block text-[12px] text-[#5f6368] leading-4 truncate">{DEFAULT_ACCOUNT}</span>
              </span>
            </button>
            {other ? (
              <form
                noValidate
                className="px-6 sm:px-9 py-4 border-b border-[#dadce0]"
                onSubmit={(e) => { e.preventDefault(); validEmail(draft) ? pick(draft) : setError("Enter a valid email address"); }}
              >
                <input
                  autoFocus
                  type="email"
                  value={draft}
                  onChange={(e) => { setDraft(e.target.value); setError(null); }}
                  placeholder="Email"
                  aria-label="Email"
                  className={cx("w-full h-12 px-3.5 rounded border text-[16px] outline-none focus:border-2", error ? "border-[#d93025] focus:border-[#d93025]" : "border-[#dadce0] focus:border-[#1a73e8]")}
                />
                {error && <div className="mt-1.5 text-[12px] text-[#d93025]">{error}</div>}
                <div className="flex justify-end mt-4">
                  <button type="submit" className="h-9 px-6 rounded-full text-white text-[14px] font-medium cursor-pointer" style={{ background: G_BLUE }}>Next</button>
                </div>
              </form>
            ) : (
              <button type="button" onClick={() => setOther(true)} className="w-full flex items-center gap-3 px-6 sm:px-9 py-3 text-left hover:bg-[#f7f8f8] cursor-pointer border-b border-[#dadce0] text-[14px] font-medium">
                <CircleUserRound size={28} strokeWidth={1.4} className="text-[#5f6368]" /> Use another account
              </button>
            )}
          </div>
          <p className="px-6 sm:px-9 py-6 text-[12px] leading-[1.5] text-[#5f6368]">
            To continue, Google will share your name, email address and profile picture with Business OS.
          </p>
        </div>
      ) : (
        <div className="px-6 sm:px-9 pt-7 pb-6">
          <h1 className="text-[24px] leading-[1.3] font-normal">Business OS wants to access your Google Account</h1>
          <button type="button" disabled={busy} onClick={() => setStep("choose")} className="mt-3 inline-flex items-center gap-2 h-8 pl-1 pr-3 rounded-full border border-[#dadce0] text-[14px] hover:bg-[#f7f8f8] cursor-pointer max-w-full">
            <Initial email={email} size={22} /> <span className="truncate">{email}</span>
          </button>
          <p className="mt-6 text-[16px]">This will allow Business OS to:</p>
          <ul className="mt-2">
            {connector.scopes.map((s) => (
              <li key={s} className="flex items-center gap-4 py-3 border-b border-[#dadce0] text-[14px]">
                <ProviderLogo id={connector.id} size={20} /> {s}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[16px] font-medium">Make sure you trust Business OS</p>
          <p className="mt-1 text-[14px] text-[#5f6368]">You may be sharing sensitive info with this site or app.</p>
          {error && <div className="mt-4 text-[13px] text-[#d93025]" role="alert">{error}</div>}
          <div className="flex justify-end gap-2 mt-7">
            <button type="button" disabled={busy} onClick={onCancel} className="h-9 px-5 rounded-full text-[14px] font-medium hover:bg-[#f1f5fe] disabled:opacity-50 cursor-pointer" style={{ color: G_BLUE }}>Cancel</button>
            <button type="button" disabled={busy} onClick={() => allow(email)} className="h-9 min-w-[96px] px-6 rounded-full text-white text-[14px] font-medium inline-flex items-center justify-center gap-2 disabled:cursor-default cursor-pointer" style={{ background: G_BLUE }}>
              {busy ? <Spinner size={14} className="!border-white/40 !border-t-white" /> : "Allow"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Every other provider ----------
export function GenericConsent({ connector, onAllow, onCancel }: { connector: Connector; onAllow: OnAllow; onCancel: () => void }) {
  const [account, setAccount] = useState(DEFAULT_ACCOUNT);
  const { busy, error, setError, allow } = useAllow(onAllow);
  useEscape(onCancel, busy);
  const color = brandColor(connector.id);
  const tile = "w-12 h-12 rounded-xl bg-white flex items-center justify-center shadow-sm";
  return (
    <div role="dialog" aria-label={`Connect ${connector.name}`} className="w-[420px] max-w-full max-h-full overflow-y-auto bg-white text-ink rounded-xl shadow-2xl anim-fade-up">
      <div className="h-24 flex items-center justify-center gap-4" style={{ background: color }}>
        <span className={tile}><BosMark size={32} /></span>
        <ArrowLeftRight size={18} className="text-white/90" />
        <span className={tile}><ProviderLogo id={connector.id} size={32} /></span>
      </div>
      <form className="p-6" onSubmit={(e) => { e.preventDefault(); account.trim() ? allow(account.trim()) : setError(`Enter the account you use for ${connector.name}.`); }}>
        <h2 className="text-[18px] font-semibold text-ink-strong">Connect {connector.name} to Business OS</h2>
        <label className="block mt-4 text-[13px] text-muted" htmlFor="connector-account">Account</label>
        <input
          id="connector-account"
          value={account}
          disabled={busy}
          onChange={(e) => { setAccount(e.target.value); setError(null); }}
          className="mt-1 w-full h-9 px-2.5 rounded-md border border-hairline-strong text-[14px] outline-none focus:border-primary"
        />
        <p className="mt-5 text-[14px] text-ink">Business OS will be able to:</p>
        <ul className="mt-2 space-y-1.5">
          {connector.scopes.map((s) => (
            <li key={s} className="flex items-center gap-2 text-[14px] text-ink"><Check size={14} strokeWidth={2.5} className="text-green shrink-0" /> {s}</li>
          ))}
        </ul>
        {error && <div className="mt-4 text-[13px] text-red" role="alert">{error}</div>}
        <div className="flex justify-end gap-2 mt-6">
          <button type="button" disabled={busy} onClick={onCancel} className="h-8 px-3 rounded-md text-[14px] text-muted hover:bg-hover hover:text-ink disabled:opacity-50 cursor-pointer">Cancel</button>
          <button type="submit" disabled={busy} className="h-8 min-w-[84px] px-4 rounded-md text-white text-[14px] font-medium inline-flex items-center justify-center gap-2 cursor-pointer disabled:cursor-default" style={{ background: color }}>
            {busy ? <Spinner size={13} className="!border-white/40 !border-t-white" /> : "Allow"}
          </button>
        </div>
      </form>
    </div>
  );
}
