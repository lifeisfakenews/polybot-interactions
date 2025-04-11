import { dirname, join } from "path";

import { Client, InteractionTypes } from "./utils";
import config from "./config.json";

const client = new Client(config, {commands_folder: join(dirname(__filename), "commands"), components_folder: join(dirname(__filename), "components")});
client.initialize();

client.on("interaction", async (interaction) => {
    try {
        if (interaction.type === InteractionTypes.MODAL_SUBMIT) return;//Handled elsewhere
        if (interaction.type === InteractionTypes.APPLICATION_COMMAND || interaction.type === InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return client.log(`No handler found for command ${interaction.commandName}`, "error");
            if (command.staff_only && !client.config.owners.includes(interaction.user.id)) return interaction.reply({ content: "You don't have permission to use this command!"}, true);
        
            if (interaction.type === InteractionTypes.APPLICATION_COMMAND_AUTOCOMPLETE) {
                if (command.autocomplete) await command.autocomplete(client, interaction);
                else await interaction.autocomplete([]);
            } else {
                await command.execute(client, interaction)
            };
        } else if (interaction.type === InteractionTypes.MESSAGE_COMPONENT) {
            if (!interaction.custom_id) return client.log(`No handler found for component ${interaction.custom_id}`, "error");
            const component = client.components.get(interaction.custom_id.split("__")[0]);
            if (!component) return;
            if (component.staff_only && !client.config.owners.includes(interaction.user.id)) return interaction.reply({ content: "You don't have permission to use this component!"}, true);
            await component.execute(client, interaction);
        } else {
            return interaction.reply({ content: "Invalid interaction type!" }, true);
        };
    } catch (e:any) {
        client.log(e, "error");
        interaction.reply({ content: `There was an error while executing this command!\n${client.toRedCodeBlock(e.toString())}` }, true);
    };
});

process.on("unhandledRejection", handleError);
process.on("uncaughtException", handleError);

function handleError(error:any) {
    console.log(error);
    client.log(`${error.message}\n\`\`\`${error.stack}\`\`\``, {footer: "true", type: "error"});
};