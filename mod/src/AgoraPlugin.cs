namespace EcoAgora
{
    using System;
    using Eco.Core.Plugins;
    using Eco.Core.Plugins.Interfaces;
    using Eco.Core.Utils;
    using Eco.Shared.Utils;
    using Eco.Gameplay.GameActions;
    using EcoAgora.Audit;
    using EcoAgora.Commerce;
    using EcoAgora.Ouverture;
    using EcoAgora.Storage;

    /// <summary>
    /// Point d'entree d'Eco Agora : ouvre la base, branche les releves (journal,
    /// ventes, horloge, connectes) et expose l'API du panel sous /api/agora.
    /// </summary>
    public class AgoraPlugin : IModKitPlugin, IInitializablePlugin, IShutdownablePlugin, IServerPlugin,
        IConfigurablePlugin
    {
        public const string Version = "1.0.0";

        private static PluginConfig<AgoraConfig> configHolder;
        private static AgoraActionListener listener;

        /// <summary>Reglages courants, accessibles depuis tout le mod.</summary>
        public static AgoraConfig Config => configHolder?.Config ?? new AgoraConfig();

        public IPluginConfig PluginConfig => configHolder;

        public object GetEditObject() => configHolder?.Config;

        public void OnEditObjectChanged(object o, string param) => this.SaveConfig();

        /// <summary>Exigee par IEditablePlugin : notification de changement de reglage.</summary>
        public ThreadSafeAction<object, string> ParamChanged { get; set; } =
            new ThreadSafeAction<object, string>();

        private string status = "Non initialise";
        private bool ready;

        public string GetCategory() => "Eco Agora";

        /// <summary>
        /// Compte les annonces a chaque lecture : une valeur figee au demarrage
        /// devient fausse des la premiere publication.
        /// </summary>
        public string GetStatus()
        {
            if (!this.ready) return this.status;
            try
            {
                return $"Pret - {AgoraDb.Annonces.Count()} annonce(s) - {AgoraOuverture.Etat()} - API /api/agora";
            }
            catch (Exception e)
            {
                return "Base illisible : " + e.Message;
            }
        }

        public void Initialize(TimedTask timer)
        {
            try
            {
                configHolder = new PluginConfig<AgoraConfig>("EcoAgora");
                var annonces = AgoraDb.Annonces.Count();

                if (Config.AuditEnabled)
                {
                    listener = new AgoraActionListener();
                    ActionUtil.Listeners.Add(listener);
                    AgoraWriter.Start();
                    Console.WriteLine("[EcoAgora] journal d'activite actif");
                }

                // Salle d'attente : branchee meme si le journal est coupe. Isolee : une
                // panne ici ne doit pas empecher le reste du mod de demarrer.
                try
                {
                    ActionUtil.Listeners.Add(new AgoraAttenteListener());
                    // Transactions de boutique : independant du journal, comme la salle d'attente.
                    ActionUtil.Listeners.Add(new AgoraVentes());
                    AgoraOuverture.Demarrer();
                    AgoraHorloge.Demarrer();
                    AgoraConnectes.Demarrer();
                }
                catch (Exception e)
                {
                    Console.WriteLine("[EcoAgora] salle d'attente indisponible : " + e.Message);
                }

                // Premier releve economique : le panel a des donnees des le demarrage.
                if (EcoAgora.Economy.AgoraEconomySampler.Latest() == null)
                {
                    EcoAgora.Economy.AgoraEconomySampler.Sample();
                }

                this.ready = true;
                this.status = $"Pret - {annonces} annonce(s) - API /api/agora";
                Console.WriteLine($"[EcoAgora] mod {Version} initialise ({AgoraDb.DatabasePath})");
            }
            catch (Exception e)
            {
                this.status = "Erreur : " + e.Message;
                Console.WriteLine($"[EcoAgora] initialisation en echec : {e}");
            }
        }

        public System.Threading.Tasks.Task ShutdownAsync()
        {
            if (listener != null)
            {
                try { ActionUtil.Listeners.Remove(listener); } catch { /* deja retire */ }
                listener = null;
            }

            // On vide le tampon d'agregation puis la file avant de fermer la base.
            AgoraActionListener.FlushBuffer();
            AgoraOuverture.Arreter();
            AgoraHorloge.Arreter();
            AgoraConnectes.Arreter();
            AgoraWriter.Stop();
            AgoraDb.Close();
            this.ready = false;
            this.status = "Arrete";
            return System.Threading.Tasks.Task.CompletedTask;
        }
    }
}
