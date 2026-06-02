import { type NextRequest, NextResponse } from "next/server"

const BACKEND = process.env.BACKEND_URL || "http://localhost:5000"
const API_VER  = process.env.API_VERSION  || "v1"

async function proxy(req: NextRequest, path: string[]) {
  const target = `${BACKEND}/api/${API_VER}/auth/${path.join("/")}${req.nextUrl.search}`

  const fwdHeaders = new Headers()
  req.headers.forEach((v, k) => {
    if (!["host", "connection", "transfer-encoding"].includes(k)) {
      fwdHeaders.set(k, v)
    }
  })

  const upstream = await fetch(target, {
    method: req.method,
    headers: fwdHeaders,
    body: ["GET", "HEAD"].includes(req.method) ? null : req.body,
    // @ts-ignore — Next.js needs duplex for streaming request bodies
    duplex: "half",
  })

  const out = new Headers()
  upstream.headers.forEach((v, k) => {
    if (k === "set-cookie") {
      // Rewrite Domain so cookie is stored for .veqiro.com (accessible to all subdomains)
      out.append("set-cookie", v.replace(/;\s*Domain=[^;]*/i, "") + "; Domain=.veqiro.com")
    } else if (!["content-encoding", "transfer-encoding", "connection"].includes(k)) {
      out.set(k, v)
    }
  })

  return new NextResponse(upstream.body, { status: upstream.status, headers: out })
}

type Ctx = { params: Promise<{ path: string[] }> }

const handler = (req: NextRequest, ctx: Ctx) => ctx.params.then((p) => proxy(req, p.path))

export const GET    = handler
export const POST   = handler
export const PUT    = handler
export const PATCH  = handler
export const DELETE = handler
