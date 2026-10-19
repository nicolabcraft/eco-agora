namespace EcoAgora.Api
{
    using System;
    using System.Collections.Generic;
    using System.IO;
    using System.Text;
    using System.Threading.Tasks;
    using EcoAgora.Storage;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using Newtonsoft.Json;
    using Newtonsoft.Json.Linq;

    /// <summary>
    /// Personnalisation du panel : nom de la communaute, adresse du jeu, liens,
    /// reglement, rideau d'ouverture... Le panel definit le schema ; le mod se
    /// contente de garder l'objet tel quel dans Mods/EcoAgora/data/site.json,
    /// lisible et modifiable a la main.
    ///
    /// Lecture publique : tout ce fichier est affiche aux visiteurs. Il ne doit
    /// donc contenir aucun secret (le mot de passe du rideau d'ouverture n'en est
    /// pas un : il est compare dans le navigateur, comme l'explique le panel).
    /// </summary>
    [ApiController]
    [Route("api/agora/site")]
    public class SiteController : ControllerBase
    {
        /// <summary>Taille maximale acceptee : un reglement tient largement dedans.</summary>
        private const int MaxBytes = 256 * 1024;

        private static readonly object Gate = new object();

        public static string SitePath => Path.Combine(AgoraDb.DataDirectory, "site.json");

        [HttpGet]
        [AllowAnonymous]
        public IActionResult Get()
        {
            lock (Gate)
            {
                if (!System.IO.File.Exists(SitePath)) return this.Json(new { config = (object)null, miseAJour = (string)null });
                try
                {
                    var config = Lire(System.IO.File.ReadAllText(SitePath, Encoding.UTF8));
                    var quand = System.IO.File.GetLastWriteTimeUtc(SitePath).ToString("o");
                    return new ContentResult
                    {
                        Content = $"{{\"config\":{config.ToString(Formatting.None)},\"miseAJour\":{JsonConvert.ToString(quand)}}}",
                        ContentType = "application/json; charset=utf-8",
                        StatusCode = 200,
                    };
                }
                catch (Exception e)
                {
                    // Un fichier edite a la main peut etre casse : le panel garde ses valeurs par defaut.
                    return this.Json(new { config = (object)null, miseAJour = (string)null, erreur = "site.json illisible : " + e.Message });
                }
            }
        }

        /// <summary>
        /// Remplace la personnalisation. Le corps est lu brut, sans passer par le
        /// serialiseur du serveur (configure avec TypeNameHandling) : on ne veut
        /// qu'un objet JSON, jamais d'instanciation de type.
        /// </summary>
        [HttpPut]
        [Authorize(Policy = "RequireAdmin")]
        public async Task<IActionResult> Put()
        {
            string texte;
            using (var lecteur = new StreamReader(this.Request.Body, Encoding.UTF8))
            {
                var tampon = new char[MaxBytes + 1];
                var lus = await lecteur.ReadBlockAsync(tampon, 0, tampon.Length);
                if (lus > MaxBytes) return this.JsonError(413, $"Personnalisation trop volumineuse (limite {MaxBytes / 1024} Ko).");
                texte = new string(tampon, 0, lus);
            }

            JObject config;
            try { config = Lire(texte); }
            catch (Exception e) { return this.JsonError(400, "JSON invalide : " + e.Message); }

            lock (Gate)
            {
                Directory.CreateDirectory(AgoraDb.DataDirectory);
                // Ecriture atomique : un arret brutal ne laisse jamais un fichier a moitie ecrit.
                var tmp = SitePath + ".tmp";
                System.IO.File.WriteAllText(tmp, config.ToString(Formatting.Indented), new UTF8Encoding(false));
                System.IO.File.Move(tmp, SitePath, overwrite: true);
            }

            return this.Get();
        }

        private static JObject Lire(string texte)
        {
            using var lecteur = new JsonTextReader(new StringReader(texte)) { DateParseHandling = DateParseHandling.None };
            var jeton = JToken.ReadFrom(lecteur);
            var objet = jeton as JObject ?? throw new InvalidDataException("un objet JSON est attendu.");
            RetirerMeta(objet);
            return objet;
        }

        /// <summary>
        /// Retire les cles reservees de Json.NET ($type, $id, $ref...) : le fichier
        /// n'en a pas besoin, et un futur lecteur configure avec TypeNameHandling
        /// ne doit jamais y trouver d'instruction d'instanciation.
        /// </summary>
        private static void RetirerMeta(JToken jeton)
        {
            if (jeton is JObject o)
            {
                foreach (var p in new List<JProperty>(o.Properties()))
                {
                    if (p.Name.StartsWith("$", StringComparison.Ordinal)) p.Remove();
                    else RetirerMeta(p.Value);
                }
            }
            else if (jeton is JArray a)
            {
                foreach (var e in a) RetirerMeta(e);
            }
        }
    }
}
