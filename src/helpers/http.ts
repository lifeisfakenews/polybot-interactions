import type { IncomingMessage, ServerResponse } from "http";
import { createReadStream, stat, statSync } from "fs";
import { join, normalize, basename } from "path";
import { parse as parseQuery } from "querystring";

type CookieOptions = {
    path?: string;
    domain?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "Strict" | "Lax" | "None";
    maxAge?: number; // in seconds
    expires?: Date;
};

export type ExpressLikeResponse = ServerResponse & {
    status: (code: number) => ExpressLikeResponse;
    json: (obj: any) => void;
    text: (msg: string) => void;
    redirect: (url: string, code?: number) => void;
    sendFile: (filePath: string) => void;
    cookie: (name: string, value: string, opts?: CookieOptions) => ExpressLikeResponse;
    clearCookie: (name: string, opts?: CookieOptions) => ExpressLikeResponse;
    send: (body: any) => void;
};

export type ExpressLikeRequest = IncomingMessage & {
    cookies: Record<string, string>;
    query: Record<string, string | string[] | undefined>;
    body: any;
    params: Record<string, string>;
};

export function readRawBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        req.on("data", c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on("end", () => resolve(Buffer.concat(chunks)));
        req.on("error", reject);
    });
}

export async function readJsonBody<T>(req: IncomingMessage) {
    const raw_body = await readRawBody(req);
    try {
        const json = JSON.parse(raw_body.toString()) as T;
        return json;
    } catch(e) {
        console.log(e);
        return null;
    }
}

export function sendJson(res: ServerResponse, code: number, obj: any) {
    const body = JSON.stringify(obj);
    res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) });
    res.end(body);
}

export function sendText(res: ServerResponse, code: number, text: string) {
    res.writeHead(code, { "Content-Type": "text/plain", "Content-Length": Buffer.byteLength(text) });
    res.end(text);
}

export function serveStatic(baseDir: string, req: IncomingMessage, res: ServerResponse) {
    if (req.method !== "GET" && req.method !== "HEAD") return false;

    let reqPath = decodeURIComponent(req.url || "/");
    if (reqPath.startsWith("/")) reqPath = reqPath.slice(1);
    const safePath = normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = join(baseDir, safePath);

    stat(filePath, (err, stats) => {
        if (err) {
            res.statusCode = 404;
            res.end("Not Found");
            return;
        }
        if (stats.isDirectory()) {
            res.statusCode = 403;
            res.end("Forbidden");
            return;
        }
        res.writeHead(200, {
            "Content-Type": getMimeType(filePath),
            "Content-Length": stats.size
        });
        if (req.method === "GET") {
            const stream = createReadStream(filePath);
            stream.pipe(res);
            stream.on("error", () => {
                res.statusCode = 500;
                res.end("Server Error");
            });
        } else {
            res.end();
        }
    });

    return true;
}

export function attachResponseHelpers(res2: ServerResponse) {
    let res: ExpressLikeResponse = res2 as any;

    res.status = function (code: number) {
        res.statusCode = code;
        return res;
    };

    res.json = function (obj: any) {
        const body = JSON.stringify(obj);
        if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Length", Buffer.byteLength(body));
        res.end(body);
    };

    res.text = function (msg: string) {
        if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Content-Length", Buffer.byteLength(msg));
        res.end(msg);
    };

    res.redirect = function (url: string, code = 302) {
        res.statusCode = code;
        res.setHeader("Location", url);
        res.end(`Redirecting to ${url}`);
    };

    res.sendFile = function (filePath: string) {
        try {
            const stats = statSync(filePath);
            res.statusCode = 200;
            res.setHeader("Content-Length", stats.size);
            res.setHeader("Content-Disposition", `inline; filename="${basename(filePath)}"`);
            const stream = createReadStream(filePath);
            stream.pipe(res);
            stream.on("error", () => {
                res.statusCode = 500;
                res.end("Server error while reading file");
            });
        } catch {
            res.statusCode = 404;
            res.end("File not found");
        }
    };

    // Send (auto-detect type)
    res.send = function (body: any) {
        if (Buffer.isBuffer(body)) {
            if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Length", body.length);
            res.end(body);
        } else if (typeof body === "object" && body !== null) {
            const json = JSON.stringify(body);
            if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json");
            res.setHeader("Content-Length", Buffer.byteLength(json));
            res.end(json);
        } else {
            const text = body != null ? String(body) : "";
            if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "text/html; charset=utf-8");
            res.setHeader("Content-Length", Buffer.byteLength(text));
            res.end(text);
        }
    };

    res.cookie = function (name: string, value: string, options: CookieOptions = {}) {
        let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
        if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
        if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
        if (options.domain) cookie += `; Domain=${options.domain}`;
        cookie += `; Path=${options.path || "/"}`;
        if (options.httpOnly) cookie += "; HttpOnly";
        if (options.secure) cookie += "; Secure";
        if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;

        const prev = res.getHeader("Set-Cookie");
        if (prev) {
            if (Array.isArray(prev)) res.setHeader("Set-Cookie", [...prev, cookie]);
            else res.setHeader("Set-Cookie", [prev as string, cookie]);
        } else {
            res.setHeader("Set-Cookie", cookie);
        }
        return res;
    };

    res.clearCookie = function (name: string, options: CookieOptions = {}) {
        res.cookie(name, "", { ...options, expires: new Date(0), maxAge: 0 });
        return res;
    };

    return res;
}

export async function attachRequestHelpers(req2: IncomingMessage, params: Record<string, string> = {}) {
    let req: ExpressLikeRequest = req2 as any;

    req.params = params;

    req.cookies = {};
    const cookieHeader = req.headers["cookie"];
    if (cookieHeader) {
        (cookieHeader as string).split(";").forEach(pair => {
            const [name, ...rest] = pair.trim().split("=");
            req.cookies[decodeURIComponent(name)] = decodeURIComponent(rest.join("="));
        });
    }

    req.query = {};
    const url = req.url || "";
    const idx = url.indexOf("?");
    if (idx !== -1) {
        req.query = parseQuery(url.slice(idx + 1));
    }

    req.body = {};
    if (["POST", "PUT", "PATCH"].includes((req.method || "").toUpperCase())) {
        const raw = await readRawBody(req);
        if (raw.length) {
            const contentType = req.headers["content-type"] || "";
            try {
                if (contentType.includes("application/json")) {
                    req.body = JSON.parse(raw.toString("utf8"));
                } else if (contentType.includes("application/x-www-form-urlencoded")) {
                    req.body = parseQuery(raw.toString("utf8"));
                } else if (contentType.startsWith("text/")) {
                    req.body = raw.toString("utf8");
                } else {
                    req.body = raw; // fallback raw Buffer
                }
            } catch {
                req.body = null;
            }
        }
    }

    return req;
};

export function matchRoute(pattern: string, path: string) {
    const patternParts = pattern.split("/").filter(Boolean);
    const pathParts = path.split("/").filter(Boolean);

    if (patternParts.length !== pathParts.length) return false;

    const params: Record<string, string> = {};
    for (let i = 0; i < patternParts.length; i++) {
        const p = patternParts[i];
        const v = pathParts[i];
        if (p.startsWith(":")) {
            params[p.slice(1)] = decodeURIComponent(v);
        } else if (p !== v) {
            return false;
        }
    }
    return params;
}

function getMimeType(file: string): string {
    if (file.endsWith(".html")) return "text/html";
    if (file.endsWith(".css")) return "text/css";
    if (file.endsWith(".js")) return "application/javascript";
    if (file.endsWith(".json")) return "application/json";
    if (file.endsWith(".png")) return "image/png";
    if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
    if (file.endsWith(".gif")) return "image/gif";
    return "application/octet-stream";
}