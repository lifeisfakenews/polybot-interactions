type RouteRateLimit = {
    limit: number;
    remaining: number;
    reset: number;
}

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

    async fetch(url:string, data:{[x:string]:any}) {
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
        }

        return response;
    };
};

export { REST };