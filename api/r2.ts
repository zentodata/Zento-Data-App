// Función serverless (Vercel) que emite URLs firmadas para Cloudflare R2.
// Las llaves de R2 viven SOLO aquí (variables de entorno de Vercel), nunca en el navegador.
//
// Variables de entorno requeridas en Vercel:
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
//   (usa VITE_FIREBASE_PROJECT_ID o FIREBASE_PROJECT_ID para validar el login)
// Los módulos se cargan dentro del handler (import dinámico) para que, si falta alguna
// dependencia en el despliegue, la respuesta diga cuál en vez de un 500 genérico.

const TIPOS_PERMITIDOS = /^(image\/(jpeg|png|webp|gif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.[\w.\-]+|application\/vnd\.ms-excel|text\/plain)$/;
const KEY_VALIDA = /^redes\/[A-Za-z0-9_\-./]{1,200}$/;

// Limpia espacios y saltos de línea que a veces quedan al pegar variables en Vercel
const env = (k: string) => (process.env[k] || "").trim();

async function s3() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  const R2_ACCESS_KEY_ID = env("R2_ACCESS_KEY_ID"), R2_SECRET_ACCESS_KEY = env("R2_SECRET_ACCESS_KEY"), R2_ENDPOINT = env("R2_ENDPOINT").replace(/\/+$/, "");
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT) throw new Error("R2 no configurado");
  return new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const bucket = env("R2_BUCKET");
  const projectId = env("FIREBASE_PROJECT_ID") || env("VITE_FIREBASE_PROJECT_ID");
  const faltan = ["R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET"].filter(k => !env(k));
  if (!projectId) faltan.push("VITE_FIREBASE_PROJECT_ID");
  if (faltan.length || !bucket || !projectId) return res.status(500).json({ error: "Servidor sin configurar", faltan });

  let mods;
  try {
    const [aws, presigner, jose, crypto] = await Promise.all([
      import("@aws-sdk/client-s3"), import("@aws-sdk/s3-request-presigner"), import("jose"), import("node:crypto"),
    ]);
    mods = { ...aws, ...presigner, ...jose, randomUUID: crypto.randomUUID };
  } catch (e) {
    const err = e as { message?: string };
    return res.status(500).json({ error: "Faltan dependencias en el servidor", detalle: String(err.message || "").slice(0, 200) });
  }
  const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand, getSignedUrl, createRemoteJWKSet, jwtVerify, randomUUID } = mods;
  const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

  // 1) Solo usuarios con sesión válida de Firebase
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sin sesión" });
  try {
    await jwtVerify(token, JWKS, { issuer: `https://securetoken.google.com/${projectId}`, audience: projectId });
  } catch {
    return res.status(401).json({ error: "Sesión inválida" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const client = await s3();

    if (body.action === "put") {
      const contentType = String(body.contentType || "");
      if (!TIPOS_PERMITIDOS.test(contentType)) return res.status(400).json({ error: "Tipo de archivo no permitido" });
      const carpeta = String(body.folder || "redes/adjuntos").replace(/[^A-Za-z0-9_\-/]/g, "").replace(/\/{2,}/g, "/");
      const nombre = String(body.filename || "archivo").replace(/[^A-Za-z0-9_.\-]/g, "_").slice(-60);
      const key = `${carpeta.startsWith("redes/") ? carpeta : "redes/" + carpeta}/${randomUUID().slice(0, 8)}-${nombre}`;
      if (!KEY_VALIDA.test(key) || key.includes("..")) return res.status(400).json({ error: "Ruta inválida" });
      const url = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 600 });
      return res.status(200).json({ key, url });
    }

    if (body.action === "get") {
      const keys: string[] = Array.isArray(body.keys) ? body.keys.slice(0, 100) : [String(body.key || "")];
      const urls: Record<string, string> = {};
      for (const k of keys) {
        if (!KEY_VALIDA.test(k) || k.includes("..")) continue;
        urls[k] = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: k }), { expiresIn: 3600 });
      }
      return res.status(200).json({ urls });
    }

    // Devuelve el archivo como data URL (para incrustar fotos en el PDF sin depender de CORS)
    if (body.action === "data") {
      const k = String(body.key || "");
      if (!KEY_VALIDA.test(k) || k.includes("..")) return res.status(400).json({ error: "Ruta inválida" });
      const { GetObjectCommand: Get } = mods;
      const r = await client.send(new Get({ Bucket: bucket, Key: k }));
      const buf = Buffer.from(await r.Body!.transformToByteArray());
      if (buf.length > 3_000_000) return res.status(413).json({ error: "Archivo muy grande" });
      const mime = buf[0] === 0xff && buf[1] === 0xd8 ? "image/jpeg"
        : buf.subarray(1, 4).toString() === "PNG" ? "image/png"
        : buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP" ? "image/webp" : "";
      if (!mime) return res.status(415).json({ error: "No es una imagen" });
      return res.status(200).json({ dataUrl: `data:${mime};base64,${buf.toString("base64")}` });
    }

    if (body.action === "delete") {
      const k = String(body.key || "");
      if (!KEY_VALIDA.test(k) || k.includes("..")) return res.status(400).json({ error: "Ruta inválida" });
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: k }));
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Acción desconocida" });
  } catch (e) {
    console.error("r2 error", e);
    // Solo nombre y mensaje del error (nunca llaves) para poder diagnosticar
    const err = e as { name?: string; message?: string };
    return res.status(500).json({ error: "Error en el almacenamiento", detalle: `${err.name || "Error"}: ${String(err.message || "").slice(0, 200)}` });
  }
}
