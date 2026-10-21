namespace EcoAgora.Ouverture
{
    using System;
    using System.Collections.Concurrent;
    using System.Globalization;
    using System.IO;
    using System.Linq;
    using System.Numerics;
    using System.Threading;
    using Eco.Gameplay.Disasters;
    using Eco.Gameplay.Players;
    using Eco.Gameplay.Systems;
    using Eco.Shared.Services;
    using Eco.Simulation.Time;
    using EcoAgora.Storage;

    /// <summary>
    /// Salle d'attente avant l'ouverture du serveur.
    ///
    /// Avant l'heure : le monde tourne (une pause d'Eco masquerait le chat, donc le
    /// decompte), mais les joueurs sont ramenes a leur place s'ils s'eloignent et
    /// leurs actions sont refusees ; un decompte leur est annonce en jeu. A l'heure
    /// dite : tout se debloque, l'asteroide est recale pour frapper exactement 60
    /// jours plus tard, et un message annonce l'ouverture.
    ///
    /// Eco n'offre aucune fonction pour figer un joueur : la retenue passe par
    /// Player.SetPosition. L'ouverture n'a lieu qu'une fois : un fichier temoin
    /// empeche qu'un redemarrage ulterieur remette le monde en pause, ou retire une
    /// pause decidee plus tard par un administrateur.
    /// </summary>
    public static class AgoraOuverture
    {
        private static readonly int[] PaliersMinutes = { 60, 30, 15, 10, 5, 3, 2, 1 };
        private static readonly int[] PaliersSecondes = { 30, 10, 5, 4, 3, 2, 1 };
        // Le runtime d'Eco n'active pas le mode de globalisation invariante (verifie),
        // mais une culture manquante ne doit jamais faire tomber le mod.

        private static readonly ConcurrentDictionary<User, Vector3> Ancrages = new();
        private static Timer horloge;
        private static int dernierPalier = int.MaxValue;
        private static int ouvertureEnCours;
        private static volatile bool ouverte;

        private static string Temoin => Path.Combine(
            Path.GetDirectoryName(AgoraDb.DatabasePath) ?? ".", "ouverture-faite.marker");

        /// <summary>Instant d'ouverture configure, ou null si la date est illisible.</summary>
        public static DateTimeOffset? Ouverture =>
            DateTimeOffset.TryParse(AgoraPlugin.Config.OuvertureDate, CultureInfo.InvariantCulture, DateTimeStyles.None, out var d)
                ? d
                : null;

        /// <summary>Vrai tant que la salle d'attente s'applique.</summary>
        public static bool EnAttente
        {
            get
            {
                if (ouverte || !AgoraPlugin.Config.SalleAttenteActive) return false;
                var o = Ouverture;
                return o.HasValue && DateTimeOffset.UtcNow < o.Value;
            }
        }

        public static TimeSpan Restant =>
            Ouverture is { } o ? (o - DateTimeOffset.UtcNow) : TimeSpan.Zero;

        public static void Demarrer()
        {
            if (!AgoraPlugin.Config.SalleAttenteActive) return;
            ouverte = File.Exists(Temoin);
            if (ouverte)
            {
                Console.WriteLine("[EcoAgora] ouverture deja faite : salle d'attente inactive");
                return;
            }

            if (Ouverture == null)
            {
                Console.WriteLine($"[EcoAgora] date d'ouverture illisible ({AgoraPlugin.Config.OuvertureDate}) : salle d'attente inactive");
                return;
            }

            // Un monde en pause masque le chat : personne ne verrait le decompte.
            if (EnAttente) LeverPause();

            UserManager.OnUserLoggedIn.Add(Accueillir);
            horloge = new Timer(_ => Battre(), null, 1000, 1000);
            Console.WriteLine($"[EcoAgora] salle d'attente {(EnAttente ? "active" : "prete")}, ouverture {Quand()}");
        }

        public static void Arreter()
        {
            horloge?.Dispose();
            horloge = null;
        }

        /// <summary>Resume pour la ligne d'etat du greffon.</summary>
        public static string Etat()
        {
            if (ouverte) return "serveur ouvert";
            if (!AgoraPlugin.Config.SalleAttenteActive) return "salle d'attente desactivee";
            return EnAttente ? $"salle d'attente, ouverture dans {Duree(Restant)}" : "ouverture imminente";
        }

        // --- Boucle ---------------------------------------------------------------

        private static void Battre()
        {
            try
            {
                if (ouverte) return;
                if (!EnAttente)
                {
                    Ouvrir();
                    return;
                }

                Annoncer(Restant);
                Retenir();
            }
            catch (Exception ex)
            {
                Console.WriteLine("[EcoAgora] salle d'attente : " + ex.Message);
            }
        }

        private static void Annoncer(TimeSpan restant)
        {
            var secondes = (int)Math.Ceiling(restant.TotalSeconds);

            // Le plus petit palier atteint, pour n'annoncer chacun qu'une fois.
            int? palier = null;
            foreach (var m in PaliersMinutes) if (secondes <= m * 60) palier = m * 60;
            foreach (var s in PaliersSecondes) if (secondes <= s) palier = s;
            if (palier is not { } p || p >= dernierPalier) return;
            dernierPalier = p;

            // Le temps reel restant, pas le palier : un serveur demarre a 18 h 02
            // annoncerait sinon « dans 1 h 00 » au lieu de 58 min.
            var style = p >= 60 ? NotificationStyle.InfoBox : NotificationStyle.Info;
            ATous((user, s) => AnnoncerDecompte(user, restant, s), style);
        }

        private static void Retenir()
        {
            var rayon = AgoraPlugin.Config.RayonAttente;
            if (rayon <= 0) return;

            foreach (var user in EnLigne())
            {
                try
                {
                    if (Libre(user) || user.Player == null) continue;

                    // Un nouveau joueur choisit d'abord son point d'apparition : on ne
                    // le retient qu'une fois dans le monde.
                    if (!user.SpawnPointSelected) continue;

                    var ici = user.Position;
                    var ancre = Ancrages.GetOrAdd(user, ici);

                    // Distance horizontale : on ne lutte pas contre la gravite.
                    var dx = ici.X - ancre.X;
                    var dz = ici.Z - ancre.Z;
                    if ((dx * dx) + (dz * dz) > rayon * rayon)
                    {
                        user.Player.SetPosition(ancre);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[EcoAgora] retenue de {user?.Name} : {ex.Message}");
                }
            }
        }

        private static void Accueillir(User user)
        {
            try
            {
                if (!EnAttente || user == null) return;
                user.MsgLoc(
                    $"Welcome! The server opens on {Quand()}. Until then, stay where you are: the game starts for everyone at the same time.",
                    NotificationStyle.InfoBox);
                AnnoncerDecompte(user, Restant, NotificationStyle.Info);
            }
            catch (Exception ex)
            {
                Console.WriteLine("[EcoAgora] accueil : " + ex.Message);
            }
        }

        // --- Ouverture ------------------------------------------------------------

        private static void Ouvrir()
        {
            // Plusieurs battements peuvent se chevaucher : une seule ouverture.
            if (Interlocked.Exchange(ref ouvertureEnCours, 1) == 1) return;

            try
            {
                if (AgoraPlugin.Config.RecalerAsteroideAOuverture) RecalerAsteroide();
                Ancrages.Clear();
                ouverte = true;
                File.WriteAllText(Temoin, DateTimeOffset.UtcNow.ToString("o"));

                ATous((user, s) => user.MsgLocStr("Here we go! The server is open. Destroy the meteor before it strikes: have a great game, everyone!", s),
                    NotificationStyle.InfoBox);
                Console.WriteLine("[EcoAgora] OUVERTURE du serveur");
            }
            catch (Exception ex)
            {
                // On laissera le battement suivant retenter.
                Interlocked.Exchange(ref ouvertureEnCours, 0);
                Console.WriteLine("[EcoAgora] ouverture : " + ex.Message);
            }
        }

        private static void LeverPause()
        {
            var pause = PauseManager.Obj;
            if (pause == null || !pause.Paused) return;
            pause.Unpause();
            Console.WriteLine($"[EcoAgora] pause levee pour garder le chat visible (etat : {(pause.Paused ? "TOUJOURS en pause" : "en marche")})");
        }

        /// <summary>Duree de base de l'asteroide (reglage de difficulte), en secondes du monde.</summary>
        public static double DureeAsteroide()
        {
            var d = DisasterPlugin.MeteorData;
            return d == null ? 0 : d.ImpactTime - d.MeteorCreationTime - d.MeteorExtraTime;
        }

        /// <summary>
        /// Impact = creation + duree + MeteorExtraTime (lu dans le code d'Eco). On passe
        /// par DisasterPlugin.AddHours / RemoveHours, les commandes d'Eco elles-memes :
        /// elles mettent a jour l'asteroide visible et enregistrent le changement.
        /// </summary>
        private static void RecalerAsteroide()
        {
            var d = DisasterPlugin.MeteorData;
            if (d == null || d.MeteorDestroyed || d.MeteorImpacted) return;

            var cible = WorldTime.Seconds + DureeAsteroide();
            var ecart = cible - d.ImpactTime;
            if (Math.Abs(ecart) >= 1)
            {
                var heures = (float)(Math.Abs(ecart) / 3600d);
                if (ecart > 0) DisasterPlugin.AddHours(null, heures);
                else DisasterPlugin.RemoveHours(null, heures);
            }

            var restant = d.ImpactTime - WorldTime.Seconds;
            Console.WriteLine($"[EcoAgora] asteroide recale : impact dans {restant / 86400d:0.0000} jours");
        }

        // --- Outils ---------------------------------------------------------------

        private static bool Libre(User user) => AgoraPlugin.Config.AdminsLibres && user.IsAdmin;

        private static User[] EnLigne() => UserManager.Users.Where(u => u != null && u.IsOnline).ToArray();

        /// <summary>
        /// Message a tous les joueurs connectes, chacun dans sa langue : `envoyer`
        /// recoit le joueur et le style, le texte est traduit par Eco a l'envoi. Hors chat, le
        /// message est aussi repete dans le chat, ou il reste lisible.
        /// </summary>
        private static void ATous(Action<User, NotificationStyle> envoyer, NotificationStyle style)
        {
            foreach (var user in EnLigne())
            {
                try
                {
                    envoyer(user, style);
                    if (style != NotificationStyle.Chat) envoyer(user, NotificationStyle.Chat);
                }
                catch
                {
                    // Un joueur qui se deconnecte a cet instant ne doit pas bloquer les autres.
                }
            }
        }

        /// <summary>Date d'ouverture, neutre (lisible dans toutes les langues) : « 2026-09-30 19:00 (UTC+02:00) ».</summary>
        private static string Quand()
        {
            if (Ouverture is not { } o) return "?";
            var decalage = o.Offset;
            var signe = decalage < TimeSpan.Zero ? "-" : "+";
            return $"{o:yyyy-MM-dd HH:mm} (UTC{signe}{decalage:hh\\:mm})";
        }

        /// <summary>Duree courte et neutre pour la ligne d'etat du greffon (administrateurs).</summary>
        private static string Duree(TimeSpan t) =>
            t <= TimeSpan.Zero ? "0" : t.TotalHours < 24 ? t.ToString(@"hh\:mm\:ss") : $"{(int)t.TotalDays}d {t.Hours}h";

        /// <summary>
        /// « Ouverture dans ... » : un modele par ordre de grandeur, pour que les
        /// unites se traduisent avec le reste de la phrase.
        /// </summary>
        private static void AnnoncerDecompte(User user, TimeSpan t, NotificationStyle style)
        {
            if (t <= TimeSpan.Zero) user.MsgLocStr("The server opens in a few moments.", style);
            else if (t.TotalSeconds < 60) user.MsgLoc($"The server opens in {(int)Math.Ceiling(t.TotalSeconds)} s.", style);
            else if (t.TotalMinutes < 60) user.MsgLoc($"The server opens in {(int)Math.Ceiling(t.TotalMinutes)} min.", style);
            else if (t.TotalHours < 24) user.MsgLoc($"The server opens in {(int)t.TotalHours} h {t.Minutes:00}.", style);
            else user.MsgLoc($"The server opens in {(int)t.TotalDays} d {t.Hours} h.", style);
        }
    }
}
