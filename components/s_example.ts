import * as types from "../types";

export default {
    custom_id: "s_example",
    type: types.ExportedComponentTypes.STRING_SELECT,
    async execute(client, interaction) {
    	const value = interaction.options.values[0];
        await interaction.reply({ content: `You choose ${value}` });
    }
} as types.ExportedComponent;
