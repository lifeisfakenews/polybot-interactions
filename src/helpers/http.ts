import type { IncomingMessage, ServerResponse } from "http";
import { createReadStream, stat, statSync } from "fs";
import { join, normalize, basename } from "path";

export type ExpressLikeResponse = ServerResponse & {
    status: (code: number) => ExpressLikeResponse;
    json: (obj: any) => void;
    text: (msg: string) => void;
    redirect: (url: string, code?: number) => void;
    sendFile: (filePath: string) => void;
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
    };
};

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
    // Only handle GET/HEAD
    if (req.method !== "GET" && req.method !== "HEAD") return false;

    // Defensive: normalize path, prevent directory traversal
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
            res.end(); // HEAD request (no body)
        }
    });

    return true;
};

export function attachResponseHelpers(res2: ServerResponse) {
    let res: ExpressLikeResponse = res2 as any;
    // Set status (chainable)
    res.status = function (code: number) {
        res.statusCode = code;
        return res;
    };

    // Send JSON
    res.json = function (obj: any) {
        const body = JSON.stringify(obj);
        if (!res.getHeader("Content-Type")) {
            res.setHeader("Content-Type", "application/json");
        }
        res.setHeader("Content-Length", Buffer.byteLength(body));
        res.end(body);
    };

    // Send text
    res.text = function (msg: string) {
        if (!res.getHeader("Content-Type")) {
            res.setHeader("Content-Type", "text/plain; charset=utf-8");
        }
        res.setHeader("Content-Length", Buffer.byteLength(msg));
        res.end(msg);
    };

    // Redirect
    res.redirect = function (url: string, code = 302) {
        res.statusCode = code;
        res.setHeader("Location", url);
        res.end(`Redirecting to ${url}`);
    };

    // Send file
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

    return res
}

function getMimeType(file: string): string {
    // Very minimal mime map
    if (file.endsWith(".html")) return "text/html";
    if (file.endsWith(".css")) return "text/css";
    if (file.endsWith(".js")) return "application/javascript";
    if (file.endsWith(".json")) return "application/json";
    if (file.endsWith(".png")) return "image/png";
    if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "image/jpeg";
    if (file.endsWith(".gif")) return "image/gif";
    return "application/octet-stream";
}