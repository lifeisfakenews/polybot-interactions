# PolyBot Interactions

Simple interaction only framework for Discord Bots. Based on the custom framework used by [Vote Manager](https://votemanager.xyz).

# Usage

1. Install the package
```sh
# Using npm
npm i polybot-interactions

# Using bun
bun add polybot-interactions
```

2. Config

You will need the ID of your bot as well as the token and public key.

Additionally, a discord webhook for logging is recommended, but not required.

```ts
// config.ts
import { type Config } from "polybot-interactions";

export default {
    "application": {
        "token": "your-bot-token",
        "public_key": "your-application-public-key",
        "id": "your-bots-id"
    },
    "folders": {
        "commands": "./commands",
        "components": "./components"
    },
    "logging": {
        "webhook_url": "https://discord.com/api/webhooks/XXXX"
    },
    "port": 2000,
    "owners": [
        "760170825629958184"
    ],
} satisfies Config;
```

3. Create the client

```ts
//index.ts
import { Client } from "polybot-interactions";
import config from "./config";

const client = new Client(config);
client.init();
```

4. Create commands
The commands folder should be placed either in the `commands` folder, at the path specified in the config.
```ts
// commands/ping.ts
import { CommandBuilder, type Command } from "polybot-interactions";

export default {
    command: new CommandBuilder("ping").setDescription("Ping!"),

    async execute(client, interaction) {
        await interaction.reply({ content: "Pong!" });
    }
}
```

5. Interactions Endpoint URL

Discord needs to be able to send a POST to the endpoint provided by the framework, which requires you to have a domain. 

This guide assumes you have already own a domain and have configured DNS to point to a server or host of your choice.

If you are using a VPS, you will likely need a reverse proxy such as nginx to pass the request to the port the framework is listening on.

Set the **Interactions Endpoint URL** in the Discord developer portal for your bot to `https://YOURDOMAIN.com/_polybot/interactions`

6. Run the code

Probably in Docker but it doesnt matter as long as you run the `index.ts` file and requests to the port specified in the config are forwarded appropriately.



An example implementation can be found in the `examples` folder



# Component Notes:
1. Modals that have components v2 enabled will automatically generate label components. Use `.setLabel()` on the child component to specify the text.
1. Modals not using components v2 will automatically put text inputs into action rows
2. Select menus are automatically put into action rows
3. Select menus default to type text, and adding options with .addOptions() automatically sets it to type text
4. Modal interactions are handled automatically can be be used like so:
```ts
const modal = new ModalBuilder("bla").setTitle("Modal Title").addComponents([
    new TextInputBuilder("bla_name").setLabel("Name").setRequired(true),
    new SelectBuilder("bla_type").setLabel("Type").addOptions([
        { label: "Option 1", value: "1" },
        { label: "Option 2", value: "2" },
        { label: "Option 3", value: "3" }
    ])
]);
const result = await interaction.modal(modal);
await result.reply({ content: `${result.options.get("bla_name")}` });
```
5. Custom IDs are ignored after the `__` to allow passing of data, e.g. `bla__12345`, `bla__5678` and `bla__1234_abc` will all be passed to the handler for `bla`

# Web Server

The framework uses the http web server to receive interactions. You can configure it to also serve static assets or handle other routes.

To serve static assets, set `web_server.publicDir` to the path of the directory containing the assets.

Use `addRouteHandler` to add other routes.

```ts
client.addRouteHandler("/api/test", (req, res) => {
    res.json({ message: "Hello World!" });
});
```

The req and res objects are `IncomingMessage` and `ServerResponse` from the `http` module, with some additonal express-like methods / properties.


# Moderation

The framework has a built in moderation system that can be enabled by setting `moderation.enabled` to `true` in the config.

This is disabled by default.

The system will automatically check all command options and modal inputs for profanity.

You can add custom blacklisted words to the system by setting `moderation.blacklisted_words` in the config.

Enable/disable specific word lists by setting `moderation.enabled_word_lists` and `moderation.disabled_word_lists` in the config.

By default, the following word lists are enabled:

- `slurs`
- `sexual_explicit`
- `sexual_mild`
- `profane_mild`

The list `profane_strict` is also available but is disabled by default.
This list contains words like "butt" that are not typically considered profane but some people may prefer them to be filtered out.


## License

MIT

## Contributing

Issues and pull requests are welcome!

## Credits

As mentioned above, this framework is based on the one used by Vote Manager, the original code for which was largely written by [@Yasser-A420](https://github.com/Yasser-A420)
