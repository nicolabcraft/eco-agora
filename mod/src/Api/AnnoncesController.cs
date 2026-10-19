namespace EcoAgora.Api
{
    using System;
    using System.Collections.Generic;
    using EcoAgora.Models;
    using EcoAgora.Storage;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using static EcoAgora.Api.AgoraJson;

    /// <summary>Corps attendu pour remplacer la liste des annonces.</summary>
    public class AnnoncesPayload
    {
        public List<Annonce> annonces { get; set; }
    }

    /// <summary>
    /// Annonces du site. La lecture est publique (elles sont destinees a tous les
    /// visiteurs) ; l'ecriture est reservee aux administrateurs, verifiee par Eco
    /// via la politique RequireAdmin et non par ce mod.
    /// </summary>
    [ApiController]
    [Route("api/agora/annonces")]
    public class AnnoncesController : ControllerBase
    {
        [HttpGet]
        [AllowAnonymous]
        public IActionResult Get()
        {
            var items = AgoraDb.ListAnnonces();
            return this.Json(new Dictionary<string, object>
            {
                ["version"] = 1,
                ["miseAJour"] = DateTime.UtcNow.ToString("o"),
                ["annonces"] = items,
                ["source"] = "mod",
            });
        }

        /// <summary>Remplace l'integralite de la liste : c'est le modele de l'editeur du panel.</summary>
        [HttpPut]
        [Authorize(Policy = "RequireAdmin")]
        public IActionResult Replace([FromBody] AnnoncesPayload payload)
        {
            if (payload == null) return this.JsonError(400, "Corps de requete absent.");

            var items = payload.annonces ?? new List<Annonce>();
            foreach (var a in items)
            {
                if (string.IsNullOrWhiteSpace(a.titre))
                    return this.JsonError(400, "Chaque annonce doit avoir un titre.");
                if (a.titre.Length > 120)
                    return this.JsonError(400, "Un titre ne peut pas depasser 120 caracteres.");
                if (a.message != null && a.message.Length > 2000)
                    return this.JsonError(400, "Un message ne peut pas depasser 2000 caracteres.");
            }

            AgoraDb.ReplaceAnnonces(items);
            var saved = AgoraDb.ListAnnonces();

            return this.Json(new Dictionary<string, object>
            {
                ["version"] = 1,
                ["miseAJour"] = DateTime.UtcNow.ToString("o"),
                ["annonces"] = saved,
                ["source"] = "mod",
            });
        }

        [HttpDelete("{id}")]
        [Authorize(Policy = "RequireAdmin")]
        public IActionResult Delete(string id)
        {
            var items = AgoraDb.ListAnnonces();
            var kept = items.FindAll(a => a.id != id);
            if (kept.Count == items.Count) return this.JsonError(404, "Annonce introuvable.");

            AgoraDb.ReplaceAnnonces(kept);
            return this.NoContent();
        }
    }
}
