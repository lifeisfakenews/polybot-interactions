import * as types from "../types";
import { EmbedBuilder, CommandBuilder, CommandTypes, OptionBuilder, OptionTypes } from "../utils";

export default {
    staff_only: true,
    visible: false,
    command: new CommandBuilder(CommandTypes.CHAT_INPUT).setName("eval").setDescription("Run some code").addOptions([
            new OptionBuilder(OptionTypes.STRING).setName("code").setDescription("Code to run").setRequired(true)
    ]),
    async execute(client, interaction) {
        await interaction.deferReply();
        if (!client.config.owners.includes(interaction.user.id)) return interaction.editReply({ content: "You can't use this command!" });
        
        const codetoeval = interaction.options.get("code");
        await client.log(`${interaction.user.username} Evaluated\n\`\`\`js\n${codetoeval}\`\`\``, "eval");
        try {
            const result = await eval(codetoeval);
            const response = new EmbedBuilder()
                .setColor(client.config.embedColor)
                .setDescription(`**Input:**\n\`${codetoeval}\`\n\n**Evaled Code:**\n\`${`${await result}`.slice(0, 2048)}\``);
            await interaction.editReply({ embeds: [response] });
        } catch (err:any) {
            const error = new EmbedBuilder().setColor(client.config.embedColor).setDescription(`**Input:**\n\`${codetoeval}\`\n\n**Error:**\n\`${JSON.stringify(err, null, 2) === "{}" ? err.toString() : JSON.stringify(err, null, 2)}\``)
            await interaction.editReply({ embeds: [error] });
        }
    },
} as types.ExportedCommand;
