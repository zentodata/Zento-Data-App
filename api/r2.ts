// Función serverless (Vercel) que emite URLs firmadas para Cloudflare R2.
// Las llaves de R2 viven SOLO aquí (variables de entorno de Vercel), nunca en el navegador.
//
// Variables de entorno requeridas en Vercel:
//   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
//   (usa VITE_FIREBASE_PROJECT_ID o FIREBASE_PROJECT_ID para validar el login)
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";

const JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));

const TIPOS_PERMITIDOS = /^(image\/(jpeg|png|webp|gif)|application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.[\w.\-]+|application\/vnd\.ms-excel|text\/plain)$/;
const KEY_VALIDA = /^redes\/[A-Za-z0-9_\-./]{1,200}$/;

function s3() {
  const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT } = process.env;
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

  const bucket = process.env.R2_BUCKET;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!bucket || !projectId) return res.status(500).json({ error: "Servidor sin configurar" });

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
    const client = s3();

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

    if (body.action === "delete") {
      const k = String(body.key || "");
      if (!KEY_VALIDA.test(k) || k.includes("..")) return res.status(400).json({ error: "Ruta inválida" });
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: k }));
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Acción desconocida" });
  } catch (e) {
    console.error("r2 error", e);
    return res.status(500).json({ error: "Error en el almacenamiento" });
  }
}
