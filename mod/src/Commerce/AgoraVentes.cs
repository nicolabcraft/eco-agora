namespace EcoAgora.Commerce
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading.Tasks;
    using Eco.Core.Utils;
    using Eco.Gameplay.Aliases;
    using Eco.Gameplay.GameActions;
    using Eco.Gameplay.Property;
    using Eco.Simulation.Time;
    using EcoAgora.Storage;
    using LiteDB;

    /// <summary>Une transaction de boutique.</summary>
    public class AgoraVente
    {
        public ObjectId Id { get; set; }
        public DateTime Ts { get; set; }
        public double Monde { get; set; }
        public string Acheteur { get; set; }
        public string Vendeur { get; set; }
        public string Proprietaire { get; set; }
        /// <summary>ObjectID de la boutique : le meme identifiant que EcoMarketApi.</summary>
        public string BoutiqueId { get; set; }
        public string Boutique { get; set; }
        public string Objet { get; set; }
        public string Etiquette { get; set; }
        public double Quantite { get; set; }
        public double Montant { get; set; }
        public string Devise { get; set; }
        public bool Troc { get; set; }
    }

    /// <summary>
    /// Enregistre chaque transaction de boutique.
    ///
    /// Eco emet une action CurrencyTrade (ou BarterTrade pour le troc) a chaque achat
    /// ou vente, avec l'acheteur, le vendeur, la boutique, l'objet, la quantite et le
    /// montant. Le journal d'activite ne gardait ni le montant ni la devise : sans ce
    /// releve, impossible de savoir qui a depense combien.
    ///
    /// Les transactions sont rares a l'echelle du jeu ; l'ecriture part neanmoins sur
    /// un fil a part pour ne jamais toucher au disque depuis la boucle de jeu.
    /// </summary>
    public class AgoraVentes : IGameActionAware
    {
        public static ILiteCollection<AgoraVente> Collection
        {
            get
            {
                var c = AgoraDb.Database.GetCollection<AgoraVente>("ventes");
                c.EnsureIndex(v => v.Ts);
                c.EnsureIndex(v => v.BoutiqueId);
                c.EnsureIndex(v => v.Acheteur);
                return c;
            }
        }

        public LazyResult CanPerformAction(GameAction action) => new LazyResult(Result.Succeeded);

        public LazyResult ShouldOverrideAuth(IAlias alias, IOwned owned, GameAction action) =>
            new LazyResult(Result.FailedNoMessage);

        public void ActionPerformed(GameAction action)
        {
            if (action is not TradeAction t || t.DryRun) return;
            try
            {
                var vente = new AgoraVente
                {
                    Ts = DateTime.UtcNow,
                    Monde = WorldTime.Seconds,
                    Acheteur = t.Buyer?.Name,
                    Vendeur = t.Seller?.Name,
                    Proprietaire = t.ShopOwner?.Name,
                    BoutiqueId = t.WorldObject?.ObjectID.ToString(),
                    Boutique = t.WorldObject?.Name,
                    Objet = t.ItemUsed?.DisplayName.ToString() ?? t.ItemUsed?.Name,
                    Etiquette = t.TagUsed?.DisplayName.ToString(),
                    Quantite = t.NumberOfItems,
                    Troc = action is BarterTrade,
                };
                if (action is CurrencyTrade c)
                {
                    vente.Montant = c.CurrencyAmount;
                    vente.Devise = c.Currency?.Name;
                }

                _ = Task.Run(() =>
                {
                    try { Collection.Insert(vente); }
                    catch (Exception ex) { Console.WriteLine("[EcoAgora] ventes : " + ex.Message); }
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine("[EcoAgora] ventes : " + ex.Message);
            }
        }

        /// <summary>Transactions depuis une date (UTC), ou toutes.</summary>
        public static List<AgoraVente> Depuis(DateTime? depuis) =>
            (depuis is { } d ? Collection.Find(v => v.Ts >= d) : Collection.FindAll()).ToList();
    }
}
