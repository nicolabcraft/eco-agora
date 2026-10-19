namespace EcoAgora.Storage
{
    using System;
    using LiteDB;

    /// <summary>
    /// Une ligne de journal. Une ligne agregee porte Count > 1 et couvre une
    /// fenetre de temps : « 340 blocs mines entre 14h02 et 14h03 autour de X,Z ».
    /// </summary>
    public class AgoraEvent
    {
        [BsonId]
        public ObjectId Id { get; set; }

        /// <summary>Instant reel (UTC) du premier evenement de la ligne.</summary>
        public DateTime Ts { get; set; }

        /// <summary>Type normalise, par exemple action.DigOrMine ou user.login.</summary>
        public string Type { get; set; }

        public string Player { get; set; }

        public string PlayerId { get; set; }

        /// <summary>Objet, espece ou sujet de l'action.</summary>
        public string Target { get; set; }

        public string Tool { get; set; }

        public string WorldObject { get; set; }

        /// <summary>Quantite cumulee sur la ligne.</summary>
        public double Quantity { get; set; }

        /// <summary>Nombre d'actions reelles regroupees (1 si ligne unitaire).</summary>
        public int Count { get; set; } = 1;

        public int X { get; set; }

        public int Y { get; set; }

        public int Z { get; set; }

        /// <summary>Fin de la fenetre couverte, pour les lignes agregees.</summary>
        public DateTime TsEnd { get; set; }

        public string Details { get; set; }
    }

    /// <summary>Compteur par heure et par type, garde a vie : source des courbes.</summary>
    public class AgoraRollup
    {
        [BsonId]
        public string Id { get; set; }

        /// <summary>Heure UTC tronquee.</summary>
        public DateTime Hour { get; set; }

        public string Type { get; set; }

        public string Player { get; set; }

        public int Count { get; set; }

        public double Quantity { get; set; }
    }
}
