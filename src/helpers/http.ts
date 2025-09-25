import type { IncomingMessage, ServerResponse } from "http";

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