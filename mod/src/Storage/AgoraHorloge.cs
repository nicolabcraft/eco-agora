namespace EcoAgora.Storage
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading;
    using Eco.Simulation.Time;
    using LiteDB;

    /// <summary>Un repere : a cet instant reel, l'horloge du monde valait tant.</summary>
    public class AgoraAncrage
    {
        public int Id { get; set; }
        public DateTime Utc { get; set; }
        public double Monde { get; set; }
    }

    /// <summary>
    /// Correspondance entre l'horloge du monde et l'heure reelle.
    ///
    /// Les statistiques d'Eco sont datees en secondes du monde. Le monde avance au
    /// rythme reel (verifie : 7,94 h reelles = 0,331 jour d'asteroide consomme), mais
    /// s'arrete quand le serveur est coupe. Une conversion par simple decalage
    /// deriverait donc de la duree de chaque redemarrage. On enregistre des reperes
    /// au demarrage puis regulierement : entre deux coupures la conversion est exacte.
    /// </summary>
    public static class AgoraHorloge
    {
        private static readonly TimeSpan Periode = TimeSpan.FromMinutes(15);
        private static Timer minuterie;

        public static ILiteCollection<AgoraAncrage> Ancrages
        {
            get
            {
                var c = AgoraDb.Database.GetCollection<AgoraAncrage>("horloge");
                c.EnsureIndex(a => a.Monde);
                return c;
            }
        }

        public static void Demarrer()
        {
            // Premier repere peu apres le demarrage : l'horloge du monde est alors chargee.
            minuterie = new Timer(_ => Noter(), null, TimeSpan.FromSeconds(20), Periode);
        }

        public static void Arreter()
        {
            minuterie?.Dispose();
            minuterie = null;
        }

        private static void Noter()
        {
            try
            {
                if (WorldTime.Paused) return; // en pause, le monde ne suit plus le temps reel
                Ancrages.Insert(new AgoraAncrage { Utc = DateTime.UtcNow, Monde = WorldTime.Seconds });
            }
            catch (Exception ex)
            {
                Console.WriteLine("[EcoAgora] horloge : " + ex.Message);
            }
        }

        /// <summary>
        /// Reperes utiles seulement : on ne garde un repere que si le decalage entre
        /// heure reelle et monde a change (coupure, pause). En pratique, un par session.
        /// </summary>
        public static List<AgoraAncrage> Utiles()
        {
            var tous = Ancrages.FindAll().OrderBy(a => a.Monde).ToList();
            var utiles = new List<AgoraAncrage>();
            double? decalage = null;
            foreach (var a in tous)
            {
                var d = (a.Utc - DateTime.UnixEpoch).TotalSeconds - a.Monde;
                if (decalage is { } prec && Math.Abs(d - prec) < 20) continue;
                decalage = d;
                utiles.Add(a);
            }
            return utiles;
        }
    }
}
