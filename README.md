# PolyBot Interactions


# Component Notes:
1. Text Inputs (for modals) are automatially put into action rows
2. Select menus are automatially put into action rows
3. Select menus default to type text, and adding options with .addOptions() automatically sets it to type text
4. Modal interactions are handled automatically can be be used like so:
```ts
const modal = new ModalBuilder("bla").setTitle("i beg this works").addComponents([
    new TextInputBuilder("bla_name").setLabel("Name").setRequired(true),
]);
const result:Interaction = await interaction.modal(modal);
await result.reply({ content: `${result.options.get("bla_name")}` });
```
5. Custom IDs are ignored after the `__` to allow passing of data, e.g. bla__12345 and bla_5678 will both be passed as `bla`
