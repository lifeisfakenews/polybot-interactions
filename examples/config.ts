import { type Config } from "polybot-interactions";

type AdditionalConfig = {
    embed_color: string;
}

export default {
    "application": {
        "token": "ODk4ODUyMzI3MzQ2MjgyNTI3.GIiEfe.bv0sFTtQhUEgMgFcPnB55uJ3jAzZzjCXYPXgj8",
        "public_key": "2b9b36d88788843e4761e550993484f24b70939be86012dd844dd3218e5ccf76",
        "id": "898852327346282527"
    },
    "folders": {
        "commands": "./commands",
        "components": "./components"
    },
    "logging": {
        "webhook_url": "https://ptb.discord.com/api/webhooks/1420840683668897872/x5jya2ZBwq163WB3B8xP2LxSEGQJaPfjf4aL79Zf1dDJXA0uCigWUVn7Xa1TxYLR1A-e"
    },
    "port": 2000,
    "owners": ["760170825629958184"],

    "additional": {
        "embed_color": "#3be143",
    }
} satisfies Config<AdditionalConfig>;
// the type passed with Config defines the type of `additional` property