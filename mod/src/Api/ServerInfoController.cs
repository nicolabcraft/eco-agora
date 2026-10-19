namespace EcoAgora.Api
{
    using System;
    using Eco.Plugins.Networking;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using static EcoAgora.Api.AgoraJson;

    /// <summary>Corps accepte pour modifier la presentation du serveur.</summary>
    public class ServerInfoPayload
    {
        public string detailedDescription { get; set; }
    }

    /// <summary>
    /// Presentation du serveur. Eco expose bien /api/v1/admin/{get,set}/servername pour
    /// le nom, mais aucune route pour la description : cette route comble ce seul manque.
    ///
    /// L'ecriture ne touche qu'une propriete de EcoServerConfig et laisse le greffon
    /// reseau enregistrer lui-meme. On evite volontairement de relire puis reecrire la
    /// configuration entiere via /api/v1/plugins/config/NetworkManager : elle contient
    /// Password, HashedPassword et RconPassword, qu'un aller-retour pourrait ecraser.
    /// </summary>
    [ApiController]
    [Route("api/agora/serverinfo")]
    public class ServerInfoController : ControllerBase
    {
        private const int MaxLength = 1000;

        [HttpGet]
        [AllowAnonymous]
        public IActionResult Get()
        {
            var config = NetworkManager.Config;
            if (config == null) return this.Json(new { available = false });

            return this.Json(new
            {
                available = true,
                name = config.Name ?? string.Empty,
                detailedDescription = config.DetailedDescription ?? string.Empty,
                discordAddress = config.DiscordAddress ?? string.Empty,
                category = config.ServerCategory.ToString(),
                publicServer = config.PublicServer,
                // Port de jeu : absent de /info, utile au bouton « Rejoindre » du panel.
                gamePort = config.GameServerPort,
                maxLength = MaxLength,
            });
        }

        [HttpPost]
        [Authorize(Policy = "RequireAdmin")]
        public IActionResult Post([FromBody] ServerInfoPayload payload)
        {
            if (payload?.detailedDescription == null)
                return this.BadRequest(new { error = "Champ detailedDescription absent." });

            var config = NetworkManager.Config;
            if (config == null)
                return this.StatusCode(503, new { error = "Configuration reseau indisponible." });

            // Espaces de fin retires : ils sont invisibles dans la liste des serveurs.
            var text = payload.detailedDescription.Replace("\r\n", "\n").Trim();
            if (text.Length > MaxLength)
                return this.BadRequest(new { error = $"Description limitee a {MaxLength} caracteres." });

            var previous = config.DetailedDescription;
            config.DetailedDescription = text;

            var saved = false;
            string warning = null;
            try
            {
                var plugin = NetworkManager.Obj;
                if (plugin != null)
                {
                    // Meme chemin que l'editeur interne du serveur : le greffon applique
                    // le changement, puis on force l'ecriture sur disque.
                    try { plugin.OnEditObjectChanged(config, nameof(config.DetailedDescription)); }
                    catch (Exception ex) { warning = "Notification du greffon refusee : " + ex.Message; }

                    var pluginConfig = plugin.PluginConfig;
                    if (pluginConfig != null)
                    {
                        pluginConfig.SaveAsync().GetAwaiter().GetResult();
                        saved = true;
                    }
                }
            }
            catch (Exception ex)
            {
                config.DetailedDescription = previous;
                return this.StatusCode(500, new { error = "Enregistrement impossible : " + ex.Message });
            }

            if (!saved)
            {
                config.DetailedDescription = previous;
                return this.StatusCode(500, new
                {
                    error = "Le greffon reseau n'a pas expose sa configuration : rien n'a ete enregistre.",
                });
            }

            return this.Json(new
            {
                ok = true,
                detailedDescription = config.DetailedDescription,
                warning,
            });
        }
    }
}
