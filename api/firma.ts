// Firma remota del cliente por enlace.
//  - Acciones del personal (requieren sesión de Firebase): "crear", "estado"
//  - Acciones públicas (las usa el cliente desde el enlace): "info", "firmar"
// Las solicitudes viven en R2 (firmas/<token>.json); el token es aleatorio de 192 bits, de un solo uso y caduca a los 7 días.
// Variables: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, VITE_FIREBASE_PROJECT_ID

const env = (k: string) => (process.env[k] || "").trim();
const TOKEN_OK = /^[a-f0-9]{48}$/;
const DIAS = 7;

type Solicitud = {
  codigo: string; ot?: string; servicioId: string; histId: string; cliente: string; descripcion: string; equipos: string[];
  fotos?: string[]; // rutas en R2 de las fotos de la instalación
  creadoEn: string; expiraEn: string;
  firmado?: boolean; firmaKey?: string; firmante?: string; firmadoEn?: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  let m;
  try {
    const [aws, jose, crypto, presigner] = await Promise.all([import("@aws-sdk/client-s3"), import("jose"), import("node:crypto"), import("@aws-sdk/s3-request-presigner")]);
    m = { ...aws, ...jose, ...presigner, randomBytes: crypto.randomBytes };
  } catch (e) {
    return res.status(500).json({ error: "Faltan dependencias en el servidor", detalle: String((e as Error).message || "").slice(0, 200) });
  }
  const { S3Client, PutObjectCommand, GetObjectCommand, createRemoteJWKSet, jwtVerify, randomBytes, getSignedUrl } = m;

  const bucket = env("R2_BUCKET");
  const projectId = env("FIREBASE_PROJECT_ID") || env("VITE_FIREBASE_PROJECT_ID");
  if (!bucket || !env("R2_ENDPOINT") || !env("R2_ACCESS_KEY_ID") || !env("R2_SECRET_ACCESS_KEY")) return res.status(500).json({ error: "Servidor sin configurar" });
  const client = new S3Client({
    region: "auto", endpoint: env("R2_ENDPOINT").replace(/\/+$/, ""), forcePathStyle: true,
    credentials: { accessKeyId: env("R2_ACCESS_KEY_ID"), secretAccessKey: env("R2_SECRET_ACCESS_KEY") },
    requestChecksumCalculation: "WHEN_REQUIRED", responseChecksumValidation: "WHEN_REQUIRED",
  });

  const leer = async (token: string): Promise<Solicitud | null> => {
    try {
      const r = await client.send(new GetObjectCommand({ Bucket: bucket, Key: `firmas/${token}.json` }));
      return JSON.parse(await r.Body!.transformToString()) as Solicitud;
    } catch { return null; }
  };
  const guardar = (token: string, s: Solicitud) =>
    client.send(new PutObjectCommand({ Bucket: bucket, Key: `firmas/${token}.json`, Body: JSON.stringify(s), ContentType: "application/json" }));
  const texto = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").slice(0, max);

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    // ── Acciones PÚBLICAS (cliente) ──
    if (body.action === "info") {
      const token = String(body.token || "");
      const s = TOKEN_OK.test(token) ? await leer(token) : null;
      if (!s) return res.status(404).json({ error: "Enlace no válido" });
      // Fotos de la instalación: URLs firmadas de lectura (1 h) para que el cliente las vea
      const fotos: string[] = [];
      if (!s.firmado) {
        for (const k of (s.fotos || []).slice(0, 8)) {
          try { fotos.push(await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: k }), { expiresIn: 3600 })); } catch { /* se omite */ }
        }
      }
      return res.status(200).json({
        cliente: s.cliente, codigo: s.codigo, ot: s.ot, descripcion: s.descripcion, equipos: s.equipos, fotos,
        firmado: !!s.firmado, expirado: new Date(s.expiraEn).getTime() < Date.now(),
      });
    }

    if (body.action === "firmar") {
      const token = String(body.token || "");
      const s = TOKEN_OK.test(token) ? await leer(token) : null;
      if (!s) return res.status(404).json({ error: "Enlace no válido" });
      if (s.firmado) return res.status(409).json({ error: "Esta acta ya fue firmada" });
      if (new Date(s.expiraEn).getTime() < Date.now()) return res.status(410).json({ error: "El enlace expiró" });
      const firma = String(body.firma || "");
      const mm = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(firma);
      if (!mm || firma.length > 600_000) return res.status(400).json({ error: "Firma inválida" });
      const png = Buffer.from(mm[1], "base64");
      if (png.length < 200 || png.subarray(1, 4).toString() !== "PNG") return res.status(400).json({ error: "Firma inválida" });
      const codigo = s.codigo.replace(/[^A-Za-z0-9_-]/g, "");
      const firmaKey = `redes/${codigo}/firma-remota-${token.slice(0, 8)}.png`;
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: firmaKey, Body: png, ContentType: "image/png" }));
      s.firmado = true; s.firmaKey = firmaKey; s.firmante = texto(body.firmante, 80).trim() || s.cliente; s.firmadoEn = new Date().toISOString();
      await guardar(token, s);
      return res.status(200).json({ ok: true });
    }

    // ── Acciones del PERSONAL (requieren login) ──
    const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    if (!bearer || !projectId) return res.status(401).json({ error: "Sin sesión" });
    try {
      const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
      await jwtVerify(bearer, JWKS, { issuer: `https://securetoken.google.com/${projectId}`, audience: projectId });
    } catch { return res.status(401).json({ error: "Sesión inválida" }); }

    if (body.action === "crear") {
      const token = randomBytes(24).toString("hex");
      const ahora = new Date();
      const s: Solicitud = {
        codigo: texto(body.codigo, 30), ot: /^\d{5}$/.test(String(body.ot || "")) ? String(body.ot) : undefined, servicioId: texto(body.servicioId, 60), histId: texto(body.histId, 60),
        cliente: texto(body.cliente, 100), descripcion: texto(body.descripcion, 2000),
        equipos: (Array.isArray(body.equipos) ? body.equipos : []).slice(0, 30).map((x: unknown) => texto(x, 120)),
        fotos: (Array.isArray(body.fotos) ? body.fotos : []).filter((k: unknown): k is string => typeof k === "string" && /^redes\/[A-Za-z0-9_\-./]{1,200}$/.test(k) && !k.includes("..")).slice(0, 8),
        creadoEn: ahora.toISOString(), expiraEn: new Date(ahora.getTime() + DIAS * 86400000).toISOString(),
      };
      await guardar(token, s);
      return res.status(200).json({ token, expiraEn: s.expiraEn });
    }

    if (body.action === "estado") {
      const tokens: string[] = (Array.isArray(body.tokens) ? body.tokens : []).filter((t: unknown) => typeof t === "string" && TOKEN_OK.test(t)).slice(0, 50);
      const estados: Record<string, { firmado: boolean; firmaKey?: string; firmante?: string; firmadoEn?: string; expirado?: boolean }> = {};
      await Promise.all(tokens.map(async t => {
        const s = await leer(t);
        if (!s) return;
        estados[t] = { firmado: !!s.firmado, firmaKey: s.firmaKey, firmante: s.firmante, firmadoEn: s.firmadoEn, expirado: new Date(s.expiraEn).getTime() < Date.now() };
      }));
      return res.status(200).json({ estados });
    }

    return res.status(400).json({ error: "Acción desconocida" });
  } catch (e) {
    console.error("firma error", e);
    const err = e as { name?: string; message?: string };
    return res.status(500).json({ error: "Error en el servidor", detalle: `${err.name || "Error"}: ${String(err.message || "").slice(0, 200)}` });
  }
}
