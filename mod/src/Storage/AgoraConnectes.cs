namespace EcoAgora.Storage
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using System.Threading.Tasks;
    using Eco.Gameplay.Players;
    using Eco.Simulation.Time;
    using LiteDB;

    /// <summary>Nombre de joueurs connectes a un instant du monde.</summary>
    public class AgoraConnectesPoint
    {
        public int Id { get; set; }
        /// <summary>Horloge du monde, en secondes : meme axe que les statistiques d'Eco.</summary>
        public double Monde { get; set; }
        public int EnLigne { get; set; }
    }

    /// <summary>
    /// Historique des joueurs connectes.
    ///
    /// Eco n'enregistre pas ce chiffre (ses 216 statistiques ont la population et les
    /// citoyens « actifs », pas les connectes a un instant donne). On le releve a
    /// chaque connexion ou deconnexion, et toutes les 2 minutes pour que les periodes
    /// calmes aient aussi des points. Date sur l'horloge du monde pour se superposer
    /// exactement aux courbes d'Eco.
    /// </summary>
    public static class AgoraConnectes
    {
        private static Timer minuterie;

        public static ILiteCollection<AgoraConnectesPoint> Points
        {
            get
            {
                var c = AgoraDb.Database.GetCollection<AgoraConnectesPoint>("connectes");
                c.EnsureIndex(p => p.Monde);
                return c;
            }
        }

        public static void Demarrer()
        {
            // Au moment de l'evenement, le joueur n'est pas forcement encore compte (ou
            // plus compte) en ligne : on releve 2 secondes plus tard.
            UserManager.OnUserLoggedIn.Add(_ => PlusTard());
            UserManager.OnUserLoggedOut.Add(_ => PlusTard());
            minuterie = new Timer(_ => Noter(), null, TimeSpan.FromSeconds(25), TimeSpan.FromMinutes(2));
        }

        public static void Arreter()
        {
            minuterie?.Dispose();
            minuterie = null;
        }

        private static void PlusTard() => _ = Task.Delay(2000).ContinueWith(_ => Noter());

        private static void Noter()
        {
            try
            {
                if (WorldTime.Paused) return;
                var n = UserManager.Users.Count(u => u != null && u.IsOnline);
                Points.Insert(new AgoraConnectesPoint { Monde = WorldTime.Seconds, EnLigne = n });
            }
            catch (Exception ex)
            {
                Console.WriteLine("[EcoAgora] connectes : " + ex.Message);
            }
        }

        /// <summary>
        /// Points entre deux instants du monde (en jours, comme /datasets). Au-dela de
        /// <paramref name="maxPoints"/>, on regroupe par intervalles en gardant le
        /// maximum : un pic de connexions ne disparait pas.
        /// </summary>
        public static List<AgoraConnectesPoint> Entre(double debutJours, double finJours, int maxPoints = 600)
        {
            var debut = debutJours * 86400d;
            var fin = finJours * 86400d;
            var points = Points.Find(p => p.Monde >= debut && p.Monde <= fin).OrderBy(p => p.Monde).ToList();
            if (points.Count <= maxPoints || fin <= debut) return points;

            var pas = (fin - debut) / maxPoints;
            return points
                .GroupBy(p => (int)((p.Monde - debut) / pas))
                .Select(g => new AgoraConnectesPoint { Monde = g.Max(p => p.Monde), EnLigne = g.Max(p => p.EnLigne) })
                .OrderBy(p => p.Monde)
                .ToList();
        }
    }
}
