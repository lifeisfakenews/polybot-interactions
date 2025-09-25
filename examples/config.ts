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
        "commands": "./commands",//optional
        "components": "./components"//optional
    },
    "logging": {
        "webhook_url": "https://ptb.discord.com/api/webhooks/1420840683668897872/x5jya2ZBwq163WB3B8xP2LxSEGQJaPfjf4aL79Zf1dDJXA0uCigWUVn7Xa1TxYLR1A-e"
    },
    "web_server": {
        "port": 2000,
        "interactions_endpoint": "/_polybot/interactions",//this is the default value (dont need to specify)
        "publicDir": "./public"//Optionally serve static assets out of the given directory
    },
    "owners": ["760170825629958184"],
    
    "embed_color": "#3be143",
} satisfies Config<AdditionalConfig>;
// the type passed with Config allows you define additonal arbitrary properties