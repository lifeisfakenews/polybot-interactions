import { CommandBuilder, EmbedBuilder, type Command, CommandTypes } from "polybot-interactions";

export default {
    visible: true,
    command: new CommandBuilder(CommandTypes.CHAT_INPUT).setName("help").setDescription("Gives a list of my commands"),
    async execute(client, interaction) {
        const self = await client.getUser(client.config.application.id);
        const embed = new EmbedBuilder()
            .setDescription(`${Array.from(client.commands.values()).filter(x => x.visible && !x.staff_only).map(x => `\`/${x.command.data.name}\`: ${x.command.data.description ?? ""}`).join("\n")}`)
            .setColor(client.config.additional.embed_color)
            .setFooter({text: interaction.user.global_name ?? interaction.user.username, icon_url: client.getUserAvatar(interaction.user.id, interaction.user.avatar)});
        if (self) embed.setAuthor({name: self.global_name ?? self.username, icon_url: client.getUserAvatar(self.id, self.avatar)}).setThumbnail(client.getUserAvatar(self.id, self.avatar));
        await interaction.reply({embeds: [embed]});
    }
} as Command;