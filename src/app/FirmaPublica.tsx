import { useEffect, useState } from "react";
import { SignaturePad } from "@/app/SignaturePad";
import logoImg from "@/imports/PERFIL-Photoroom_-_copia.png";

type Info = { cliente: string; codigo: string; descripcion: string; equipos: string[]; firmado: boolean; expirado: boolean };

async function post<T>(body: unknown): Promise<{ ok: boolean; status: number; data: T & { error?: string } }> {
  const r = await fetch("/api/firma", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => ({})) };
}

// Página pública: el cliente abre el enlace, revisa el trabajo y firma con el dedo.
export default function FirmaPublica({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [error, setError] = useState("");
  const [firma, setFirma] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [acepta, setAcepta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    post<Info>({ action: "info", token }).then(r => {
      if (!r.ok) setError(r.data.error || "No se pudo abrir el enlace");
      else { setInfo(r.data); setNombre(r.data.cliente); }
    }).catch(() => setError("Sin conexión. Revisa tu internet e inténtalo de nuevo."));
  }, [token]);

  async function enviar() {
    if (!firma) { setError("Dibuja tu firma en el recuadro"); return; }
    if (!acepta) { setError("Marca la casilla de conformidad"); return; }
    setError(""); setEnviando(true);
    try {
      const r = await post<{ ok?: boolean }>({ action: "firmar", token, firma, firmante: nombre });
      if (r.ok) setListo(true); else setError(r.data.error || "No se pudo enviar la firma");
    } catch { setError("Sin conexión. Inténtalo de nuevo."); }
    finally { setEnviando(false); }
  }

  const caja = "w-full max-w-md mx-auto bg-[#0b0e1a] border border-[#1a2235] rounded-2xl p-5";
  return (
    <div className="min-h-screen bg-[#07090f] text-[#e8e8f0] px-4 py-6" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="max-w-md mx-auto flex items-center gap-3 mb-5">
        <img src={logoImg} alt="Zento Data" className="w-10 h-10 rounded-full object-cover" />
        <div>
          <div className="font-bold text-white leading-tight">Zento Data</div>
          <div className="text-[11px] text-[#8090a8]">Acta de entrega de servicio</div>
        </div>
      </div>

      {!info && !error && <div className={`${caja} text-center text-sm text-[#8090a8]`}>Cargando...</div>}

      {error && !info && <div className={`${caja} text-center`}><div className="text-3xl mb-2">⚠️</div><p className="text-sm">{error}</p></div>}

      {info && (listo || info.firmado) && (
        <div className={`${caja} text-center`}>
          <div className="text-4xl mb-2">✅</div>
          <h1 className="text-lg font-bold text-white mb-1">{listo ? "¡Gracias! Firma recibida" : "Esta acta ya fue firmada"}</h1>
          <p className="text-sm text-[#8090a8]">Tu conformidad quedó registrada. Ya puedes cerrar esta página.</p>
        </div>
      )}

      {info && info.expirado && !info.firmado && !listo && (
        <div className={`${caja} text-center`}>
          <div className="text-3xl mb-2">⏰</div>
          <p className="text-sm">Este enlace expiró. Pide a Zento Data que te envíe uno nuevo.</p>
        </div>
      )}

      {info && !info.firmado && !info.expirado && !listo && (
        <div className={`${caja} space-y-4`}>
          <div>
            <h1 className="text-lg font-bold text-white">Hola, {info.cliente}</h1>
            <p className="text-sm text-[#8090a8]">Revisa el trabajo realizado y firma tu conformidad. Servicio <span className="font-mono text-[#0ea5c8]">{info.codigo}</span></p>
          </div>

          {info.equipos.length > 0 && (
            <div>
              <div className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider mb-1.5">Equipos instalados</div>
              <ul className="space-y-1">
                {info.equipos.map((e, i) => <li key={i} className="text-sm bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-1.5">{e}</li>)}
              </ul>
            </div>
          )}

          <div>
            <div className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider mb-1.5">Trabajo realizado</div>
            <p className="text-sm whitespace-pre-wrap bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2">{info.descripcion || "Instalación / servicio técnico."}</p>
          </div>

          <div>
            <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1.5">Nombre de quien recibe</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              className="w-full bg-[#060810] border border-[#1a2235] rounded-lg px-3 py-2.5 text-base text-[#e8e8f0] focus:outline-none focus:border-[#0ea5c8]" />
          </div>

          <div>
            <label className="text-[11px] text-[#8090a8] font-semibold uppercase tracking-wider block mb-1.5">Firma</label>
            <SignaturePad value={firma} onChange={setFirma} />
          </div>

          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={acepta} onChange={e => setAcepta(e.target.checked)} className="mt-1 w-4 h-4 accent-[#0ea5c8]" />
            <span>Confirmo que recibí el trabajo descrito y que lo recibo conforme.</span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button onClick={enviar} disabled={enviando}
            className="w-full py-3 rounded-xl font-bold text-white bg-gradient-to-r from-[#1d6fd8] to-[#0ea5c8] disabled:opacity-60">
            {enviando ? "Enviando..." : "Firmar y enviar"}
          </button>
        </div>
      )}
    </div>
  );
}
