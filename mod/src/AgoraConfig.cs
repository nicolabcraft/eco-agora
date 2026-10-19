namespace EcoAgora
{
    using System.ComponentModel;

    /// <summary>
    /// Reglages du mod, modifiables depuis l'interface de configuration du serveur.
    /// </summary>
    public class AgoraConfig
    {
        [Description("Journaliser l'activite des joueurs.")]
        public bool AuditEnabled { get; set; } = true;

        [Description("Nombre de jours d'evenements bruts conserves et interrogeables.")]
        public int RetentionDays { get; set; } = 30;

        [Description("Fenetre d'agregation des actions repetitives, en secondes.")]
        public int AggregationWindowSeconds { get; set; } = 60;

        [Description("Taille des zones d'agregation, en blocs.")]
        public int AggregationZoneSize { get; set; } = 16;

        [Description("Types d'actions agregees, separes par des virgules. Vide = liste par defaut.")]
        public string AggregatedActions { get; set; } = string.Empty;

        [Description("Joueurs suivis en detail malgre l'agregation, separes par des virgules.")]
        public string DetailedPlayers { get; set; } = string.Empty;

        [Description("Ecrire une archive quotidienne avant la purge.")]
        public bool ArchiveBeforePurge { get; set; } = true;

        // --- Salle d'attente avant l'ouverture ---

        [Description("Salle d'attente : avant l'ouverture, les joueurs peuvent se connecter mais ni bouger ni agir. Necessite une date d'ouverture.")]
        public bool SalleAttenteActive { get; set; } = false;

        [Description("Date et heure d'ouverture, avec decalage horaire (ex. 2026-09-30T19:00:00+02:00).")]
        public string OuvertureDate { get; set; } = string.Empty;

        [Description("A l'ouverture, recaler l'asteroide : l'impact tombe exactement 60 jours (duree du reglage de difficulte) apres l'heure d'ouverture, meme si le monde a tourne avant. Le monde n'est pas mis en pause : le chat reste visible pendant l'attente.")]
        public bool RecalerAsteroideAOuverture { get; set; } = true;

        [Description("Distance toleree, en blocs, avant qu'un joueur en attente soit ramene a sa place. 0 = aucune retenue.")]
        public float RayonAttente { get; set; } = 2f;

        [Description("Les administrateurs sont libres de bouger et d'agir pendant l'attente, pour preparer le monde.")]
        public bool AdminsLibres { get; set; } = true;
    }
}
