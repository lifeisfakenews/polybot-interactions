type RouteRateLimit = {
    limit: number;
    remaining: number;
    reset: number;
}

type FetchOptions = Parameters<typeof fetch>[1];

type LogLevel = "error" | "warn" | "info" | "debug";

class REST {
    token: string;
    globalRateLimit: boolean;
    globalRateLimitReset: number;
    routeRateLimits: Map<string, RouteRateLimit>;

    constructor(token:string) {
        this.token = token;
        this.globalRateLimit = false;
        this.globalRateLimitReset = 0;
        this.routeRateLimits = new Map();
    };

    private logToConsole(content:string, level:LogLevel = "info") {
        const color = {
            error: "\x1b[31m",
            warn: "\x1b[33m",
            info: "\x1b[36m",
            debug: "\x1b[36m",
        } as const;
        console.log(`${color[level]}[PolyBot]\x1b[0m ${content}`);
    };

    async fetch(url:string, data:FetchOptions) {
        if (this.globalRateLimit && Date.now() < this.globalRateLimitReset) {
            const delay = this.globalRateLimitReset - Date.now();
            await new Promise(resolve => setTimeout(resolve, delay));
        };
        const routeData = this.routeRateLimits.get(url);
        if (routeData) {
            if (routeData.remaining === 0 && Date.now() < routeData.reset) {
                const delay = routeData.reset - Date.now();
                await new Promise(resolve => setTimeout(resolve, delay));
            };
        };
        const response = await fetch(url, data);
        const rateLimitHeaders = response.headers.get("x-ratelimit-bucket") ? response.headers : null;
        if (rateLimitHeaders) {
            const bucket = rateLimitHeaders.get("x-ratelimit-bucket") ?? url;
            const limit = rateLimitHeaders.get("x-ratelimit-limit")!;
            const remaining = rateLimitHeaders.get("x-ratelimit-remaining")!;
            const reset = rateLimitHeaders.get("x-ratelimit-reset")!;
            this.routeRateLimits.set(bucket, {
                limit: parseInt(limit),
                remaining: parseInt(remaining),
                reset: parseInt(reset) * 1000
            });
        } else {
            this.globalRateLimit = false;
            this.globalRateLimitReset = 0;
        }
    
        if (response.status === 429 && response.headers.has("x-ratelimit-global")) {
            this.globalRateLimit = true;
            this.globalRateLimitReset = parseInt(response.headers.get("retry-after")!) + Date.now();
            this.logToConsole(`Global rate limit hit, waiting ${this.globalRateLimitReset - Date.now()}ms before retrying`, "warn");
        };

        return response;
    };
};

export { REST };