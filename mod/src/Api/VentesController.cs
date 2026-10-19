namespace EcoAgora.Api
{
    using System;
    using System.Linq;
    using EcoAgora.Commerce;
    using Microsoft.AspNetCore.Authorization;
    using Microsoft.AspNetCore.Mvc;
    using static EcoAgora.Api.AgoraJson;

    /// <summary>
    /// Qui a depense combien dans chaque boutique. Reserve aux administrateurs : les
    /// depenses de chaque joueur ne sont pas une information publique par defaut.
    /// </summary>
    [ApiController]
    [Route("api/agora/ventes")]
    [Authorize(Policy = "RequireAdmin")]
    public class VentesController : ControllerBase
    {
        /// <summary>Resume par boutique et par client. jours = 0 : toute la periode.</summary>
        [HttpGet("resume")]
        public IActionResult Resume([FromQuery] double jours = 0)
        {
            DateTime? depuis = jours > 0 ? DateTime.UtcNow.AddDays(-jours) : null;
            var ventes = AgoraVentes.Depuis(depuis);

            var boutiques = ventes
                .GroupBy(v => v.BoutiqueId ?? v.Boutique ?? "?")
                .Select(g =>
                {
                    var derniere = g.OrderByDescending(v => v.Ts).First();
                    return new
                    {
                        boutiqueId = derniere.BoutiqueId,
                        boutique = derniere.Boutique,
                        proprietaire = derniere.Proprietaire,
                        transactions = g.Count(),
                        // Ce que les clients ont paye a la boutique, par devise.
                        encaisse = g.Where(v => v.Acheteur != v.Proprietaire && !v.Troc)
                            .GroupBy(v => v.Devise ?? "")
                            .Select(d => new { devise = d.Key, montant = d.Sum(v => v.Montant) }),
                        clients = g.Where(v => !string.IsNullOrEmpty(v.Acheteur) && v.Acheteur != v.Proprietaire)
                            .GroupBy(v => v.Acheteur)
                            .Select(c => new
                            {
                                joueur = c.Key,
                                achats = c.Count(),
                                articles = c.Sum(v => v.Quantite),
                                depense = c.Where(v => !v.Troc).GroupBy(v => v.Devise ?? "")
                                    .Select(d => new { devise = d.Key, montant = d.Sum(v => v.Montant) }),
                                dernier = c.Max(v => v.Ts).ToString("o"),
                            })
                            .OrderByDescending(c => c.depense.Sum(d => d.montant))
                            .ToList(),
                        // La boutique qui achete aux joueurs : qui lui a vendu quoi.
                        fournisseurs = g.Where(v => !string.IsNullOrEmpty(v.Vendeur) && v.Vendeur != v.Proprietaire)
                            .GroupBy(v => v.Vendeur)
                            .Select(c => new
                            {
                                joueur = c.Key,
                                ventes = c.Count(),
                                articles = c.Sum(v => v.Quantite),
                                recu = c.Where(v => !v.Troc).GroupBy(v => v.Devise ?? "")
                                    .Select(d => new { devise = d.Key, montant = d.Sum(v => v.Montant) }),
                            })
                            .ToList(),
                    };
                })
                .OrderByDescending(b => b.transactions)
                .ToList();

            return this.Json(new
            {
                depuis = depuis?.ToString("o"),
                transactions = ventes.Count,
                premiere = ventes.Count > 0 ? ventes.Min(v => v.Ts).ToString("o") : null,
                boutiques,
            });
        }

        /// <summary>Dernieres transactions, filtrables par boutique ou par joueur.</summary>
        [HttpGet]
        public IActionResult Liste([FromQuery] string boutiqueId = null, [FromQuery] string joueur = null, [FromQuery] int limite = 200)
        {
            var q = AgoraVentes.Collection.FindAll().AsEnumerable();
            if (!string.IsNullOrEmpty(boutiqueId)) q = q.Where(v => v.BoutiqueId == boutiqueId);
            if (!string.IsNullOrEmpty(joueur)) q = q.Where(v => v.Acheteur == joueur || v.Vendeur == joueur);
            var liste = q.OrderByDescending(v => v.Ts).Take(Math.Clamp(limite, 1, 1000))
                .Select(v => new
                {
                    ts = v.Ts.ToString("o"),
                    v.Acheteur, v.Vendeur, v.Proprietaire, v.BoutiqueId, v.Boutique,
                    v.Objet, v.Etiquette, v.Quantite, v.Montant, v.Devise, v.Troc,
                })
                .ToList();
            return this.Json(new { transactions = liste });
        }
    }
}
