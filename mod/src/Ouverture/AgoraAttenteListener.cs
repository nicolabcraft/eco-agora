namespace EcoAgora.Ouverture
{
    using System;
    using System.Collections.Concurrent;
    using System.Linq;
    using System.Reflection;
    using Eco.Core.Utils;
    using Eco.Gameplay.Aliases;
    using Eco.Gameplay.GameActions;
    using Eco.Gameplay.Players;
    using Eco.Gameplay.Property;

    /// <summary>
    /// Refuse les actions des joueurs pendant la salle d'attente : miner, construire,
    /// fabriquer, commercer... Les administrateurs restent libres si la
    /// configuration le permet, pour preparer le monde.
    ///
    /// Independant du journal d'activite : il doit fonctionner meme si le journal
    /// est desactive.
    /// </summary>
    public class AgoraAttenteListener : IGameActionAware
    {
        private const string Refus =
            "Le serveur n'est pas encore ouvert : patience, le décompte est en cours !";

        /// <summary>Par type d'action, la propriete qui designe le joueur (ou null).</summary>
        private static readonly ConcurrentDictionary<Type, PropertyInfo> Acteurs = new();

        public LazyResult CanPerformAction(GameAction action)
        {
            try
            {
                if (action == null || !AgoraOuverture.EnAttente) return new LazyResult(Result.Succeeded);

                var user = ActeurDe(action);
                // Action du monde (croissance, simulation...) : ce n'est pas un joueur.
                if (user == null) return new LazyResult(Result.Succeeded);
                if (AgoraPlugin.Config.AdminsLibres && user.IsAdmin) return new LazyResult(Result.Succeeded);

                return new LazyResult(Result.FailLocStr(Refus));
            }
            catch
            {
                // En cas de doute, ne jamais bloquer le jeu par erreur.
                return new LazyResult(Result.Succeeded);
            }
        }

        public void ActionPerformed(GameAction action)
        {
        }

        /// <summary>Aucun contournement d'autorisation : la salle d'attente ne fait que refuser.</summary>
        public LazyResult ShouldOverrideAuth(IAlias alias, IOwned owned, GameAction action) =>
            new LazyResult(Result.FailedNoMessage);

        private static User ActeurDe(GameAction action)
        {
            var prop = Acteurs.GetOrAdd(action.GetType(), t =>
                t.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                    .FirstOrDefault(p => p.PropertyType == typeof(User) && p.GetIndexParameters().Length == 0));
            return prop?.GetValue(action) as User;
        }
    }
}
