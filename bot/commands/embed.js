var { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits } = require('discord.js');
var db = require('../../db/database');
var config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Create and manage custom embeds')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(sub =>
            sub.setName('create')
                .setDescription('Create a custom embed in the current channel')
                .addStringOption(opt =>
                    opt.setName('template')
                        .setDescription('Use a saved template (optional)')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub.setName('quick')
                .setDescription('Quick embed with inline options')
                .addStringOption(opt =>
                    opt.setName('title')
                        .setDescription('Embed title')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('description')
                        .setDescription('Embed description')
                        .setRequired(true)
                )
                .addStringOption(opt =>
                    opt.setName('color')
                        .setDescription('Hex color (e.g. #5865F2)')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('footer')
                        .setDescription('Footer text')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('image')
                        .setDescription('Image URL')
                        .setRequired(false)
                )
                .addStringOption(opt =>
                    opt.setName('thumbnail')
                        .setDescription('Thumbnail URL')
                        .setRequired(false)
                )
        )
        .addSubcommandGroup(group =>
            group.setName('template')
                .setDescription('Manage embed templates')
                .addSubcommand(sub =>
                    sub.setName('save')
                        .setDescription('Save current settings as a template')
                        .addStringOption(opt =>
                            opt.setName('name')
                                .setDescription('Template name')
                                .setRequired(true)
                        )
                        .addStringOption(opt =>
                            opt.setName('color')
                                .setDescription('Default color (e.g. #5865F2)')
                                .setRequired(false)
                        )
                        .addStringOption(opt =>
                            opt.setName('title')
                                .setDescription('Default embed title')
                                .setRequired(false)
                        )
                        .addStringOption(opt =>
                            opt.setName('footer')
                                .setDescription('Default footer text')
                                .setRequired(false)
                        )
                        .addStringOption(opt =>
                            opt.setName('image')
                                .setDescription('Default image URL')
                                .setRequired(false)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('list')
                        .setDescription('Show all saved templates')
                )
                .addSubcommand(sub =>
                    sub.setName('delete')
                        .setDescription('Delete a saved template')
                        .addStringOption(opt =>
                            opt.setName('name')
                                .setDescription('Template name to delete')
                                .setRequired(true)
                        )
                )
                .addSubcommand(sub =>
                    sub.setName('preview')
                        .setDescription('Preview a saved template')
                        .addStringOption(opt =>
                            opt.setName('name')
                                .setDescription('Template name to preview')
                                .setRequired(true)
                        )
                )
        ),

    async execute(interaction, client) {
        var sub = interaction.options.getSubcommand();
        var group = interaction.options.getSubcommandGroup(false);
        var guildId = interaction.guildId;

        // handle template subcommands
        if (group === 'template') {
            if (sub === 'save') {
                var name = interaction.options.getString('name').toLowerCase().trim();
                var color = interaction.options.getString('color') || '#5865F2';
                var title = interaction.options.getString('title') || '';
                var footer = interaction.options.getString('footer') || '';
                var image = interaction.options.getString('image') || '';

                // validate color
                var cleanColor = color.replace('#', '');
                if (!/^[0-9a-fA-F]{6}$/.test(cleanColor)) {
                    return interaction.reply({ content: '❌ Invalid hex color. Use format like `#5865F2` or `5865F2`.', ephemeral: true });
                }

                db.saveTemplate(guildId, name, {
                    color: '#' + cleanColor,
                    title: title,
                    footer: footer,
                    image: image
                });

                var preview = new EmbedBuilder()
                    .setTitle(title || 'Template Preview')
                    .setDescription('This is what your template defaults look like.')
                    .setColor(parseInt(cleanColor, 16));

                if (footer) preview.setFooter({ text: footer });
                if (image) preview.setImage(image);

                await interaction.reply({
                    content: '✅ Template **' + name + '** saved!',
                    embeds: [preview],
                    ephemeral: true
                });
            }

            else if (sub === 'list') {
                var templates = db.listTemplates(guildId);

                if (templates.length === 0) {
                    return interaction.reply({ content: '📋 No templates saved yet. Use `/embed template save` to create one.', ephemeral: true });
                }

                var lines = templates.map(function(t, i) {
                    var color = t.data.color || 'default';
                    var footer = t.data.footer ? ' | Footer: ' + t.data.footer : '';
                    return '**' + (i + 1) + '.** `' + t.name + '` — Color: `' + color + '`' + footer;
                });

                var embed = new EmbedBuilder()
                    .setTitle('📋 Embed Templates')
                    .setDescription(lines.join('\n'))
                    .setColor(config.embedColor)
                    .setFooter({ text: templates.length + ' template(s)' });

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            else if (sub === 'delete') {
                var name = interaction.options.getString('name').toLowerCase().trim();
                var deleted = db.deleteTemplate(guildId, name);

                if (deleted) {
                    await interaction.reply({ content: '✅ Template **' + name + '** deleted.', ephemeral: true });
                } else {
                    await interaction.reply({ content: '❌ Template **' + name + '** not found.', ephemeral: true });
                }
            }

            else if (sub === 'preview') {
                var name = interaction.options.getString('name').toLowerCase().trim();
                var template = db.getTemplate(guildId, name);

                if (!template) {
                    return interaction.reply({ content: '❌ Template **' + name + '** not found.', ephemeral: true });
                }

                var d = template.data;
                var embed = new EmbedBuilder()
                    .setTitle(d.title || 'Template: ' + name)
                    .setDescription('This is a preview of the **' + name + '** template.\nUse `/embed create template:' + name + '` to use it.')
                    .setColor(parseInt((d.color || '#5865F2').replace('#', ''), 16));

                if (d.footer) embed.setFooter({ text: d.footer });
                if (d.image) embed.setImage(d.image);

                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            return;
        }

        // /embed create — opens a modal
        if (sub === 'create') {
            var templateName = interaction.options.getString('template');
            var defaults = { title: '', color: '5865F2', footer: '', image: '' };

            if (templateName) {
                var template = db.getTemplate(guildId, templateName.toLowerCase().trim());
                if (template) {
                    defaults.title = template.data.title || '';
                    defaults.color = (template.data.color || '#5865F2').replace('#', '');
                    defaults.footer = template.data.footer || '';
                    defaults.image = template.data.image || '';
                }
            }

            var modal = new ModalBuilder()
                .setCustomId('embed_create_modal')
                .setTitle('Create Embed');

            var titleInput = new TextInputBuilder()
                .setCustomId('embed_title')
                .setLabel('Title')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter embed title')
                .setRequired(true)
                .setMaxLength(256)
                .setValue(defaults.title);

            var descInput = new TextInputBuilder()
                .setCustomId('embed_description')
                .setLabel('Description')
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder('Enter embed description (supports markdown)')
                .setRequired(false)
                .setMaxLength(4000);

            var colorInput = new TextInputBuilder()
                .setCustomId('embed_color')
                .setLabel('Color (hex code)')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('#5865F2')
                .setRequired(false)
                .setMaxLength(7)
                .setValue(defaults.color ? '#' + defaults.color : '');

            var footerInput = new TextInputBuilder()
                .setCustomId('embed_footer')
                .setLabel('Footer')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Footer text (optional)')
                .setRequired(false)
                .setMaxLength(2048)
                .setValue(defaults.footer);

            var imageInput = new TextInputBuilder()
                .setCustomId('embed_image')
                .setLabel('Image URL')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('https://example.com/image.png (optional)')
                .setRequired(false)
                .setValue(defaults.image);

            modal.addComponents(
                new ActionRowBuilder().addComponents(titleInput),
                new ActionRowBuilder().addComponents(descInput),
                new ActionRowBuilder().addComponents(colorInput),
                new ActionRowBuilder().addComponents(footerInput),
                new ActionRowBuilder().addComponents(imageInput)
            );

            await interaction.showModal(modal);
        }

    }
};
