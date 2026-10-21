namespace EcoAgora
{
    using System.ComponentModel;

    /// <summary>
    /// Reglages du mod, modifiables depuis l'interface de configuration du serveur.
    /// Descriptions en anglais, traduites par Eco (translations/EcoAgora.csv).
    /// </summary>
    public class AgoraConfig
    {
        [Description("Log player activity.")]
        public bool AuditEnabled { get; set; } = true;

        [Description("Number of days raw events are kept and searchable.")]
        public int RetentionDays { get; set; } = 30;

        [Description("Aggregation window for repetitive actions, in seconds.")]
        public int AggregationWindowSeconds { get; set; } = 60;

        [Description("Size of aggregation zones, in blocks.")]
        public int AggregationZoneSize { get; set; } = 16;

        [Description("Aggregated action types, comma separated. Empty = default list.")]
        public string AggregatedActions { get; set; } = string.Empty;

        [Description("Players tracked in detail despite aggregation, comma separated.")]
        public string DetailedPlayers { get; set; } = string.Empty;

        [Description("Write a daily archive before purging.")]
        public bool ArchiveBeforePurge { get; set; } = true;

        // --- Salle d'attente avant l'ouverture ---

        [Description("Waiting room: before opening, players can join but can neither move nor act. Requires an opening date.")]
        public bool SalleAttenteActive { get; set; } = false;

        [Description("Opening date and time, with time zone offset (e.g. 2026-09-30T19:00:00+02:00).")]
        public string OuvertureDate { get; set; } = string.Empty;

        [Description("At opening, realign the meteor: impact happens exactly the configured duration (difficulty setting) after the opening time, even if the world ran before. The world is not paused: chat stays visible while waiting.")]
        public bool RecalerAsteroideAOuverture { get; set; } = true;

        [Description("Allowed distance, in blocks, before a waiting player is moved back. 0 = no restriction.")]
        public float RayonAttente { get; set; } = 2f;

        [Description("Admins can move and act while waiting, to prepare the world.")]
        public bool AdminsLibres { get; set; } = true;
    }
}
